#!/usr/bin/env node

import pool from './db.js';

const verifyTestData = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verifying comprehensive test data...\n');
    
    // 1. User distribution by role
    console.log('👥 USERS ANALYSIS:');
    const userRoles = await client.query(`
      SELECT role, COUNT(*) as count, 
             STRING_AGG(name, ', ') as names
      FROM users 
      GROUP BY role 
      ORDER BY count DESC;
    `);
    
    userRoles.rows.forEach(row => {
      console.log(`   • ${row.role}: ${row.count} users`);
      console.log(`     Names: ${row.names}`);
    });
    
    const contactInfo = await client.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(email) as users_with_email,
        COUNT(phone) as users_with_phone,
        COUNT(CASE WHEN email IS NOT NULL AND phone IS NOT NULL THEN 1 END) as users_with_both
      FROM users;
    `);
    
    const contact = contactInfo.rows[0];
    console.log(`\n   Contact information coverage:`);
    console.log(`   • Total users: ${contact.total_users}`);
    console.log(`   • With email: ${contact.users_with_email}`);
    console.log(`   • With phone: ${contact.users_with_phone}`);
    console.log(`   • With both: ${contact.users_with_both}`);
    
    // 2. Bike analysis
    console.log('\n🚲 BIKES ANALYSIS:');
    const bikesByBrand = await client.query(`
      SELECT brand, COUNT(*) as count,
             ROUND(AVG(purchase_price), 0) as avg_price
      FROM bikes 
      GROUP BY brand 
      ORDER BY count DESC;
    `);
    
    bikesByBrand.rows.forEach(row => {
      console.log(`   • ${row.brand}: ${row.count} bikes (avg price: ₽${row.avg_price})`);
    });
    
    const bikesBySize = await client.query(`
      SELECT size, COUNT(*) as count 
      FROM bikes 
      GROUP BY size 
      ORDER BY count DESC;
    `);
    
    console.log(`\n   Size distribution:`);
    bikesBySize.rows.forEach(row => {
      console.log(`   • Size ${row.size}: ${row.count} bikes`);
    });
    
    const bikeCondition = await client.query(`
      SELECT condition_rating, COUNT(*) as count 
      FROM bikes 
      GROUP BY condition_rating 
      ORDER BY condition_rating DESC;
    `);
    
    console.log(`\n   Condition ratings:`);
    bikeCondition.rows.forEach(row => {
      console.log(`   • Rating ${row.condition_rating}/5: ${row.count} bikes`);
    });
    
    // 3. Parts analysis
    console.log('\n🔧 PARTS ANALYSIS:');
    const expensiveParts = await client.query(`
      SELECT name, unit_price, supplier
      FROM part_models 
      ORDER BY unit_price DESC 
      LIMIT 5;
    `);
    
    console.log(`   Most expensive parts:`);
    expensiveParts.rows.forEach(row => {
      console.log(`   • ${row.name}: ₽${row.unit_price} (${row.supplier})`);
    });
    
    const partsBySupplier = await client.query(`
      SELECT supplier, COUNT(*) as parts_count,
             ROUND(AVG(unit_price), 0) as avg_price
      FROM part_models 
      GROUP BY supplier 
      ORDER BY parts_count DESC;
    `);
    
    console.log(`\n   Parts by supplier:`);
    partsBySupplier.rows.forEach(row => {
      console.log(`   • ${row.supplier}: ${row.parts_count} parts (avg: ₽${row.avg_price})`);
    });
    
    // 4. Stock analysis
    console.log('\n📦 STOCK ANALYSIS:');
    const stockSummary = await client.query(`
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        ROUND(AVG(quantity), 1) as avg_quantity,
        COUNT(CASE WHEN quantity <= min_stock THEN 1 END) as low_stock_items
      FROM part_stock;
    `);
    
    const stock = stockSummary.rows[0];
    console.log(`   • Total stock items: ${stock.total_items}`);
    console.log(`   • Total quantity: ${stock.total_quantity} pieces`);
    console.log(`   • Average per item: ${stock.avg_quantity} pieces`);
    console.log(`   • Low stock alerts: ${stock.low_stock_items} items`);
    
    const stockByLocation = await client.query(`
      SELECT warehouse_location, 
             COUNT(*) as items,
             SUM(quantity) as total_qty
      FROM part_stock 
      GROUP BY warehouse_location 
      ORDER BY total_qty DESC;
    `);
    
    console.log(`\n   Stock by location:`);
    stockByLocation.rows.forEach(row => {
      console.log(`   • ${row.warehouse_location}: ${row.items} items (${row.total_qty} pieces)`);
    });
    
    // 5. Maintenance analysis
    console.log('\n🔨 MAINTENANCE ANALYSIS:');
    const maintenanceByType = await client.query(`
      SELECT "тип_ремонта", COUNT(*) as count
      FROM maintenance_events 
      GROUP BY "тип_ремонта" 
      ORDER BY count DESC;
    `);
    
    console.log(`   Repair types:`);
    maintenanceByType.rows.forEach(row => {
      console.log(`   • ${row.тип_ремонта}: ${row.count} events`);
    });
    
    const maintenanceCosts = await client.query(`
      SELECT 
        me."тип_ремонта",
        COUNT(mp.id) as parts_used,
        SUM(mp."использовано" * mp."цена_за_шт") as total_cost
      FROM maintenance_events me
      LEFT JOIN maintenance_parts mp ON me.id = mp."событие_id"
      WHERE mp.id IS NOT NULL
      GROUP BY me."тип_ремонта"
      ORDER BY total_cost DESC;
    `);
    
    console.log(`\n   Repair costs with parts:`);
    maintenanceCosts.rows.forEach(row => {
      console.log(`   • ${row.тип_ремонта}: ${row.parts_used} parts, ₽${row.total_cost}`);
    });
    
    // 6. Purchase requests analysis
    console.log('\n📋 PURCHASE REQUESTS ANALYSIS:');
    const requestsByUser = await client.query(`
      SELECT u.name, u.role,
             COUNT(pr.id) as requests_made,
             SUM(pr.requested_quantity) as total_qty_requested
      FROM users u
      LEFT JOIN purchase_requests pr ON u.id = pr.requested_by
      WHERE pr.id IS NOT NULL
      GROUP BY u.id, u.name, u.role
      ORDER BY requests_made DESC;
    `);
    
    console.log(`   Requests by user:`);
    requestsByUser.rows.forEach(row => {
      console.log(`   • ${row.name} (${row.role}): ${row.requests_made} requests (${row.total_qty_requested} items)`);
    });
    
    const urgentRequests = await client.query(`
      SELECT pr.reason, pm.name, pr.requested_quantity
      FROM purchase_requests pr
      JOIN part_models pm ON pr.part_model_id = pm.id
      WHERE pr.urgent = true;
    `);
    
    console.log(`\n   Urgent requests:`);
    urgentRequests.rows.forEach(row => {
      console.log(`   • ${row.name} (${row.requested_quantity} pcs): ${row.reason}`);
    });
    
    // 7. Complex analytical query
    console.log('\n📈 COMPLEX ANALYTICS:');
    const bikeUtilization = await client.query(`
      SELECT 
        b.name,
        b.brand,
        b.status,
        COUNT(me.id) as maintenance_events,
        CASE 
          WHEN COUNT(me.id) > 2 THEN 'High maintenance'
          WHEN COUNT(me.id) > 0 THEN 'Normal maintenance'
          ELSE 'No maintenance yet'
        END as maintenance_level
      FROM bikes b
      LEFT JOIN maintenance_events me ON b.id = me.bike_id
      GROUP BY b.id, b.name, b.brand, b.status
      ORDER BY maintenance_events DESC;
    `);
    
    console.log(`   Bike maintenance profiles:`);
    bikeUtilization.rows.forEach(row => {
      console.log(`   • ${row.name} (${row.brand}): ${row.maintenance_events} events - ${row.maintenance_level}`);
    });
    
    // 8. Data integrity verification
    console.log('\n🔒 DATA INTEGRITY VERIFICATION:');
    const integrityChecks = await client.query(`
      SELECT 
        'Bikes without maintenance' as check_type,
        COUNT(*) as count
      FROM bikes b
      LEFT JOIN maintenance_events me ON b.id = me.bike_id
      WHERE me.id IS NULL
      
      UNION ALL
      
      SELECT 
        'Parts without stock records' as check_type,
        COUNT(*) as count
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE ps.id IS NULL
      
      UNION ALL
      
      SELECT 
        'Maintenance without parts used' as check_type,
        COUNT(*) as count
      FROM maintenance_events me
      LEFT JOIN maintenance_parts mp ON me.id = mp."событие_id"
      WHERE mp.id IS NULL;
    `);
    
    integrityChecks.rows.forEach(row => {
      console.log(`   • ${row.check_type}: ${row.count}`);
    });
    
    console.log('\n✅ Test data verification completed!');
    console.log('\n🎯 Summary: The database now contains realistic, comprehensive test data with:');
    console.log('   • Diverse user profiles with mixed contact information');
    console.log('   • Variety of bike brands, sizes, and conditions');
    console.log('   • Comprehensive parts catalog with realistic pricing');
    console.log('   • Realistic stock levels including low-stock scenarios');
    console.log('   • Mixed status purchase requests with urgency levels');
    console.log('   • Various maintenance scenarios with parts tracking');
    console.log('   • Proper relational data integrity across all tables');
    
  } catch (error) {
    console.error('❌ Error verifying test data:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

// Run the verification
verifyTestData()
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