import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Link as LinkIcon, X, Play } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Extract URLs from text
export function extractUrls(text) {
  if (!text) return [];
  
  // URL regex pattern
  const urlPattern = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;
  
  const matches = text.match(urlPattern) || [];
  // Return unique URLs only
  return [...new Set(matches)];
}

// Detect special link types
function detectLinkType(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      let videoId = null;
      if (hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1).split('?')[0];
      } else if (urlObj.pathname.includes('/watch')) {
        videoId = urlObj.searchParams.get('v');
      } else if (urlObj.pathname.includes('/shorts/')) {
        videoId = urlObj.pathname.split('/shorts/')[1]?.split('?')[0];
      } else if (urlObj.pathname.includes('/live/')) {
        videoId = urlObj.pathname.split('/live/')[1]?.split('?')[0];
      }
      if (videoId) {
        return { type: 'youtube', videoId };
      }
    }
    
    // TikTok
    if (hostname.includes('tiktok.com')) {
      const videoMatch = url.match(/\/video\/(\d+)/);
      if (videoMatch) {
        return { type: 'tiktok', videoId: videoMatch[1], url };
      }
      // Handle short links or other formats
      return { type: 'tiktok', url };
    }
    
    // Twitter/X
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      const statusMatch = urlObj.pathname.match(/\/([^\/]+)\/status\/(\d+)/);
      if (statusMatch) {
        return { type: 'twitter', username: statusMatch[1], tweetId: statusMatch[2] };
      }
    }
    
    // 7TV Emotes
    if (hostname.includes('7tv.app')) {
      const emoteMatch = urlObj.pathname.match(/\/emotes\/([A-Za-z0-9]+)/);
      if (emoteMatch) {
        return { type: '7tv', emoteId: emoteMatch[1] };
      }
    }
    
    return { type: 'generic' };
  } catch {
    return { type: 'generic' };
  }
}

