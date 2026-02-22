import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/equipment - все модели оборудования с доступным количеством
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        em.*,
        em.total_quantity - COUNT(ri.id) FILTER (
          WHERE ri.status = 'active' AND ri.item_type = 'equipment'
        ) AS available_quantity
      FROM equipment_models em
      LEFT JOIN rental_items ri ON ri.equipment_model_id = em.id
      GROUP BY em.id
      ORDER BY em.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении оборудования:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/equipment
router.post("/", async (req, res) => {
  try {
    const { name, category, total_quantity, price_per_rental, notes } = req.body;
    if (!name) return res.status(400).json({ error: "Название обязательно" });

    const result = await pool.query(
      `INSERT INTO equipment_models (name, category, total_quantity, price_per_rental, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, category || null, total_quantity || 0, price_per_rental || null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при создании оборудования:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PUT /api/equipment/:id
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, total_quantity, price_per_rental, notes } = req.body;

    const result = await pool.query(
      `UPDATE equipment_models SET name=$1, category=$2, total_quantity=$3, price_per_rental=$4, notes=$5
       WHERE id=$6 RETURNING *`,
      [name, category || null, total_quantity || 0, price_per_rental || null, notes || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Оборудование не найдено" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при обновлении оборудования:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
