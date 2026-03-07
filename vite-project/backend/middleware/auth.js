import pool from "../db.js";

// Очистка устаревших сессий (вызывается периодически)
export const cleanExpiredSessions = async () => {
  await pool.query("DELETE FROM sessions WHERE expires_at < NOW()");
};

// Middleware: проверяет session cookie, кладёт req.user
export const authenticate = async (req, res, next) => {
  const sessionId = req.cookies?.session_id;
  if (!sessionId) return res.status(401).json({ error: "Не авторизован" });

  try {
    const result = await pool.query(
      `SELECT s.id, s.expires_at, u.id AS user_id, u.name, u.email, u.role, u.is_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      res.clearCookie("session_id");
      return res.status(401).json({ error: "Сессия истекла или недействительна" });
    }

    const user = result.rows[0];
    if (!user.is_active) {
      res.clearCookie("session_id");
      return res.status(403).json({ error: "Аккаунт деактивирован" });
    }

    req.user = {
      id:    user.user_id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    };
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Ошибка авторизации" });
  }
};

// Middleware: проверяет роль(и)
export const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Не авторизован" });
  if (!roles.includes(req.user.role))
    return res.status(403).json({ error: "Недостаточно прав" });
  next();
};
