import { useEffect, useState } from 'react';
import { useToastStore } from '../../stores/toastStore';
import { Clock, AlertTriangle, X } from 'lucide-react';

/**
 * Rate limit banner that shows a countdown when rate limited
 */
export default function RateLimitBanner() {
  const rateLimit = useToastStore((state) => state.rateLimit);
  const clearRateLimit = useToastStore((state) => state.clearRateLimit);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!rateLimit) {
      setDismissed(false);
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const remaining = Math.max(0, Math.ceil((rateLimit.resetTime - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        clearRateLimit();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [rateLimit, clearRateLimit]);

  if (!rateLimit || dismissed || timeRemaining <= 0) {
    return null;
  }

  const formatTime = (seconds) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  const progressPercent = Math.max(0, (timeRemaining / rateLimit.retryAfter) * 100);

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] animate-slide-down">
      <div className="bg-gradient-to-r from-red-900/95 to-orange-900/95 backdrop-blur-sm border-b border-red-500/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-white font-medium">Rate Limit Reached</p>
                <p className="text-red-200 text-sm">
                  Too many requests. Please wait before making more requests.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Countdown Timer */}
              <div className="flex items-center gap-2 bg-black/30 rounded-lg px-4 py-2">
                <Clock className="w-5 h-5 text-red-300" />
                <div className="text-center">
                  <span className="text-2xl font-bold text-white font-mono">
                    {formatTime(timeRemaining)}
                  </span>
                  <p className="text-xs text-red-300 -mt-0.5">remaining</p>
                </div>
              </div>

              {/* Dismiss Button */}
              <button
                onClick={() => setDismissed(true)}
                className="p-2 text-red-300 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
                title="Dismiss (rate limit still active)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-2 h-1 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
