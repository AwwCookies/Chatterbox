import pg from 'pg';
import logger from '../utils/logger.js';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'twitch_archive',
  user: process.env.DB_USER || 'twitch',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected database error:', err);
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query executed', { text: text.substring(0, 100), duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query error', { text: text.substring(0, 100), error: error.message });
    throw error;
  }
};

export const getClient = async () => {
  return pool.connect();
};

export const testConnection = async () => {
  try {
    const result = await query('SELECT NOW()');
    logger.info('Database connection successful');
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    return false;
  }
};

export default pool;
