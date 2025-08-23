import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/maintenance - получить все события обслуживания
router.get("/", async (req, res) => {
  try {
    const { 
      maintenance_type, 
      status, 
      parts_need,
      bike_id, 
      date_from, 
      date_to,
      limit = 100,
      offset = 0 
    } = req.query;

    let whereClause = [];
    let queryParams = [];
    let paramCount = 1;

    // Фильтр по типу обслуживания
    if (maintenance_type) {
      whereClause.push(`me.maintenance_type = $${paramCount}`);
      queryParams.push(maintenance_type);
      paramCount++;
    }

    // Фильтр по статусу
    if (status) {
      whereClause.push(`me.status = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    // Фильтр по статусу запчастей
    if (parts_need) {
      whereClause.push(`me.parts_need = $${paramCount}`);
      queryParams.push(parts_need);
      paramCount++;
    }

    // Фильтр по велосипеду
    if (bike_id) {
      whereClause.push(`me.bike_id = $${paramCount}`);
      queryParams.push(bike_id);
      paramCount++;
    }

    // Фильтр по датам создания
    if (date_from) {
      whereClause.push(`me.created_at >= $${paramCount}`);
      queryParams.push(date_from);
      paramCount++;
    }

    if (date_to) {
      whereClause.push(`me.created_at <= $${paramCount}`);
      queryParams.push(date_to);
      paramCount++;
    }

    const whereSQL = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    // Добавляем LIMIT и OFFSET параметры
    const limitParamIndex = paramCount;
    const offsetParamIndex = paramCount + 1;
    queryParams.push(limit, offset);
    
    const result = await pool.query(`
      SELECT 
        me.*,
        b.internal_article as bike_number,
        b.model,
        b.condition_status as bike_status,
        
        -- Информация об ответственных пользователях
        scheduled_user.name as scheduled_user_name,
        scheduled_for_user.name as scheduled_for_user_name,
        started_user.name as started_user_name,
        completed_user.name as completed_user_name,
        tested_user.name as tested_user_name,
        
        -- Расчетные поля времени (в часах)
        CASE 
          WHEN me.completed_at IS NOT NULL AND me.started_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (me.completed_at - me.started_at)) / 3600 
          ELSE NULL 
        END as repair_hours,
        
        CASE 
          WHEN me.parts_delivered_at IS NOT NULL AND me.parts_needed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (me.parts_delivered_at - me.parts_needed_at)) / 3600
          ELSE NULL
        END as parts_wait_hours,
        
        -- Флаги состояния
        CASE 
          WHEN me.scheduled_for < NOW() AND me.status = 'planned'
          THEN true 
          ELSE false 
        END as is_overdue,
        
        CASE 
          WHEN me.status = 'in_progress' AND me.parts_need = 'needed'
          THEN true
          ELSE false
        END as is_waiting_parts
        
      FROM maintenance_events me
      LEFT JOIN bikes b ON me.bike_id = b.id
      LEFT JOIN users scheduled_user ON me.scheduled_user_id = scheduled_user.id
      LEFT JOIN users scheduled_for_user ON me.scheduled_for_user_id = scheduled_for_user.id
      LEFT JOIN users started_user ON me.started_user_id = started_user.id
      LEFT JOIN users completed_user ON me.completed_user_id = completed_user.id
      LEFT JOIN users tested_user ON me.tested_user_id = tested_user.id
      ${whereSQL}
      ORDER BY 
        CASE 
          WHEN me.status = 'in_progress' THEN 1
          WHEN me.status = 'planned' THEN 2
          WHEN me.status = 'completed' THEN 3
          ELSE 4
        END,
        me.scheduled_for ASC NULLS LAST,
        me.created_at DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `, queryParams);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка получения событий обслуживания:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/maintenance - создать новое событие обслуживания
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      bike_id,
      maintenance_type,
      status = 'planned',
      scheduled_at,
      scheduled_user_id,
      scheduled_for,
      scheduled_for_user_id,
      description,
      notes
    } = req.body;

    // Проверяем существование велосипеда
    const bikeCheck = await client.query(
      "SELECT id, condition_status FROM bikes WHERE id = $1",
      [bike_id]
    );

    if (bikeCheck.rows.length === 0) {
      throw new Error("Велосипед не найден");
    }

    // Проверяем конфликты для блокирующих ремонтов
    const isBlockingRepair = status === 'in_progress';

    if (isBlockingRepair) {
      const conflictingRepairsCheck = await client.query(
        `SELECT id, maintenance_type, status
         FROM maintenance_events 
         WHERE bike_id = $1 AND status = 'in_progress'`,
        [bike_id]
      );

      if (conflictingRepairsCheck.rows.length > 0) {
        const conflictingRepair = conflictingRepairsCheck.rows[0];
        throw new Error(
          `Велосипед #${bike_id} уже находится в активном ремонте (ID: ${conflictingRepair.id}). ` +
          `Нельзя начать новый ремонт пока текущий не завершен.`
        );
      }
    }

    // Создаем событие обслуживания
    const result = await client.query(
      `INSERT INTO maintenance_events (
        bike_id,
        maintenance_type,
        status,
        scheduled_at,
        scheduled_user_id,
        scheduled_for,
        scheduled_for_user_id,
        description,
        notes,
        started_at,
        started_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        bike_id,
        maintenance_type,
        status,
        scheduled_at || null,
        scheduled_user_id || null,
        scheduled_for || null,
        scheduled_for_user_id || null,
        description || null,
        notes || null,
        status === 'in_progress' ? new Date() : null,
        status === 'in_progress' ? scheduled_user_id : null
      ]
    );

    // Обновляем статус велосипеда при необходимости
    if (status === "in_progress") {
      await client.query("UPDATE bikes SET condition_status = $1 WHERE id = $2", [
        "в ремонте",
        bike_id,
      ]);
    }

    await client.query("COMMIT");

    // Возвращаем созданное событие с дополнительной информацией
    const createdEvent = await client.query(
      `SELECT 
        me.*,
        b.internal_article as bike_number,
        b.model,
        b.condition_status as bike_status,
        scheduled_user.name as scheduled_user_name,
        scheduled_for_user.name as scheduled_for_user_name,
        started_user.name as started_user_name
      FROM maintenance_events me
      LEFT JOIN bikes b ON me.bike_id = b.id
      LEFT JOIN users scheduled_user ON me.scheduled_user_id = scheduled_user.id
      LEFT JOIN users scheduled_for_user ON me.scheduled_for_user_id = scheduled_for_user.id
      LEFT JOIN users started_user ON me.started_user_id = started_user.id
      WHERE me.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(createdEvent.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка создания события обслуживания:", error);
    res
      .status(400)
      .json({ error: error.message || "Ошибка при создании события" });
  } finally {
    client.release();
  }
});

