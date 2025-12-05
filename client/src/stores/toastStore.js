import { create } from 'zustand';

export const useToastStore = create((set, get) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      type: 'info', // 'success' | 'error' | 'warning' | 'info'
      duration: 5000,
      dismissible: true,
      ...toast,
    };
    
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
