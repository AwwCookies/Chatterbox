/**
 * Log Service - Stores logs in memory with ring buffer for API access
 */

class LogService {
  constructor(maxLogs = 10000) {
    this.logs = [];
    this.maxLogs = maxLogs;
    this.logId = 0;
  }

  /**
   * Add a log entry
   */
  addLog(level, message, meta = {}) {
    const entry = {
      id: ++this.logId,
      timestamp: new Date().toISOString(),
      level,
      message,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
    };

    this.logs.push(entry);

    // Trim if over limit (ring buffer behavior)
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    return entry;
  }

  /**
   * Get logs with filtering and pagination
   */
  getLogs(options = {}) {
    const {
      level,
      search,
      since,
      until,
      limit = 100,
      offset = 0,
      order = 'desc', // 'asc' or 'desc'
    } = options;

    let filtered = [...this.logs];

    // Filter by level
    if (level) {
      const levels = Array.isArray(level) ? level : [level];
      filtered = filtered.filter(log => levels.includes(log.level));
    }

    // Filter by search term (message or meta)
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        (log.meta && JSON.stringify(log.meta).toLowerCase().includes(searchLower))
      );
    }

    // Filter by time range
    if (since) {
      const sinceDate = new Date(since);
      filtered = filtered.filter(log => new Date(log.timestamp) >= sinceDate);
    }
    if (until) {
      const untilDate = new Date(until);
      filtered = filtered.filter(log => new Date(log.timestamp) <= untilDate);
    }

    // Sort
    if (order === 'desc') {
      filtered.sort((a, b) => b.id - a.id);
    } else {
      filtered.sort((a, b) => a.id - b.id);
    }

    // Get total before pagination
    const total = filtered.length;

    // Paginate
    const paginated = filtered.slice(offset, offset + limit);

    return {
      logs: paginated,
      total,
      limit,
      offset,
      hasMore: offset + paginated.length < total,
    };
  }

  /**
   * Get log statistics
   */
  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {},
      recentErrors: [],
      oldestLog: this.logs[0]?.timestamp || null,
      newestLog: this.logs[this.logs.length - 1]?.timestamp || null,
    };

    // Count by level
    for (const log of this.logs) {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
    }

    // Get recent errors (last 10)
    stats.recentErrors = this.logs
      .filter(log => log.level === 'error')
      .slice(-10)
      .reverse();

    return stats;
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
    this.logId = 0;
  }

  /**
   * Stream logs since a given ID (for real-time updates)
   */
  getLogsSince(lastId) {
    return this.logs.filter(log => log.id > lastId);
  }
}

// Singleton instance
const logService = new LogService();

export default logService;
