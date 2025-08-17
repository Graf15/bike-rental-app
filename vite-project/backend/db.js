import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "bikerental",
  password: "rYRxB7aLT5bh",


  port: 5432, // стандартный порт PostgreSQL
});

export default pool;
