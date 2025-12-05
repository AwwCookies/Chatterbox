import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, ChevronLeft, ChevronRight, ExternalLink, X, User, Users, Play, Music2, Video } from 'lucide-react';
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
  const openProfileCard = useProfileCardStore(state => state.openCard);

  // Extract links from messages, grouping by URL
  const links = useMemo(() => {
    const linkMap = new Map(); // normalizedUrl -> { url, users: [...] }

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
          });
        }
      }
    }

    // Convert to array and limit
    return Array.from(linkMap.values()).slice(0, 50);
  }, [messages, dismissedLinks]);

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
      <div className="p-3 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link2 className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-gray-300">Links</span>
          {links.length > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">
              {links.length}
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

      {/* Links List */}
      <div className="flex-1 overflow-y-auto">
        {links.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Link2 className="w-8 h-8 mb-2" />
            <p className="text-sm">No links yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700/50">
            {links.map((link, index) => (
              <LinkItem 
                key={`${link.normalizedUrl}-${index}`}
                link={link}
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

function LinkItem({ link, onDismiss, openProfileCard }) {
  const [isHovered, setIsHovered] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);

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

  // Extract useful info from URL for platforms that block previews
  const urlInfo = useMemo(() => {
    try {
      const url = new URL(link.url);
      const pathname = url.pathname;
      
      if (platform === 'tiktok') {
        // TikTok URL patterns:
        // /@username/video/1234567890
        // /t/ABC123 (short URL)
        const videoMatch = pathname.match(/\/@([^/]+)\/video\/(\d+)/);
        const userMatch = pathname.match(/\/@([^/]+)/);
        const shortMatch = pathname.match(/\/t\/([A-Za-z0-9]+)/);
        
        if (videoMatch) {
          return { type: 'video', username: videoMatch[1], videoId: videoMatch[2] };
        } else if (shortMatch) {
          return { type: 'short', code: shortMatch[1] };
        } else if (userMatch) {
          return { type: 'profile', username: userMatch[1] };
        }
      }
      
      if (platform === 'youtube') {
        const videoId = url.searchParams.get('v') || pathname.match(/\/(?:shorts|embed|v)\/([^/?]+)/)?.[1];
        if (videoId) return { type: 'video', videoId };
      }
      
      if (platform === 'twitter') {
        const statusMatch = pathname.match(/\/([^/]+)\/status\/(\d+)/);
        if (statusMatch) return { type: 'tweet', username: statusMatch[1], tweetId: statusMatch[2] };
        const userMatch = pathname.match(/^\/([^/]+)\/?$/);
        if (userMatch && !['home', 'explore', 'search', 'notifications', 'messages'].includes(userMatch[1])) {
          return { type: 'profile', username: userMatch[1] };
        }
      }
      
      if (platform === 'twitch') {
        const channelMatch = pathname.match(/^\/([^/]+)\/?$/);
        const clipMatch = pathname.match(/\/clip\/([^/?]+)/);
        const videoMatch = pathname.match(/\/videos\/(\d+)/);
        if (clipMatch) return { type: 'clip', clipId: clipMatch[1] };
        if (videoMatch) return { type: 'vod', vodId: videoMatch[1] };
        if (channelMatch && !['directory', 'p', 'settings'].includes(channelMatch[1])) {
          return { type: 'channel', channel: channelMatch[1] };
        }
      }
      
      return { type: 'link' };
    } catch {
      return { type: 'link' };
    }
  }, [link.url, platform]);

  const users = link.users || [];
  const firstUser = users[0];
  const otherUsers = users.slice(1);
  const hasMultipleUsers = users.length > 1;

  // Render platform-specific fallback when no preview is available
  const renderPlatformFallback = () => {
    const PlatformIcon = config.icon;
    
    return (
      <div className={`rounded-lg p-3 ${config.bgColor}`}>
        <div className="flex items-start space-x-3">
          {/* Platform icon */}
          <div className={`p-2 rounded-lg bg-gray-800/50 ${config.textColor}`}>
            {platform === 'twitter' ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            ) : platform === 'instagram' ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            ) : platform === 'reddit' ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
              </svg>
            ) : PlatformIcon ? (
              <PlatformIcon className="w-5 h-5" />
            ) : (
              <Link2 className="w-5 h-5" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className={`text-xs font-semibold ${config.textColor}`}>
                {config.name || new URL(link.url).hostname}
              </span>
              {platform === 'tiktok' && urlInfo.type === 'video' && (
                <span className="text-xs text-gray-500">Video</span>
              )}
              {platform === 'tiktok' && urlInfo.type === 'profile' && (
                <span className="text-xs text-gray-500">Profile</span>
              )}
            </div>
            
            {/* Platform-specific info */}
            {platform === 'tiktok' && urlInfo.username && (
              <p className="text-sm text-white mt-1">@{urlInfo.username}</p>
            )}
            {platform === 'twitter' && urlInfo.username && (
              <p className="text-sm text-white mt-1">
                @{urlInfo.username}
                {urlInfo.type === 'tweet' && <span className="text-gray-500"> · Tweet</span>}
              </p>
            )}
            {platform === 'twitch' && urlInfo.channel && (
              <p className="text-sm text-white mt-1">{urlInfo.channel}</p>
            )}
            {platform === 'twitch' && urlInfo.type === 'clip' && (
              <p className="text-sm text-gray-400 mt-1">Clip</p>
            )}
            {platform === 'twitch' && urlInfo.type === 'vod' && (
              <p className="text-sm text-gray-400 mt-1">VOD</p>
            )}
            
            {/* Fallback URL display */}
            {platform === 'generic' && (
              <p className="text-sm text-white truncate mt-1">
                {new URL(link.url).hostname}
              </p>
            )}
            
            <div className="flex items-center space-x-1 mt-1 text-gray-500">
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs">Open link</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`p-2 hover:bg-gray-800/50 transition-colors border-l-2 ${config.color}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Users info */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-1 flex-wrap min-w-0">
          {hasMultipleUsers ? (
            <Users className="w-3 h-3 text-gray-400 flex-shrink-0" />
          ) : (
            <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )}
          
          <button
            onClick={() => openProfileCard(firstUser.username)}
            className="text-xs text-twitch-purple hover:underline truncate"
          >
            {firstUser.displayName}
          </button>
          
          {hasMultipleUsers && (
            <button
              onClick={() => setShowAllUsers(!showAllUsers)}
              className="text-xs text-gray-400 hover:text-white flex-shrink-0"
            >
              +{otherUsers.length} more
            </button>
          )}
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0">
          <span className="text-xs text-gray-500">{formatRelative(firstUser.timestamp)}</span>
          {isHovered && (
            <button
              onClick={onDismiss}
              className="p-0.5 text-gray-500 hover:text-red-400"
              title="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded users list */}
      {showAllUsers && otherUsers.length > 0 && (
        <div className="mb-2 pl-4 space-y-0.5">
          {otherUsers.map((user, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <button
                onClick={() => openProfileCard(user.username)}
                className="text-twitch-purple hover:underline truncate"
              >
                {user.displayName}
              </button>
              <span className="text-gray-500 flex-shrink-0">{formatRelative(user.timestamp)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Link preview */}
      <a 
        href={link.url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="block group"
      >
        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-3 bg-gray-700 rounded w-3/4 mb-1"></div>
            <div className="h-2 bg-gray-700 rounded w-1/2"></div>
          </div>
        ) : preview && (preview.image || preview.title) ? (
          <div className="space-y-1">
            {/* Thumbnail */}
            {preview.image && (
              <div className="relative rounded overflow-hidden bg-gray-800 aspect-video max-h-24">
                <img 
                  src={preview.image} 
                  alt="" 
                  className="w-full h-full object-cover"
                  onError={(e) => e.target.style.display = 'none'}
                />
                {/* Platform badge overlay */}
                {platform !== 'generic' && (
                  <div className={`absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${config.bgColor} ${config.textColor}`}>
                    {config.name}
                  </div>
                )}
              </div>
            )}
            
            {/* Title & Description */}
            <div>
              <p className="text-xs text-white group-hover:text-twitch-purple line-clamp-2 font-medium">
                {preview.title || link.url}
              </p>
              {/* Author info (from oEmbed) */}
              {preview.author && (
                <p className="text-xs text-gray-400 mt-0.5">
                  by {preview.author}
                </p>
              )}
              {preview.description && !preview.author && (
                <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">
                  {preview.description}
                </p>
              )}
              <div className="flex items-center space-x-1 mt-1 text-gray-500">
                {preview.favicon && (
                  <img 
                    src={preview.favicon} 
                    alt="" 
                    className="w-3 h-3"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                )}
                <span className="text-xs truncate">
                  {preview.siteName || new URL(link.url).hostname}
                </span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </div>
            </div>
          </div>
        ) : (
          // Platform-specific fallback for links without rich previews
          renderPlatformFallback()
        )}
      </a>
    </div>
  );
}

export default LinkPanel;