// Format large numbers (e.g., 1.2M, 450K)
function formatCount(num) {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

// YouTube Embed Component
function YouTubeEmbed({ videoId, url, onDismiss, metadata }) {
  const [showEmbed, setShowEmbed] = useState(false);
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  const hqThumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  
  // Extract channel name from metadata if available
  const channelName = metadata?.siteName === 'YouTube' ? null : metadata?.siteName;
  
  return (
    <div className="mt-2 max-w-2xl relative group">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute -top-1 -right-1 p-1 bg-gray-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-gray-700"
        title="Dismiss preview"
      >
        <X className="w-3 h-3 text-gray-400" />
      </button>
      
      <div className="rounded-lg overflow-hidden border border-gray-700 bg-twitch-dark">
        {showEmbed ? (
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              title="YouTube video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row">
            {/* Left side - Video Info */}
            <div className="flex-1 p-4 flex flex-col justify-between min-w-0 order-2 sm:order-1">
              {/* YouTube branding */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <svg className="w-6 h-6 text-red-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  <span className="text-red-500 font-semibold text-sm">YouTube</span>
                </div>
                
                {/* Title */}
                {metadata?.title && (
                  <h4 className="text-white font-medium text-sm leading-tight line-clamp-3 mb-2">
                    {metadata.title}
                  </h4>
                )}
                
                {/* Channel */}
                {channelName && (
                  <p className="text-gray-400 text-xs mb-3">{channelName}</p>
                )}
              </div>
              
              {/* Stats - would need YouTube API for real stats, showing placeholders from description */}
              <div className="space-y-2">
                {metadata?.description && (
                  <p className="text-gray-500 text-xs line-clamp-2">{metadata.description}</p>
                )}
                
                {/* Action buttons */}
                <div className="flex items-center space-x-3 pt-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open in YouTube</span>
                  </a>
                </div>
              </div>
            </div>
            
            {/* Right side - Thumbnail */}
            <div 
              className="relative w-full sm:w-64 flex-shrink-0 cursor-pointer order-1 sm:order-2"
              onClick={() => setShowEmbed(true)}
            >
              <img
                src={hqThumbnailUrl}
                alt="YouTube video thumbnail"
                className="w-full h-36 sm:h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition-colors">
                <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-lg hover:bg-red-500 transition-colors">
                  <Play className="w-7 h-7 text-white fill-white ml-1" />
                </div>
              </div>
              {/* Duration badge placeholder */}
              <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                ▶ Play
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// TikTok Embed Component
function TikTokEmbed({ videoId, url, onDismiss, metadata }) {
  const [showEmbed, setShowEmbed] = useState(false);
  
  return (
    <div className="mt-2 max-w-sm relative group">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute -top-1 -right-1 p-1 bg-gray-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-gray-700"
        title="Dismiss preview"
      >
        <X className="w-3 h-3 text-gray-400" />
      </button>
      
      <div className="rounded-lg overflow-hidden border border-gray-700 bg-black">
        {showEmbed && videoId ? (
          <div className="relative w-full" style={{ minHeight: '400px' }}>
            <iframe
              className="w-full h-[500px]"
              src={`https://www.tiktok.com/embed/v2/${videoId}`}
              title="TikTok video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            onClick={(e) => {
              if (videoId) {
                e.preventDefault();
                setShowEmbed(true);
              }
            }}
          >
            {metadata?.image ? (
              <div className="relative">
                <img
                  src={metadata.image}
                  alt="TikTok video thumbnail"
                  className="w-full h-auto max-h-64 object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/20 transition-colors">
                  <div className="w-14 h-14 bg-black rounded-full flex items-center justify-center border-2 border-white">
                    <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>
            ) : null}
            <div className="p-3 bg-gradient-to-r from-[#69C9D0] via-black to-[#EE1D52]">
              <div className="inline-flex items-center space-x-2 bg-black/50 rounded px-2 py-1">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                </svg>
                <span className="text-white text-sm font-medium">TikTok</span>
              </div>
            </div>
            {metadata?.title && (
              <div className="p-3 bg-gray-900">
                <p className="text-white text-sm line-clamp-2">{metadata.title}</p>
              </div>
            )}
          </a>
        )}
      </div>
    </div>
  );
}

// Twitter/X Embed Component
function TwitterEmbed({ username, tweetId, url, onDismiss, metadata }) {
  const [showEmbed, setShowEmbed] = useState(false);
  
  return (
    <div className="mt-2 max-w-lg relative group">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute -top-1 -right-1 p-1 bg-gray-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-gray-700"
        title="Dismiss preview"
      >
        <X className="w-3 h-3 text-gray-400" />
      </button>
      
      <div className="rounded-lg overflow-hidden border border-gray-700 bg-black">
        {showEmbed ? (
          <div className="bg-black p-2">
            <iframe
              src={`https://platform.twitter.com/embed/Tweet.html?id=${tweetId}&theme=dark`}
              className="w-full min-h-[200px]"
              style={{ border: 'none', minHeight: '250px' }}
              title="Twitter post"
              allowFullScreen
            />
          </div>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block hover:bg-gray-900 transition-colors"
            onClick={(e) => {
              e.preventDefault();
              setShowEmbed(true);
            }}
          >
            {metadata?.image && (
              <img
                src={metadata.image}
                alt="Tweet preview"
                className="w-full h-auto max-h-48 object-cover"
              />
            )}
            <div className="p-3">
              <div className="flex items-center space-x-2 mb-2">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="text-gray-400 text-sm">@{username}</span>
                <ExternalLink className="w-3 h-3 text-gray-500 ml-auto" />
              </div>
              {metadata?.title && (
                <p className="text-white text-sm line-clamp-3">{metadata.title}</p>
              )}
              {metadata?.description && !metadata?.title && (
                <p className="text-gray-300 text-sm line-clamp-3">{metadata.description}</p>
              )}
              <div className="mt-2 text-xs text-blue-400">Click to load tweet</div>
            </div>
          </a>
        )}
      </div>
    </div>
  );
}

// Fetch link metadata
async function fetchLinkMetadata(url) {
  const response = await fetch(`${API_BASE}/api/utils/link-preview?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch metadata');
  }
  return response.json();
}

// 7TV Emote Embed Component
function SevenTVEmbed({ emoteId, url, onDismiss }) {
  const { data: emoteData, isLoading, error } = useQuery({
    queryKey: ['7tv-emote', emoteId],
    queryFn: async () => {
      const response = await fetch(`https://7tv.io/v3/emotes/${emoteId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch emote');
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
    retry: 1,
  });

  if (error) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mt-2 max-w-xs">
        <div className="rounded-lg border border-gray-700 bg-twitch-dark p-3 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16 bg-gray-700 rounded"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-700 rounded w-24"></div>
              <div className="h-3 bg-gray-700 rounded w-16"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Get the best emote URL (4x size, webp format preferred)
  const emoteFile = emoteData?.host?.files?.find(f => f.name === '4x.webp') 
    || emoteData?.host?.files?.find(f => f.name === '4x.png')
    || emoteData?.host?.files?.find(f => f.name === '3x.webp')
    || emoteData?.host?.files?.find(f => f.name === '2x.webp')
    || emoteData?.host?.files?.[0];
  
  const emoteUrl = emoteFile 
    ? `https:${emoteData.host.url}/${emoteFile.name}`
    : null;

  const isAnimated = emoteData?.animated;
  const emoteName = emoteData?.name;
  const ownerName = emoteData?.owner?.display_name || emoteData?.owner?.username;

  return (
    <div className="mt-2 max-w-xs relative group">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDismiss();
        }}
        className="absolute -top-1 -right-1 p-1 bg-gray-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-gray-700"
        title="Dismiss preview"
      >
        <X className="w-3 h-3 text-gray-400" />
      </button>
      
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg overflow-hidden border border-gray-700 bg-twitch-dark hover:border-gray-600 transition-colors"
      >
        <div className="p-3 flex items-center space-x-3">
          {/* Emote image */}
          <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center bg-gray-900 rounded">
            {emoteUrl && (
              <img
                src={emoteUrl}
                alt={emoteName || 'Emote'}
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
          
          {/* Emote info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              {/* 7TV Logo */}
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 109.6 80.9" fill="currentColor">
                <path fill="#4FC2BC" d="M82.1,80.9L49.5,34.8l6.2-8.6l38.8,54.7H82.1z"/>
                <path fill="#4FC2BC" d="M27.5,80.9L60.1,34.8l-6.2-8.6L15,80.9H27.5z"/>
                <path fill="#fff" d="M43.3,56.9L14.5,17h12.8l22.3,31.4L43.3,56.9z"/>
                <path fill="#fff" d="M66.3,56.9l28.8-39.9H82.2L60.1,48.4L66.3,56.9z"/>
                <polygon fill="#4FC2BC" points="65.3,9 54.8,23.5 44.3,9 44.3,0 54.8,14.5 65.3,0"/>
              </svg>
              <span className="text-[#4FC2BC] text-xs font-medium">7TV</span>
              {isAnimated && (
                <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                  Animated
                </span>
              )}
            </div>
            
            {/* Emote name */}
            <h4 className="text-white font-medium text-sm truncate">
              {emoteName || 'Unknown Emote'}
            </h4>
            
            {/* Owner */}
            {ownerName && (
              <p className="text-gray-500 text-xs truncate">
                by {ownerName}
              </p>
            )}
          </div>
          
          <ExternalLink className="w-4 h-4 text-gray-500 flex-shrink-0" />
        </div>
      </a>
    </div>
  );
}

function SingleLinkPreview({ url }) {
  const [dismissed, setDismissed] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const linkInfo = detectLinkType(url);

  // Fetch metadata for all link types (needed for YouTube title/description too)
  const { data: metadata, isLoading, error } = useQuery({
    queryKey: ['link-preview', url],
    queryFn: () => fetchLinkMetadata(url),
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    retry: 1,
  });

  if (dismissed || error) {
    return null;
  }

  // Handle dismiss callback
  const handleDismiss = () => setDismissed(true);

  // YouTube embed - can show with just thumbnail while metadata loads
  if (linkInfo.type === 'youtube' && linkInfo.videoId) {
    // Show loading skeleton if metadata not ready yet
    if (isLoading) {
      return (
        <div className="mt-2 max-w-2xl">
          <div className="rounded-lg border border-gray-700 bg-twitch-dark p-4 animate-pulse">
            <div className="flex flex-col sm:flex-row">
              <div className="flex-1 space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 bg-red-500/30 rounded"></div>
                  <div className="h-4 bg-gray-700 rounded w-16"></div>
                </div>
                <div className="h-4 bg-gray-700 rounded w-full"></div>
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </div>
              <div className="w-full sm:w-64 h-36 bg-gray-700 rounded mt-3 sm:mt-0 sm:ml-4"></div>
            </div>
          </div>
        </div>
      );
    }
    return <YouTubeEmbed videoId={linkInfo.videoId} url={url} onDismiss={handleDismiss} metadata={metadata} />;
  }

  // Show loading for other links
  if (isLoading) {
    return (
      <div className="mt-2 max-w-md">
        <div className="rounded-lg border border-gray-700 bg-twitch-dark p-3 animate-pulse">
          <div className="flex items-center space-x-2">
            <LinkIcon className="w-4 h-4 text-gray-600" />
            <div className="h-3 bg-gray-700 rounded w-24"></div>
          </div>
          <div className="mt-2 h-4 bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  // TikTok embed
  if (linkInfo.type === 'tiktok') {
    return <TikTokEmbed videoId={linkInfo.videoId} url={url} onDismiss={handleDismiss} metadata={metadata} />;
  }

  // Twitter/X embed
  if (linkInfo.type === 'twitter' && linkInfo.tweetId) {
    return <TwitterEmbed username={linkInfo.username} tweetId={linkInfo.tweetId} url={url} onDismiss={handleDismiss} metadata={metadata} />;
  }

  // 7TV emote embed - handles its own loading state
  if (linkInfo.type === '7tv' && linkInfo.emoteId) {
    return <SevenTVEmbed emoteId={linkInfo.emoteId} url={url} onDismiss={handleDismiss} />;
  }

  if (!metadata || (!metadata.title && !metadata.description && !metadata.image)) {
    return null;
  }

  const hostname = (() => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  })();

  // Special handling for image type
  if (metadata.type === 'image') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block mt-2 max-w-md group"
      >
        <div className="rounded-lg overflow-hidden border border-gray-700 bg-twitch-dark hover:border-gray-600 transition-colors">
          <img
            src={metadata.image}
            alt={metadata.title || 'Image'}
            className="max-h-64 w-auto object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      </a>
    );
  }

  return (
    <div className="mt-2 max-w-md relative group">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDismissed(true);
        }}
        className="absolute -top-1 -right-1 p-1 bg-gray-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-gray-700"
        title="Dismiss preview"
      >
        <X className="w-3 h-3 text-gray-400" />
      </button>
      
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-lg overflow-hidden border border-gray-700 bg-twitch-dark hover:border-gray-600 transition-colors"
      >
        {/* Image preview */}
        {metadata.image && !imageError && (
          <div className="relative bg-gray-900">
            <img
              src={metadata.image}
              alt={metadata.title || 'Preview'}
              className="w-full h-32 object-cover"
              onError={() => setImageError(true)}
            />
          </div>
        )}
        
        {/* Content */}
        <div className="p-3">
          {/* Site info */}
          <div className="flex items-center space-x-2 mb-1">
            {metadata.favicon ? (
              <img 
                src={metadata.favicon} 
                alt="" 
                className="w-4 h-4"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <LinkIcon className="w-4 h-4 text-gray-500" />
            )}
            <span className="text-xs text-gray-500 truncate">
              {metadata.siteName || hostname}
            </span>
            <ExternalLink className="w-3 h-3 text-gray-500 ml-auto flex-shrink-0" />
          </div>
          
          {/* Title */}
          {metadata.title && (
            <h4 className="text-sm font-medium text-white line-clamp-2 mb-1">
              {metadata.title}
            </h4>
          )}
          
          {/* Description */}
          {metadata.description && (
            <p className="text-xs text-gray-400 line-clamp-2">
              {metadata.description}
            </p>
          )}
        </div>
      </a>
    </div>
  );
}

function LinkPreview({ text }) {
  const urls = extractUrls(text);

  if (urls.length === 0) {
    return null;
  }

  // Only show first 2 link previews to avoid spam
  const urlsToShow = urls.slice(0, 2);

  return (
    <div className="flex flex-wrap gap-2">
      {urlsToShow.map((url) => (
        <SingleLinkPreview key={url} url={url} />
      ))}
    </div>
  );
}

export default LinkPreview;
