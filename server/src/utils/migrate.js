import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'twitch_archive',
  user: process.env.DB_USER || 'twitch',
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  console.log('Starting database migration...');
  
  try {
    // Read migration file
    const migrationPath = join(__dirname, '../../migrations/001_initial_schema.sql');
    const sql = readFileSync(migrationPath, 'utf-8');
    
    // Execute migration
    await pool.query(sql);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
