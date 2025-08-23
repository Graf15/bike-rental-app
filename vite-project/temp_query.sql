-- Проверка созданных таблиц
\d brands
\d currency_rates

-- Информация о таблице brands
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'brands' 
ORDER BY ordinal_position;

-- Информация о таблице currency_rates
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'currency_rates' 
ORDER BY ordinal_position;