import pool from './db.js';

async function addFrameNumberColumn() {
    const client = await pool.connect();
    
    try {
        await client.query('ALTER TABLE bikes ADD COLUMN frame_number VARCHAR(100)');
        console.log('✅ Поле frame_number добавлено в таблицу bikes');
    } catch (error) {
        if (error.code === '42701') {
            console.log('ℹ️ Поле frame_number уже существует');
        } else {
            console.error('❌ Ошибка:', error.message);
        }
    } finally {
        client.release();
        process.exit(0);
    }
}

addFrameNumberColumn();