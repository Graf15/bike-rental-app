import express from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";

const router = express.Router();

// GET / — все сотрудники (без password_hash)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, phone, role, is_active, created_at, updated_at FROM users ORDER BY name"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST / — создать сотрудника
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Укажите имя" });
    if (!email?.trim()) return res.status(400).json({ error: "Укажите email" });
    if (!password || password.length < 6)
      return res.status(400).json({ error: "Пароль должен быть не менее 6 символов" });

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.trim().toLowerCase()]);
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "Сотрудник с таким email уже существует" });

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, role, password_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, name, email, phone, role, is_active, created_at`,
      [name.trim(), email.trim().toLowerCase(), phone?.trim() || null, role || "manager", password_hash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PUT /:id — обновить данные сотрудника
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, is_active } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "Укажите имя" });
    if (!email?.trim()) return res.status(400).json({ error: "Укажите email" });

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1 AND id != $2",
      [email.trim().toLowerCase(), id]
    );
    if (existing.rows.length > 0)
      return res.status(409).json({ error: "Этот email уже используется другим сотрудником" });

    const result = await pool.query(
      `UPDATE users SET name=$1, email=$2, phone=$3, role=$4, is_active=$5, updated_at=NOW()
       WHERE id=$6
       RETURNING id, name, email, phone, role, is_active, created_at`,
      [name.trim(), email.trim().toLowerCase(), phone?.trim() || null, role, is_active ?? true, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Сотрудник не найден" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /:id/reset-password — сброс пароля администратором
router.post("/:id/reset-password", async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({ error: "Пароль должен быть не менее 6 символов" });

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2 RETURNING id",
      [password_hash, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Сотрудник не найден" });

    // Инвалидируем все сессии этого сотрудника
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /:id — удалить сотрудника
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    const result = await pool.query("DELETE FROM users WHERE id=$1 RETURNING id", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Сотрудник не найден" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
