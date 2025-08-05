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

// Active repair statuses
const ACTIVE_STATUSES = ['запланирован', 'в ремонте', 'ожидает деталей'];

async function connectToDatabase() {
  try {
    const client = await pool.connect();
    console.log('✅ Successfully connected to PostgreSQL database "bikerental"');
    return client;
  } catch (error) {
    console.error('❌ Error connecting to database:', error.message);
    throw error;
  }
}

async function findDuplicateActiveRepairs(client) {
  console.log('\n🔍 Finding bikes with duplicate active repairs...');
  
  const query = `
    SELECT 
      bike_id,
      COUNT(*) as duplicate_count,
      STRING_AGG(
        'ID: ' || id || 
        ' (статус: ' || "статус_ремонта" || 
        ', тип: ' || COALESCE(repair_type, 'не указан') || 
        ', приоритет: ' || COALESCE(priority::text, 'не указан') || 
        ', создан: ' || created_at::text || ')',
        '; '
        ORDER BY priority ASC NULLS LAST, created_at DESC
      ) as repairs_info
    FROM maintenance_events 
    WHERE "статус_ремонта" = ANY($1)
    GROUP BY bike_id 
    HAVING COUNT(*) > 1
    ORDER BY bike_id;
  `;
  
  try {
    const result = await client.query(query, [ACTIVE_STATUSES]);
    
    if (result.rows.length === 0) {
      console.log('✅ No duplicate active repairs found');
      return [];
    }
    
    console.log(`⚠️  Found ${result.rows.length} bikes with duplicate active repairs:`);
    result.rows.forEach(row => {
      console.log(`   Bike ID ${row.bike_id}: ${row.duplicate_count} active repairs`);
      console.log(`     ${row.repairs_info}`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error finding duplicate repairs:', error.message);
    throw error;
  }
}

async function getRepairsToKeepAndDelete(client, bikeId) {
  console.log(`\n🔍 Analyzing repairs for bike ID ${bikeId}...`);
  
  const query = `
    SELECT 
      id,
      bike_id,
      "статус_ремонта",
      repair_type,
      priority,
      created_at,
      "примечания"
    FROM maintenance_events 
    WHERE bike_id = $1 
    AND "статус_ремонта" = ANY($2)
    ORDER BY 
      priority ASC NULLS LAST,  -- Lower number = higher priority
      created_at DESC           -- Most recent first
  `;
  
  try {
    const result = await client.query(query, [bikeId, ACTIVE_STATUSES]);
    const repairs = result.rows;
    
    if (repairs.length <= 1) {
      return { toKeep: repairs, toDelete: [] };
    }
    
    // Keep the first repair (highest priority, most recent)
    const toKeep = [repairs[0]];
    const toDelete = repairs.slice(1);
    
    console.log(`   📌 Keeping repair ID ${toKeep[0].id} (priority: ${toKeep[0].priority || 'null'}, created: ${toKeep[0].created_at})`);
    console.log(`   🗑️  Will delete ${toDelete.length} duplicate repair(s):`);
    toDelete.forEach(repair => {
      console.log(`      - ID ${repair.id} (priority: ${repair.priority || 'null'}, created: ${repair.created_at})`);
    });
    
    return { toKeep, toDelete };
  } catch (error) {
    console.error(`❌ Error analyzing repairs for bike ${bikeId}:`, error.message);
    throw error;
  }
}

async function deleteDuplicateRepairs(client, repairsToDelete) {
  if (repairsToDelete.length === 0) {
    console.log('✅ No duplicate repairs to delete');
    return;
  }
  
  console.log(`\n🗑️  Deleting ${repairsToDelete.length} duplicate repair(s)...`);
  
  const repairIds = repairsToDelete.map(repair => repair.id);
  const query = `
    DELETE FROM maintenance_events 
    WHERE id = ANY($1)
    RETURNING id, bike_id, "статус_ремонта", repair_type, created_at;
  `;
  
  try {
    const result = await client.query(query, [repairIds]);
    
    console.log(`✅ Successfully deleted ${result.rows.length} duplicate repair(s):`);
    result.rows.forEach(repair => {
      console.log(`   - Deleted repair ID ${repair.id} for bike ${repair.bike_id} (${repair.статус_ремонта})`);
    });
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error deleting duplicate repairs:', error.message);
    throw error;
  }
}

async function createUniqueIndex(client) {
  console.log('\n🔧 Creating unique index to prevent future duplicates...');
  
  const query = `
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_repair_per_bike 
    ON maintenance_events (bike_id) 
    WHERE "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей');
  `;
  
  try {
    await client.query(query);
    console.log('✅ Unique index created successfully');
    
    // Add comment to the index
    const commentQuery = `
      COMMENT ON INDEX idx_unique_active_repair_per_bike IS 
      'Prevents creating multiple active repairs for the same bike';
    `;
    await client.query(commentQuery);
    console.log('✅ Index comment added');
    
  } catch (error) {
    console.error('❌ Error creating unique index:', error.message);
    throw error;
  }
}

async function createTriggerFunction(client) {
  console.log('\n🔧 Creating trigger function...');
  
  const query = `
    CREATE OR REPLACE FUNCTION check_active_repairs_before_insert()
    RETURNS TRIGGER AS $$
    DECLARE
        active_count INTEGER;
        active_repair_info RECORD;
    BEGIN
        -- Check only if creating an active repair
        IF NEW."статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей') THEN
            
            -- Count active repairs for this bike
            SELECT COUNT(*) INTO active_count
            FROM maintenance_events 
            WHERE bike_id = NEW.bike_id 
            AND "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
            AND id != COALESCE(NEW.id, 0); -- Exclude current record on UPDATE
            
            -- If there are active repairs, get info about the first one
            IF active_count > 0 THEN
                SELECT 
                    id, 
                    "статус_ремонта",
                    repair_type
                INTO active_repair_info
                FROM maintenance_events 
                WHERE bike_id = NEW.bike_id 
                AND "статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
                AND id != COALESCE(NEW.id, 0)
                LIMIT 1;
                
                -- Raise detailed error message
                RAISE EXCEPTION 
                    'ACTIVE_REPAIR_EXISTS: Bike ID % already has an active repair (ID: %, type: %, status: "%"). Complete the current repair before starting a new one.',
                    NEW.bike_id,
                    active_repair_info.id,
                    COALESCE(active_repair_info.repair_type, 'not specified'),
                    active_repair_info."статус_ремонта"
                    USING ERRCODE = '23505'; -- Uniqueness violation error code
            END IF;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  try {
    await client.query(query);
    console.log('✅ Trigger function created successfully');
    
    // Add comment to the function
    const commentQuery = `
      COMMENT ON FUNCTION check_active_repairs_before_insert() IS 
      'Trigger function to prevent creating duplicate active repairs';
    `;
    await client.query(commentQuery);
    console.log('✅ Function comment added');
    
  } catch (error) {
    console.error('❌ Error creating trigger function:', error.message);
    throw error;
  }
}

async function createTrigger(client) {
  console.log('\n🔧 Creating trigger...');
  
  // Drop trigger if it exists
  const dropQuery = `DROP TRIGGER IF EXISTS trigger_check_active_repairs ON maintenance_events;`;
  
  // Create trigger
  const createQuery = `
    CREATE TRIGGER trigger_check_active_repairs
        BEFORE INSERT OR UPDATE ON maintenance_events
        FOR EACH ROW
        EXECUTE FUNCTION check_active_repairs_before_insert();
  `;
  
  try {
    await client.query(dropQuery);
    await client.query(createQuery);
    console.log('✅ Trigger created successfully');
    
  } catch (error) {
    console.error('❌ Error creating trigger:', error.message);
    throw error;
  }
}

async function createHelperFunction(client) {
  console.log('\n🔧 Creating helper function to get active repairs...');
  
  const query = `
    CREATE OR REPLACE FUNCTION get_active_repairs_for_bike(p_bike_id INTEGER)
    RETURNS TABLE (
        repair_id INTEGER,
        repair_type_code VARCHAR(20),
        repair_type_name TEXT,
        status_name TEXT,
        created_at TIMESTAMP,
        priority INTEGER
    ) AS $$
    BEGIN
        RETURN QUERY
        SELECT 
            me.id as repair_id,
            me.repair_type as repair_type_code,
            CASE me.repair_type
                WHEN 'current' THEN 'Current/Emergency'
                WHEN 'weekly' THEN 'Weekly Maintenance'  
                WHEN 'longterm' THEN 'Long-term'
                ELSE 'Unknown'
            END as repair_type_name,
            me."статус_ремонта" as status_name,
            me.created_at,
            me.priority
        FROM maintenance_events me
        WHERE me.bike_id = p_bike_id
        AND me."статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
        ORDER BY me.priority ASC NULLS LAST, me.created_at DESC;
    END;
    $$ LANGUAGE plpgsql;
  `;
  
  try {
    await client.query(query);
    console.log('✅ Helper function created successfully');
    
    // Add comment to the function
    const commentQuery = `
      COMMENT ON FUNCTION get_active_repairs_for_bike(INTEGER) IS 
      'Returns list of all active repairs for the specified bike';
    `;
    await client.query(commentQuery);
    console.log('✅ Helper function comment added');
    
  } catch (error) {
    console.error('❌ Error creating helper function:', error.message);
    throw error;
  }
}

async function verifyResults(client) {
  console.log('\n🔍 Verifying results...');
  
  // Check for remaining duplicates
  const duplicateQuery = `
    SELECT 
      bike_id,
      COUNT(*) as count
    FROM maintenance_events 
    WHERE "статус_ремонта" = ANY($1)
    GROUP BY bike_id 
    HAVING COUNT(*) > 1;
  `;
  
  // Get total active repairs count
  const totalQuery = `
    SELECT COUNT(*) as total_active_repairs
    FROM maintenance_events 
    WHERE "статус_ремонта" = ANY($1);
  `;
  
  try {
    const duplicateResult = await client.query(duplicateQuery, [ACTIVE_STATUSES]);
    const totalResult = await client.query(totalQuery, [ACTIVE_STATUSES]);
    
    if (duplicateResult.rows.length === 0) {
      console.log('✅ No duplicate active repairs remaining');
    } else {
      console.log(`⚠️  Warning: ${duplicateResult.rows.length} bikes still have duplicate active repairs`);
      duplicateResult.rows.forEach(row => {
        console.log(`   Bike ID ${row.bike_id}: ${row.count} active repairs`);
      });
    }
    
    console.log(`📊 Total active repairs in database: ${totalResult.rows[0].total_active_repairs}`);
    
  } catch (error) {
    console.error('❌ Error verifying results:', error.message);
    throw error;
  }
}

async function main() {
  let client;
  
  try {
    console.log('🚀 Starting duplicate repair cleanup process...');
    
    // Connect to database
    client = await connectToDatabase();
    
    // Find duplicate active repairs
    const duplicateBikes = await findDuplicateActiveRepairs(client);
    
    if (duplicateBikes.length === 0) {
      console.log('\n✅ No duplicate repairs found. Proceeding to create constraints...');
    } else {
      console.log(`\n🔧 Processing ${duplicateBikes.length} bikes with duplicate repairs...`);
      
      let totalDeleted = 0;
      
      // Process each bike with duplicates
      for (const bike of duplicateBikes) {
        const { toKeep, toDelete } = await getRepairsToKeepAndDelete(client, bike.bike_id);
        
        if (toDelete.length > 0) {
          await deleteDuplicateRepairs(client, toDelete);
          totalDeleted += toDelete.length;
        }
      }
      
      console.log(`\n✅ Cleanup completed! Deleted ${totalDeleted} duplicate repair(s)`);
    }
    
    // Create unique index
    await createUniqueIndex(client);
    
    // Create trigger function
    await createTriggerFunction(client);
    
    // Create trigger
    await createTrigger(client);
    
    // Create helper function
    await createHelperFunction(client);
    
    // Verify results
    await verifyResults(client);
    
    // Update table statistics
    console.log('\n🔧 Updating table statistics...');
    await client.query('ANALYZE maintenance_events;');
    console.log('✅ Table statistics updated');
    
    console.log('\n🎉 All operations completed successfully!');
    console.log('   - Duplicate active repairs have been removed');
    console.log('   - Unique index created to prevent future duplicates'); 
    console.log('   - Trigger function and trigger created for enforcement');
    console.log('   - Helper function created for querying active repairs');
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      client.release();
      console.log('\n🔌 Database connection closed');
    }
    await pool.end();
  }
}

// Run the main function
main().catch(console.error);