import React from 'react';

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
        return <span key={index}>{part.content}</span>;
      })}
    </span>
  );
}

export default EmoteRenderer;
