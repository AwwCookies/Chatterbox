import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Link as LinkIcon, X } from 'lucide-react';

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

// Fetch link metadata
async function fetchLinkMetadata(url) {
  const response = await fetch(`${API_BASE}/api/utils/link-preview?url=${encodeURIComponent(url)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch metadata');
  }
  return response.json();
}

function SingleLinkPreview({ url }) {
  const [dismissed, setDismissed] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { data: metadata, isLoading, error } = useQuery({
    queryKey: ['link-preview', url],
    queryFn: () => fetchLinkMetadata(url),
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
    retry: 1,
  });

  if (dismissed || error) {
    return null;
  }

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
