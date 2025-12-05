import { useEffect, useState, useCallback, useRef } from 'react';
import { create } from 'zustand';
import wsService from '../services/websocket';

// Zustand store for WebSocket state (allows external subscriptions)
export const useWebSocketStore = create((set, get) => ({
  messages: [],
  modActions: [],
  maxMessages: 500,
  
  addMessage: (message) => {
    set(state => ({
      messages: [message, ...state.messages].slice(0, state.maxMessages),
    }));
  },
  
  addModAction: (action) => {
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
  
  clearMessages: () => set({ messages: [] }),
  clearModActions: () => set({ modActions: [] }),
}));

export const useWebSocket = (channels = []) => {
  const [isConnected, setIsConnected] = useState(false);
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
    if (channels.length > 0 && isConnected) {
      // Clear old data when switching channels
      clearMessages();
      clearModActions();
      wsService.subscribe(channels);
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

    const unsubMessage = wsService.on('message', handleMessage);
    const unsubModAction = wsService.on('mod_action', handleModAction);
    const unsubDeleted = wsService.on('message_deleted', handleMessageDeleted);

    return () => {
      unsubMessage();
      unsubModAction();
      unsubDeleted();
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

export default useWebSocket;
