const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:iGoMango10!@localhost:5432/sentinelai'
});

async function initDatabase() {
  try {
    console.log('🚀 Initializing database...\n');
    
    // Read schema file
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📖 Executing schema.sql...\n');
    
    // Execute schema
    await pool.query(schema);
    
    console.log('✅ Database schema created successfully!\n');
    
    // Verify tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('📊 Tables created:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Check today's stats entry
    const statsCheck = await pool.query(`
      SELECT * FROM flow_stats WHERE date = CURRENT_DATE
    `);
    
    console.log(`\n✅ Flow stats initialized: ${statsCheck.rows.length} entry for today`);
    
    console.log('\n🎉 Database initialization complete!');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
    console.error('\nFull error:', error);
  } finally {
    await pool.end();
  }
}

// Run initialization
initDatabase();