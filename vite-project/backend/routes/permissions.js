import express from "express";
import pool from "../db.js";
import { authorize } from "../middleware/auth.js";
import { invalidateCache } from "../middleware/routePermissions.js";

const router = express.Router();

// GET /api/permissions — все разрешения (любой авторизованный)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT route_path, allowed_roles FROM route_permissions ORDER BY route_path"
    );
    // Возвращаем объект { '/': ['admin','manager'], ... }
    const permissions = {};
    result.rows.forEach(({ route_path, allowed_roles }) => {
      permissions[route_path] = allowed_roles;
    });
    res.json(permissions);
  } catch (err) {
    console.error("GET /api/permissions error:", err);
    res.status(500).json({ error: "Ошибка загрузки разрешений" });
  }
});

// PUT /api/permissions — обновить разрешения (только admin)
router.put("/", authorize("admin"), async (req, res) => {
  const permissions = req.body; // { '/': ['admin','manager'], ... }

  if (!permissions || typeof permissions !== "object") {
    return res.status(400).json({ error: "Неверный формат данных" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const [route_path, allowed_roles] of Object.entries(permissions)) {
      await client.query(
        `INSERT INTO route_permissions (route_path, allowed_roles)
         VALUES ($1, $2)
         ON CONFLICT (route_path) DO UPDATE SET allowed_roles = $2`,
        [route_path, allowed_roles]
      );
    }
    await client.query("COMMIT");
    invalidateCache(); // следующий запрос перечитает из БД
    res.json({ ok: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PUT /api/permissions error:", err);
    res.status(500).json({ error: "Ошибка сохранения разрешений" });
  } finally {
    client.release();
  }
});

export default router;