// PATCH /api/maintenance/:id - обновить событие обслуживания
router.patch("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const updateFields = req.body;

    // Получаем текущее событие
    const currentEvent = await client.query(
      "SELECT * FROM maintenance_events WHERE id = $1",
      [id]
    );

    if (currentEvent.rows.length === 0) {
      return res.status(404).json({ error: "Событие не найдено" });
    }

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

    if (setClause.length > 0) {
      const updateQuery = `
        UPDATE maintenance_events 
        SET ${setClause.join(", ")} 
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      // Обновляем временные метки при смене статуса
      const newStatus = updateFields.status;
      const currentStatus = currentEvent.rows[0].status;
      
      if (newStatus && newStatus !== currentStatus) {
        const timeUpdates = [];
        const timeValues = [];
        let timeParamCount = 1;

        if (newStatus === 'in_progress' && currentStatus === 'planned') {
          timeUpdates.push(`started_at = $${timeParamCount}`);
          timeValues.push(new Date());
          timeParamCount++;
          
          if (updateFields.started_user_id) {
            timeUpdates.push(`started_user_id = $${timeParamCount}`);
            timeValues.push(updateFields.started_user_id);
            timeParamCount++;
          }
        } else if (newStatus === 'completed' && currentStatus === 'in_progress') {
          timeUpdates.push(`completed_at = $${timeParamCount}`);
          timeValues.push(new Date());
          timeParamCount++;
          
          if (updateFields.completed_user_id) {
            timeUpdates.push(`completed_user_id = $${timeParamCount}`);
            timeValues.push(updateFields.completed_user_id);
            timeParamCount++;
          }
        }

        if (timeUpdates.length > 0) {
          timeValues.push(id);
          await client.query(
            `UPDATE maintenance_events SET ${timeUpdates.join(", ")} WHERE id = $${timeParamCount}`,
            timeValues
          );
        }

        // Обновляем статус велосипеда
        const bikeId = currentEvent.rows[0].bike_id;
        let newBikeStatus = null;

        switch (newStatus) {
          case "in_progress":
            newBikeStatus = "в ремонте";
            break;
          case "completed":
            newBikeStatus = "в наличии";
            break;
        }

        if (newBikeStatus) {
          await client.query("UPDATE bikes SET condition_status = $1 WHERE id = $2", [
            newBikeStatus,
            bikeId,
          ]);
        }
      }
    }

    await client.query("COMMIT");

    // Возвращаем обновленное событие с дополнительной информацией
    const updatedEvent = await client.query(
      `SELECT 
        me.*,
        b.internal_article as bike_number,
        b.model,
        b.condition_status as bike_status,
        scheduled_user.name as scheduled_user_name,
        scheduled_for_user.name as scheduled_for_user_name,
        started_user.name as started_user_name,
        completed_user.name as completed_user_name,
        tested_user.name as tested_user_name
      FROM maintenance_events me
      LEFT JOIN bikes b ON me.bike_id = b.id
      LEFT JOIN users scheduled_user ON me.scheduled_user_id = scheduled_user.id
      LEFT JOIN users scheduled_for_user ON me.scheduled_for_user_id = scheduled_for_user.id
      LEFT JOIN users started_user ON me.started_user_id = started_user.id
      LEFT JOIN users completed_user ON me.completed_user_id = completed_user.id
      LEFT JOIN users tested_user ON me.tested_user_id = tested_user.id
      WHERE me.id = $1`,
      [id]
    );

    res.json(updatedEvent.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка обновления события:", error);
    res
      .status(400)
      .json({ error: error.message || "Ошибка при обновлении события" });
  } finally {
    client.release();
  }
});

// DELETE /api/maintenance/:id - удалить событие обслуживания
router.delete("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    // Получаем информацию о событии перед удалением
    const eventInfo = await client.query(
      'SELECT bike_id, status FROM maintenance_events WHERE id = $1',
      [id]
    );

    if (eventInfo.rows.length === 0) {
      return res.status(404).json({ error: "Событие не найдено" });
    }

    // Удаляем событие
    await client.query("DELETE FROM maintenance_events WHERE id = $1", [id]);

    // Проверяем, есть ли еще активные ремонты для этого велосипеда
    const activeRepairs = await client.query(
      `SELECT id FROM maintenance_events 
       WHERE bike_id = $1 AND status IN ('in_progress', 'planned')`,
      [eventInfo.rows[0].bike_id]
    );

    // Если активных ремонтов нет, возвращаем велосипед в наличие
    if (activeRepairs.rows.length === 0) {
      await client.query("UPDATE bikes SET condition_status = $1 WHERE id = $2", [
        "в наличии",
        eventInfo.rows[0].bike_id,
      ]);
    }

    await client.query("COMMIT");
    res.json({ message: "Событие успешно удалено" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка удаления события:", error);
    res.status(500).json({ error: "Ошибка при удалении события" });
  } finally {
    client.release();
  }
});

// GET /api/maintenance/:id - получить конкретное событие
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: "Неверный формат ID события" });
    }
    
    const result = await pool.query(
      `SELECT 
        me.*,
        b.internal_article as bike_number,
        b.model,
        b.condition_status as bike_status,
        scheduled_user.name as scheduled_user_name,
        scheduled_for_user.name as scheduled_for_user_name,
        started_user.name as started_user_name,
        completed_user.name as completed_user_name,
        tested_user.name as tested_user_name,
        
        -- Расчетные поля времени
        CASE 
          WHEN me.completed_at IS NOT NULL AND me.started_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (me.completed_at - me.started_at)) / 3600 
          ELSE NULL 
        END as repair_hours,
        
        CASE 
          WHEN me.parts_delivered_at IS NOT NULL AND me.parts_needed_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (me.parts_delivered_at - me.parts_needed_at)) / 3600
          ELSE NULL
        END as parts_wait_hours
        
      FROM maintenance_events me
      LEFT JOIN bikes b ON me.bike_id = b.id
      LEFT JOIN users scheduled_user ON me.scheduled_user_id = scheduled_user.id
      LEFT JOIN users scheduled_for_user ON me.scheduled_for_user_id = scheduled_for_user.id
      LEFT JOIN users started_user ON me.started_user_id = started_user.id
      LEFT JOIN users completed_user ON me.completed_user_id = completed_user.id
      LEFT JOIN users tested_user ON me.tested_user_id = tested_user.id
      WHERE me.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Событие не найдено" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка получения события:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;