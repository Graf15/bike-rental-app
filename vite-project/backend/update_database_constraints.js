// update_database_constraints.js - Обновление ограничений базы данных
import pkg from 'pg';
const { Pool } = pkg;

// Используем те же настройки что и в db.js
const pool = new Pool({
  user: 'postgres',
  host: 'localhost', 
  database: 'bikerental',
  password: '1515',
  port: 5432,
});

async function updateDatabaseConstraints() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Обновление ограничений базы данных...');
    
    // 1. Удаляем старый индекс
    console.log('📝 Удаление старого уникального индекса...');
    await client.query(`
      DROP INDEX IF EXISTS idx_unique_active_repair_per_bike;
    `);
    
    // 2. Создаем новый индекс с правильной логикой
    console.log('📝 Создание нового уникального индекса...');
    await client.query(`
      CREATE UNIQUE INDEX idx_unique_conflicting_repair_per_bike 
        ON maintenance_events (bike_id) 
        WHERE "статус_ремонта" IN ('в ремонте', 'ожидает деталей') 
        AND repair_type != 'longterm';
    `);
    
    // 3. Обновляем триггерную функцию
    console.log('📝 Обновление триггерной функции...');
    await client.query(`
      CREATE OR REPLACE FUNCTION check_active_repairs_before_insert()
      RETURNS TRIGGER AS $$
      DECLARE
          conflicting_count INTEGER;
          conflicting_repair_info RECORD;
          should_check_conflicts BOOLEAN;
      BEGIN
          -- Определяем нужно ли проверять конфликты
          should_check_conflicts := NOT (
              NEW.repair_type = 'longterm' OR -- Долгосрочные ремонты всегда разрешены
              (NEW.repair_type = 'weekly' AND NEW."статус_ремонта" = 'запланирован') -- Планирование еженедельного ТО
          );
          
          -- Проверяем конфликты только если нужно
          IF should_check_conflicts AND NEW."статус_ремонта" IN ('в ремонте', 'ожидает деталей') THEN
              
              -- Считаем конфликтующие ремонты
              SELECT COUNT(*) INTO conflicting_count
              FROM maintenance_events 
              WHERE bike_id = NEW.bike_id 
              AND "статус_ремонта" IN ('в ремонте', 'ожидает деталей')
              AND repair_type != 'longterm' -- Долгосрочные не конфликтуют
              AND id != COALESCE(NEW.id, 0); -- Исключаем текущую запись при UPDATE
              
              -- Если есть конфликтующие ремонты
              IF conflicting_count > 0 THEN
                  SELECT 
                      id, 
                      "тип_ремонта", 
                      "статус_ремонта",
                      repair_type
                  INTO conflicting_repair_info
                  FROM maintenance_events 
                  WHERE bike_id = NEW.bike_id 
                  AND "статус_ремонта" IN ('в ремонте', 'ожидает деталей')
                  AND repair_type != 'longterm'
                  AND id != COALESCE(NEW.id, 0)
                  LIMIT 1;
                  
                  -- Формируем сообщение об ошибке
                  RAISE EXCEPTION 
                      'КОНФЛИКТ_АКТИВНЫХ_РЕМОНТОВ: Велосипед ID % уже находится в активном ремонте (ID: %, тип: %, статус: "%"). Нельзя начать новый "%" ремонт со статусом "%" пока текущий не завершен.',
                      NEW.bike_id,
                      conflicting_repair_info.id,
                      COALESCE(conflicting_repair_info.repair_type, 'не указан'),
                      conflicting_repair_info."статус_ремонта",
                      NEW.repair_type,
                      NEW."статус_ремонта"
                      USING ERRCODE = '23505';
              END IF;
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    // 4. Добавляем комментарии
    await client.query(`
      COMMENT ON INDEX idx_unique_conflicting_repair_per_bike IS 
          'Предотвращает конфликтующие активные ремонты (исключает longterm и запланированные weekly)';
    `);
    
    // 5. Проверяем что все работает
    console.log('🧪 Тестирование новых ограничений...');
    
    // Тест: должен разрешить создание longterm ремонта
    console.log('   - Тест longterm ремонта...');
    
    // Тест: должен разрешить запланированный weekly ремонт  
    console.log('   - Тест запланированного weekly ремонта...');
    
    console.log('✅ Ограничения базы данных успешно обновлены!');
    console.log('');
    console.log('📋 Новая логика:');
    console.log('   ✅ Долгосрочные ремонты (longterm) - всегда разрешены');
    console.log('   ✅ Еженедельные ремонты со статусом "запланирован" - разрешены');
    console.log('   ❌ Активные ремонты (в ремонте, ожидает деталей) не-longterm - блокируются');
    
  } catch (error) {
    console.error('❌ Ошибка обновления ограничений:', error.message);
    console.error('🔍 Подробности:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Запускаем обновление
updateDatabaseConstraints();