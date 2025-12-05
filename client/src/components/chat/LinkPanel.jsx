import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, ChevronLeft, ChevronRight, ExternalLink, X, User, Users, Play, Music2, Video, TrendingUp, Clock, Hash } from 'lucide-react';
import { useProfileCardStore } from '../../stores/profileCardStore';
import { formatRelative } from '../../utils/formatters';

// URL regex pattern
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

// API base for link previews
const API_BASE = '';

// Platform icons and colors
const PLATFORM_CONFIG = {
  youtube: {
    color: 'border-l-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    icon: Play,
    name: 'YouTube',
  },
  tiktok: {
    color: 'border-l-pink-500',
    bgColor: 'bg-gradient-to-r from-cyan-500/10 to-pink-500/10',
    textColor: 'text-pink-400',
    icon: Music2,
    name: 'TikTok',
  },
  twitter: {
    color: 'border-l-blue-400',
    bgColor: 'bg-blue-400/10',
    textColor: 'text-blue-400',
    icon: null, // Will use custom X icon
    name: 'X',
  },
  twitch: {
    color: 'border-l-purple-500',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-400',
    icon: Video,
    name: 'Twitch',
  },
  instagram: {
    color: 'border-l-pink-400',
    bgColor: 'bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10',
    textColor: 'text-pink-400',
    icon: null,
    name: 'Instagram',
  },
  reddit: {
    color: 'border-l-orange-500',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    icon: null,
    name: 'Reddit',
  },
  generic: {
    color: 'border-l-gray-500',
    bgColor: 'bg-gray-700/30',
    textColor: 'text-gray-400',
    icon: Link2,
    name: null,
  },
};

