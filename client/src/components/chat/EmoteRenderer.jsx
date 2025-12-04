import React from 'react';

// URL regex pattern
const urlPattern = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// Render text with clickable links
function renderTextWithLinks(text, keyPrefix = '') {
  const parts = [];
  let lastIndex = 0;
  let match;
  
  // Reset regex state
  urlPattern.lastIndex = 0;
  
  while ((match = urlPattern.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(
        <span key={`${keyPrefix}-text-${lastIndex}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }
    
    // Add the URL as a link
    parts.push(
      <a
        key={`${keyPrefix}-link-${match.index}`}
        href={match[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {match[0]}
      </a>
    );
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={`${keyPrefix}-text-${lastIndex}`}>
        {text.slice(lastIndex)}
      </span>
    );
  }
  
  return parts.length > 0 ? parts : text;
}

function EmoteRenderer({ parts }) {
  if (!parts || parts.length === 0) {
    return null;
  }

  return (
    <span className="inline">
      {parts.map((part, index) => {
        if (part.type === 'emote') {
          return (
            <img
              key={`${part.content}-${index}`}
              src={part.emote.url}
              alt={part.content}
              title={`${part.content} (${part.emote.type})`}
              className="inline-block h-7 align-middle mx-0.5"
              loading="lazy"
              onError={(e) => {
                // If emote fails to load, replace with text
                e.target.outerHTML = part.content;
              }}
            />
          );
        }
        // Render text with clickable links
        return (
          <span key={index}>
            {renderTextWithLinks(part.content, `part-${index}`)}
          </span>
        );
      })}
    </span>
  );
}

export default EmoteRenderer;
