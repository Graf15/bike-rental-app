#!/usr/bin/env node

import pool from './db.js';

const insertTestData = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🔗 Connecting to bikerental database...');
    
    // Start transaction
    await client.query('BEGIN');
    
    console.log('🏗️ Inserting comprehensive test data...\n');
    
    // 1. USERS (5-7 users) - Mix of employees, mechanics, managers
    console.log('1. Inserting users...');
    const usersData = [
      ['Иванов Сергей Петрович', 'sergey.ivanov@bikerental.ru', '+7-925-123-4567', 'manager'],
      ['Петрова Анна Владимировна', 'anna.petrova@bikerental.ru', '+7-916-987-6543', 'mechanic'],
      ['Smith John', 'john.smith@bikerental.ru', '+7-903-555-0123', 'employee'],
      ['Козлов Михаил Александрович', null, '+7-905-777-8899', 'mechanic'],
      ['Johnson Sarah', 'sarah.j@bikerental.ru', null, 'employee'],
      ['Сидоров Алексей Викторович', 'alexey.sidorov@bikerental.ru', '+7-926-444-3333', 'manager'],
      ['Garcia Maria', null, '+7-915-222-1111', 'employee']
    ];
    
    const userIds = [];
    for (const [name, email, phone, role] of usersData) {
      const result = await client.query(`
        INSERT INTO users (name, email, phone, role, is_active) 
        VALUES ($1, $2, $3, $4, true) 
        RETURNING id
      `, [name, email, phone, role]);
      userIds.push(result.rows[0].id);
    }
    console.log(`   ✅ Inserted ${userIds.length} users`);
    
    // 2. BIKES (10-15 bikes) - Variety of bikes with different statuses
    console.log('2. Inserting bikes...');
    const bikesData = [
      ['Trek Mountain Explorer', 'X-Caliber 8', 'Trek', 'M', 'Синий', '2023-03-15', 85000, 'в наличии', 5],
      ['Giant Road Racer', 'Defy Advanced 2', 'Giant', 'L', 'Черный', '2023-01-20', 120000, 'арендован', 4],
      ['Specialized City Cruiser', 'Sirrus X 3.0', 'Specialized', 'S', 'Красный', '2022-11-10', 95000, 'в наличии', 5],
      ['Merida All-Terrain', 'Big.Nine 500', 'Merida', 'XL', 'Зеленый', '2023-05-08', 75000, 'в ремонте', 3],
      ['Cannondale Urban', 'Quick CX 3', 'Cannondale', 'M', 'Белый', '2023-02-14', 68000, 'в наличии', 4],
      ['Scott Mountain Pro', 'Aspect 940', 'Scott', 'L', 'Оранжевый', '2022-12-05', 82000, 'арендован', 5],
      ['Cube Hybrid', 'Nature Hybrid One', 'Cube', 'M', 'Серый', '2023-04-22', 105000, 'в наличии', 4],
      ['GT Urban Rider', 'Transeo Comp', 'GT', 'S', 'Синий', '2022-10-18', 55000, 'в ремонте', 2],
      ['KTM Adventure', 'Chicago Disc 291', 'KTM', 'L', 'Черный', '2023-06-12', 78000, 'в наличии', 5],
      ['Bianchi Classic', 'C-Sport 1', 'Bianchi', 'M', 'Белый', '2023-01-08', 92000, 'арендован', 4],
      ['Stels Navigator', 'Navigator 600 MD', 'Stels', 'XL', 'Зеленый', '2022-09-25', 35000, 'в наличии', 3],
      ['Forward City Bike', 'Barcelona 2.0', 'Forward', 'S', 'Розовый', '2023-03-30', 28000, 'в наличии', 5],
      ['Kona Trail', 'Process 134', 'Kona', 'L', 'Оранжевый', '2023-07-01', 140000, 'в ремонте', 4],
      ['Norco Endurance', 'Search XR C2', 'Norco', 'M', 'Серый', '2022-11-28', 115000, 'в наличии', 4],
      ['Felt Speed', 'Verza Speed 40', 'Felt', 'S', 'Красный', '2023-02-20', 72000, 'арендован', 5]
    ];
    
    const bikeIds = [];
    for (const [name, model, brand, size, color, purchaseDate, price, status, condition] of bikesData) {
      const result = await client.query(`
        INSERT INTO bikes (name, model, brand, size, color, purchase_date, purchase_price, status, condition_rating) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
        RETURNING id
      `, [name, model, brand, size, color, purchaseDate, price, status, condition]);
      bikeIds.push(result.rows[0].id);
    }
    console.log(`   ✅ Inserted ${bikeIds.length} bikes`);
    
    // 3. PART MODELS (15-20 parts) - Common bike parts
    console.log('3. Inserting part models...');
    const partModelsData = [
      ['Тормозные колодки Shimano', 'тормоза', 'Shimano', 'BR-M315', 'Дисковые тормозные колодки', 850, 'VeloShop', 'Y8FN98010'],
      ['Цепь KMC X11', 'трансмиссия', 'KMC', 'X11-93', '11-скоростная цепь', 2400, 'BikeWorld', 'X11-93-GD'],
      ['Покрышка Continental', 'колеса', 'Continental', 'Grand Prix 5000', '700x25c шоссейная', 4500, 'TireExpress', 'GP5000-70025'],
      ['Камера Schwalbe 26"', 'колеса', 'Schwalbe', 'SV13', 'Камера 26x1.5-2.4', 650, 'VeloShop', 'SV13-26'],
      ['Звездочки Sram', 'трансмиссия', 'Sram', 'PG-1130', 'Кассета 11-42T', 3200, 'BikeWorld', 'PG1130-1142'],
      ['Фонарь передний Cateye', 'освещение', 'Cateye', 'Volt 800', 'USB перезаряжаемый', 5800, 'LightStore', 'HL-EL471RC'],
      ['Фонарь задний Lezyne', 'освещение', 'Lezyne', 'Strip Drive', 'LED задний фонарь', 2100, 'LightStore', 'LZN-STRIP'],
      ['Седло Selle Royal', 'оборудование', 'Selle Royal', 'Scientia M1', 'Спортивное седло', 3800, 'ComfortRide', 'SR-SCI-M1'],
      ['Грипсы Ergon', 'оборудование', 'Ergon', 'GA2 Fat', 'Анатомические ручки', 2900, 'ComfortRide', 'GA2-FAT-L'],
      ['Тросик тормозной Jagwire', 'тормоза', 'Jagwire', 'Elite Link', 'Нержавеющий трос', 450, 'VeloShop', 'JW-ELK-2000'],
      ['Рубашка тросика Jagwire', 'тормоза', 'Jagwire', 'Elite Link', 'Оплетка троса 5мм', 320, 'VeloShop', 'JW-ELK-5MM'],
      ['Педали Shimano SPD', 'оборудование', 'Shimano', 'PD-M540', 'Контактные педали', 4200, 'BikeWorld', 'PD-M540-BK'],
      ['Ось заднего колеса', 'колеса', 'Novatec', 'D142SB', 'Втулка 142x12 Thru', 2800, 'WheelTech', 'D142SB-32H'],
      ['Спицы DT Swiss', 'колеса', 'DT Swiss', 'Competition', '2.0/1.8/2.0 мм', 85, 'WheelTech', 'DT-COMP-264'],
      ['Смазка цепи Finish Line', 'обслуживание', 'Finish Line', 'Wet Lube', 'Влажная смазка 60мл', 750, 'VeloShop', 'FL-WET-60'],
      ['Обезжириватель Muc-Off', 'обслуживание', 'Muc-Off', 'Degreaser', 'Очиститель 500мл', 1200, 'VeloShop', 'MO-DEG-500'],
      ['Шестигранник Park Tool', 'инструменты', 'Park Tool', 'AWS-10', 'Набор ключей 1.5-10мм', 3500, 'ToolMaster', 'PK-AWS10'],
      ['Насос напольный Topeak', 'инструменты', 'Topeak', 'Joe Blow Sport', 'С манометром до 11 bar', 4800, 'ToolMaster', 'TK-JBS'],
  ];
    
    const partModelIds = [];
    for (const [name, category, brand, model, description, price, supplier, partNumber] of partModelsData) {
      const result = await client.query(`
        INSERT INTO part_models (name, category, brand, model, description, unit_price, supplier, part_number) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING id
      `, [name, category, brand, model, description, price, supplier, partNumber]);
      partModelIds.push(result.rows[0].id);
    }
    console.log(`   ✅ Inserted ${partModelIds.length} part models`);
    
    // 4. PART STOCK - Inventory for all part models
    console.log('4. Inserting part stock...');
    const warehouseLocations = ['Основной склад', 'Склад запчастей', 'Мастерская', 'Резервный склад'];
    
    for (let i = 0; i < partModelIds.length; i++) {
      const quantity = Math.floor(Math.random() * 50) + 1; // 1-50 items
      const minStock = Math.floor(Math.random() * 10) + 2; // 2-11 minimum
      const maxStock = Math.floor(Math.random() * 40) + 60; // 60-99 maximum
      const location = warehouseLocations[Math.floor(Math.random() * warehouseLocations.length)];
      
      await client.query(`
        INSERT INTO part_stock (part_model_id, quantity, min_stock, max_stock, warehouse_location) 
        VALUES ($1, $2, $3, $4, $5)
      `, [partModelIds[i], quantity, minStock, maxStock, location]);
    }
    console.log(`   ✅ Inserted stock records for ${partModelIds.length} parts`);
    
    // 5. PURCHASE REQUESTS (5-8 requests) - Mix of statuses
    console.log('5. Inserting purchase requests...');
    const purchaseRequestsData = [
      [partModelIds[0], 20, 'Низкий запас тормозных колодок', 'pending', userIds[1], true, null],
      [partModelIds[2], 5, 'Заказ для планового ремонта', 'approved', userIds[0], false, userIds[5]],
      [partModelIds[5], 3, 'Запрос на новые фонари', 'pending', userIds[2], false, null],
      [partModelIds[8], 10, 'Замена изношенных грипс', 'approved', userIds[3], false, userIds[0]],
      [partModelIds[12], 2, 'Срочный ремонт колеса', 'pending', userIds[1], true, null],
      [partModelIds[15], 6, 'Пополнение расходных материалов', 'approved', userIds[4], false, userIds[5]],
      [partModelIds[7], 4, 'Замена седел на арендных велосипедах', 'pending', userIds[2], false, null],
      [partModelIds[14], 12, 'Регулярное обслуживание', 'approved', userIds[1], false, userIds[0]]
    ];
    
    for (const [partId, quantity, reason, status, requestedBy, urgent, approvedBy] of purchaseRequestsData) {
      await client.query(`
        INSERT INTO purchase_requests (part_model_id, requested_quantity, reason, status, requested_by, urgent, approved_by, approved_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [partId, quantity, reason, status, requestedBy, urgent, approvedBy, 
          approvedBy ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) : null]);
    }
    console.log(`   ✅ Inserted ${purchaseRequestsData.length} purchase requests`);
    
    // 6. MAINTENANCE EVENTS (8-12 events) - Various repair scenarios
    console.log('6. Inserting maintenance events...');
    const maintenanceData = [
      [bikeIds[1], 'Замена тормозных колодок', 'завершен', '2024-01-15 09:00:00', '2024-01-15 11:30:00', '2024-01-15', 'Плановая замена изношенных колодок', userIds[1]],
      [bikeIds[3], 'Ремонт трансмиссии', 'в процессе', '2024-01-20 10:00:00', null, '2024-01-20', 'Замена цепи и кассеты', userIds[3]],
      [bikeIds[7], 'Восстановление после аварии', 'запланирован', null, null, '2024-01-25', 'Серьезные повреждения рамы', userIds[1]],
      [bikeIds[12], 'Плановое ТО', 'в процессе', '2024-01-18 14:00:00', null, '2024-01-18', 'Регулярное обслуживание', userIds[3]],
      [bikeIds[0], 'Замена покрышки', 'завершен', '2024-01-10 15:30:00', '2024-01-10 16:45:00', '2024-01-10', 'Прокол переднего колеса', userIds[1]],
      [bikeIds[5], 'Настройка тормозов', 'завершен', '2024-01-12 11:00:00', '2024-01-12 12:15:00', '2024-01-12', 'Слабое торможение', userIds[3]],
      [bikeIds[9], 'Замена седла', 'запланирован', null, null, '2024-01-28', 'Жалобы клиентов на комфорт', userIds[1]],
      [bikeIds[2], 'Чистка и смазка', 'завершен', '2024-01-08 09:30:00', '2024-01-08 10:30:00', '2024-01-08', 'Плановое обслуживание', userIds[3]],
      [bikeIds[11], 'Замена грипс', 'в процессе', '2024-01-22 13:00:00', null, '2024-01-22', 'Изношены резиновые ручки', userIds[1]],
      [bikeIds[6], 'Регулировка переключателей', 'завершен', '2024-01-14 16:00:00', '2024-01-14 17:30:00', '2024-01-14', 'Плохое переключение скоростей', userIds[3]],
      [bikeIds[13], 'Замена тросиков', 'запланирован', null, null, '2024-01-30', 'Профилактическая замена', userIds[1]],
      [bikeIds[4], 'Установка фонарей', 'завершен', '2024-01-16 10:15:00', '2024-01-16 11:00:00', '2024-01-16', 'Добавление освещения', userIds[3]]
    ];
    
    const maintenanceIds = [];
    for (const [bikeId, type, status, startDate, endDate, plannedDate, notes, executor] of maintenanceData) {
      const result = await client.query(`
        INSERT INTO maintenance_events (bike_id, "тип_ремонта", "статус_ремонта", "дата_начала", "дата_окончания", "ремонт_запланирован_на", "примечания", "исполнитель") 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING id
      `, [bikeId, type, status, startDate, endDate, plannedDate, notes, 'Пользователь ' + executor]);
      maintenanceIds.push(result.rows[0].id);
    }
    console.log(`   ✅ Inserted ${maintenanceIds.length} maintenance events`);
    
    // 7. MAINTENANCE PARTS - Parts used in some repairs
    console.log('7. Inserting maintenance parts usage...');
    const maintenancePartsData = [
      [maintenanceIds[0], partModelIds[0], 2, 850, 'Замена передних и задних колодок'],
      [maintenanceIds[1], partModelIds[1], 1, 2400, 'Установка новой цепи KMC'],
      [maintenanceIds[1], partModelIds[4], 1, 3200, 'Замена кассеты'],
      [maintenanceIds[4], partModelIds[2], 1, 4500, 'Новая покрышка Continental'],
      [maintenanceIds[4], partModelIds[3], 1, 650, 'Новая камера'],
      [maintenanceIds[5], partModelIds[9], 2, 450, 'Замена тормозных тросов'],
      [maintenanceIds[5], partModelIds[10], 2, 320, 'Новые рубашки тросов'],
      [maintenanceIds[6], partModelIds[7], 1, 3800, 'Установка нового седла'],
      [maintenanceIds[7], partModelIds[14], 1, 750, 'Смазка цепи'],
      [maintenanceIds[7], partModelIds[15], 1, 1200, 'Очистка трансмиссии'],
      [maintenanceIds[8], partModelIds[8], 2, 2900, 'Новые грипсы Ergon'],
      [maintenanceIds[11], partModelIds[5], 1, 5800, 'Передний фонарь Cateye'],
      [maintenanceIds[11], partModelIds[6], 1, 2100, 'Задний фонарь Lezyne']
    ];
    
    for (const [eventId, partId, quantity, price, notes] of maintenancePartsData) {
      await client.query(`
        INSERT INTO maintenance_parts ("событие_id", part_model_id, "использовано", "цена_за_шт", notes) 
        VALUES ($1, $2, $3, $4, $5)
      `, [eventId, partId, quantity, price, notes]);
    }
    console.log(`   ✅ Inserted ${maintenancePartsData.length} maintenance parts records`);
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('\n🎉 All test data inserted successfully!');
    
    // Get summary statistics
    console.log('\n📊 Database summary:');
    const summary = await client.query(`
      SELECT 
        'users' as table_name, COUNT(*) as record_count FROM users
      UNION ALL
      SELECT 'bikes' as table_name, COUNT(*) as record_count FROM bikes
      UNION ALL
      SELECT 'part_models' as table_name, COUNT(*) as record_count FROM part_models
      UNION ALL
      SELECT 'part_stock' as table_name, COUNT(*) as record_count FROM part_stock
      UNION ALL
      SELECT 'purchase_requests' as table_name, COUNT(*) as record_count FROM purchase_requests
      UNION ALL
      SELECT 'maintenance_events' as table_name, COUNT(*) as record_count FROM maintenance_events
      UNION ALL
      SELECT 'maintenance_parts' as table_name, COUNT(*) as record_count FROM maintenance_parts
      ORDER BY table_name;
    `);
    
    console.log('   📋 Record counts by table:');
    summary.rows.forEach(row => {
      console.log(`      • ${row.table_name}: ${row.record_count} records`);
    });
    
    // Sample verification queries
    console.log('\n🔍 Sample verification queries:');
    
    // 1. Bikes by status
    const bikeStatus = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM bikes 
      GROUP BY status 
      ORDER BY count DESC;
    `);
    console.log('\n   🚲 Bikes by status:');
    bikeStatus.rows.forEach(row => {
      console.log(`      • ${row.status}: ${row.count} bikes`);
    });
    
    // 2. Parts by category
    const partCategories = await client.query(`
      SELECT category, COUNT(*) as count 
      FROM part_models 
      GROUP BY category 
      ORDER BY count DESC;
    `);
    console.log('\n   🔧 Parts by category:');
    partCategories.rows.forEach(row => {
      console.log(`      • ${row.category}: ${row.count} parts`);
    });
    
    // 3. Maintenance by status
    const maintenanceStatus = await client.query(`
      SELECT "статус_ремонта", COUNT(*) as count 
      FROM maintenance_events 
      GROUP BY "статус_ремонта" 
      ORDER BY count DESC;
    `);
    console.log('\n   🔨 Maintenance by status:');
    maintenanceStatus.rows.forEach(row => {
      console.log(`      • ${row.статус_ремонта}: ${row.count} events`);
    });
    
    // 4. Purchase requests by status
    const purchaseStatus = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM purchase_requests 
      GROUP BY status 
      ORDER BY count DESC;
    `);
    console.log('\n   📋 Purchase requests by status:');
    purchaseStatus.rows.forEach(row => {
      console.log(`      • ${row.status}: ${row.count} requests`);
    });
    
    // 5. Low stock parts
    const lowStock = await client.query(`
      SELECT pm.name, ps.quantity, ps.min_stock 
      FROM part_stock ps
      JOIN part_models pm ON pm.id = ps.part_model_id
      WHERE ps.quantity <= ps.min_stock
      ORDER BY ps.quantity ASC;
    `);
    console.log(`\n   ⚠️  Parts with low stock (${lowStock.rows.length} items):`);
    lowStock.rows.forEach(row => {
      console.log(`      • ${row.name}: ${row.quantity} (min: ${row.min_stock})`);
    });
    
    console.log('\n✅ Test data insertion completed successfully!');
    console.log('\n💡 Sample realistic data has been created with:');
    console.log('   • Mixed Russian/English names and realistic roles');
    console.log('   • Various bike brands, sizes, and statuses');
    console.log('   • Comprehensive parts catalog with realistic prices');
    console.log('   • Stock levels with some low-stock scenarios');
    console.log('   • Purchase requests in different statuses');
    console.log('   • Maintenance events with realistic repair scenarios');
    console.log('   • Parts usage tracking in maintenance events');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error inserting test data:', error.message);
    console.error('Full error details:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run the script
insertTestData()
  .then(() => {
    console.log('\n🏁 Test data insertion completed. Closing connection...');
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Test data insertion failed:', error.message);
    pool.end();
    process.exit(1);
  });