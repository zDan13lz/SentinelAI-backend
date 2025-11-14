import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function testDB() {
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('🕒 Server time:', res.rows[0].now);
  } catch (err) {
    console.error('❌ Database connection error:', err);
  } finally {
    await client.end();
  }
}

testDB();
