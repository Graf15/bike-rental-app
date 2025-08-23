import pool from './db.js';

async function migrateBikesTable() {
    const client = await pool.connect();
    
    try {
        console.log('Начинаю миграцию таблицы bikes...');
        
        // Создание новой таблицы bikes с правильной структурой
        const createBikesQuery = `
            CREATE TABLE IF NOT EXISTS bikes (
                id SERIAL PRIMARY KEY,
                model VARCHAR(300) NOT NULL,
                internal_article VARCHAR(100) UNIQUE,
                brand_id INTEGER REFERENCES brands(id),
                purchase_price_usd DECIMAL(10, 2),
                purchase_price_uah DECIMAL(10, 2),
                purchase_date DATE,
                model_year INTEGER,
                wheel_size VARCHAR(20),
                frame_size VARCHAR(20),
                gender VARCHAR(20),
                price_segment VARCHAR(50),
                supplier_article VARCHAR(100),
                supplier_website_link VARCHAR(500),
                photos JSONB DEFAULT '{}',
                last_maintenance_date DATE,
                condition_status VARCHAR(50),
                notes TEXT,
                has_documents BOOLEAN DEFAULT false,
                document_details JSONB DEFAULT '{}',
                installed_components JSONB DEFAULT '{}',
                created_by INTEGER REFERENCES users(id),
                updated_by INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        await client.query(createBikesQuery);
        console.log('✅ Таблица bikes создана успешно');
        
        // Создание индексов для производительности
        const createIndexesQuery = `
            CREATE INDEX IF NOT EXISTS idx_bikes_brand_id ON bikes(brand_id);
            CREATE INDEX IF NOT EXISTS idx_bikes_internal_article ON bikes(internal_article);
            CREATE INDEX IF NOT EXISTS idx_bikes_condition_status ON bikes(condition_status);
            CREATE INDEX IF NOT EXISTS idx_bikes_photos ON bikes USING GIN(photos);
            CREATE INDEX IF NOT EXISTS idx_bikes_document_details ON bikes USING GIN(document_details);
            CREATE INDEX IF NOT EXISTS idx_bikes_installed_components ON bikes USING GIN(installed_components);
        `;
        
        await client.query(createIndexesQuery);
        console.log('✅ Индексы созданы успешно');
        
        // Очистка демо-данных из связанных таблиц
        const clearDemoDataQuery = `
            DELETE FROM maintenance_events;
            DELETE FROM weekly_repair_schedule;
            DELETE FROM bike_status_history;
        `;
        
        await client.query(clearDemoDataQuery);
        console.log('✅ Демо-данные очищены из связанных таблиц');

        // Восстановление внешних ключей
        const restoreForeignKeysQuery = `
            ALTER TABLE maintenance_events 
            ADD CONSTRAINT maintenance_events_bike_id_fkey 
            FOREIGN KEY (bike_id) REFERENCES bikes(id);
            
            ALTER TABLE weekly_repair_schedule 
            ADD CONSTRAINT weekly_repair_schedule_bike_id_fkey 
            FOREIGN KEY (bike_id) REFERENCES bikes(id);
            
            ALTER TABLE bike_status_history 
            ADD CONSTRAINT bike_status_history_bike_id_fkey 
            FOREIGN KEY (bike_id) REFERENCES bikes(id);
        `;
        
        await client.query(restoreForeignKeysQuery);
        console.log('✅ Внешние ключи восстановлены успешно');
        
        // Добавление примеров брендов (если еще не добавлены)
        const insertBrandsQuery = `
            INSERT INTO brands (name, country, description) VALUES 
            ('Trek', 'USA', 'Американский производитель велосипедов'),
            ('Specialized', 'USA', 'Премиальный бренд велосипедов'),
            ('Giant', 'Taiwan', 'Крупнейший производитель велосипедов в мире'),
            ('Cannondale', 'USA', 'Высокопроизводительные велосипеды'),
            ('Scott', 'Switzerland', 'Швейцарский производитель велосипедов')
            ON CONFLICT (name) DO NOTHING;
        `;
        
        await client.query(insertBrandsQuery);
        console.log('✅ Примеры брендов добавлены');
        
        // Добавление курсов валют (если еще не добавлены)
        const insertCurrencyRatesQuery = `
            INSERT INTO currency_rates (currency_code, rate_to_usd, date) VALUES 
            ('USD', 1.000000, CURRENT_DATE),
            ('EUR', 0.850000, CURRENT_DATE),
            ('RUB', 0.011000, CURRENT_DATE),
            ('UAH', 0.025000, CURRENT_DATE)
            ON CONFLICT (currency_code, date) DO NOTHING;
        `;
        
        await client.query(insertCurrencyRatesQuery);
        console.log('✅ Курсы валют добавлены');
        
        console.log('🎉 Миграция завершена успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка при миграции:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Запуск миграции
migrateBikesTable()
    .then(() => {
        console.log('Миграция выполнена успешно');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Ошибка при выполнении миграции:', error);
        process.exit(1);
    });