import pool from './db.js';

async function insertDemoBikes() {
    const client = await pool.connect();
    
    try {
        console.log('Добавляю демо-данные велосипедов...');
        
        // Получаем ID брендов
        const brandsResult = await client.query('SELECT id, name FROM brands ORDER BY id');
        const brands = brandsResult.rows;
        
        if (brands.length === 0) {
            console.log('Нет брендов в базе данных');
            return;
        }
        
        console.log('Найденные бренды:', brands.map(b => `${b.id}: ${b.name}`).join(', '));
        
        // Демо-данные велосипедов
        const demoBikes = [
            {
                model: 'Trek X-Caliber 8',
                internal_article: 'TRK-XC8-2023-001',
                brand_id: brands.find(b => b.name === 'Trek')?.id || brands[0].id,
                purchase_price_usd: 1200,
                purchase_price_uah: 44400,
                purchase_date: '2023-03-15',
                model_year: 2023,
                wheel_size: '29',
                frame_size: 'L',
                frame_number: 'TRK2023XC8L001',
                gender: 'мужской',
                price_segment: 'premium',
                supplier_article: 'TRK-XC8-BLK-L',
                supplier_website_link: 'https://www.trekbikes.com/x-caliber-8',
                photos: '{"main": "trek_xc8_main.jpg", "gallery": ["trek_xc8_1.jpg", "trek_xc8_2.jpg"]}',
                last_maintenance_date: '2024-01-15',
                condition_status: 'отличное',
                notes: 'Новый велосипед, прошел предпродажную подготовку',
                has_documents: true,
                document_details: '{"invoice_price_uah": 44400, "invoice_date": "2023-03-15", "invoice_photo": "invoice_001.jpg"}',
                installed_components: '{"fork": "RockShox Judy Silver TK", "drivetrain": "Shimano Deore", "brakes": "Shimano MT200"}',
                created_by: 1
            },
            {
                model: 'Specialized Rockhopper Sport',
                internal_article: 'SPZ-RH-2022-002',
                brand_id: brands.find(b => b.name === 'Specialized')?.id || brands[1]?.id || brands[0].id,
                purchase_price_usd: 650,
                purchase_price_uah: 24050,
                purchase_date: '2022-07-20',
                model_year: 2022,
                wheel_size: '27.5',
                frame_size: 'M',
                frame_number: 'SPZ2022RHM002',
                gender: 'унисекс',
                price_segment: 'standart',
                supplier_article: 'SPZ-RH-RED-M',
                supplier_website_link: 'https://www.specialized.com/rockhopper-sport',
                photos: '{"main": "spz_rh_main.jpg"}',
                last_maintenance_date: '2023-12-10',
                condition_status: 'хорошее',
                notes: 'Регулярное ТО, небольшие царапины на раме',
                has_documents: true,
                document_details: '{"invoice_price_uah": 24050, "invoice_date": "2022-07-20"}',
                installed_components: '{"fork": "SR Suntour XCT", "drivetrain": "Shimano Altus", "brakes": "Tektro"}',
                created_by: 1
            },
            {
                model: 'Giant Talon 3',
                internal_article: 'GNT-T3-2023-003',
                brand_id: brands.find(b => b.name === 'Giant')?.id || brands[2]?.id || brands[0].id,
                purchase_price_usd: 520,
                purchase_price_uah: 19240,
                purchase_date: '2023-05-12',
                model_year: 2023,
                wheel_size: '26',
                frame_size: 'S',
                frame_number: 'GNT2023T3S003',
                gender: 'женский',
                price_segment: 'econom',
                supplier_article: 'GNT-T3-WHT-S',
                supplier_website_link: 'https://www.giant-bicycles.com/talon-3',
                photos: '{"main": "giant_t3_main.jpg", "detail": "giant_t3_detail.jpg"}',
                last_maintenance_date: '2024-02-01',
                condition_status: 'удовлетворительное',
                notes: 'Требует замены тормозных колодок',
                has_documents: false,
                document_details: '{}',
                installed_components: '{"fork": "SR Suntour XCE", "drivetrain": "Shimano Tourney", "brakes": "V-brake"}',
                created_by: 1
            },
            {
                model: 'Cannondale Trail 8',
                internal_article: 'CND-TR8-2024-004',
                brand_id: brands.find(b => b.name === 'Cannondale')?.id || brands[3]?.id || brands[0].id,
                purchase_price_usd: 890,
                purchase_price_uah: 32930,
                purchase_date: '2024-01-08',
                model_year: 2024,
                wheel_size: '29',
                frame_size: 'XL',
                frame_number: 'CND2024TR8XL004',
                gender: 'мужской',
                price_segment: 'standart',
                supplier_article: 'CND-TR8-GRN-XL',
                supplier_website_link: 'https://www.cannondale.com/trail-8',
                photos: '{"main": "cannondale_tr8.jpg"}',
                last_maintenance_date: '2024-01-20',
                condition_status: 'отличное',
                notes: 'Новинка 2024 года, топовая комплектация',
                has_documents: true,
                document_details: '{"invoice_price_uah": 32930, "invoice_date": "2024-01-08", "warranty": "2 года"}',
                installed_components: '{"fork": "SR Suntour XCR", "drivetrain": "Shimano Acera", "brakes": "Shimano MT200"}',
                created_by: 1
            },
            {
                model: 'Scott Aspect 960',
                internal_article: 'SCT-A960-2023-005',
                brand_id: brands.find(b => b.name === 'Scott')?.id || brands[4]?.id || brands[0].id,
                purchase_price_usd: 750,
                purchase_price_uah: 27750,
                purchase_date: '2023-09-14',
                model_year: 2023,
                wheel_size: '27.5',
                frame_size: 'M',
                frame_number: 'SCT2023A960M005',
                gender: 'унисекс',
                price_segment: 'standart',
                supplier_article: 'SCT-A960-BLU-M',
                supplier_website_link: 'https://www.scott-sports.com/aspect-960',
                photos: '{"main": "scott_a960.jpg", "side": "scott_a960_side.jpg"}',
                last_maintenance_date: '2023-11-25',
                condition_status: 'хорошее',
                notes: 'Легкие следы эксплуатации, все компоненты исправны',
                has_documents: true,
                document_details: '{"invoice_price_uah": 27750, "invoice_date": "2023-09-14", "supplier": "Scott Ukraine"}',
                installed_components: '{"fork": "SR Suntour XCT", "drivetrain": "Shimano Altus", "brakes": "Shimano MT200"}',
                created_by: 1
            },
            {
                model: 'Trek FX 2 Disc',
                internal_article: 'TRK-FX2D-2022-006',
                brand_id: brands.find(b => b.name === 'Trek')?.id || brands[0].id,
                purchase_price_usd: 580,
                purchase_price_uah: 21460,
                purchase_date: '2022-11-03',
                model_year: 2022,
                wheel_size: '26',
                frame_size: 'S',
                frame_number: 'TRK2022FX2DS006',
                gender: 'женский',
                price_segment: 'econom',
                supplier_article: 'TRK-FX2D-PNK-S',
                supplier_website_link: 'https://www.trekbikes.com/fx-2-disc',
                photos: '{"main": "trek_fx2d.jpg"}',
                last_maintenance_date: '2023-10-15',
                condition_status: 'требует ремонта',
                notes: 'Нужна замена цепи и кассеты, проблемы с задним переключателем',
                has_documents: true,
                document_details: '{"invoice_price_uah": 21460, "invoice_date": "2022-11-03"}',
                installed_components: '{"fork": "жесткая", "drivetrain": "Shimano Altus", "brakes": "Tektro HD-R280"}',
                created_by: 1
            },
            {
                model: 'Giant ATX 2',
                internal_article: 'GNT-ATX2-2023-007',
                brand_id: brands.find(b => b.name === 'Giant')?.id || brands[2]?.id || brands[0].id,
                purchase_price_usd: 480,
                purchase_price_uah: 17760,
                purchase_date: '2023-06-28',
                model_year: 2023,
                wheel_size: '26',
                frame_size: 'M',
                frame_number: 'GNT2023ATX2M007',
                gender: 'мужской',
                price_segment: 'econom',
                supplier_article: 'GNT-ATX2-BLK-M',
                supplier_website_link: 'https://www.giant-bicycles.com/atx-2',
                photos: '{"main": "giant_atx2.jpg", "components": "giant_atx2_components.jpg"}',
                last_maintenance_date: '2024-01-12',
                condition_status: 'в ремонте',
                notes: 'В процессе капитального ремонта, замена всех расходников',
                has_documents: false,
                document_details: '{"repair_start": "2024-01-10", "expected_completion": "2024-01-20"}',
                installed_components: '{"fork": "SR Suntour XCT", "drivetrain": "Shimano Tourney", "brakes": "V-brake"}',
                created_by: 1
            },
            {
                model: 'Specialized Sirrus X 2.0',
                internal_article: 'SPZ-SX2-2024-008',
                brand_id: brands.find(b => b.name === 'Specialized')?.id || brands[1]?.id || brands[0].id,
                purchase_price_usd: 1450,
                purchase_price_uah: 53650,
                purchase_date: '2024-02-14',
                model_year: 2024,
                wheel_size: '27.5',
                frame_size: 'L',
                frame_number: 'SPZ2024SX2L008',
                gender: 'унисекс',
                price_segment: 'premium',
                supplier_article: 'SPZ-SX2-GRY-L',
                supplier_website_link: 'https://www.specialized.com/sirrus-x-2',
                photos: '{"main": "spz_sx2.jpg", "detail1": "spz_sx2_fork.jpg", "detail2": "spz_sx2_drivetrain.jpg"}',
                last_maintenance_date: '2024-02-20',
                condition_status: 'отличное',
                notes: 'Премиум гибрид, только из салона',
                has_documents: true,
                document_details: '{"invoice_price_uah": 53650, "invoice_date": "2024-02-14", "warranty": "3 года", "warranty_card": "warranty_008.pdf"}',
                installed_components: '{"fork": "Future Shock 1.5", "drivetrain": "Shimano Deore", "brakes": "Shimano MT200", "tires": "Specialized Pathfinder Pro"}',
                created_by: 1
            },
            {
                model: 'Cannondale Quick CX 3',
                internal_article: 'CND-QCX3-2023-009',
                brand_id: brands.find(b => b.name === 'Cannondale')?.id || brands[3]?.id || brands[0].id,
                purchase_price_usd: 920,
                purchase_price_uah: 34040,
                purchase_date: '2023-08-07',
                model_year: 2023,
                wheel_size: '27.5',
                frame_size: 'M',
                frame_number: 'CND2023QCX3M009',
                gender: 'женский',
                price_segment: 'premium',
                supplier_article: 'CND-QCX3-TRQ-M',
                supplier_website_link: 'https://www.cannondale.com/quick-cx-3',
                photos: '{"main": "cnd_qcx3.jpg"}',
                last_maintenance_date: '2023-12-18',
                condition_status: 'хорошее',
                notes: 'Отличный городской велосипед, минимальный пробег',
                has_documents: true,
                document_details: '{"invoice_price_uah": 34040, "invoice_date": "2023-08-07"}',
                installed_components: '{"fork": "Cannondale C3", "drivetrain": "Shimano Altus", "brakes": "Tektro HD-R280"}',
                created_by: 1
            },
            {
                model: 'Scott Sub Cross 20',
                internal_article: 'SCT-SC20-2022-010',
                brand_id: brands.find(b => b.name === 'Scott')?.id || brands[4]?.id || brands[0].id,
                purchase_price_usd: 1680,
                purchase_price_uah: 62160,
                purchase_date: '2022-04-22',
                model_year: 2022,
                wheel_size: '29',
                frame_size: 'XL',
                frame_number: 'SCT2022SC20XL010',
                gender: 'мужской',
                price_segment: 'premium',
                supplier_article: 'SCT-SC20-MAT-XL',
                supplier_website_link: 'https://www.scott-sports.com/sub-cross-20',
                photos: '{"main": "scott_sc20.jpg", "detail": "scott_sc20_detail.jpg"}',
                last_maintenance_date: '2023-09-05',
                condition_status: 'списано',
                notes: 'Серьезные повреждения рамы после аварии, списан',
                has_documents: true,
                document_details: '{"invoice_price_uah": 62160, "invoice_date": "2022-04-22", "insurance_claim": "claim_010.pdf"}',
                installed_components: '{"fork": "поврежден", "drivetrain": "Shimano Deore XT", "brakes": "Shimano MT400"}',
                created_by: 1
            }
        ];
        
        // Вставляем каждый велосипед
        for (const bike of demoBikes) {
            try {
                const result = await client.query(`
                    INSERT INTO bikes (
                        model, internal_article, brand_id, purchase_price_usd, purchase_price_uah,
                        purchase_date, model_year, wheel_size, frame_size, frame_number, gender, price_segment,
                        supplier_article, supplier_website_link, photos, last_maintenance_date,
                        condition_status, notes, has_documents, document_details, 
                        installed_components, created_by
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
                    ) RETURNING id, model
                `, [
                    bike.model, bike.internal_article, bike.brand_id, bike.purchase_price_usd, bike.purchase_price_uah,
                    bike.purchase_date, bike.model_year, bike.wheel_size, bike.frame_size, bike.frame_number, 
                    bike.gender, bike.price_segment, bike.supplier_article, bike.supplier_website_link, 
                    bike.photos, bike.last_maintenance_date, bike.condition_status, bike.notes, 
                    bike.has_documents, bike.document_details, bike.installed_components, bike.created_by
                ]);
                
                console.log(`✅ Добавлен велосипед ID: ${result.rows[0].id}, модель: ${result.rows[0].model}`);
            } catch (error) {
                console.error(`❌ Ошибка при добавлении велосипеда ${bike.model}:`, error.message);
            }
        }
        
        console.log('🎉 Демо-данные успешно добавлены!');
        
    } catch (error) {
        console.error('❌ Ошибка при добавлении демо-данных:', error);
    } finally {
        client.release();
        process.exit(0);
    }
}

insertDemoBikes();