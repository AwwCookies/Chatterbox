import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { create } from 'zustand';
import wsService from '../services/websocket';
import notificationService from '../services/notifications';

// Stable empty history array (created once, reused)
const EMPTY_MPS_HISTORY = Array(60).fill(0).map((_, i) => ({ time: i, value: 0 }));

// Zustand store for WebSocket state (allows external subscriptions)
export const useWebSocketStore = create((set, get) => ({
  messages: [],
  modActions: [],
  maxMessages: 500,
  // Channel-specific MPS tracking
  channelMps: {},
  channelMpsHistory: {}, // channelName -> array of {time, value}
  channelPeakMps: {},
  
  addMessage: (message) => {
    set(state => ({
      messages: [message, ...state.messages].slice(0, state.maxMessages),
    }));
  },
  
  addModAction: (action) => {
    // Trigger notification for ban/timeout
    notificationService.notifyModAction(action);
    
    set(state => ({
      modActions: [action, ...state.modActions].slice(0, 100),
    }));
  },
  
  markMessageDeleted: (messageId, deletedAt) => {
    set(state => ({
      messages: state.messages.map(msg =>
        msg.messageId === messageId
          ? { ...msg, is_deleted: true, deleted_at: deletedAt }
          : msg
      ),
    }));
  },
  
  setChannelMps: (channel, mps) => {
    set(state => {
      const history = state.channelMpsHistory[channel] || EMPTY_MPS_HISTORY;
      const newHistory = [...history.slice(1), { time: history.length, value: mps }]
        .map((item, i) => ({ ...item, time: i }));
      const currentPeak = state.channelPeakMps[channel] || 0;
      
      return {
        channelMps: { ...state.channelMps, [channel]: mps },
        channelMpsHistory: { ...state.channelMpsHistory, [channel]: newHistory },
        channelPeakMps: { ...state.channelPeakMps, [channel]: Math.max(currentPeak, mps) }
      };
    });
  },
  
  clearMessages: () => set({ messages: [] }),
  clearModActions: () => set({ modActions: [] }),
}));

// Zustand store for global real-time stats
export const useGlobalStore = create((set, get) => ({
  stats: null,
  globalModActions: [],
  channelStatuses: {},
  mps: 0,
  mpsHistory: Array(60).fill(0).map((_, i) => ({ time: i, value: 0 })),
  peakMps: 0,
  
  setStats: (stats) => set({ stats }),
  
  setMps: (mps) => set(state => {
    const newHistory = [...state.mpsHistory.slice(1), { time: state.mpsHistory.length, value: mps }]
      .map((item, i) => ({ ...item, time: i }));
    return {
      mps,
      mpsHistory: newHistory,
      peakMps: Math.max(state.peakMps, mps)
    };
  }),
  
  addGlobalModAction: (action) => {
    set(state => ({
      globalModActions: [action, ...state.globalModActions].slice(0, 50),
    }));
  },
  
  updateChannelStatus: (channelData) => {
    set(state => ({
      channelStatuses: {
        ...state.channelStatuses,
        [channelData.name]: channelData,
      },
    }));
  },
  
  clearGlobalModActions: () => set({ globalModActions: [] }),
}));

/**
 * Hook for subscribing to global WebSocket events (dashboard use)
 * Provides real-time stats, global mod actions, and channel status updates
 */
export const useGlobalWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const { stats, globalModActions, channelStatuses, mps, mpsHistory, peakMps } = useGlobalStore();

  useEffect(() => {
    wsService.connect();

    const checkConnection = () => {
      setIsConnected(wsService.isConnected());
    };

    const interval = setInterval(checkConnection, 1000);
    checkConnection();

    return () => {
      clearInterval(interval);
    };
  }, []);

  // Subscribe to global events when connected
  useEffect(() => {
    if (isConnected) {
      wsService.subscribeGlobal();
    }

    return () => {
      wsService.unsubscribeGlobal();
    };
  }, [isConnected]);

  // Set up event listeners
  useEffect(() => {
    const handleStatsUpdate = (data) => {
      useGlobalStore.getState().setStats(data);
    };

    const handleGlobalModAction = (data) => {
      useGlobalStore.getState().addGlobalModAction(data);
    };

    const handleChannelStatus = (data) => {
      useGlobalStore.getState().updateChannelStatus(data);
    };

    const handleMpsUpdate = (data) => {
      useGlobalStore.getState().setMps(data.mps);
    };

    const unsubStats = wsService.on('stats_update', handleStatsUpdate);
    const unsubModAction = wsService.on('global_mod_action', handleGlobalModAction);
    const unsubChannelStatus = wsService.on('channel_status', handleChannelStatus);
    const unsubMps = wsService.on('mps_update', handleMpsUpdate);

    return () => {
      unsubStats();
      unsubModAction();
      unsubChannelStatus();
      unsubMps();
    };
  }, []);

  return {
    isConnected,
    stats,
    globalModActions,
    channelStatuses,
    mps,
    mpsHistory,
    peakMps,
  };
};

export const useWebSocket = (channels = []) => {
  const [isConnected, setIsConnected] = useState(false);
  const prevChannelsRef = useRef('');
  const { messages, modActions, clearMessages, clearModActions } = useWebSocketStore();

  useEffect(() => {
    wsService.connect();

    const checkConnection = () => {
      setIsConnected(wsService.isConnected());
    };

    // Check connection status periodically
    const interval = setInterval(checkConnection, 1000);
    checkConnection();

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const channelKey = channels.sort().join(',');
    
    // Only subscribe/clear if we have channels and they actually changed
    if (channels.length > 0 && isConnected) {
      // Only clear when switching between different channel sets
      if (prevChannelsRef.current && prevChannelsRef.current !== channelKey) {
        clearMessages();
        clearModActions();
      }
      wsService.subscribe(channels);
      prevChannelsRef.current = channelKey;
    }

    return () => {
      if (channels.length > 0) {
        wsService.unsubscribe(channels);
      }
    };
  }, [channels.join(','), isConnected]); // Use join to detect actual channel changes

  useEffect(() => {
    const handleMessage = (data) => {
      useWebSocketStore.getState().addMessage(data.data);
    };

    const handleModAction = (data) => {
      useWebSocketStore.getState().addModAction(data.data);
    };

    const handleMessageDeleted = (data) => {
      useWebSocketStore.getState().markMessageDeleted(data.data.messageId, data.data.deletedAt);
    };

    const handleChannelMps = (data) => {
      useWebSocketStore.getState().setChannelMps(data.channel, data.mps);
    };

    const unsubMessage = wsService.on('message', handleMessage);
    const unsubModAction = wsService.on('mod_action', handleModAction);
    const unsubDeleted = wsService.on('message_deleted', handleMessageDeleted);
    const unsubChannelMps = wsService.on('channel_mps', handleChannelMps);

    return () => {
      unsubMessage();
      unsubModAction();
      unsubDeleted();
      unsubChannelMps();
    };
  }, []);

  return {
    isConnected,
    messages,
    modActions,
    clearMessages,
    clearModActions,
  };
};

/**
 * Hook to get channel-specific MPS data
 */
export const useChannelMps = (channelName) => {
  const mps = useWebSocketStore(state => state.channelMps[channelName] || 0);
  const mpsHistory = useWebSocketStore(state => 
    state.channelMpsHistory[channelName] || EMPTY_MPS_HISTORY
  );
  const peakMps = useWebSocketStore(state => state.channelPeakMps[channelName] || 0);
  
  return { mps, mpsHistory, peakMps };
};

export default useWebSocket;
