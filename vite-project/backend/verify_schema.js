#!/usr/bin/env node

import pool from './db.js';

const verifySchema = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verifying database schema...\n');
    
    // Get schema information for all tables
    const schemaResult = await client.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position;
    `);
    
    // Group columns by table
    const tableSchemas = {};
    schemaResult.rows.forEach(row => {
      if (!tableSchemas[row.table_name]) {
        tableSchemas[row.table_name] = [];
      }
      tableSchemas[row.table_name].push(row);
    });
    
    // Display schema for each table
    for (const [tableName, columns] of Object.entries(tableSchemas)) {
      console.log(`📋 Table: ${tableName}`);
      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`   • ${col.column_name}: ${col.data_type}${length} ${nullable}${defaultVal}`);
      });
      console.log('');
    }
    
    // Check foreign key constraints
    console.log('🔗 Foreign key constraints:');
    const fkResult = await client.query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `);
    
    fkResult.rows.forEach(row => {
      console.log(`   • ${row.table_name}.${row.column_name} → ${row.foreign_table_name}.${row.foreign_column_name}`);
    });
    
    console.log('\n✅ Schema verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Error verifying schema:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Run the script
verifySchema()
  .then(() => {
    console.log('\n🏁 Verification completed. Closing connection...');
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Verification failed:', error.message);
    pool.end();
    process.exit(1);
  });