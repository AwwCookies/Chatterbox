/**
 * Validate and sanitize pagination parameters
 */
export const validatePagination = (query) => {
  const limit = Math.min(Math.max(parseInt(query.limit) || 50, 1), 100);
  const offset = Math.max(parseInt(query.offset) || 0, 0);
  return { limit, offset };
};

/**
 * Validate date string
 */
export const validateDate = (dateStr) => {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Sanitize channel name (remove # prefix if present)
 */
export const sanitizeChannelName = (channel) => {
  if (!channel) return null;
  return channel.replace(/^#/, '').toLowerCase().trim();
};

/**
 * Sanitize username
 */
export const sanitizeUsername = (username) => {
  if (!username) return null;
  return username.toLowerCase().trim();
};

/**
 * Validate action type
 */
export const validateActionType = (type) => {
  const validTypes = ['ban', 'timeout', 'delete', 'unban', 'untimeout', 'clear'];
  return validTypes.includes(type) ? type : null;
};

/**
 * Build WHERE clause conditions from filters
 */
export const buildWhereClause = (filters, startIndex = 1) => {
  const conditions = [];
  const values = [];
  let paramIndex = startIndex;

  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined) {
      conditions.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  return { conditions, values, nextIndex: paramIndex };
};
