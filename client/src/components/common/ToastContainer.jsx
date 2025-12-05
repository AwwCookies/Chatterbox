import { useEffect, useState } from 'react';
import { useToastStore } from '../../stores/toastStore';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const styles = {
  success: {
    bg: 'bg-green-500/10 border-green-500/50',
    icon: 'text-green-400',
    bar: 'bg-green-500',
  },
  error: {
    bg: 'bg-red-500/10 border-red-500/50',
    icon: 'text-red-400',
    bar: 'bg-red-500',
  },
  warning: {
    bg: 'bg-yellow-500/10 border-yellow-500/50',
    icon: 'text-yellow-400',
    bar: 'bg-yellow-500',
  },
  info: {
    bg: 'bg-blue-500/10 border-blue-500/50',
    icon: 'text-blue-400',
    bar: 'bg-blue-500',
  },
};

function Toast({ toast }) {
  const removeToast = useToastStore((state) => state.removeToast);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  const Icon = icons[toast.type] || Info;
  const style = styles[toast.type] || styles.info;

  useEffect(() => {
    if (toast.duration > 0) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - (100 / (toast.duration / 100));
          return newProgress < 0 ? 0 : newProgress;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [toast.duration]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => removeToast(toast.id), 200);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-lg border backdrop-blur-sm shadow-lg transition-all duration-200 ${
        style.bg
      } ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}`}
    >
      <div className="flex items-start p-4 pr-10">
        <Icon className={`w-5 h-5 ${style.icon} flex-shrink-0 mt-0.5`} />
        <div className="ml-3 flex-1">
          {toast.title && (
            <p className="text-sm font-medium text-white">{toast.title}</p>
          )}
          <p className={`text-sm text-gray-300 ${toast.title ? 'mt-1' : ''}`}>
            {toast.message}
          </p>
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="mt-2 text-sm font-medium text-twitch-purple hover:underline"
            >
              {toast.action.label}
            </button>
          )}
        </div>
        {toast.dismissible && (
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Progress bar */}
      {toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/50">
          <div
            className={`h-full ${style.bar} transition-all duration-100`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

export default ToastContainer;
