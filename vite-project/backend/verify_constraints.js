import pkg from "pg";
const { Pool } = pkg;

// Database connection configuration
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "bikerental",
  password: "1515",
  port: 5432,
});

async function testConstraints() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing database constraints...\n');
    
    // Test 1: Try to insert a duplicate active repair
    console.log('Test 1: Attempting to insert a duplicate active repair for bike_id=3...');
    try {
      await client.query(`
        INSERT INTO maintenance_events (bike_id, "статус_ремонта", repair_type, priority, "примечания") 
        VALUES (3, 'запланирован', 'weekly', 2, 'Test duplicate repair');
      `);
      console.log('❌ ERROR: Duplicate repair was allowed to be inserted!');
    } catch (error) {
      if (error.code === '23505') {
        console.log('✅ SUCCESS: Duplicate repair correctly prevented by unique index');
        console.log(`   Error message: ${error.message}`);
      } else {
        console.log('⚠️  UNEXPECTED ERROR:', error.message);
      }
    }
    
    // Test 2: Try to insert a duplicate using trigger function  
    console.log('\nTest 2: Checking if trigger function provides detailed error...');
    try {
      // First, let's try with a different approach that might trigger the function
      await client.query(`
        INSERT INTO maintenance_events (bike_id, "статус_ремонта", repair_type, priority, "примечания") 
        VALUES (3, 'в ремонте', 'current', 1, 'Another test repair');
      `);
      console.log('❌ ERROR: Duplicate repair was allowed!');
    } catch (error) {
      console.log('✅ SUCCESS: Constraint prevented duplicate repair');
      console.log(`   Error code: ${error.code}`);
      if (error.message.includes('ACTIVE_REPAIR_EXISTS')) {
        console.log('✅ Trigger function is working correctly');
      }
    }
    
    // Test 3: Verify current active repairs
    console.log('\nTest 3: Current active repairs in database...');
    const result = await client.query(`
      SELECT 
        bike_id,
        id,
        "статус_ремонта",
        repair_type,
        priority,
        created_at
      FROM maintenance_events 
      WHERE "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
      ORDER BY bike_id, priority ASC NULLS LAST, created_at DESC;
    `);
    
    console.log(`Found ${result.rows.length} active repair(s):`);
    result.rows.forEach(repair => {
      console.log(`   Bike ${repair.bike_id}: Repair ID ${repair.id} (${repair.статус_ремонта}, priority: ${repair.priority})`);
    });
    
    // Test 4: Test helper function
    console.log('\nTest 4: Testing helper function get_active_repairs_for_bike(3)...');
    const helperResult = await client.query(`SELECT * FROM get_active_repairs_for_bike(3);`);
    
    console.log(`Helper function returned ${helperResult.rows.length} active repair(s) for bike 3:`);
    helperResult.rows.forEach(repair => {
      console.log(`   Repair ID ${repair.repair_id}: ${repair.repair_type_name} (${repair.status_name})`);
    });
    
    // Test 5: Test inserting repair for different bike (should work)
    console.log('\nTest 5: Inserting active repair for different bike (should succeed)...');
    try {
      const insertResult = await client.query(`
        INSERT INTO maintenance_events (bike_id, "статус_ремонта", repair_type, priority, "примечания") 
        VALUES (999, 'запланирован', 'weekly', 3, 'Test repair for different bike')
        RETURNING id, bike_id, "статус_ремонта";
      `);
      console.log('✅ SUCCESS: New repair inserted for different bike');
      console.log(`   Inserted repair ID ${insertResult.rows[0].id} for bike ${insertResult.rows[0].bike_id}`);
      
      // Clean up - delete the test record
      await client.query(`DELETE FROM maintenance_events WHERE id = $1`, [insertResult.rows[0].id]);
      console.log('   Test record cleaned up');
      
    } catch (error) {
      console.log('❌ ERROR: Failed to insert repair for different bike:', error.message);
    }
    
    console.log('\n🎉 Constraint testing completed!');
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

testConstraints().catch(console.error);