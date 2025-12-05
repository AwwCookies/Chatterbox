import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Link2, ExternalLink, X, User, Users, Play, Music2, Video, 
  TrendingUp, Clock, Hash, Filter, Search, Grid, List,
  ChevronDown, ChevronUp, Globe, Image, UserX, Settings
} from 'lucide-react';
import { useProfileCardStore } from '../../stores/profileCardStore';
import { useChannelSettingsStore } from '../../stores/channelSettingsStore';
import { formatRelative, formatNumber } from '../../utils/formatters';
import LoadingSpinner from '../common/LoadingSpinner';

// URL regex pattern
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

// API base for link previews
const API_BASE = import.meta.env.VITE_API_URL || '';

// Platform config
const PLATFORM_CONFIG = {
  youtube: {
    color: 'border-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    hoverBg: 'hover:bg-red-500/20',
    icon: Play,
    name: 'YouTube',
  },
  tiktok: {
    color: 'border-pink-500',
    bgColor: 'bg-gradient-to-r from-cyan-500/10 to-pink-500/10',
    textColor: 'text-pink-400',
    hoverBg: 'hover:bg-pink-500/20',
    icon: Music2,
    name: 'TikTok',
  },
  twitter: {
    color: 'border-blue-400',
    bgColor: 'bg-blue-400/10',
    textColor: 'text-blue-400',
    hoverBg: 'hover:bg-blue-400/20',
    icon: null,
    name: 'X',
  },
  twitch: {
    color: 'border-purple-500',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-400',
    hoverBg: 'hover:bg-purple-500/20',
    icon: Video,
    name: 'Twitch',
  },
  instagram: {
    color: 'border-pink-400',
    bgColor: 'bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10',
    textColor: 'text-pink-400',
    hoverBg: 'hover:bg-pink-500/20',
    icon: Image,
    name: 'Instagram',
  },
  reddit: {
    color: 'border-orange-500',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    hoverBg: 'hover:bg-orange-500/20',
    icon: null,
    name: 'Reddit',
  },
  '7tv': {
    color: 'border-[#4FC2BC]',
    bgColor: 'bg-[#4FC2BC]/10',
    textColor: 'text-[#4FC2BC]',
    hoverBg: 'hover:bg-[#4FC2BC]/20',
    icon: null,
    name: '7TV',
  },
  generic: {
    color: 'border-gray-600',
    bgColor: 'bg-gray-700/30',
    textColor: 'text-gray-400',
    hoverBg: 'hover:bg-gray-700/50',
    icon: Globe,
    name: null,
  },
};

function detectPlatform(url) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('tiktok.com')) return 'tiktok';
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter';
  if (lowerUrl.includes('twitch.tv')) return 'twitch';
  if (lowerUrl.includes('instagram.com')) return 'instagram';
  if (lowerUrl.includes('reddit.com')) return 'reddit';
  if (lowerUrl.includes('7tv.app')) return '7tv';
  return 'generic';
}

// Extract 7TV emote ID from URL
function extract7TVEmoteId(url) {
  const match = url.match(/7tv\.app\/emotes\/([A-Za-z0-9]+)/);
  return match ? match[1] : null;
}

