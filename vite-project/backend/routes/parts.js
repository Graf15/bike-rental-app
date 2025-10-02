import express from "express";
import pool from "../db.js";

const router = express.Router();

// Получить все запчасти с информацией о складских остатках
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        pm.*,
        COALESCE(ps.quantity, 0) as quantity,
        ps.min_stock,
        ps.max_stock,
        ps.warehouse_location,
        ps.notes as stock_notes
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      ORDER BY pm.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении запчастей:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Получить запчасть по ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `
      SELECT
        pm.*,
        COALESCE(ps.quantity, 0) as quantity,
        ps.min_stock,
        ps.max_stock,
        ps.warehouse_location,
        ps.notes as stock_notes
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pm.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Запчасть не найдена" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при получении запчасти:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Создать новую запчасть
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      name,
      category,
      brand,
      model,
      description,
      unit_price = 0,
      supplier,
      part_number,
      quantity = 0,
      min_stock = 5,
      max_stock = 100,
      warehouse_location,
      notes
    } = req.body;

    await client.query("BEGIN");

    // Создаем модель запчасти
    const partResult = await client.query(
      `
      INSERT INTO part_models (name, category, brand, model, description, unit_price, supplier, part_number)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [name, category, brand, model, description, unit_price, supplier, part_number]
    );

    const partId = partResult.rows[0].id;

    // Создаем запись на складе
    await client.query(
      `
      INSERT INTO part_stock (part_model_id, quantity, min_stock, max_stock, warehouse_location, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [partId, quantity, min_stock, max_stock, warehouse_location, notes]
    );

    await client.query("COMMIT");

    // Возвращаем созданную запчасть с количеством на складе
    const result = await client.query(
      `
      SELECT
        pm.*,
        ps.quantity,
        ps.min_stock,
        ps.max_stock,
        ps.warehouse_location,
        ps.notes as stock_notes
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pm.id = $1
    `,
      [partId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при создании запчасти:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

// Обновить запчасть
router.put("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const {
      name,
      category,
      brand,
      model,
      description,
      unit_price,
      supplier,
      part_number,
      quantity,
      min_stock,
      max_stock,
      warehouse_location,
      notes
    } = req.body;

    await client.query("BEGIN");

    // Обновляем модель запчасти
    const partResult = await client.query(
      `
      UPDATE part_models
      SET name = $1, category = $2, brand = $3, model = $4, description = $5,
          unit_price = $6, supplier = $7, part_number = $8, updated_at = now()
      WHERE id = $9
      RETURNING *
    `,
      [name, category, brand, model, description, unit_price, supplier, part_number, id]
    );

    if (partResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Запчасть не найдена" });
    }

    // Обновляем информацию на складе (или создаем запись если её нет)
    await client.query(
      `
      INSERT INTO part_stock (part_model_id, quantity, min_stock, max_stock, warehouse_location, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (part_model_id)
      DO UPDATE SET
        quantity = COALESCE($2, part_stock.quantity),
        min_stock = COALESCE($3, part_stock.min_stock),
        max_stock = COALESCE($4, part_stock.max_stock),
        warehouse_location = COALESCE($5, part_stock.warehouse_location),
        notes = COALESCE($6, part_stock.notes),
        last_updated = now()
    `,
      [id, quantity, min_stock, max_stock, warehouse_location, notes]
    );

    await client.query("COMMIT");

    // Возвращаем обновленную запчасть
    const result = await client.query(
      `
      SELECT
        pm.*,
        COALESCE(ps.quantity, 0) as quantity,
        ps.min_stock,
        ps.max_stock,
        ps.warehouse_location,
        ps.notes as stock_notes
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pm.id = $1
    `,
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при обновлении запчасти:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

// Удалить запчасть
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // part_stock удалится автоматически благодаря CASCADE
    const result = await pool.query(
      "DELETE FROM part_models WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Запчасть не найдена" });
    }

    res.json({ message: "Запчасть удалена успешно" });
  } catch (err) {
    console.error("Ошибка при удалении запчасти:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Обновить только количество на складе
router.patch("/:id/stock", async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    // Проверяем, существует ли запчасть
    const partCheck = await pool.query(
      "SELECT id FROM part_models WHERE id = $1",
      [id]
    );
    if (partCheck.rows.length === 0) {
      return res.status(404).json({ error: "Запчасть не найдена" });
    }

    // Обновляем или создаем запись на складе
    await pool.query(
      `
      INSERT INTO part_stock (part_model_id, quantity)
      VALUES ($1, $2)
      ON CONFLICT (part_model_id)
      DO UPDATE SET quantity = $2, last_updated = now()
    `,
      [id, quantity]
    );

    // Возвращаем обновленную информацию
    const result = await pool.query(
      `
      SELECT
        pm.*,
        ps.quantity,
        ps.min_stock,
        ps.max_stock,
        ps.warehouse_location,
        ps.notes as stock_notes
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pm.id = $1
    `,
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при обновлении количества на складе:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Получить историю использования запчасти
router.get("/:id/usage", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        mp.*,
        me.started_at,
        me.status,
        b.id as bike_id,
        b.model as bike_model
      FROM maintenance_parts mp
      JOIN maintenance_events me ON mp."событие_id" = me.id
      JOIN bikes b ON me.bike_id = b.id
      WHERE mp.part_model_id = $1
      ORDER BY me.started_at DESC
    `,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении истории использования:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;