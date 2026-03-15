import express from "express";
import pool from "../db.js";
import { broadcast } from "../ws.js";
import { authenticate } from "../middleware/auth.js";

// API-ключ для MacroDroid — передаётся в заголовке X-Api-Key
const WEBHOOK_API_KEY = process.env.WEBHOOK_API_KEY || "macrodroid-bike-2025";

const webhookAuth = (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (key === WEBHOOK_API_KEY) return next();
  res.status(401).json({ error: "Неверный API-ключ" });
};

const router = express.Router();

// Нормализация номера — убираем всё кроме цифр и +
function normalizePhone(raw) {
  if (!raw) return null;
  return raw.replace(/[^\d+]/g, "");
}

// Поиск клиента по номеру + активный договор + статистика
async function findCustomer(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "").slice(-9);

  const { rows } = await pool.query(
    `SELECT id, last_name, first_name, middle_name, phone, birth_date,
            is_veteran, status, restriction_reason, no_show_count, notes
     FROM customers
     WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE $1
     LIMIT 1`,
    [`%${digits}`]
  );
  if (!rows[0]) return null;
  const customer = rows[0];

  // Статистика по договорам
  const { rows: stats } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('active','overdue'))  AS active_count,
       COUNT(*) FILTER (WHERE status = 'booked')               AS booked_count,
       COUNT(*) FILTER (WHERE status = 'completed')            AS completed_count,
       COUNT(*) FILTER (WHERE status = 'no_show')              AS no_show_rental_count
     FROM rental_contracts WHERE customer_id = $1`,
    [customer.id]
  );
  customer.stats = stats[0];

  // Активный или забронированный договор
  const { rows: activeContracts } = await pool.query(
    `SELECT rc.id, rc.status, rc.start_time, rc.end_time, rc.total_amount,
            COUNT(ri.id) AS items_count
     FROM rental_contracts rc
     LEFT JOIN rental_items ri ON ri.contract_id = rc.id
     WHERE rc.customer_id = $1 AND rc.status IN ('active','booked','overdue')
     GROUP BY rc.id
     ORDER BY rc.created_at DESC
     LIMIT 1`,
    [customer.id]
  );
  customer.active_contract = activeContracts[0] || null;

  return customer;
}

// POST /api/calls — принимает событие от MacroDroid (auth: X-Api-Key)
// Тело запроса: { call_id, event, phone, started_at, duration_sec }
router.post("/", webhookAuth, async (req, res) => {
  try {
    const { call_id, event, phone: rawPhone, started_at, duration_sec } = req.body;

    if (!event || !rawPhone) {
      return res.status(400).json({ error: "event и phone обязательны" });
    }

    const phone = normalizePhone(rawPhone);
    const customer = await findCustomer(phone);

    // Сохраняем в БД только значимые события (не active)
    let savedId = null;
    if (event !== "active") {
      const { rows } = await pool.query(
        `INSERT INTO calls (call_id, event, phone, customer_id, started_at, duration_sec)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          call_id || null,
          event,
          phone,
          customer?.id || null,
          started_at || new Date(),
          duration_sec || null,
        ]
      );
      savedId = rows[0].id;
    }

    // Broadcast на фронт
    broadcast(`call_${event}`, {
      id: savedId,
      call_id: call_id || null,
      event,
      phone,
      duration_sec: duration_sec || null,
      started_at: started_at || new Date(),
      customer: customer
        ? {
            id: customer.id,
            name: [customer.last_name, customer.first_name, customer.middle_name]
              .filter(Boolean)
              .join(" "),
            status: customer.status,
          }
        : null,
    });

    res.json({ ok: true, id: savedId, customer_found: !!customer });
  } catch (err) {
    console.error("[calls] Ошибка:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/calls — история звонков (auth: сессия)
router.get("/", authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(
      `SELECT c.id, c.call_id, c.event, c.phone, c.started_at, c.duration_sec, c.created_at,
              cust.id AS customer_id,
              TRIM(CONCAT(cust.last_name, ' ', cust.first_name, ' ', COALESCE(cust.middle_name, ''))) AS customer_name,
              cust.status AS customer_status
       FROM calls c
       LEFT JOIN customers cust ON cust.id = c.customer_id
       WHERE c.event != 'active'
       ORDER BY c.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM calls WHERE event != 'active'`
    );

    res.json({
      data: rows,
      total: parseInt(countRows[0].count),
      page,
      limit,
    });
  } catch (err) {
    console.error("[calls] Ошибка GET:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
