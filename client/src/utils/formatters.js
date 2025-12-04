import { format, formatDistanceToNow, parseISO } from 'date-fns';

/**
 * Format a timestamp to readable date/time
 */
export const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp);
  return format(date, 'MMM d, yyyy h:mm:ss a');
};

/**
 * Format a timestamp to just the time
 */
export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp);
  return format(date, 'h:mm:ss a');
};

/**
 * Format a timestamp to relative time (e.g., "5 minutes ago")
 */
export const formatRelative = (timestamp) => {
  if (!timestamp) return '';
  const date = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp);
  return formatDistanceToNow(date, { addSuffix: true });
};

/**
 * Format a duration in seconds to readable format
 */
export const formatDuration = (seconds) => {
  if (!seconds) return '';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
};

/**
 * Format a large number with K/M suffixes
 */
export const formatNumber = (num) => {
  if (!num && num !== 0) return '';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

/**
 * Capitalize first letter
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Get badge color class
 */
export const getBadgeClass = (badgeType) => {
  const classes = {
    moderator: 'badge-moderator',
    subscriber: 'badge-subscriber',
    vip: 'badge-vip',
    broadcaster: 'bg-red-600 text-white',
    admin: 'bg-yellow-500 text-black',
  };
  return classes[badgeType] || 'bg-gray-600 text-white';
};

/**
 * Get action type color class
 */
export const getActionClass = (actionType) => {
  const classes = {
    ban: 'action-ban',
    timeout: 'action-timeout',
    delete: 'action-delete',
    clear: 'action-clear',
    unban: 'bg-green-600 text-white',
    untimeout: 'bg-green-600 text-white',
  };
  return classes[actionType] || 'bg-gray-600 text-white';
};
