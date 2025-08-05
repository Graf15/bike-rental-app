import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET - получить всех пользователей
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении пользователей:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET - получить пользователя по ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при получении пользователя:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST - создать нового пользователя
router.post("/", async (req, res) => {
  try {
    const { username, full_name, role } = req.body;

    const result = await pool.query(
      "INSERT INTO users (username, full_name, role) VALUES ($1, $2, $3) RETURNING *",
      [username, full_name, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при создании пользователя:", err);
    if (err.code === "23505") {
      // unique violation
      res
        .status(400)
        .json({ error: "Пользователь с таким логином уже существует" });
    } else {
      res.status(500).json({ error: "Ошибка сервера" });
    }
  }
});

// PUT - обновить пользователя
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { username, full_name, role } = req.body;

    const result = await pool.query(
      "UPDATE users SET username = $1, full_name = $2, role = $3, updated_at = now() WHERE id = $4 RETURNING *",
      [username, full_name, role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при обновлении пользователя:", err);
    if (err.code === "23505") {
      res
        .status(400)
        .json({ error: "Пользователь с таким логином уже существует" });
    } else {
      res.status(500).json({ error: "Ошибка сервера" });
    }
  }
});

// DELETE - удалить пользователя
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    res.json({ message: "Пользователь удален", user: result.rows[0] });
  } catch (err) {
    console.error("Ошибка при удалении пользователя:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
