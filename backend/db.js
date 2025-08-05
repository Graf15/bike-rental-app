import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "bikerental",
  password: "1515",
  port: 5432, // стандартный порт PostgreSQL
});

export default pool;
