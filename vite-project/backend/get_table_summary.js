#!/usr/bin/env node

import pool from './db.js';

const getTableSummary = async () => {
  const client = await pool.connect();
  
  try {
    console.log('📊 Getting database table summary...\n');
    
    // Get list of tables in public schema
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📋 Tables in bikerental database:');
    
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      
      // Get record count for each table
      const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName};`);
      const recordCount = countResult.rows[0].count;
      
      console.log(`   • ${tableName}: ${recordCount} records`);
    }
    
    console.log('\n✅ Summary completed successfully!');
    
  } catch (error) {
    console.error('❌ Error getting table summary:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Run the script
getTableSummary()
  .then(() => {
    console.log('\n🏁 Summary completed. Closing connection...');
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Summary failed:', error.message);
    pool.end();
    process.exit(1);
  });