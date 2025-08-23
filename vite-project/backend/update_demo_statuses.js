import pool from './db.js';

async function updateDemoStatuses() {
    const client = await pool.connect();
    
    try {
        console.log('Обновляю статусы демо-данных...');
        
        const updates = [
            { id: 1, condition_status: 'в наличии' },
            { id: 2, condition_status: 'в наличии' },
            { id: 3, condition_status: 'в прокате' },
            { id: 4, condition_status: 'в наличии' },
            { id: 5, condition_status: 'в прокате' },
            { id: 6, condition_status: 'в ремонте' },
            { id: 7, condition_status: 'в ремонте' },
            { id: 8, condition_status: 'в наличии' },
            { id: 9, condition_status: 'бронь' },
            { id: 10, condition_status: 'продан' }
        ];
        
        for (const update of updates) {
            await client.query(
                'UPDATE bikes SET condition_status = $1 WHERE id = $2',
                [update.condition_status, update.id]
            );
            console.log(`✅ ID ${update.id}: ${update.condition_status}`);
        }
        
        console.log('🎉 Статусы обновлены успешно!');
        
    } catch (error) {
        console.error('❌ Ошибка при обновлении статусов:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

updateDemoStatuses();