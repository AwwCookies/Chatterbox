import { useState, useEffect, useCallback } from 'react';

// Cache for emotes (persists across component remounts)
const emoteCache = {
  global: {
    twitch: {},
    bttv: {},
    ffz: {},
    seventv: {},
  },
  channels: {}, // channelId -> { bttv: {}, ffz: {}, seventv: {} }
  channelIds: {}, // channelName -> channelId
  loaded: {
    global: false,
    channels: new Set(),
  },
};

// Fetch global emotes
async function fetchGlobalEmotes() {
  if (emoteCache.loaded.global) return;

  try {
    // BTTV Global
    const bttvGlobal = await fetch('https://api.betterttv.net/3/cached/emotes/global');
    if (bttvGlobal.ok) {
      const data = await bttvGlobal.json();
      data.forEach(emote => {
        emoteCache.global.bttv[emote.code] = {
          id: emote.id,
          url: `https://cdn.betterttv.net/emote/${emote.id}/2x`,
          type: 'bttv',
        };
      });
    }
  } catch (e) {
    console.warn('Failed to fetch BTTV global emotes:', e);
  }

  try {
    // FFZ Global
    const ffzGlobal = await fetch('https://api.frankerfacez.com/v1/set/global');
    if (ffzGlobal.ok) {
      const data = await ffzGlobal.json();
      Object.values(data.sets).forEach(set => {
        set.emoticons?.forEach(emote => {
          emoteCache.global.ffz[emote.name] = {
            id: emote.id,
            url: emote.urls['2'] || emote.urls['1'],
            type: 'ffz',
          };
        });
      });
    }
  } catch (e) {
    console.warn('Failed to fetch FFZ global emotes:', e);
  }

  try {
    // 7TV Global
    const seventvGlobal = await fetch('https://7tv.io/v3/emote-sets/global');
    if (seventvGlobal.ok) {
      const data = await seventvGlobal.json();
      data.emotes?.forEach(emote => {
        const file = emote.data?.host?.files?.find(f => f.name === '2x.webp') || emote.data?.host?.files?.[0];
        if (file && emote.data?.host?.url) {
          emoteCache.global.seventv[emote.name] = {
            id: emote.id,
            url: `https:${emote.data.host.url}/${file.name}`,
            type: '7tv',
          };
        }
      });
    }
  } catch (e) {
    console.warn('Failed to fetch 7TV global emotes:', e);
  }

  emoteCache.loaded.global = true;
}

// Fetch channel emotes
async function fetchChannelEmotes(channelId, channelName) {
  if (!channelId || emoteCache.loaded.channels.has(channelId)) return;

  emoteCache.channels[channelId] = {
    bttv: {},
    ffz: {},
    seventv: {},
  };
  emoteCache.channelIds[channelName.toLowerCase()] = channelId;

  try {
    // BTTV Channel
    const bttvChannel = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channelId}`);
    if (bttvChannel.ok) {
      const data = await bttvChannel.json();
      [...(data.channelEmotes || []), ...(data.sharedEmotes || [])].forEach(emote => {
        emoteCache.channels[channelId].bttv[emote.code] = {
          id: emote.id,
          url: `https://cdn.betterttv.net/emote/${emote.id}/2x`,
          type: 'bttv',
        };
      });
    }
  } catch (e) {
    console.warn(`Failed to fetch BTTV channel emotes for ${channelName}:`, e);
  }

  try {
    // FFZ Channel
    const ffzChannel = await fetch(`https://api.frankerfacez.com/v1/room/id/${channelId}`);
    if (ffzChannel.ok) {
      const data = await ffzChannel.json();
      Object.values(data.sets || {}).forEach(set => {
        set.emoticons?.forEach(emote => {
          emoteCache.channels[channelId].ffz[emote.name] = {
            id: emote.id,
            url: emote.urls['2'] || emote.urls['1'],
            type: 'ffz',
          };
        });
      });
    }
  } catch (e) {
    console.warn(`Failed to fetch FFZ channel emotes for ${channelName}:`, e);
  }

  try {
    // 7TV Channel
    const seventvChannel = await fetch(`https://7tv.io/v3/users/twitch/${channelId}`);
    if (seventvChannel.ok) {
      const data = await seventvChannel.json();
      data.emote_set?.emotes?.forEach(emote => {
        const file = emote.data?.host?.files?.find(f => f.name === '2x.webp') || emote.data?.host?.files?.[0];
        if (file && emote.data?.host?.url) {
          emoteCache.channels[channelId].seventv[emote.name] = {
            id: emote.id,
            url: `https:${emote.data.host.url}/${file.name}`,
            type: '7tv',
          };
        }
      });
    }
  } catch (e) {
    console.warn(`Failed to fetch 7TV channel emotes for ${channelName}:`, e);
  }

  emoteCache.loaded.channels.add(channelId);
}

