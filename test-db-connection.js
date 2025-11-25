import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    
    const client = await pool.connect();
    console.log('✓ Connected to database successfully');
    
    const result = await client.query('SELECT NOW()');
    console.log('✓ Query successful:', result.rows[0]);
    
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

testConnection();
