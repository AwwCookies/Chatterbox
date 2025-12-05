import { useSettingsStore } from '../stores/settingsStore';

class NotificationService {
  constructor() {
    this.audioContext = null;
  }

  // Check if notifications are enabled and permission is granted
  canNotify() {
    const settings = useSettingsStore.getState();
    return (
      settings.enableNotifications &&
      'Notification' in window &&
      Notification.permission === 'granted'
    );
  }

  // Request notification permission
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      return false;
    }

    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  // Show a browser notification
  show(title, options = {}) {
    if (!this.canNotify()) return;

    const notification = new Notification(title, {
      icon: '/chatterbox-icon.png',
      badge: '/chatterbox-icon.png',
      tag: options.tag || 'chatterbox',
      renotify: options.renotify || false,
      ...options,
    });

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    // Play sound if enabled
    this.playSound();

    return notification;
  }

  // Play notification sound
  playSound() {
    const settings = useSettingsStore.getState();
    if (!settings.soundEnabled) return;

    try {
      // Create a simple beep using Web Audio API
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;

      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
      oscillator.stop(this.audioContext.currentTime + 0.2);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  // Notify for mod actions (ban/timeout)
  notifyModAction(action) {
    const settings = useSettingsStore.getState();
    if (!settings.enableNotifications) return;

    const actionType = action.actionType?.toLowerCase() || action.action_type?.toLowerCase();
    const username = action.targetUser || action.target_user;
    const channel = action.channelName || action.channel_name;

    if (actionType === 'ban' && settings.notifyOnBan) {
      this.show(`User Banned in #${channel}`, {
        body: `${username} was banned`,
        tag: `ban-${username}-${Date.now()}`,
        renotify: true,
      });
    } else if (actionType === 'timeout' && settings.notifyOnTimeout) {
      const duration = action.duration || action.timeout_duration;
      this.show(`User Timed Out in #${channel}`, {
        body: `${username} was timed out${duration ? ` for ${duration}s` : ''}`,
        tag: `timeout-${username}-${Date.now()}`,
        renotify: true,
      });
    }
  }
}

// Singleton instance
const notificationService = new NotificationService();

export default notificationService;
