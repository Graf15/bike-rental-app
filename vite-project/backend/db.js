import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "bikerental",
  password: "1515",
  port: 5432,
});

// Устанавливаем часовой пояс для каждого соединения
// чтобы NOW() возвращало локальное время (UTC+2, Киев)
pool.on("connect", (client) => {
  client.query("SET timezone = 'Europe/Kiev'");
});

export default pool;
