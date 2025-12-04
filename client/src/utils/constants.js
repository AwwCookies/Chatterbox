export const API_URL = import.meta.env.VITE_API_URL || '';
export const WS_URL = import.meta.env.VITE_WS_URL || '';

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
};

export const ACTION_TYPES = [
  { value: 'ban', label: 'Ban' },
  { value: 'timeout', label: 'Timeout' },
  { value: 'delete', label: 'Delete' },
  { value: 'unban', label: 'Unban' },
  { value: 'untimeout', label: 'Untimeout' },
  { value: 'clear', label: 'Clear' },
];

export const BADGE_TYPES = {
  moderator: { name: 'Moderator', icon: '🗡️' },
  subscriber: { name: 'Subscriber', icon: '⭐' },
  vip: { name: 'VIP', icon: '💎' },
  broadcaster: { name: 'Broadcaster', icon: '📺' },
  admin: { name: 'Admin', icon: '👑' },
  staff: { name: 'Staff', icon: '🔧' },
};
