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
      return await ModAction.create(actionData);
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
}

export default ArchiveService;
