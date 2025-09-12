import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/brands - получить все бренды
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, country, description 
      FROM brands 
      ORDER BY name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении брендов:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/brands - создать новый бренд
router.post("/", async (req, res) => {
  try {
    const { name, country, description } = req.body;

    // Валидация
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: "Название бренда обязательно" });
    }

    // Проверяем, не существует ли уже такой бренд
    const existingBrand = await pool.query(
      "SELECT id FROM brands WHERE LOWER(name) = LOWER($1)",
      [name.trim()]
    );

    if (existingBrand.rows.length > 0) {
      return res.status(409).json({ error: "Бренд с таким названием уже существует" });
    }

    // Создаем новый бренд
    const result = await pool.query(
      `INSERT INTO brands (name, country, description) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, country, description`,
      [name.trim(), country?.trim() || null, description?.trim() || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при создании бренда:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;