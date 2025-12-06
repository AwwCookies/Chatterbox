import Message from '../models/Message.js';
import ModAction from '../models/ModAction.js';
import logger from '../utils/logger.js';

class ArchiveService {
  constructor() {
    this.messageBuffer = [];
    this.bufferFlushInterval = 5000; // 5 seconds
    this.maxBufferSize = 1000;
    this.flushTimer = null;
    this.isProcessing = false;
    this.websocketService = null;
    this.statsCallback = null; // Callback to fetch fresh stats
  }

  /**
   * Set the websocket service for broadcasting flush events
   */
  setWebsocketService(websocketService) {
    this.websocketService = websocketService;
  }

  /**
   * Set callback to fetch stats for broadcasting
   */
  setStatsCallback(callback) {
    this.statsCallback = callback;
  }

  /**
   * Start the buffer flush timer
   */
  start() {
    this.flushTimer = setInterval(() => {
      this.flushMessageBuffer();
    }, this.bufferFlushInterval);
    
    logger.info('Archive service started');
  }

  /**
   * Stop the service and flush remaining messages
   */
  async stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    // Flush any remaining messages
    await this.flushMessageBuffer();
    logger.info('Archive service stopped');
  }

  /**
   * Queue a message for batch insertion
   */
  queueMessage(messageData) {
    this.messageBuffer.push(messageData);
    
    // Flush if buffer is full
    if (this.messageBuffer.length >= this.maxBufferSize) {
      this.flushMessageBuffer();
    }
  }

  /**
   * Flush the message buffer to the database
   */
  async flushMessageBuffer() {
    if (this.isProcessing || this.messageBuffer.length === 0) {
      return;
    }

    this.isProcessing = true;
    const messagesToInsert = [...this.messageBuffer];
    this.messageBuffer = [];

    try {
      const inserted = await Message.bulkCreate(messagesToInsert);
      logger.info(`Flushed ${inserted.length} messages to database`);
      
      // Notify clients that messages have been flushed
      if (this.websocketService && inserted.length > 0) {
        // Extract unique usernames and channels from flushed messages
        const flushedUsers = [...new Set(messagesToInsert.map(m => m.username?.toLowerCase()).filter(Boolean))];
        const flushedChannels = [...new Set(messagesToInsert.map(m => m.channelName?.toLowerCase()).filter(Boolean))];
        
        this.websocketService.broadcastToAll('messages_flushed', {
          usernames: flushedUsers,
          channels: flushedChannels,
          count: inserted.length,
          timestamp: new Date().toISOString()
        });

        // Broadcast stats update to global subscribers
        if (this.statsCallback) {
          try {
            const stats = await this.statsCallback();
            this.websocketService.broadcastStatsUpdate(stats);
          } catch (err) {
            logger.error('Error broadcasting stats update:', err.message);
          }
        }
      }
    } catch (error) {
      logger.error('Error flushing message buffer:', error.message);
      // Re-queue failed messages (with some limit to prevent infinite loop)
      if (messagesToInsert.length < this.maxBufferSize * 2) {
        this.messageBuffer = [...messagesToInsert, ...this.messageBuffer];
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Mark a message as deleted
   */
  async markMessageDeleted(messageId, deletedById = null) {
    try {
      return await Message.markDeleted(messageId, deletedById);
    } catch (error) {
      logger.error('Error marking message deleted:', error.message);
      return null;
    }
  }

  /**
   * Record a moderation action
   */
  async recordModAction(actionData) {
    try {
      const result = await ModAction.create(actionData);
      return result;
    } catch (error) {
      logger.error('Error recording mod action:', error.message);
      return null;
    }
  }

  /**
   * Get buffer statistics
   */
  getStats() {
    return {
      bufferedMessages: this.messageBuffer.length,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Get the last message for a user in a channel from the buffer
   * This is useful for mod actions where the message may not have been flushed yet
   */
  getLastBufferedMessage(channelId, userId, username) {
    // Search buffer in reverse (most recent first)
    for (let i = this.messageBuffer.length - 1; i >= 0; i--) {
      const msg = this.messageBuffer[i];
      if (msg.channelId === channelId && (msg.userId === userId || msg.username?.toLowerCase() === username?.toLowerCase())) {
        return {
          message_text: msg.messageText,
          timestamp: msg.timestamp
        };
      }
    }
    return null;
  }
}

export default ArchiveService;
