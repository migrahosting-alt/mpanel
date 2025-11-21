import db from './index.js';

async function checkMigrations() {
  try {
    const result = await db.query('SELECT name, executed_at FROM _migrations ORDER BY executed_at DESC');
    console.log('\n=== Executed Migrations ===');
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name} (${row.executed_at.toISOString()})`);
    });
    console.log(`\nTotal: ${result.rows.length} migration(s) executed\n`);
    process.exit(0);
  } catch (error) {
    console.error('Error checking migrations:', error.message);
    process.exit(1);
  }
}

checkMigrations();