// Custom hook for fetching link preview data (handles 7TV and generic links)
function useLinkPreview(url, platform) {
  const emoteId = platform === '7tv' ? extract7TVEmoteId(url) : null;
  
  return useQuery({
    queryKey: platform === '7tv' && emoteId ? ['7tv-emote', emoteId] : ['link-preview', url],
    queryFn: async () => {
      if (platform === '7tv' && emoteId) {
        const res = await fetch(`https://7tv.io/v3/emotes/${emoteId}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        // Transform to match preview format
        const emoteFile = data?.host?.files?.find(f => f.name === '4x.webp') 
          || data?.host?.files?.find(f => f.name === '4x.png')
          || data?.host?.files?.find(f => f.name === '3x.webp')
          || data?.host?.files?.[0];
        const imageUrl = emoteFile ? `https:${data.host.url}/${emoteFile.name}` : null;
        return {
          title: data.name,
          description: data.animated ? 'Animated Emote' : 'Emote',
          image: imageUrl,
          author: data.owner?.display_name || data.owner?.username,
          siteName: '7TV',
          is7TVEmote: true,
          animated: data.animated,
        };
      }
      const res = await fetch(`${API_BASE}/api/utils/link-preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

function LinksTab({ messages = [], isLoading, totalCount, channelName }) {
  const { getChannelSettings, excludeUserFromLinks } = useChannelSettingsStore();
  const channelSettings = channelName ? getChannelSettings(channelName) : {};
  
  // Initialize from channel settings
  const [sortBy, setSortBy] = useState(channelSettings.defaultLinkSort || 'count');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(channelSettings.defaultLinkView || 'grid');
  const [expandedLink, setExpandedLink] = useState(null);
  const openProfileCard = useProfileCardStore(state => state.openCard);

  // Update view mode when settings change
  useEffect(() => {
    if (channelSettings.defaultLinkView) {
      setViewMode(channelSettings.defaultLinkView);
    }
    if (channelSettings.defaultLinkSort) {
      setSortBy(channelSettings.defaultLinkSort);
    }
  }, [channelSettings.defaultLinkView, channelSettings.defaultLinkSort]);

  // Extract and aggregate links from messages
  const aggregatedLinks = useMemo(() => {
    const linkMap = new Map();
    const excludedUsers = channelSettings.excludedUsers || [];
    const excludedPlatforms = channelSettings.excludedPlatforms || [];

    for (const msg of messages) {
      // Skip excluded users
      if (excludedUsers.includes(msg.username?.toLowerCase())) {
        continue;
      }
      
      const text = msg.message_text || msg.messageText || '';
      const urls = text.match(URL_REGEX) || [];
      
      for (const url of urls) {
        const normalizedUrl = url.replace(/\/$/, '').toLowerCase();
        const platform = detectPlatform(url);
        
        // Skip excluded platforms
        if (excludedPlatforms.includes(platform)) {
          continue;
        }
        
        const userInfo = {
          username: msg.username,
          displayName: msg.user_display_name || msg.username,
          timestamp: msg.timestamp,
          messageId: msg.id,
          messageText: text,
        };
        
        if (linkMap.has(normalizedUrl)) {
          const existing = linkMap.get(normalizedUrl);
          existing.count++;
          existing.lastSeen = userInfo.timestamp;
          // Add user if not already present
          if (!existing.users.some(u => u.username === userInfo.username)) {
            existing.users.push(userInfo);
          }
          // Track all message contexts
          existing.messages.push(userInfo);
        } else {
          linkMap.set(normalizedUrl, {
            url,
            normalizedUrl,
            platform,
            users: [userInfo],
            messages: [userInfo],
            count: 1,
            firstSeen: userInfo.timestamp,
            lastSeen: userInfo.timestamp,
          });
        }
      }
    }

    return Array.from(linkMap.values());
  }, [messages, channelSettings.excludedUsers, channelSettings.excludedPlatforms]);

  // Filter and sort links
  const filteredLinks = useMemo(() => {
    let result = [...aggregatedLinks];
    const minShares = channelSettings.minLinkShares || 1;
    
    // Filter by minimum shares
    if (minShares > 1) {
      result = result.filter(link => link.count >= minShares);
    }
    
    // Filter by platform
    if (filterPlatform !== 'all') {
      result = result.filter(link => link.platform === filterPlatform);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(link => 
        link.url.toLowerCase().includes(query) ||
        link.users.some(u => u.displayName.toLowerCase().includes(query))
      );
    }
    
    // Sort
    switch (sortBy) {
      case 'count':
        result.sort((a, b) => b.count - a.count);
        break;
      case 'recent':
        result.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
        break;
      case 'users':
        result.sort((a, b) => b.users.length - a.users.length);
        break;
    }
    
    return result;
  }, [aggregatedLinks, filterPlatform, searchQuery, sortBy, channelSettings.minLinkShares]);

  // Platform stats for filter badges
  const platformStats = useMemo(() => {
    const stats = {};
    for (const link of aggregatedLinks) {
      stats[link.platform] = (stats[link.platform] || 0) + 1;
    }
    return stats;
  }, [aggregatedLinks]);

  // Total unique links and shares
  const totalUniqueLinks = aggregatedLinks.length;
  const totalShares = aggregatedLinks.reduce((sum, l) => sum + l.count, 0);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{formatNumber(totalUniqueLinks)}</div>
          <div className="text-xs text-gray-400">Unique Links</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-blue-400">{formatNumber(totalShares)}</div>
          <div className="text-xs text-gray-400">Total Shares</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">
            {aggregatedLinks.filter(l => l.users.length > 1).length}
          </div>
          <div className="text-xs text-gray-400">Multi-User Links</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-purple-400">
            {Object.keys(platformStats).length}
          </div>
          <div className="text-xs text-gray-400">Platforms</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search links or users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setSortBy('count')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              sortBy === 'count' 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Popular
          </button>
          <button
            onClick={() => setSortBy('recent')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              sortBy === 'recent' 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Recent
          </button>
          <button
            onClick={() => setSortBy('users')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              sortBy === 'users' 
                ? 'bg-blue-500/20 text-blue-400' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Users
          </button>
        </div>

        {/* View Mode */}
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'grid' 
                ? 'bg-gray-700 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded transition-colors ${
              viewMode === 'list' 
                ? 'bg-gray-700 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Platform Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterPlatform('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            filterPlatform === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
          }`}
        >
          All ({totalUniqueLinks})
        </button>
        {Object.entries(platformStats).map(([platform, count]) => {
          const config = PLATFORM_CONFIG[platform];
          return (
            <button
              key={platform}
              onClick={() => setFilterPlatform(platform)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterPlatform === platform
                  ? `${config.bgColor} ${config.textColor} ring-1 ring-current`
                  : `bg-gray-800 text-gray-400 hover:${config.textColor}`
              }`}
            >
              <PlatformIcon platform={platform} size={12} />
              {config.name || platform} ({count})
            </button>
          );
        })}
      </div>

      {/* Links Display */}
      {filteredLinks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No links found</p>
          {searchQuery && <p className="text-sm mt-1">Try adjusting your search</p>}
          {(channelSettings.excludedUsers?.length > 0 || channelSettings.excludedPlatforms?.length > 0) && (
            <p className="text-sm mt-1 text-yellow-500/70">
              Some links may be hidden by your settings
            </p>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredLinks.map((link, idx) => (
            <LinkCard 
              key={link.normalizedUrl} 
              link={link} 
              rank={sortBy === 'count' ? idx + 1 : null}
              isExpanded={expandedLink === link.normalizedUrl}
              onToggleExpand={() => setExpandedLink(
                expandedLink === link.normalizedUrl ? null : link.normalizedUrl
              )}
              openProfileCard={openProfileCard}
              channelName={channelName}
              onExcludeUser={excludeUserFromLinks}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLinks.map((link, idx) => (
            <LinkListItem 
              key={link.normalizedUrl} 
              link={link}
              rank={sortBy === 'count' ? idx + 1 : null}
              isExpanded={expandedLink === link.normalizedUrl}
              onToggleExpand={() => setExpandedLink(
                expandedLink === link.normalizedUrl ? null : link.normalizedUrl
              )}
              openProfileCard={openProfileCard}
              channelName={channelName}
              onExcludeUser={excludeUserFromLinks}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PlatformIcon({ platform, size = 16, className = '' }) {
  const config = PLATFORM_CONFIG[platform];
  
  if (platform === 'twitter') {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }
  
  if (platform === 'reddit') {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
      </svg>
    );
  }
  
  if (platform === '7tv') {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 109.6 80.9" fill="currentColor">
        <path fill="#4FC2BC" d="M82.1,80.9L49.5,34.8l6.2-8.6l38.8,54.7H82.1z"/>
        <path fill="#4FC2BC" d="M27.5,80.9L60.1,34.8l-6.2-8.6L15,80.9H27.5z"/>
        <path fill="currentColor" d="M43.3,56.9L14.5,17h12.8l22.3,31.4L43.3,56.9z"/>
        <path fill="currentColor" d="M66.3,56.9l28.8-39.9H82.2L60.1,48.4L66.3,56.9z"/>
        <polygon fill="#4FC2BC" points="65.3,9 54.8,23.5 44.3,9 44.3,0 54.8,14.5 65.3,0"/>
      </svg>
    );
  }
  
  const Icon = config?.icon || Globe;
  return <Icon className={className} size={size} />;
}

function LinkCard({ link, rank, isExpanded, onToggleExpand, openProfileCard, channelName, onExcludeUser }) {
  const config = PLATFORM_CONFIG[link.platform];
  
  // Use unified hook for fetching preview
  const { data: preview, isLoading } = useLinkPreview(link.url, link.platform);

  const handleExcludeUser = (username, e) => {
    e.stopPropagation();
    if (channelName && onExcludeUser) {
      onExcludeUser(channelName, username);
    }
  };

  return (
    <div className={`rounded-lg border ${config.color} ${config.bgColor} overflow-hidden transition-all hover:shadow-lg`}>
      {/* Preview Image */}
      {isLoading ? (
        <div className={`${preview?.is7TVEmote ? 'aspect-square' : 'aspect-video'} bg-gray-800 animate-pulse`} />
      ) : preview?.image ? (
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="block">
          <div className={`relative ${preview?.is7TVEmote ? 'aspect-square' : 'aspect-video'} bg-gray-800 ${preview?.is7TVEmote ? 'flex items-center justify-center p-4' : ''}`}>
            <img 
              src={preview.image} 
              alt={preview?.title || ''} 
              className={preview?.is7TVEmote ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-cover'}
              onError={(e) => e.target.style.display = 'none'}
            />
            {/* Animated badge for 7TV */}
            {preview?.is7TVEmote && preview?.animated && (
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-purple-500/80 rounded text-[10px] text-white font-medium">
                Animated
              </div>
            )}
            {/* Rank Badge */}
            {rank && rank <= 3 && (
              <div className={`absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                rank === 1 ? 'bg-yellow-500 text-black' :
                rank === 2 ? 'bg-gray-300 text-black' :
                'bg-orange-500 text-black'
              }`}>
                #{rank}
              </div>
            )}
            {/* Platform Badge */}
            <div className={`absolute bottom-2 right-2 px-2 py-1 rounded ${config.bgColor} backdrop-blur-sm`}>
              <span className={`text-xs font-medium ${config.textColor} flex items-center gap-1`}>
                <PlatformIcon platform={link.platform} size={12} />
                {preview?.siteName || config.name || new URL(link.url).hostname}
              </span>
            </div>
          </div>
        </a>
      ) : (
        <div className="aspect-video bg-gray-800/50 flex items-center justify-center">
          <PlatformIcon platform={link.platform} size={48} className={`${config.textColor} opacity-30`} />
        </div>
      )}
      
      {/* Content */}
      <div className="p-3">
        {/* Title */}
        <a 
          href={link.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="block group"
        >
          <h3 className="text-sm font-medium text-white group-hover:text-twitch-purple line-clamp-2 mb-1">
            {isLoading ? (
              <div className="animate-pulse h-4 bg-gray-700 rounded w-3/4"></div>
            ) : (
              preview?.title || new URL(link.url).hostname + new URL(link.url).pathname.slice(0, 40)
            )}
          </h3>
        </a>

        {/* Description */}
        {preview?.description && (
          <p className="text-xs text-gray-400 line-clamp-2 mb-2">{preview.description}</p>
        )}

        {/* Author/Channel info (from oEmbed) */}
        {preview?.author && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
            <User className="w-3 h-3" />
            {preview.authorUrl ? (
              <a 
                href={preview.authorUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-twitch-purple hover:underline"
              >
                {preview.author}
              </a>
            ) : (
              <span>{preview.author}</span>
            )}
          </div>
        )}

        {/* Site/Domain info */}
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          {preview?.favicon && (
            <img 
              src={preview.favicon} 
              alt="" 
              className="w-3 h-3"
              onError={(e) => e.target.style.display = 'none'}
            />
          )}
          <PlatformIcon platform={link.platform} size={12} className={config.textColor} />
          <span className="truncate">{preview?.siteName || new URL(link.url).hostname}</span>
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-3 text-xs mb-2">
          <div className="flex items-center gap-1 text-blue-400">
            <Hash className="w-3 h-3" />
            <span className="font-medium">{link.count}</span>
            <span className="text-gray-500">shares</span>
          </div>
          <div className="flex items-center gap-1 text-green-400">
            <Users className="w-3 h-3" />
            <span className="font-medium">{link.users.length}</span>
            <span className="text-gray-500">users</span>
          </div>
        </div>

        {/* Users */}
        <div className="flex items-center gap-1 flex-wrap">
          {link.users.slice(0, isExpanded ? link.users.length : 3).map((user, idx) => (
            <span key={user.username} className="inline-flex items-center group/user">
              <button
                onClick={() => openProfileCard(user.username)}
                className="text-xs text-twitch-purple hover:underline"
              >
                {user.displayName}
              </button>
              {channelName && (
                <button
                  onClick={(e) => handleExcludeUser(user.username, e)}
                  className="ml-0.5 opacity-0 group-hover/user:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                  title={`Hide links from ${user.displayName}`}
                >
                  <UserX className="w-3 h-3" />
                </button>
              )}
              {idx < Math.min(link.users.length, isExpanded ? link.users.length : 3) - 1 && (
                <span className="text-gray-500 mr-1">,</span>
              )}
            </span>
          ))}
          {link.users.length > 3 && (
            <button
              onClick={onToggleExpand}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-0.5"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  less
                </>
              ) : (
                <>
                  +{link.users.length - 3} more
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Timestamp */}
        <div className="mt-2 text-[10px] text-gray-500">
          Last shared {formatRelative(link.lastSeen)}
        </div>
      </div>
    </div>
  );
}

function LinkListItem({ link, rank, isExpanded, onToggleExpand, openProfileCard, channelName, onExcludeUser }) {
  const config = PLATFORM_CONFIG[link.platform];
  
  // Use unified hook for fetching preview
  const { data: preview, isLoading } = useLinkPreview(link.url, link.platform);

  const handleExcludeUser = (username, e) => {
    e.stopPropagation();
    if (channelName && onExcludeUser) {
      onExcludeUser(channelName, username);
    }
  };

  return (
    <div className={`rounded-lg border ${config.color} ${config.bgColor} p-3 transition-all ${config.hoverBg}`}>
      <div className="flex items-start gap-3">
        {/* Thumbnail - larger for list view, square for 7TV emotes */}
        {isLoading ? (
          <div className={`flex-shrink-0 ${preview?.is7TVEmote ? 'w-16 h-16' : 'w-24 h-16'} rounded bg-gray-800 animate-pulse`} />
        ) : preview?.image ? (
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <div className={`${preview?.is7TVEmote ? 'w-16 h-16' : 'w-24 h-16'} rounded overflow-hidden bg-gray-800 relative ${preview?.is7TVEmote ? 'flex items-center justify-center p-1' : ''}`}>
              <img 
                src={preview.image} 
                alt={preview?.title || ''} 
                className={preview?.is7TVEmote ? 'max-w-full max-h-full object-contain' : 'w-full h-full object-cover'}
                onError={(e) => e.target.style.display = 'none'}
              />
              {/* Animated badge for 7TV */}
              {preview?.is7TVEmote && preview?.animated && (
                <div className="absolute -top-1 -right-1 px-1 py-0.5 bg-purple-500/80 rounded text-[8px] text-white font-medium">
                  GIF
                </div>
              )}
              {/* Rank Badge on thumbnail */}
              {rank && rank <= 3 && (
                <div className={`absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  rank === 1 ? 'bg-yellow-500 text-black' :
                  rank === 2 ? 'bg-gray-300 text-black' :
                  'bg-orange-500 text-black'
                }`}>
                  #{rank}
                </div>
              )}
            </div>
          </a>
        ) : (
          <div className={`flex-shrink-0 w-24 h-16 rounded flex items-center justify-center ${config.bgColor} ${config.textColor} relative`}>
            <PlatformIcon platform={link.platform} size={24} />
            {rank && rank <= 3 && (
              <div className={`absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                rank === 1 ? 'bg-yellow-500 text-black' :
                rank === 2 ? 'bg-gray-300 text-black' :
                'bg-orange-500 text-black'
              }`}>
                #{rank}
              </div>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <a 
            href={link.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="block group"
          >
            <h3 className="text-sm font-medium text-white group-hover:text-twitch-purple line-clamp-1">
              {isLoading ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                preview?.title || link.url
              )}
            </h3>
          </a>

          {/* Description */}
          {preview?.description && (
            <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{preview.description}</p>
          )}

          {/* Site & Author info */}
          <div className="flex items-center gap-2 mt-1 text-xs">
            {preview?.favicon && (
              <img 
                src={preview.favicon} 
                alt="" 
                className="w-3 h-3"
                onError={(e) => e.target.style.display = 'none'}
              />
            )}
            <span className={`flex items-center gap-1 ${config.textColor}`}>
              <PlatformIcon platform={link.platform} size={10} />
              {preview?.siteName || config.name || new URL(link.url).hostname}
            </span>
            {preview?.author && (
              <>
                <span className="text-gray-600">•</span>
                {preview.authorUrl ? (
                  <a 
                    href={preview.authorUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-twitch-purple hover:underline"
                  >
                    {preview.author}
                  </a>
                ) : (
                  <span className="text-gray-400">{preview.author}</span>
                )}
              </>
            )}
            <ExternalLink className="w-3 h-3 text-gray-500" />
          </div>

          {/* Users who shared */}
          <div className="flex items-center gap-1 flex-wrap mt-1.5">
            <Users className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-500">Shared by:</span>
            {link.users.slice(0, isExpanded ? link.users.length : 4).map((user, idx) => (
              <span key={user.username} className="inline-flex items-center group/user">
                <button
                  onClick={() => openProfileCard(user.username)}
                  className="text-xs text-twitch-purple hover:underline"
                >
                  {user.displayName}
                </button>
                {channelName && (
                  <button
                    onClick={(e) => handleExcludeUser(user.username, e)}
                    className="ml-0.5 opacity-0 group-hover/user:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
                    title={`Hide links from ${user.displayName}`}
                  >
                    <UserX className="w-3 h-3" />
                  </button>
                )}
                {idx < Math.min(link.users.length, isExpanded ? link.users.length : 4) - 1 && (
                  <span className="text-gray-500 mr-1">,</span>
                )}
              </span>
            ))}
            {link.users.length > 4 && (
              <button
                onClick={onToggleExpand}
                className="text-xs text-gray-400 hover:text-white"
              >
                {isExpanded ? '(less)' : `+${link.users.length - 4} more`}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex-shrink-0 flex items-center gap-3">
          <div className="text-center">
            <div className="text-lg font-bold text-blue-400">{link.count}</div>
            <div className="text-[10px] text-gray-500">shares</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">{link.users.length}</div>
            <div className="text-[10px] text-gray-500">users</div>
          </div>
        </div>
      </div>

      {/* Expanded Messages */}
      {isExpanded && link.messages.length > 1 && (
        <div className="mt-3 pt-3 border-t border-gray-700/50 space-y-2">
          <div className="text-xs text-gray-400 font-medium">Recent shares:</div>
          {link.messages.slice(0, 5).map((msg, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs">
              <button
                onClick={() => openProfileCard(msg.username)}
                className="text-twitch-purple hover:underline flex-shrink-0"
              >
                {msg.displayName}
              </button>
              <span className="text-gray-500 flex-shrink-0">{formatRelative(msg.timestamp)}</span>
              <span className="text-gray-400 truncate">{msg.messageText}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LinksTab;
