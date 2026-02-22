INSERT INTO tariffs (name, description, price_first_hour, price_next_hour, price_day, price_24h, price_week, price_2weeks, price_month, has_weekend_pricing, is_active) VALUES
('Эконом / Детский', 'Тариф для обычных и детских велосипедов. Одинаковая цена в будни и выходные.', 100, 50, 300, 350, 750, 1300, 2400, FALSE, TRUE);

INSERT INTO tariffs (name, description, price_first_hour_wd, price_next_hour_wd, price_day_wd, price_24h_wd, price_first_hour_we, price_next_hour_we, price_day_we, price_24h_we, price_week, price_2weeks, price_month, has_weekend_pricing, is_active) VALUES
('Стандарт', 'Тариф для велосипедов стандартного класса. Цена различается в будние и выходные дни (сб 11:00 – вс 19:30).', 110, 60, 350, 400, 130, 70, 400, 450, 1200, 2000, 3300, TRUE, TRUE);

INSERT INTO tariffs (name, description, price_first_hour, price_next_hour, price_day, price_24h, price_week, price_2weeks, price_month, has_weekend_pricing, is_active) VALUES
('Самокат', 'Тариф для электросамокатов.', 180, 120, 480, 700, 2000, 3000, 4000, FALSE, TRUE);

INSERT INTO tariffs (name, description, price_first_hour, price_next_hour, price_day, price_24h, has_weekend_pricing, is_active) VALUES
('Электровелосипед', 'Тариф для электровелосипедов.', 250, 120, 600, 900, FALSE, TRUE);
