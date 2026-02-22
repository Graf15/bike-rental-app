import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/tariffs
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM tariffs ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении тарифов:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/tariffs
router.post("/", async (req, res) => {
  try {
    const { name, description, price_first_hour, price_next_hour, price_day, price_24h, price_week } = req.body;
    if (!name) return res.status(400).json({ error: "Название обязательно" });

    const result = await pool.query(
      `INSERT INTO tariffs (name, description, price_first_hour, price_next_hour, price_day, price_24h, price_week)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, description || null, price_first_hour || null, price_next_hour || null, price_day || null, price_24h || null, price_week || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при создании тарифа:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PUT /api/tariffs/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price_first_hour, price_next_hour, price_day, price_24h, price_week, is_active } = req.body;

    const result = await pool.query(
      `UPDATE tariffs SET name=$1, description=$2, price_first_hour=$3, price_next_hour=$4,
       price_day=$5, price_24h=$6, price_week=$7, is_active=$8 WHERE id=$9 RETURNING *`,
      [name, description || null, price_first_hour || null, price_next_hour || null,
       price_day || null, price_24h || null, price_week || null, is_active ?? true, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Тариф не найден" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при обновлении тарифа:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /api/tariffs/:id
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const used = await pool.query(
      "SELECT COUNT(*) FROM rental_items WHERE tariff_id = $1",
      [id]
    );
    if (parseInt(used.rows[0].count) > 0) {
      return res.status(400).json({ error: "Тариф используется в договорах, удаление невозможно" });
    }
    const result = await pool.query("DELETE FROM tariffs WHERE id = $1 RETURNING id", [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Тариф не найден" });
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка при удалении тарифа:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
