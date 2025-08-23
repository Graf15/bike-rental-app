import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/bikes - получить все велосипеды
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.*,
        br.name as brand_name
      FROM bikes b
      LEFT JOIN brands br ON b.brand_id = br.id
      ORDER BY b.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении велосипедов:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/bikes/:id - получить конкретный велосипед
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        b.*,
        br.name as brand_name
      FROM bikes b
      LEFT JOIN brands br ON b.brand_id = br.id
      WHERE b.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Велосипед не найден" });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка получения велосипеда:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/bikes - создать новый велосипед
router.post("/", async (req, res) => {
  try {
    const {
      model,
      internal_article,
      brand_id,
      purchase_price_usd,
      purchase_price_uah,
      purchase_date,
      model_year,
      wheel_size,
      frame_size,
      frame_number,
      gender,
      price_segment,
      supplier_article,
      supplier_website_link,
      photos,
      last_maintenance_date,
      condition_status,
      notes,
      has_documents,
      document_details,
      installed_components,
      created_by
    } = req.body;

    const result = await pool.query(`
      INSERT INTO bikes (
        model, internal_article, brand_id, purchase_price_usd, purchase_price_uah,
        purchase_date, model_year, wheel_size, frame_size, frame_number, gender, price_segment,
        supplier_article, supplier_website_link, photos, last_maintenance_date,
        condition_status, notes, has_documents, document_details, 
        installed_components, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
      ) RETURNING *
    `, [
      model, internal_article, brand_id, purchase_price_usd, purchase_price_uah,
      purchase_date, model_year, wheel_size, frame_size, frame_number, gender, price_segment,
      supplier_article, supplier_website_link, photos || {}, last_maintenance_date,
      condition_status, notes, has_documents || false, document_details || {},
      installed_components || {}, created_by
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка создания велосипеда:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PATCH /api/bikes/:id - обновить велосипед
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;
    
    // Добавляем updated_at автоматически
    updateFields.updated_at = new Date();
    
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
    
    const result = await pool.query(updateQuery, values);
    
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
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    
    // Проверяем существование велосипеда
    const bikeCheck = await client.query(
      'SELECT id, model, internal_article FROM bikes WHERE id = $1',
      [id]
    );
    
    if (bikeCheck.rows.length === 0) {
      return res.status(404).json({ error: "Велосипед не найден" });
    }
    
    // Проверяем, есть ли активные события обслуживания
    const activeMaintenanceCheck = await client.query(
      'SELECT id FROM maintenance_events WHERE bike_id = $1 AND repair_status IN ($2, $3, $4)',
      [id, 'в ремонте', 'ожидает деталей', 'запланирован']
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

export default router;