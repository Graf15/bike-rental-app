// routes/purchase-requests.js

import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/purchase-requests - получить все заказы запчастей
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pr.*,
        pm."название" as part_name,
        pm.purchase_price,
        COALESCE(ps."количество_на_складе", 0) as current_stock
      FROM purchase_requests pr
      JOIN part_models pm ON pr.part_model_id = pm.id
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      ORDER BY 
        CASE pr."приоритет"
          WHEN 'критичный' THEN 1
          WHEN 'высокий' THEN 2
          WHEN 'обычный' THEN 3
          WHEN 'низкий' THEN 4
        END,
        pr."дата_создания" DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении заказов:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/purchase-requests/:id - получить заказ по ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `
      SELECT 
        pr.*,
        pm."название" as part_name,
        pm.purchase_price,
        COALESCE(ps."количество_на_складе", 0) as current_stock
      FROM purchase_requests pr
      JOIN part_models pm ON pr.part_model_id = pm.id
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pr.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Заказ не найден" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при получении заказа:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/purchase-requests - создать новый заказ
router.post("/", async (req, res) => {
  try {
    const {
      part_model_id,
      количество_нужно,
      приоритет = "обычный",
      примечания,
    } = req.body;

    // Проверяем существование запчасти
    const partCheck = await pool.query(
      "SELECT id FROM part_models WHERE id = $1",
      [part_model_id]
    );

    if (partCheck.rows.length === 0) {
      return res.status(404).json({ error: "Запчасть не найдена" });
    }

    const result = await pool.query(
      `
      INSERT INTO purchase_requests (
        part_model_id,
        "количество_нужно",
        "приоритет",
        "примечания"
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [part_model_id, количество_нужно, приоритет, примечания]
    );

    // Возвращаем созданный заказ с дополнительной информацией
    const createdRequest = await pool.query(
      `
      SELECT 
        pr.*,
        pm."название" as part_name,
        pm.purchase_price,
        COALESCE(ps."количество_на_складе", 0) as current_stock
      FROM purchase_requests pr
      JOIN part_models pm ON pr.part_model_id = pm.id
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pr.id = $1
    `,
      [result.rows[0].id]
    );

    res.status(201).json(createdRequest.rows[0]);
  } catch (err) {
    console.error("Ошибка при создании заказа:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/purchase-requests/:id - обновить заказ
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    // Формируем запрос обновления
    const setClause = [];
    const values = [];
    let paramCount = 1;

    Object.entries(updateFields).forEach(([key, value]) => {
      setClause.push(`"${key}" = $${paramCount}`);
      values.push(value);
      paramCount++;
    });

    values.push(id); // для WHERE условия

    if (setClause.length === 0) {
      return res.status(400).json({ error: "Нет полей для обновления" });
    }

    setClause.push("updated_at = now()");

    const updateQuery = `
      UPDATE purchase_requests 
      SET ${setClause.join(", ")} 
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Заказ не найден" });
    }

    // Возвращаем обновленный заказ с дополнительной информацией
    const updatedRequest = await pool.query(
      `
      SELECT 
        pr.*,
        pm."название" as part_name,
        pm.purchase_price,
        COALESCE(ps."количество_на_складе", 0) as current_stock
      FROM purchase_requests pr
      JOIN part_models pm ON pr.part_model_id = pm.id
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pr.id = $1
    `,
      [id]
    );

    res.json(updatedRequest.rows[0]);
  } catch (err) {
    console.error("Ошибка при обновлении заказа:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /api/purchase-requests/:id - удалить заказ
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM purchase_requests WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Заказ не найден" });
    }

    res.json({ message: "Заказ удален успешно" });
  } catch (err) {
    console.error("Ошибка при удалении заказа:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
