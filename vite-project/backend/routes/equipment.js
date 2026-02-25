import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/equipment — прокатное оборудование (part_models WHERE is_rental = true)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        pm.id, pm.name, pm.category, pm.brand, pm.model,
        pm.unit_price, pm.description, pm.part_number,
        pm.is_rental, pm.rental_tariff_id,
        t.name AS tariff_name,
        COALESCE(ps.quantity, 0) AS total_quantity,
        COALESCE(ps.quantity, 0) - COUNT(ri.id) FILTER (
          WHERE ri.status = 'active' AND ri.item_type = 'equipment'
        ) AS available_quantity
      FROM part_models pm
      LEFT JOIN tariffs t ON t.id = pm.rental_tariff_id
      LEFT JOIN part_stock ps ON ps.part_model_id = pm.id
      LEFT JOIN rental_items ri ON ri.equipment_model_id = pm.id
      WHERE pm.is_rental = true
      GROUP BY pm.id, t.name, ps.quantity
      ORDER BY pm.name
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении оборудования:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/equipment — создать прокатный товар (part_models + part_stock)
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, category, brand, model, description, unit_price,
            rental_tariff_id, part_number, total_quantity } = req.body;
    if (!name) return res.status(400).json({ error: "Название обязательно" });

    await client.query("BEGIN");

    const pmResult = await client.query(
      `INSERT INTO part_models (name, category, brand, model, description, unit_price, part_number, is_rental, rental_tariff_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8) RETURNING *`,
      [name, category || null, brand || null, model || null, description || null,
       unit_price || 0, part_number || null, rental_tariff_id || null]
    );
    const pm = pmResult.rows[0];

    await client.query(
      `INSERT INTO part_stock (part_model_id, quantity, min_stock, max_stock)
       VALUES ($1,$2,0,999)`,
      [pm.id, total_quantity || 0]
    );

    await client.query("COMMIT");
    res.status(201).json({ ...pm, total_quantity: total_quantity || 0, available_quantity: total_quantity || 0 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при создании оборудования:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

// PUT /api/equipment/:id
router.put("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, category, brand, model, description, unit_price,
            rental_tariff_id, part_number, total_quantity } = req.body;

    await client.query("BEGIN");

    const pmResult = await client.query(
      `UPDATE part_models SET name=$1, category=$2, brand=$3, model=$4, description=$5,
       unit_price=$6, part_number=$7, rental_tariff_id=$8, updated_at=now()
       WHERE id=$9 RETURNING *`,
      [name, category || null, brand || null, model || null, description || null,
       unit_price || 0, part_number || null, rental_tariff_id || null, id]
    );
    if (pmResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Оборудование не найдено" });
    }

    if (total_quantity !== undefined) {
      await client.query(
        `INSERT INTO part_stock (part_model_id, quantity) VALUES ($1,$2)
         ON CONFLICT (part_model_id) DO UPDATE SET quantity=$2, last_updated=now()`,
        [id, total_quantity]
      );
    }

    await client.query("COMMIT");
    res.json({ ...pmResult.rows[0], total_quantity: total_quantity ?? 0 });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при обновлении оборудования:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

export default router;
