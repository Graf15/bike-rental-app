import { Router } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import pool from "../db.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Конец текущего рабочего дня по Киеву (23:59:59)
const getEndOfDayKyiv = () => {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
  now.setHours(23, 59, 59, 0);
  return now;
};

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Введите email и пароль" });

  try {
    const result = await pool.query(
      "SELECT id, name, email, role, is_active, password_hash FROM users WHERE email = $1",
      [email.trim().toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Неверный email или пароль" });
    if (!user.is_active) return res.status(403).json({ error: "Аккаунт деактивирован" });
    if (!user.password_hash) return res.status(401).json({ error: "Пароль не установлен" });

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) return res.status(401).json({ error: "Неверный email или пароль" });

    // Создаём сессию до конца текущего дня
    const sessionId = randomUUID();
    const expiresAt = getEndOfDayKyiv();
    await pool.query(
      "INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)",
      [sessionId, user.id, expiresAt]
    );

    res.cookie("session_id", sessionId, { ...COOKIE_OPTIONS, expires: expiresAt });
    res.json({
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req, res) => {
  const sessionId = req.cookies?.session_id;
  try {
    if (sessionId) await pool.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
    res.clearCookie("session_id");
    res.json({ ok: true });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/auth/me — проверить текущую сессию
router.get("/me", authenticate, (req, res) => {
  res.json(req.user);
});

// POST /api/auth/change-password
router.post("/change-password", authenticate, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password)
    return res.status(400).json({ error: "Заполните все поля" });
  if (new_password.length < 6)
    return res.status(400).json({ error: "Пароль должен быть не менее 6 символов" });

  try {
    const result = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [req.user.id]
    );
    const ok = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: "Неверный текущий пароль" });

    const newHash = await bcrypt.hash(new_password, 12);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [newHash, req.user.id]);

    // Удаляем все остальные сессии этого пользователя (кроме текущей)
    const sessionId = req.cookies?.session_id;
    await pool.query(
      "DELETE FROM sessions WHERE user_id = $1 AND id != $2",
      [req.user.id, sessionId]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
