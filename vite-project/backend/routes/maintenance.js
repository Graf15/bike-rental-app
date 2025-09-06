import express from "express";
import pool from "../db.js";

const router = express.Router();

// Middleware для логирования всех запросов к maintenance endpoints
router.use((req, res, next) => {
  console.log(`=== MAINTENANCE REQUEST ===`);
  console.log(`Method: ${req.method}`);
  console.log(`Path: ${req.path}`);
  console.log(`URL: ${req.url}`);
  console.log(`Params:`, req.params);
  next();
});

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

// GET /api/maintenance/weekly-schedule - получить еженедельное расписание
router.get("/weekly-schedule", async (req, res) => {
  console.log("=== WEEKLY SCHEDULE ENDPOINT CALLED ===");
  console.log("Request path:", req.path);
  console.log("Request params:", req.params);
  console.log("Request URL:", req.url);
  
  try {
    const result = await pool.query(
      `SELECT 
        ws.*,
        b.internal_article,
        b.model
      FROM weekly_repair_schedule ws
      LEFT JOIN bikes b ON ws.bike_id = b.id
      ORDER BY ws.day_of_week, b.internal_article`
    );

    console.log("Query result:", result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка получения еженедельного расписания:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PUT /api/maintenance/weekly-schedule - обновить еженедельное расписание
router.put("/weekly-schedule", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { bike_id, days_of_week } = req.body;

    if (!bike_id) {
      return res.status(400).json({ error: "Не указан ID велосипеда" });
    }

    if (!Array.isArray(days_of_week)) {
      return res.status(400).json({ error: "Неверный формат данных для дней недели" });
    }

    // Проверяем существование велосипеда
    const bikeCheck = await client.query(
      "SELECT id FROM bikes WHERE id = $1",
      [bike_id]
    );

    if (bikeCheck.rows.length === 0) {
      throw new Error(`Велосипед с ID ${bike_id} не найден`);
    }

    // Удаляем все существующие расписания для этого велосипеда
    await client.query(
      "DELETE FROM weekly_repair_schedule WHERE bike_id = $1",
      [bike_id]
    );

    // Если массив дней не пустой, создаем новые расписания
    if (days_of_week.length > 0) {
      for (const day_of_week of days_of_week) {
        // Проверяем что день недели валидный
        if (day_of_week < 1 || day_of_week > 7) {
          throw new Error(`Неверный день недели: ${day_of_week}`);
        }

        await client.query(
          `INSERT INTO weekly_repair_schedule (bike_id, day_of_week, is_active, week_interval)
           VALUES ($1, $2, true, 1)`,
          [bike_id, day_of_week]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ 
      message: "Расписание успешно обновлено",
      bike_id,
      days_of_week: days_of_week.length > 0 ? days_of_week : []
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка обновления расписания:", error);
    res.status(400).json({ error: error.message || "Ошибка при обновлении расписания" });
  } finally {
    client.release();
  }
});

// POST /api/maintenance/generate-weekly - генерировать еженедельные ремонты
router.post("/generate-weekly", async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Получаем активные еженедельные расписания
    const schedulesResult = await client.query(
      `SELECT ws.*, b.internal_article, b.model
       FROM weekly_repair_schedule ws
       JOIN bikes b ON ws.bike_id = b.id
       WHERE ws.is_active = true
       ORDER BY ws.day_of_week`
    );

    const schedules = schedulesResult.rows;

    if (schedules.length === 0) {
      return res.status(400).json({ error: "Нет активных еженедельных расписаний" });
    }

    // Получаем следующий понедельник
    const today = new Date();
    const nextMonday = new Date(today);
    const daysUntilMonday = (8 - today.getDay()) % 7;
    nextMonday.setDate(today.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday));
    nextMonday.setHours(9, 0, 0, 0); // Устанавливаем время на 9:00

    const createdEvents = [];
    const skippedBikes = [];
    const errors = [];

    // Создаем события для каждого дня недели
    for (const schedule of schedules) {
      try {
        // Вычисляем дату для этого дня недели
        const eventDate = new Date(nextMonday);
        const daysToAdd = schedule.day_of_week - 1; // 1 = понедельник, поэтому -1
        eventDate.setDate(nextMonday.getDate() + daysToAdd);

        // Проверяем, есть ли уже запланированное событие в этот день для этого велосипеда
        const existingEvent = await client.query(
          `SELECT me.id, me.maintenance_type, me.status, me.scheduled_for, me.description
           FROM maintenance_events me
           WHERE me.bike_id = $1 
           AND DATE(me.scheduled_for) = DATE($2) 
           AND me.status IN ('planned', 'in_progress')`,
          [schedule.bike_id, eventDate]
        );

        if (existingEvent.rows.length > 0) {
          const existing = existingEvent.rows[0];
          const dayName = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][schedule.day_of_week - 1];
          skippedBikes.push({
            bike_id: schedule.bike_id,
            internal_article: schedule.internal_article,
            model: schedule.model,
            planned_day: dayName,
            planned_date: eventDate.toLocaleDateString('ru-RU'),
            reason: existing.status === 'in_progress' 
              ? 'в активном ремонте' 
              : 'уже запланировано',
            existing_event: {
              type: existing.maintenance_type,
              status: existing.status,
              description: existing.description
            }
          });
          continue;
        }

        // Проверяем есть ли незавершенные ремонты для этого велосипеда
        const activeRepairs = await client.query(
          `SELECT me.id, me.maintenance_type, me.status, me.scheduled_for, me.description
           FROM maintenance_events me
           WHERE me.bike_id = $1 
           AND me.status = 'in_progress'`,
          [schedule.bike_id]
        );

        if (activeRepairs.rows.length > 0) {
          const activeRepair = activeRepairs.rows[0];
          const dayName = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][schedule.day_of_week - 1];
          skippedBikes.push({
            bike_id: schedule.bike_id,
            internal_article: schedule.internal_article,
            model: schedule.model,
            planned_day: dayName,
            planned_date: eventDate.toLocaleDateString('ru-RU'),
            reason: 'незавершенный ремонт',
            existing_event: {
              type: activeRepair.maintenance_type,
              status: activeRepair.status,
              description: activeRepair.description
            }
          });
          continue;
        }

        // Создаем событие обслуживания
        const newEvent = await client.query(
          `INSERT INTO maintenance_events (
            bike_id,
            maintenance_type,
            status,
            scheduled_for,
            description,
            notes
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *`,
          [
            schedule.bike_id,
            'weekly', // Еженедельное обслуживание
            'planned',
            eventDate,
            `Еженедельное ТО (${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][schedule.day_of_week - 1]})`,
            `Автоматически созданное событие на основе еженедельного расписания`
          ]
        );

        createdEvents.push({
          ...newEvent.rows[0],
          bike_article: schedule.internal_article,
          bike_model: schedule.model
        });
      } catch (eventError) {
        errors.push({
          bike_id: schedule.bike_id,
          internal_article: schedule.internal_article,
          model: schedule.model,
          error: eventError.message
        });
      }
    }

    await client.query("COMMIT");

    // Формируем детальное сообщение
    let message = `Создано ${createdEvents.length} событий обслуживания на неделю ${nextMonday.toLocaleDateString('ru-RU')}`;
    
    if (skippedBikes.length > 0) {
      message += `\n\nПропущено велосипедов: ${skippedBikes.length}`;
    }
    
    if (errors.length > 0) {
      message += `\n\nОшибок при создании: ${errors.length}`;
    }

    res.json({
      message,
      events: createdEvents,
      skipped: skippedBikes,
      errors: errors,
      weekStart: nextMonday.toISOString(),
      summary: {
        created: createdEvents.length,
        skipped: skippedBikes.length,
        errors: errors.length,
        total_scheduled: schedules.length
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка генерации еженедельных событий:", error);
    res.status(400).json({ error: error.message || "Ошибка при генерации событий" });
  } finally {
    client.release();
  }
});

// PATCH /api/maintenance/:id - обновить событие обслуживания
router.patch("/:id", async (req, res) => {
  console.log("=== PATCH /:id ENDPOINT CALLED ===");
  console.log("Request path:", req.path);
  console.log("Request params:", req.params);
  console.log("Request URL:", req.url);
  console.log("Param ID:", req.params.id);
  
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

export default router;