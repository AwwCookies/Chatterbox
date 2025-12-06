import ApiUsage from '../models/ApiUsage.js';
import logger from '../utils/logger.js';

/**
 * Background jobs for usage aggregation and cleanup
 */
class UsageJobs {
  constructor() {
    this.aggregationInterval = null;
    this.cleanupInterval = null;
    this.rateLimitCleanupInterval = null;
  }

  /**
   * Start all background jobs
   */
  start() {
    logger.info('Starting usage background jobs');

    // Run daily aggregation at midnight
    this.scheduleDailyAggregation();

    // Run cleanup weekly
    this.scheduleWeeklyCleanup();

    // Clean up rate limit buckets every 5 minutes
    this.scheduleRateLimitCleanup();

    // Run initial aggregation for yesterday if needed
    this.runInitialAggregation();
  }

  /**
   * Stop all background jobs
   */
  stop() {
    if (this.aggregationInterval) {
      clearInterval(this.aggregationInterval);
      this.aggregationInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = null;
    }
    logger.info('Usage background jobs stopped');
  }

  /**
   * Schedule daily aggregation
   */
  scheduleDailyAggregation() {
    // Run every hour, but only aggregate once per day
    this.aggregationInterval = setInterval(async () => {
      const now = new Date();
      // Run at midnight UTC
      if (now.getUTCHours() === 0 && now.getUTCMinutes() < 5) {
        await this.runAggregation();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Schedule weekly cleanup
   */
  scheduleWeeklyCleanup() {
    // Run every hour, but only cleanup once per week
    this.cleanupInterval = setInterval(async () => {
      const now = new Date();
      // Run on Sunday at 3 AM UTC
      if (now.getUTCDay() === 0 && now.getUTCHours() === 3 && now.getUTCMinutes() < 5) {
        await this.runCleanup();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes
  }

  /**
   * Schedule rate limit bucket cleanup
   */
  scheduleRateLimitCleanup() {
    // Run every 5 minutes
    this.rateLimitCleanupInterval = setInterval(async () => {
      try {
        const deleted = await ApiUsage.cleanupRateLimits();
        if (deleted > 0) {
          logger.debug(`Cleaned up ${deleted} rate limit buckets`);
        }
      } catch (error) {
        logger.error('Error cleaning up rate limit buckets:', error);
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Run initial aggregation for yesterday
   */
  async runInitialAggregation() {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      logger.info(`Running initial aggregation for ${yesterday.toISOString().split('T')[0]}`);
      const rows = await ApiUsage.aggregateDaily(yesterday);
      logger.info(`Initial aggregation completed: ${rows} rows affected`);
    } catch (error) {
      logger.error('Error in initial aggregation:', error);
    }
  }

  /**
   * Run daily aggregation
   */
  async runAggregation() {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      logger.info(`Running daily aggregation for ${yesterday.toISOString().split('T')[0]}`);
      const rows = await ApiUsage.aggregateDaily(yesterday);
      logger.info(`Daily aggregation completed: ${rows} rows affected`);
    } catch (error) {
      logger.error('Error in daily aggregation:', error);
    }
  }

  /**
   * Run cleanup of old records
   */
  async runCleanup(days = 90) {
    try {
      logger.info(`Running cleanup of api_usage records older than ${days} days`);
      const deleted = await ApiUsage.cleanup(days);
      logger.info(`Cleanup completed: ${deleted} records deleted`);
    } catch (error) {
      logger.error('Error in cleanup:', error);
    }
  }

  /**
   * Manually trigger aggregation for a specific date
   */
  async aggregateForDate(date) {
    try {
      const targetDate = new Date(date);
      logger.info(`Manual aggregation for ${targetDate.toISOString().split('T')[0]}`);
      const rows = await ApiUsage.aggregateDaily(targetDate);
      return rows;
    } catch (error) {
      logger.error('Error in manual aggregation:', error);
      throw error;
    }
  }
}

// Singleton instance
const usageJobs = new UsageJobs();

export default usageJobs;
