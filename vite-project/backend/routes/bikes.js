import express from "express";
import pool from "../db.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM bikes ORDER BY id");
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении велосипедов:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;

// GET /api/bikes/:id - получить конкретный велосипед
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM bikes WHERE id = $1", [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Велосипед не найден" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка получения велосипеда:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/bikes/:id - обновить велосипед
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;
    
    // Формируем запрос обновления
    const setClause = [];
    const values = [];
    let paramCount = 1;
    
    Object.entries(updateFields).forEach(([key, value]) => {
      setClause.push(`${key} = $${paramCount}`);
      values.push(value);
      paramCount++;
    });
    
    values.push(id); // для WHERE условия
    
    if (setClause.length === 0) {
      return res.status(400).json({ error: "Нет полей для обновления" });
    }
    
    const updateQuery = `
      UPDATE bikes 
      SET ${setClause.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Велосипед не найден" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка обновления велосипеда:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/bikes/:id - получить конкретный велосипед
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query("SELECT * FROM bikes WHERE id = $1", [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Велосипед не найден" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка получения велосипеда:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/bikes/:id - обновить велосипед
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;
    
    // Формируем запрос обновления
    const setClause = [];
    const values = [];
    let paramCount = 1;
    
    Object.entries(updateFields).forEach(([key, value]) => {
      setClause.push(`${key} = ${paramCount}`);
      values.push(value);
      paramCount++;
    });
    
    values.push(id); // для WHERE условия
    
    if (setClause.length === 0) {
      return res.status(400).json({ error: "Нет полей для обновления" });
    }
    
    const updateQuery = `
      UPDATE bikes 
      SET ${setClause.join(', ')} 
      WHERE id = ${paramCount}
      RETURNING *
    `;
    
    const result = await db.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Велосипед не найден" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка обновления велосипеда:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /api/bikes/:id - удалить велосипед
router.delete("/:id", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Проверяем существование велосипеда
    const bikeCheck = await client.query(
      'SELECT id, bike_number, model FROM bikes WHERE id = $1',
      [id]
    );
    
    if (bikeCheck.rows.length === 0) {
      return res.status(404).json({ error: "Велосипед не найден" });
    }
    
    // Проверяем, есть ли активные события обслуживания
    const activeMaintenanceCheck = await client.query(
      'SELECT id FROM maintenance_events WHERE bike_id = $1 AND "статус_ремонта" IN (\'в ремонте\', \'ожидает деталей\', \'запланирован\')',
      [id]
    );
    
    if (activeMaintenanceCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: "Нельзя удалить велосипед с активными событиями обслуживания" 
      });
    }
    
    // Удаляем велосипед (связанные записи удалятся каскадно)
    await client.query('DELETE FROM bikes WHERE id = $1', [id]);
    
    await client.query('COMMIT');
    
    res.json({ 
      message: "Велосипед успешно удален",
      deleted: bikeCheck.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Ошибка удаления велосипеда:", error);
    res.status(500).json({ error: "Ошибка при удалении велосипеда" });
  } finally {
    client.release();
  }
});