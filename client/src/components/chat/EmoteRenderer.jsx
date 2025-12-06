import React from 'react';
import { useProfileCardStore } from '../../stores/profileCardStore';

// URL regex pattern
const urlPattern = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// Mention regex pattern
const mentionPattern = /@([a-zA-Z0-9_]{1,25})/g;

// Component to render a clickable mention
function MentionLink({ username }) {
  const openCard = useProfileCardStore(state => state.openCard);
  
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    openCard(username);
  };
  
  return (
    <button
      onClick={handleClick}
      className="text-twitch-purple hover:underline font-medium cursor-pointer"
    >
      @{username}
    </button>
  );
}

// Render text with mentions highlighted and clickable
function renderTextWithMentions(text, keyPrefix = '') {
  const parts = [];
  let lastIndex = 0;
  let match;
  
  // Reset regex state
  mentionPattern.lastIndex = 0;
  
  while ((match = mentionPattern.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(
        <span key={`${keyPrefix}-text-${lastIndex}`}>
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }
    
    // Add the mention as a clickable link
    parts.push(
      <MentionLink 
        key={`${keyPrefix}-mention-${match.index}`} 
        username={match[1]} 
      />
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

// Render text with clickable links and mentions
function renderTextWithLinksAndMentions(text, keyPrefix = '') {
  const parts = [];
  let lastIndex = 0;
  let match;
  
  // Reset regex state
  urlPattern.lastIndex = 0;
  
  while ((match = urlPattern.exec(text)) !== null) {
    // Add text before the URL (with mentions parsed)
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      parts.push(
        <span key={`${keyPrefix}-text-${lastIndex}`}>
          {renderTextWithMentions(textBefore, `${keyPrefix}-pre-${lastIndex}`)}
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
  
  // Add remaining text (with mentions parsed)
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    parts.push(
      <span key={`${keyPrefix}-text-${lastIndex}`}>
        {renderTextWithMentions(remainingText, `${keyPrefix}-post-${lastIndex}`)}
      </span>
    );
  }
  
  return parts.length > 0 ? parts : renderTextWithMentions(text, keyPrefix);
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
        // Render text with clickable links and mentions
        return (
          <span key={index}>
            {renderTextWithLinksAndMentions(part.content, `part-${index}`)}
          </span>
        );
      })}
    </span>
  );
}

export default EmoteRenderer;
