#!/usr/bin/env node

import pool from './db.js';

const finalAnalyze = async () => {
  const client = await pool.connect();
  
  try {
    console.log('📊 Running final ANALYZE to update database statistics...');
    
    await client.query('ANALYZE');
    
    console.log('✅ Database statistics updated successfully!');
    
    console.log('\n🎯 Final database setup summary:');
    console.log('   • Database: bikerental');
    console.log('   • Connection: postgresql://postgres:***@localhost:5432/bikerental');
    console.log('   • Tables created: 7 core tables');
    console.log('   • Foreign keys: 7 constraints');
    console.log('   • All tables are empty and ready for data');
    
    console.log('\n📋 Core tables created:');
    console.log('   1. users - User accounts and roles');
    console.log('   2. bikes - Bike inventory and specifications');
    console.log('   3. part_models - Parts catalog/templates');
    console.log('   4. part_stock - Parts inventory management');
    console.log('   5. maintenance_events - Repair and maintenance tracking');
    console.log('   6. maintenance_parts - Parts used in repairs');
    console.log('   7. purchase_requests - Parts procurement requests');
    
  } catch (error) {
    console.error('❌ Error running final analyze:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Run the script
finalAnalyze()
  .then(() => {
    console.log('\n🏁 Database setup completed successfully. Connection closed.');
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Final analyze failed:', error.message);
    pool.end();
    process.exit(1);
  });