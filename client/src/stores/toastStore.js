import { create } from 'zustand';

export const useToastStore = create((set, get) => ({
  toasts: [],
  
  // Rate limit state
  rateLimit: null, // { retryAfter: seconds, resetTime: Date }
  
  setRateLimit: (retryAfter) => {
    if (retryAfter) {
      set({
        rateLimit: {
          retryAfter,
          resetTime: new Date(Date.now() + retryAfter * 1000),
        },
      });
    } else {
      set({ rateLimit: null });
    }
  },
  
  clearRateLimit: () => {
    set({ rateLimit: null });
  },
  
  addToast: (toastOrMessage, typeOrOptions) => {
    const id = Date.now() + Math.random();
    
    // Support both: addToast('message', 'type') and addToast({ message, type, ... })
    let newToast;
    if (typeof toastOrMessage === 'string') {
      // Called as addToast('message', 'type') or addToast('message', { type, ... })
      const message = toastOrMessage;
      const options = typeof typeOrOptions === 'string' 
        ? { type: typeOrOptions }
        : (typeOrOptions || {});
      newToast = {
        id,
        type: 'info',
        duration: 5000,
        dismissible: true,
        message,
        ...options,
      };
    } else {
      // Called as addToast({ message, type, ... })
      newToast = {
        id,
        type: 'info',
        duration: 5000,
        dismissible: true,
        ...toastOrMessage,
      };
    }
    
    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));
    
    // Auto-dismiss after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, newToast.duration);
    }
    
    return id;
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  
  clearToasts: () => {
    set({ toasts: [] });
  },
  
  // Convenience methods
  success: (message, options = {}) => {
    return get().addToast({ type: 'success', message, ...options });
  },
  
  error: (message, options = {}) => {
    return get().addToast({ type: 'error', message, duration: 8000, ...options });
  },
  
  warning: (message, options = {}) => {
    return get().addToast({ type: 'warning', message, ...options });
  },
  
  info: (message, options = {}) => {
    return get().addToast({ type: 'info', message, ...options });
  },
}));

// Hook for easy access
export const useToast = () => {
  const { success, error, warning, info, addToast, removeToast, clearToasts } = useToastStore();
  return { success, error, warning, info, addToast, removeToast, clearToasts };
};
