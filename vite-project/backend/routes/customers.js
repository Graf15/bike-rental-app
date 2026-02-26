import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/customers - получить всех клиентов
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'completed') as total_rentals,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'no_show') as no_show_count_actual,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'cancelled') as cancelled_count
      FROM customers c
      LEFT JOIN rental_contracts rc ON c.id = rc.customer_id
      GROUP BY c.id
      ORDER BY c.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении клиентов:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/customers/:id - получить клиента по ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT
        c.*,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'completed') as total_rentals,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'no_show') as no_show_count_actual,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'cancelled') as cancelled_count,
        COALESCE(SUM(rc.total_price) FILTER (WHERE rc.status = 'completed'), 0) as total_spent
      FROM customers c
      LEFT JOIN rental_contracts rc ON c.id = rc.customer_id
      WHERE c.id = $1
      GROUP BY c.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Клиент не найден" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при получении клиента:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/customers - создать клиента
router.post("/", async (req, res) => {
  try {
    const {
      last_name,
      first_name,
      middle_name,
      phone,
      birth_date,
      gender,
      height_cm,
      is_veteran = false,
      status = "active",
      restriction_reason,
      notes,
    } = req.body;

    if (!first_name || !phone) {
      return res.status(400).json({
        error: "Обязательные поля: имя, телефон",
      });
    }

    const result = await pool.query(
      `INSERT INTO customers (
        last_name, first_name, middle_name, phone, birth_date,
        gender, height_cm, is_veteran, status, restriction_reason, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        last_name || null, first_name, middle_name || null, phone, birth_date || null,
        gender || null, height_cm || null, is_veteran || false, status,
        restriction_reason || null, notes || null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505" && err.constraint === "customers_phone_unique") {
      const existing = await pool.query(
        "SELECT id, first_name, last_name, phone, status, is_veteran, no_show_count, birth_date FROM customers WHERE phone = $1",
        [req.body.phone]
      );
      return res.status(409).json({
        error: "Клиент с таким номером телефона уже существует",
        existing: existing.rows[0] || null,
      });
    }
    console.error("Ошибка при создании клиента:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PUT /api/customers/:id - обновить клиента
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      last_name,
      first_name,
      middle_name,
      phone,
      birth_date,
      gender,
      height_cm,
      is_veteran = false,
      status,
      restriction_reason,
      notes,
    } = req.body;

    const result = await pool.query(
      `UPDATE customers SET
        last_name = $1, first_name = $2, middle_name = $3, phone = $4,
        birth_date = $5, gender = $6, height_cm = $7, is_veteran = $8,
        status = $9, restriction_reason = $10, notes = $11, updated_at = NOW()
      WHERE id = $12
      RETURNING *`,
      [
        last_name, first_name, middle_name || null, phone,
        birth_date, gender || null, height_cm || null, is_veteran || false,
        status, restriction_reason || null, notes || null, id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Клиент не найден" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505" && err.constraint === "customers_phone_unique") {
      const existing = await pool.query(
        "SELECT id, first_name, last_name, phone FROM customers WHERE phone = $1",
        [req.body.phone]
      );
      return res.status(409).json({
        error: "Клиент с таким номером телефона уже существует",
        existing: existing.rows[0] || null,
      });
    }
    console.error("Ошибка при обновлении клиента:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/customers/:id - частичное обновление (напр. статус)
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const setClause = [];
    const values = [];
    let i = 1;

    Object.entries(fields).forEach(([key, value]) => {
      setClause.push(`${key} = $${i}`);
      values.push(value);
      i++;
    });

    if (setClause.length === 0) {
      return res.status(400).json({ error: "Нет полей для обновления" });
    }

    setClause.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE customers SET ${setClause.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Клиент не найден" });
    }

    // Автоблокировка при 2+ неявках
    if (fields.hasOwnProperty('no_show_count')) {
      const customer = result.rows[0];
      if (customer.no_show_count >= 2 && customer.status === 'active') {
        await pool.query(
          `UPDATE customers SET status = 'no_booking', restriction_reason = 'Автоблокировка: 2 неявки по брони', updated_at = NOW() WHERE id = $1`,
          [id]
        );
        const updated = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
        return res.json(updated.rows[0]);
      }
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при обновлении клиента:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /api/customers/:id - удалить клиента
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем наличие активных договоров
    const activeContracts = await pool.query(
      `SELECT id FROM rental_contracts WHERE customer_id = $1 AND status IN ('booked', 'active')`,
      [id]
    );

    if (activeContracts.rows.length > 0) {
      return res.status(400).json({
        error: "Нельзя удалить клиента с активными или будущими бронями",
      });
    }

    const result = await pool.query(
      "DELETE FROM customers WHERE id = $1 RETURNING id, last_name, first_name",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Клиент не найден" });
    }

    res.json({ message: "Клиент удалён", deleted: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при удалении клиента:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