function LinkPanel({ messages = [], isCollapsed, onToggle }) {
  const [dismissedLinks, setDismissedLinks] = useState(new Set());
  const [sortBy, setSortBy] = useState('count'); // 'count' or 'recent'
  const openProfileCard = useProfileCardStore(state => state.openCard);

  // Extract links from messages, grouping by URL and counting occurrences
  const links = useMemo(() => {
    const linkMap = new Map(); // normalizedUrl -> { url, users: [...], count, firstSeen, lastSeen }

    for (const msg of messages) {
      const text = msg.messageText || msg.message_text || '';
      const urls = text.match(URL_REGEX) || [];
      
      for (const url of urls) {
        // Normalize URL for deduplication
        const normalizedUrl = url.replace(/\/$/, '').toLowerCase();
        
        if (dismissedLinks.has(normalizedUrl)) continue;
        
        const userInfo = {
          username: msg.username || msg.user_display_name,
          displayName: msg.displayName || msg.user_display_name || msg.username,
          timestamp: msg.timestamp,
          messageId: msg.messageId || msg.id,
        };
        
        if (linkMap.has(normalizedUrl)) {
          const existing = linkMap.get(normalizedUrl);
          existing.count++;
          existing.lastSeen = userInfo.timestamp;
          // Only add user if not already in the list
          const alreadyAdded = existing.users.some(u => u.username === userInfo.username);
          if (!alreadyAdded) {
            existing.users.push(userInfo);
          }
        } else {
          linkMap.set(normalizedUrl, {
            url,
            normalizedUrl,
            users: [userInfo],
            count: 1,
            firstSeen: userInfo.timestamp,
            lastSeen: userInfo.timestamp,
          });
        }
      }
    }

    // Convert to array and sort
    let result = Array.from(linkMap.values());
    
    if (sortBy === 'count') {
      result.sort((a, b) => b.count - a.count);
    } else {
      result.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));
    }
    
    return result.slice(0, 50);
  }, [messages, dismissedLinks, sortBy]);

  // Calculate total link count
  const totalLinkCount = useMemo(() => {
    return links.reduce((sum, link) => sum + link.count, 0);
  }, [links]);

  const dismissLink = (normalizedUrl) => {
    setDismissedLinks(prev => new Set([...prev, normalizedUrl]));
  };

  const clearDismissed = () => {
    setDismissedLinks(new Set());
  };

  if (isCollapsed) {
    return (
      <button
        onClick={onToggle}
        className="bg-twitch-gray rounded-lg border border-gray-700 p-2 h-[600px] flex flex-col items-center justify-center hover:bg-gray-800 transition-colors"
        title="Show Links Panel"
      >
        <ChevronRight className="w-5 h-5 text-gray-400" />
        <Link2 className="w-5 h-5 text-blue-400 mt-2" />
        {links.length > 0 && (
          <span className="mt-2 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
            {links.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="bg-twitch-gray rounded-lg border border-gray-700 h-[600px] flex flex-col w-80">
      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Link2 className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-gray-300">Links</span>
            {links.length > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                {links.length} unique
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1">
            {dismissedLinks.size > 0 && (
              <button
                onClick={clearDismissed}
                className="text-xs text-gray-400 hover:text-white px-2"
              >
                Reset
              </button>
            )}
            <button
              onClick={onToggle}
              className="p-1 text-gray-400 hover:text-white"
              title="Collapse panel"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Sort controls */}
        {links.length > 1 && (
          <div className="flex items-center space-x-1 mt-2">
            <button
              onClick={() => setSortBy('count')}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                sortBy === 'count' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <TrendingUp className="w-3 h-3" />
              <span>Popular</span>
            </button>
            <button
              onClick={() => setSortBy('recent')}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                sortBy === 'recent' 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Clock className="w-3 h-3" />
              <span>Recent</span>
            </button>
          </div>
        )}
      </div>

      {/* Links List */}
      <div className="flex-1 overflow-y-auto">
        {links.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Link2 className="w-8 h-8 mb-2" />
            <p className="text-sm">No links yet</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {links.map((link, index) => (
              <CompactLinkItem 
                key={`${link.normalizedUrl}-${index}`}
                link={link}
                rank={sortBy === 'count' ? index + 1 : null}
                onDismiss={() => dismissLink(link.normalizedUrl)}
                openProfileCard={openProfileCard}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CompactLinkItem({ link, rank, onDismiss, openProfileCard }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch link preview
  const { data: preview, isLoading } = useQuery({
    queryKey: ['link-preview', link.url],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/utils/link-preview?url=${encodeURIComponent(link.url)}`);
      if (!res.ok) throw new Error('Failed to fetch preview');
      return res.json();
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
  });

  // Detect platform for special styling
  const platform = useMemo(() => {
    const url = link.url.toLowerCase();
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('twitch.tv')) return 'twitch';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('reddit.com')) return 'reddit';
    return 'generic';
  }, [link.url]);

  const config = PLATFORM_CONFIG[platform];
  const users = link.users || [];
  const hasMultipleUsers = users.length > 1;

  // Get platform icon
  const PlatformIcon = config.icon;

  const renderPlatformIcon = () => {
    if (platform === 'twitter') {
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );
    }
    if (platform === 'instagram') {
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      );
    }
    if (platform === 'reddit') {
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
        </svg>
      );
    }
    if (PlatformIcon) {
      return <PlatformIcon className="w-3.5 h-3.5" />;
    }
    return <Link2 className="w-3.5 h-3.5" />;
  };

  return (
    <div 
      className={`rounded-lg border border-gray-700/50 overflow-hidden transition-all hover:border-gray-600 ${config.bgColor}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main content row */}
      <div className="p-2">
        <div className="flex items-start gap-2">
          {/* Rank badge or thumbnail */}
          {rank && rank <= 3 ? (
            <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center font-bold text-sm ${
              rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
              rank === 2 ? 'bg-gray-400/20 text-gray-300' :
              'bg-orange-600/20 text-orange-400'
            }`}>
              #{rank}
            </div>
          ) : preview?.image ? (
            <div className="flex-shrink-0 w-12 h-8 rounded overflow-hidden bg-gray-800">
              <img 
                src={preview.image} 
                alt="" 
                className="w-full h-full object-cover"
                onError={(e) => e.target.style.display = 'none'}
              />
            </div>
          ) : (
            <div className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center ${config.bgColor} ${config.textColor}`}>
              {renderPlatformIcon()}
            </div>
          )}

          {/* Link info */}
          <div className="flex-1 min-w-0">
            <a 
              href={link.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block group"
            >
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-3 bg-gray-700 rounded w-3/4"></div>
                </div>
              ) : (
                <p className="text-xs text-white group-hover:text-twitch-purple line-clamp-1 font-medium">
                  {preview?.title || new URL(link.url).hostname + new URL(link.url).pathname.slice(0, 30)}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`${config.textColor}`}>
                  {renderPlatformIcon()}
                </span>
                <span className="text-[10px] text-gray-500 truncate">
                  {config.name || new URL(link.url).hostname}
                </span>
              </div>
            </a>
          </div>

          {/* Stats & actions */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {/* Link count badge */}
            {link.count > 1 && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                <Hash className="w-2.5 h-2.5" />
                <span className="text-[10px] font-medium">{link.count}</span>
              </div>
            )}
            
            {/* Dismiss button */}
            {isHovered && (
              <button
                onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                className="p-1 text-gray-500 hover:text-red-400 rounded hover:bg-red-500/10"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Users row */}
        <div className="mt-1.5 flex items-center gap-1">
          <div className={`${config.textColor}`}>
            {hasMultipleUsers ? (
              <Users className="w-3 h-3" />
            ) : (
              <User className="w-3 h-3" />
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
            {users.slice(0, isExpanded ? users.length : 3).map((user, idx) => (
              <button
                key={user.username}
                onClick={() => openProfileCard(user.username)}
                className="text-[10px] text-twitch-purple hover:underline truncate max-w-[80px]"
              >
                {user.displayName}{idx < Math.min(users.length, isExpanded ? users.length : 3) - 1 ? ',' : ''}
              </button>
            ))}
            {users.length > 3 && !isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="text-[10px] text-gray-400 hover:text-white"
              >
                +{users.length - 3} more
              </button>
            )}
            {isExpanded && users.length > 3 && (
              <button
                onClick={() => setIsExpanded(false)}
                className="text-[10px] text-gray-400 hover:text-white"
              >
                (less)
              </button>
            )}
          </div>
          <span className="text-[10px] text-gray-500 flex-shrink-0">
            {formatRelative(link.lastSeen)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default LinkPanel;
