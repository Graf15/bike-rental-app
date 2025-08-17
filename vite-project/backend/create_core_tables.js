#!/usr/bin/env node

import pool from './db.js';

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔗 Connecting to bikerental database...');
    
    // Start transaction
    await client.query('BEGIN');
    
    console.log('🏗️ Creating core database tables...\n');
    
    // 1. Users table
    console.log('1. Creating users table...');
    await client.query(`
      CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE,
          phone VARCHAR(20),
          role VARCHAR(50) DEFAULT 'employee',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('   ✅ Users table created');
    
    // 2. Bikes table
    console.log('2. Creating bikes table...');
    await client.query(`
      CREATE TABLE bikes (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          model VARCHAR(100),
          brand VARCHAR(50),
          size VARCHAR(10),
          color VARCHAR(30),
          purchase_date DATE,
          purchase_price DECIMAL(10,2),
          status VARCHAR(50) DEFAULT 'в наличии',
          condition_rating INTEGER DEFAULT 5 CHECK (condition_rating BETWEEN 1 AND 5),
          last_service_date DATE,
          service_interval_days INTEGER DEFAULT 30,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('   ✅ Bikes table created');
    
    // 3. Part models table
    console.log('3. Creating part_models table...');
    await client.query(`
      CREATE TABLE part_models (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          category VARCHAR(50),
          brand VARCHAR(50),
          model VARCHAR(100),
          description TEXT,
          unit_price DECIMAL(10,2) DEFAULT 0,
          supplier VARCHAR(100),
          part_number VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('   ✅ Part models table created');
    
    // 4. Part stock table
    console.log('4. Creating part_stock table...');
    await client.query(`
      CREATE TABLE part_stock (
          id SERIAL PRIMARY KEY,
          part_model_id INTEGER NOT NULL REFERENCES part_models(id) ON DELETE CASCADE,
          quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
          min_stock INTEGER DEFAULT 5,
          max_stock INTEGER DEFAULT 100,
          warehouse_location VARCHAR(50),
          last_updated TIMESTAMP DEFAULT NOW(),
          notes TEXT
      );
    `);
    console.log('   ✅ Part stock table created');
    
    // 5. Maintenance events table
    console.log('5. Creating maintenance_events table...');
    await client.query(`
      CREATE TABLE maintenance_events (
          id SERIAL PRIMARY KEY,
          bike_id INTEGER NOT NULL REFERENCES bikes(id) ON DELETE CASCADE,
          "тип_ремонта" VARCHAR(100) NOT NULL,
          "статус_ремонта" VARCHAR(50) DEFAULT 'запланирован',
          "дата_начала" TIMESTAMP,
          "дата_окончания" TIMESTAMP,
          "ремонт_запланирован_на" DATE,
          "примечания" TEXT,
          "исполнитель" VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('   ✅ Maintenance events table created');
    
    // 6. Maintenance parts table
    console.log('6. Creating maintenance_parts table...');
    await client.query(`
      CREATE TABLE maintenance_parts (
          id SERIAL PRIMARY KEY,
          "событие_id" INTEGER NOT NULL REFERENCES maintenance_events(id) ON DELETE CASCADE,
          part_model_id INTEGER NOT NULL REFERENCES part_models(id),
          "использовано" INTEGER NOT NULL CHECK ("использовано" > 0),
          "цена_за_шт" DECIMAL(10,2) DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('   ✅ Maintenance parts table created');
    
    // 7. Purchase requests table
    console.log('7. Creating purchase_requests table...');
    await client.query(`
      CREATE TABLE purchase_requests (
          id SERIAL PRIMARY KEY,
          part_model_id INTEGER NOT NULL REFERENCES part_models(id) ON DELETE CASCADE,
          requested_quantity INTEGER NOT NULL CHECK (requested_quantity > 0),
          reason VARCHAR(255),
          status VARCHAR(50) DEFAULT 'pending',
          requested_by INTEGER REFERENCES users(id),
          requested_at TIMESTAMP DEFAULT NOW(),
          approved_by INTEGER REFERENCES users(id),
          approved_at TIMESTAMP,
          notes TEXT,
          urgent BOOLEAN DEFAULT false
      );
    `);
    console.log('   ✅ Purchase requests table created');
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('\n🎉 All tables created successfully!');
    
    // Update statistics
    console.log('\n📊 Updating database statistics...');
    await client.query('ANALYZE');
    console.log('   ✅ Statistics updated');
    
    // Get table summary
    console.log('\n📋 Database summary:');
    const tableInfo = await client.query(`
      SELECT 
        schemaname, 
        tablename, 
        COALESCE(n_tup_ins, 0) as record_count
      FROM pg_stat_user_tables 
      WHERE tablename IN (
        'users', 'bikes', 'part_models', 'part_stock', 
        'maintenance_events', 'maintenance_parts', 'purchase_requests'
      )
      ORDER BY tablename;
    `);
    
    console.log('   📊 Created tables and record counts:');
    tableInfo.rows.forEach(row => {
      console.log(`      • ${row.tablename}: ${row.record_count} records`);
    });
    
    console.log('\n✅ Core database tables setup completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', error.message);
    console.error('Full error details:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run the script
createTables()
  .then(() => {
    console.log('\n🏁 Database setup completed. Closing connection...');
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Database setup failed:', error.message);
    pool.end();
    process.exit(1);
  });