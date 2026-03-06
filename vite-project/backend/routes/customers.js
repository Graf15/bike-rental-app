import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/customers - клиенты с пагинацией и поиском
router.get("/", async (req, res) => {
  try {
    const {
      search,
      status, gender, is_veteran,
      last_name, first_name, middle_name, phone, restriction_reason, notes,
      id: filterId, height_cm, birth_date, created_at,
      page = 1, limit = 50,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];
    let i = 1;

    // Глобальный OR-поиск (используется из модалок)
    if (search?.length >= 2) {
      where.push(`(c.last_name ILIKE $${i} OR c.first_name ILIKE $${i} OR c.middle_name ILIKE $${i} OR c.phone ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }

    // Текстовые колонки — ILIKE
    for (const [col, val] of [
      ["last_name", last_name], ["first_name", first_name], ["middle_name", middle_name],
      ["phone", phone], ["restriction_reason", restriction_reason], ["notes", notes],
    ]) {
      if (val) { where.push(`c.${col} ILIKE $${i++}`); params.push(`%${val}%`); }
    }

    // id и height_cm — частичное совпадение по тексту
    if (filterId)   { where.push(`c.id::text LIKE $${i++}`);       params.push(`%${filterId}%`); }
    if (height_cm)  { where.push(`c.height_cm::text LIKE $${i++}`); params.push(`%${height_cm}%`); }

    // Даты — ILIKE по текстовому представлению
    if (birth_date) { where.push(`c.birth_date::text ILIKE $${i++}`);  params.push(`%${birth_date}%`); }
    if (created_at) { where.push(`c.created_at::text ILIKE $${i++}`);  params.push(`%${created_at}%`); }

    // Статус — одно значение или несколько через запятую
    if (status) {
      const vals = status.split(",").filter(Boolean);
      if (vals.length === 1) { where.push(`c.status = $${i++}`); params.push(vals[0]); }
      else { where.push(`c.status IN (${vals.map(() => `$${i++}`).join(",")})`); params.push(...vals); }
    }

    // Пол — одно или несколько
    if (gender) {
      const vals = gender.split(",").filter(Boolean);
      if (vals.length === 1) { where.push(`c.gender = $${i++}`); params.push(vals[0]); }
      else { where.push(`c.gender IN (${vals.map(() => `$${i++}`).join(",")})`); params.push(...vals); }
    }

    // УБД — "true"/"false"
    if (is_veteran !== undefined && is_veteran !== "") {
      where.push(`c.is_veteran = $${i++}`);
      params.push(is_veteran === "true");
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const dataParams = [...params, parseInt(limit), offset];
    const result = await pool.query(`
      SELECT
        c.*,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'completed') as total_rentals,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'no_show') as no_show_count_actual,
        COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'cancelled') as cancelled_count
      FROM customers c
      LEFT JOIN rental_contracts rc ON c.id = rc.customer_id
      ${whereSQL}
      GROUP BY c.id
      ORDER BY c.id DESC
      LIMIT $${i++} OFFSET $${i++}
    `, dataParams);

    // Счётчики для стат-карт (без фильтра поиска для точности)
    const totalResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status != 'active') as restricted
      FROM customers
    `);

    res.json({
      rows: result.rows,
      total: parseInt(totalResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
      counts: {
        active:     parseInt(totalResult.rows[0].active),
        restricted: parseInt(totalResult.rows[0].restricted),
        total:      parseInt(totalResult.rows[0].total),
      },
    });
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
        "SELECT id, first_name, last_name, phone, status, is_veteran, birth_date FROM customers WHERE phone = $1",
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

// GET /api/customers/:id/stats - статистика клиента
router.get("/:id/stats", async (req, res) => {
  const { id } = req.params;
  try {
    const statsRes = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed')           AS completed,
        COUNT(*) FILTER (WHERE status IN ('active','overdue')) AS active,
        COUNT(*) FILTER (WHERE status = 'booked')             AS booked,
        COUNT(*) FILTER (WHERE status = 'cancelled')          AS cancelled,
        COUNT(*) FILTER (WHERE status = 'no_show')            AS no_shows,
        COALESCE((
          SELECT SUM(ri.paid_amount) FROM rental_items ri
          JOIN rental_contracts rc2 ON rc2.id = ri.contract_id
          WHERE rc2.customer_id = $1 AND rc2.status = 'completed'
        ), 0) AS total_revenue,
        (SELECT json_build_object('id', id, 'date', actual_end) FROM rental_contracts
          WHERE customer_id = $1 AND status = 'completed' ORDER BY actual_end DESC LIMIT 1) AS last_completed,
        (SELECT json_build_object('id', id, 'date', updated_at) FROM rental_contracts
          WHERE customer_id = $1 AND status = 'cancelled' ORDER BY updated_at DESC LIMIT 1) AS last_cancelled,
        (SELECT json_build_object('id', id, 'date', updated_at) FROM rental_contracts
          WHERE customer_id = $1 AND status = 'no_show' ORDER BY updated_at DESC LIMIT 1) AS last_no_show,
        (SELECT json_build_object('id', id, 'date', booked_start) FROM rental_contracts
          WHERE customer_id = $1 AND status = 'booked' ORDER BY created_at DESC LIMIT 1) AS last_booked
      FROM rental_contracts
      WHERE customer_id = $1
    `, [id]);

    const topBikesRes = await pool.query(`
      SELECT b.id, b.internal_article, b.model, b.frame_size, t.name AS tariff_name, COUNT(*) AS times
      FROM rental_items ri
      JOIN bikes b ON b.id = ri.bike_id
      JOIN rental_contracts rc ON rc.id = ri.contract_id
      LEFT JOIN tariffs t ON t.id = b.tariff_id
      WHERE rc.customer_id = $1 AND rc.status = 'completed' AND ri.bike_id IS NOT NULL
      GROUP BY b.id, b.internal_article, b.model, b.frame_size, t.name
      ORDER BY times DESC
      LIMIT 3
    `, [id]);

    res.json({
      ...statsRes.rows[0],
      top_bikes: topBikesRes.rows,
    });
  } catch (err) {
    console.error("Ошибка при загрузке статистики клиента:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
