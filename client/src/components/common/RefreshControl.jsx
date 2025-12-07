import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, Clock, ChevronDown, Check } from 'lucide-react';

const REFRESH_INTERVALS = [
  { value: 0, label: 'Off' },
  { value: 15, label: '15s' },
  { value: 30, label: '30s' },
  { value: 60, label: '1m' },
  { value: 300, label: '5m' },
];

export default function RefreshControl({ 
  onRefresh, 
  isLoading = false,
  lastUpdated = null,
  storageKey = null,  // Optional: persist auto-refresh setting
  className = ''
}) {
  const [autoRefresh, setAutoRefresh] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const dropdownRef = useRef(null);
  const intervalRef = useRef(null);
  const countdownRef = useRef(null);

  // Load saved preference
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`autoRefresh_${storageKey}`);
      if (saved) {
        setAutoRefresh(parseInt(saved, 10));
      }
    }
  }, [storageKey]);

  // Save preference when changed
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`autoRefresh_${storageKey}`, autoRefresh.toString());
    }
  }, [autoRefresh, storageKey]);

  // Handle auto-refresh interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    if (autoRefresh > 0) {
      setCountdown(autoRefresh);
      
      // Countdown timer
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            return autoRefresh;
          }
          return prev - 1;
        });
      }, 1000);

      // Refresh timer
      intervalRef.current = setInterval(() => {
        onRefresh();
      }, autoRefresh * 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoRefresh, onRefresh]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleManualRefresh = () => {
    if (!isLoading) {
      onRefresh();
      if (autoRefresh > 0) {
        setCountdown(autoRefresh);
      }
    }
  };

  const formatCountdown = (seconds) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  const getSelectedLabel = () => {
    const selected = REFRESH_INTERVALS.find(i => i.value === autoRefresh);
    return selected ? selected.label : 'Off';
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Last updated indicator */}
      {lastUpdated && (
        <span className="text-xs text-gray-500 hidden sm:inline">
          Updated {new Date(lastUpdated).toLocaleTimeString()}
        </span>
      )}

      {/* Countdown indicator */}
      {autoRefresh > 0 && (
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatCountdown(countdown)}
        </span>
      )}

      {/* Refresh button */}
      <button
        onClick={handleManualRefresh}
        disabled={isLoading}
        className={`p-2 rounded-lg transition-colors ${
          isLoading 
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
        }`}
        title="Refresh now"
      >
        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      </button>

      {/* Auto-refresh dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-sm transition-colors ${
            autoRefresh > 0
              ? 'bg-twitch-purple/20 text-twitch-purple border border-twitch-purple/30'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{getSelectedLabel()}</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[120px] py-1">
            <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700">
              Auto-refresh
            </div>
            {REFRESH_INTERVALS.map(interval => (
              <button
                key={interval.value}
                onClick={() => {
                  setAutoRefresh(interval.value);
                  setShowDropdown(false);
                  if (interval.value > 0) {
                    setCountdown(interval.value);
                  }
                }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-700 transition-colors ${
                  autoRefresh === interval.value ? 'text-twitch-purple' : 'text-gray-300'
                }`}
              >
                <span>{interval.label}</span>
                {autoRefresh === interval.value && <Check className="w-4 h-4" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
