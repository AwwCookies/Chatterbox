import { useState, useCallback } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { usePullToRefresh } from '../../hooks/useMobile';

function PullToRefresh({ onRefresh, children, className = '' }) {
  const {
    pullDistance,
    refreshing,
    isPulling,
    handlers,
  } = usePullToRefresh(onRefresh, { threshold: 80 });

  const progress = Math.min(pullDistance / 80, 1);
  const showIndicator = isPulling || refreshing;

  return (
    <div 
      className={`relative ${className}`}
      {...handlers}
    >
      {/* Pull indicator */}
      <div 
        className={`absolute left-0 right-0 flex justify-center items-center transition-opacity duration-200 z-10 ${
          showIndicator ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ 
          top: Math.max(pullDistance - 60, 0),
          transform: `translateY(${Math.min(pullDistance, 80)}px)`,
        }}
      >
        <div className={`flex items-center justify-center w-10 h-10 rounded-full bg-twitch-gray border border-gray-600 shadow-lg ${
          refreshing ? 'animate-spin' : ''
        }`}>
          {refreshing ? (
            <RefreshCw className="w-5 h-5 text-twitch-purple" />
          ) : (
            <ChevronDown 
              className="w-5 h-5 text-gray-400 transition-transform duration-200"
              style={{ 
                transform: `rotate(${progress * 180}deg)`,
                color: progress >= 1 ? 'var(--accent-color)' : undefined 
              }}
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div 
        className="transition-transform duration-200"
        style={{ 
          transform: isPulling ? `translateY(${pullDistance * 0.5}px)` : undefined 
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