// Find emote by code
function findEmote(code, channelId = null) {
  // Check channel emotes first
  if (channelId && emoteCache.channels[channelId]) {
    const channelEmotes = emoteCache.channels[channelId];
    if (channelEmotes.seventv[code]) return channelEmotes.seventv[code];
    if (channelEmotes.bttv[code]) return channelEmotes.bttv[code];
    if (channelEmotes.ffz[code]) return channelEmotes.ffz[code];
  }

  // Check global emotes
  if (emoteCache.global.seventv[code]) return emoteCache.global.seventv[code];
  if (emoteCache.global.bttv[code]) return emoteCache.global.bttv[code];
  if (emoteCache.global.ffz[code]) return emoteCache.global.ffz[code];

  return null;
}

// Parse message with Twitch emotes and third-party emotes
export function parseMessageWithEmotes(text, twitchEmotes = [], channelId = null) {
  if (!text) return [];

  const parts = [];
  let lastIndex = 0;

  // Convert Twitch emotes to sorted array of positions
  const twitchEmotePositions = [];
  if (twitchEmotes && Array.isArray(twitchEmotes)) {
    twitchEmotes.forEach(emote => {
      twitchEmotePositions.push({
        start: emote.start,
        end: emote.end + 1,
        id: emote.id,
        type: 'twitch',
      });
    });
  }
  twitchEmotePositions.sort((a, b) => a.start - b.start);

  // Build parts with Twitch emotes
  let currentIndex = 0;
  const textParts = [];

  for (const emote of twitchEmotePositions) {
    if (emote.start > currentIndex) {
      textParts.push({
        type: 'text',
        content: text.slice(currentIndex, emote.start),
      });
    }
    textParts.push({
      type: 'emote',
      content: text.slice(emote.start, emote.end),
      emote: {
        id: emote.id,
        url: `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/dark/2.0`,
        type: 'twitch',
      },
    });
    currentIndex = emote.end;
  }

  if (currentIndex < text.length) {
    textParts.push({
      type: 'text',
      content: text.slice(currentIndex),
    });
  }

  if (textParts.length === 0) {
    textParts.push({ type: 'text', content: text });
  }

  // Now process text parts for third-party emotes
  const finalParts = [];

  for (const part of textParts) {
    if (part.type === 'emote') {
      finalParts.push(part);
      continue;
    }

    // Split text by spaces and check each word
    const words = part.content.split(/(\s+)/);
    
    for (const word of words) {
      if (!word) continue;
      
      // Check if it's whitespace
      if (/^\s+$/.test(word)) {
        finalParts.push({ type: 'text', content: word });
        continue;
      }

      const emote = findEmote(word, channelId);
      if (emote) {
        finalParts.push({
          type: 'emote',
          content: word,
          emote,
        });
      } else {
        finalParts.push({ type: 'text', content: word });
      }
    }
  }

  return finalParts;
}

// Hook to use emotes
export function useEmotes(channels = []) {
  const [isLoaded, setIsLoaded] = useState(emoteCache.loaded.global);

  useEffect(() => {
    fetchGlobalEmotes().then(() => setIsLoaded(true));
  }, []);

  useEffect(() => {
    // Fetch channel emotes when we have channel IDs
    channels.forEach(channel => {
      if (channel.twitch_id) {
        fetchChannelEmotes(channel.twitch_id, channel.name);
      }
    });
  }, [channels]);

  const getChannelId = useCallback((channelName) => {
    return emoteCache.channelIds[channelName?.toLowerCase()] || null;
  }, []);

  const loadChannelEmotes = useCallback(async (channelId, channelName) => {
    await fetchChannelEmotes(channelId, channelName);
  }, []);

  return {
    isLoaded,
    parseMessage: parseMessageWithEmotes,
    getChannelId,
    loadChannelEmotes,
    cache: emoteCache,
  };
}

export default useEmotes;
