import express from "express";
import pool from "../db.js";

const router = express.Router();

const TARIFF_FIELDS = [
  "name", "description", "is_active",
  "has_weekend_pricing",
  // Единые цены (когда has_weekend_pricing = false)
  "price_first_hour", "price_next_hour", "price_day", "price_24h",
  // Будние дни (когда has_weekend_pricing = true)
  "price_first_hour_wd", "price_next_hour_wd", "price_day_wd", "price_24h_wd",
  // Выходные дни (когда has_weekend_pricing = true)
  "price_first_hour_we", "price_next_hour_we", "price_day_we", "price_24h_we",
  // Длинные периоды (одинаковые для всех дней)
  "price_week", "price_2weeks", "price_month",
];

const n = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
const b = (v) => (v === "" || v === null || v === undefined ? false : Boolean(v));

// GET /api/tariffs
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tariffs ORDER BY name");
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении тарифов:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/tariffs/:id
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM tariffs WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Тариф не найден" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при получении тарифа:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/tariffs
router.post("/", async (req, res) => {
  try {
    const d = req.body;
    if (!d.name) return res.status(400).json({ error: "Название обязательно" });

    const result = await pool.query(
      `INSERT INTO tariffs (
        name, description, is_active, has_weekend_pricing,
        price_first_hour, price_next_hour, price_day, price_24h,
        price_first_hour_wd, price_next_hour_wd, price_day_wd, price_24h_wd,
        price_first_hour_we, price_next_hour_we, price_day_we, price_24h_we,
        price_week, price_2weeks, price_month
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19
      ) RETURNING *`,
      [
        d.name, d.description || null, b(d.is_active ?? true), b(d.has_weekend_pricing),
        n(d.price_first_hour), n(d.price_next_hour), n(d.price_day), n(d.price_24h),
        n(d.price_first_hour_wd), n(d.price_next_hour_wd), n(d.price_day_wd), n(d.price_24h_wd),
        n(d.price_first_hour_we), n(d.price_next_hour_we), n(d.price_day_we), n(d.price_24h_we),
        n(d.price_week), n(d.price_2weeks), n(d.price_month),
      ]
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
    const d = req.body;
    if (!d.name) return res.status(400).json({ error: "Название обязательно" });

    const result = await pool.query(
      `UPDATE tariffs SET
        name=$1, description=$2, is_active=$3, has_weekend_pricing=$4,
        price_first_hour=$5, price_next_hour=$6, price_day=$7, price_24h=$8,
        price_first_hour_wd=$9, price_next_hour_wd=$10, price_day_wd=$11, price_24h_wd=$12,
        price_first_hour_we=$13, price_next_hour_we=$14, price_day_we=$15, price_24h_we=$16,
        price_week=$17, price_2weeks=$18, price_month=$19
       WHERE id=$20 RETURNING *`,
      [
        d.name, d.description || null, b(d.is_active ?? true), b(d.has_weekend_pricing),
        n(d.price_first_hour), n(d.price_next_hour), n(d.price_day), n(d.price_24h),
        n(d.price_first_hour_wd), n(d.price_next_hour_wd), n(d.price_day_wd), n(d.price_24h_wd),
        n(d.price_first_hour_we), n(d.price_next_hour_we), n(d.price_day_we), n(d.price_24h_we),
        n(d.price_week), n(d.price_2weeks), n(d.price_month),
        id,
      ]
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
      "SELECT COUNT(*) FROM rental_items WHERE tariff_id = $1", [id]
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
