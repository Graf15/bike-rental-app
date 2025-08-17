import express from "express";
import db from "../db.js";

const router = express.Router();

// GET /api/maintenance - получить все события обслуживания с фильтрами
router.get("/", async (req, res) => {
  try {
    const { 
      repair_type, 
      status, 
      bike_id, 
      priority,
      date_from, 
      date_to,
      limit = 100,
      offset = 0 
    } = req.query;

    let whereClause = [];
    let queryParams = [];
    let paramCount = 1;

    // Фильтр по типу ремонта
    if (repair_type) {
      whereClause.push(`me.repair_type = $${paramCount}`);
      queryParams.push(repair_type);
      paramCount++;
    }

    // Фильтр по статусу
    if (status) {
      whereClause.push(`me."статус_ремонта" = $${paramCount}`);
      queryParams.push(status);
      paramCount++;
    }

    // Фильтр по велосипеду
    if (bike_id) {
      whereClause.push(`me.bike_id = $${paramCount}`);
      queryParams.push(bike_id);
      paramCount++;
    }

    // Фильтр по приоритету
    if (priority) {
      whereClause.push(`me.priority = $${paramCount}`);
      queryParams.push(priority);
      paramCount++;
    }

    // Фильтр по датам
    if (date_from) {
      whereClause.push(`me."ремонт_запланирован_на" >= $${paramCount}`);
      queryParams.push(date_from);
      paramCount++;
    }

    if (date_to) {
      whereClause.push(`me."ремонт_запланирован_на" <= $${paramCount}`);
      queryParams.push(date_to);
      paramCount++;
    }

    const whereSQL = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

    // Добавляем LIMIT и OFFSET параметры
    const limitParamIndex = paramCount;
    const offsetParamIndex = paramCount + 1;
    queryParams.push(limit, offset);
    
    const result = await db.query(`
      SELECT 
        me.*,
        b.id as bike_id,
        b.name as bike_name,
        b.model,
        b.status as bike_status,
        manager.name as manager_name,
        executor.name as executor_name,
        -- Расчет количества дней до планируемой даты
        CASE 
          WHEN me."ремонт_запланирован_на" IS NOT NULL 
          THEN (me."ремонт_запланирован_на"::DATE - CURRENT_DATE)
          ELSE NULL 
        END as days_until_planned,
        -- Флаг просроченности
        CASE 
          WHEN me."ремонт_запланирован_на" < CURRENT_DATE AND me."статус_ремонта" != 'ремонт выполнен'
          THEN true 
          ELSE false 
        END as is_overdue
      FROM maintenance_events me
      LEFT JOIN bikes b ON me.bike_id = b.id
      LEFT JOIN users manager ON me."менеджер_id" = manager.id
      LEFT JOIN users executor ON me."исполнитель_id" = executor.id
      ${whereSQL}
      ORDER BY 
        CASE me.priority WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 WHEN 4 THEN 4 ELSE 5 END,
        me."ремонт_запланирован_на" ASC NULLS LAST,
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
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const {
      bike_id,
      тип_ремонта,
      статус_ремонта,
      ремонт_запланирован_на,
      дата_начала,
      менеджер_id,
      исполнитель_id,
      примечания,
      обкатка_выполнена,
      // Новые поля
      repair_type = 'current',
      priority = 3,
      estimated_duration = 15,
      estimated_cost = 0
    } = req.body;

    // Проверяем существование велосипеда
    const bikeCheck = await client.query(
      "SELECT id, status FROM bikes WHERE id = $1",
      [bike_id]
    );

    if (bikeCheck.rows.length === 0) {
      throw new Error("Велосипед не найден");
    }

    // Проверяем конфликты только для ремонтов, которые реально блокируют велосипед
    // Разрешаем: все планировочные ремонты (статус "запланирован") и долгосрочные ремонты
    const isBlockingRepair = (
      статус_ремонта === 'в ремонте' || 
      статус_ремонта === 'ожидает деталей'
    ) && repair_type !== 'longterm'; // Долгосрочные ремонты никогда не блокируют

    if (isBlockingRepair) {
      // Ищем другие активные ремонты, которые реально блокируют велосипед
      const conflictingRepairsCheck = await client.query(
        `SELECT id, "тип_ремонта", "статус_ремонта", repair_type 
         FROM maintenance_events 
         WHERE bike_id = $1 
         AND "статус_ремонта" IN ('в ремонте', 'ожидает деталей')
         AND repair_type != 'longterm'`, // Долгосрочные ремонты не блокируют велосипед
        [bike_id]
      );

      if (conflictingRepairsCheck.rows.length > 0) {
        const conflictingRepair = conflictingRepairsCheck.rows[0];
        const repairTypeText = conflictingRepair.repair_type === 'current' ? 'текущий' : 
                             conflictingRepair.repair_type === 'weekly' ? 'еженедельный' : 'долгосрочный';
        
        throw new Error(
          `Велосипед #${bike_id} уже находится в активном ремонте (ID: ${conflictingRepair.id}, ` +
          `тип: ${repairTypeText}, статус: ${conflictingRepair.статус_ремонта}). ` +
          `Нельзя начать новый "${repair_type}" ремонт со статусом "${статус_ремонта}" пока текущий не завершен.`
        );
      }
    }

    // Создаем событие обслуживания
    const result = await client.query(
      `
      INSERT INTO maintenance_events (
        bike_id,
        "тип_ремонта",
        "статус_ремонта",
        "ремонт_запланирован_на",
        "дата_начала",
        "менеджер_id",
        "исполнитель_id",
        "примечания",
        "обкатка_выполнена",
        repair_type,
        priority,
        estimated_duration,
        estimated_cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `,
      [
        bike_id,
        тип_ремонта,
        статус_ремонта,
        ремонт_запланирован_на || null,
        дата_начала || (статус_ремонта === "запланирован" ? null : new Date()),
        менеджер_id,
        исполнитель_id || null,
        примечания || null,
        обкатка_выполнена || false,
        repair_type,
        priority,
        estimated_duration,
        estimated_cost
      ]
    );

    // Обновляем статус велосипеда, если нужно (кроме долгосрочных ремонтов)
    if (статус_ремонта === "в ремонте" && repair_type !== 'longterm') {
      await client.query("UPDATE bikes SET status = $1 WHERE id = $2", [
        "в ремонте",
        bike_id,
      ]);
    }

    await client.query("COMMIT");

    // Возвращаем созданное событие с дополнительной информацией
    const createdEvent = await client.query(
      `
      SELECT 
        me.*,
        b.id as bike_id,
        b.name as bike_name,
        b.model,
        b.status as bike_status,
        manager.username as manager_name,
        executor.username as executor_name
      FROM maintenance_events me
      LEFT JOIN bikes b ON me.bike_id = b.id
      LEFT JOIN users manager ON me."менеджер_id" = manager.id
      LEFT JOIN users executor ON me."исполнитель_id" = executor.id
      WHERE me.id = $1
    `,
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
  const client = await db.connect();

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
      setClause.push(`"${key}" = ${paramCount}`);
      values.push(value);
      paramCount++;
    });

    values.push(id); // для WHERE условия

    if (setClause.length > 0) {
      setClause.push("updated_at = now()");

      const updateQuery = `
        UPDATE maintenance_events 
        SET ${setClause.join(", ")} 
        WHERE id = ${paramCount}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      // Если изменился статус ремонта, обновляем статус велосипеда
      if (updateFields.статус_ремонта) {
        const bikeId = currentEvent.rows[0].bike_id;
        let newBikeStatus = null;

        switch (updateFields.статус_ремонта) {
          case "в ремонте":
          case "ожидает деталей":
            newBikeStatus = "в ремонте";
            break;
          case "ремонт выполнен":
            newBikeStatus = "в наличии";
            break;
        }

        if (newBikeStatus) {
          await client.query("UPDATE bikes SET status = $1 WHERE id = $2", [
            newBikeStatus,
            bikeId,
          ]);
        }
      }
    }

    await client.query("COMMIT");

    // Возвращаем обновленное событие с дополнительной информацией
    const updatedEvent = await client.query(
      `
      SELECT 
        me.*,
        b.id as bike_id,
        b.name as bike_name,
        b.model,
        b.status as bike_status,
        manager.username as manager_name,
        executor.username as executor_name
      FROM maintenance_events me
      LEFT JOIN bikes b ON me.bike_id = b.id
      LEFT JOIN users manager ON me."менеджер_id" = manager.id
      LEFT JOIN users executor ON me."исполнитель_id" = executor.id
      WHERE me.id = $1
    `,
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
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    // Получаем информацию о событии перед удалением
    const eventInfo = await client.query(
      'SELECT bike_id, "статус_ремонта" FROM maintenance_events WHERE id = $1',
      [id]
    );

    if (eventInfo.rows.length === 0) {
      return res.status(404).json({ error: "Событие не найдено" });
    }

    // Удаляем событие
    await client.query("DELETE FROM maintenance_events WHERE id = $1", [id]);

    // Проверяем, есть ли еще активные ремонты для этого велосипеда
    const activeRepairs = await client.query(
      `
      SELECT id FROM maintenance_events 
      WHERE bike_id = $1 AND "статус_ремонта" IN ('в ремонте', 'ожидает деталей', 'запланирован')
    `,
      [eventInfo.rows[0].bike_id]
    );

    // Если активных ремонтов нет, возвращаем велосипед в наличие
    if (activeRepairs.rows.length === 0) {
      await client.query("UPDATE bikes SET status = $1 WHERE id = $2", [
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

// GET /api/maintenance/:id/parts - получить запчасти для события ремонта
router.get("/:id/parts", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        mp.*,
        pm."название",
        pm."описание",
        pm.purchase_price,
        (mp."использовано" * COALESCE(mp."цена_за_шт", pm.purchase_price)) as total_cost
      FROM maintenance_parts mp
      JOIN part_models pm ON mp."деталь_id" = pm.id
      WHERE mp."событие_id" = $1
      ORDER BY mp.id
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка получения запчастей события:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/maintenance/:id/parts - добавить запчасти к событию ремонта
router.post("/:id/parts", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query("BEGIN");
    
    const { id } = req.params;
    const { parts } = req.body; // Массив объектов с деталь_id, использовано, нужно
    
    // Проверяем существование события
    const eventCheck = await client.query(
      "SELECT id FROM maintenance_events WHERE id = $1",
      [id]
    );
    
    if (eventCheck.rows.length === 0) {
      throw new Error("Событие не найдено");
    }
    
    const addedParts = [];
    
    for (const part of parts) {
      const { деталь_id, использовано, нужно } = part;
      
      // Получаем цену запчасти
      const partInfo = await client.query(
        "SELECT purchase_price FROM part_models WHERE id = $1",
        [деталь_id]
      );
      
      if (partInfo.rows.length === 0) {
        throw new Error(`Запчасть с ID ${деталь_id} не найдена`);
      }
      
      const цена_за_шт = partInfo.rows[0].purchase_price;
      
      // Добавляем запчасть к событию
      const result = await client.query(`
        INSERT INTO maintenance_parts (
          "событие_id",
          "деталь_id", 
          "использовано",
          "нужно",
          "цена_за_шт"
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [id, деталь_id, использовано, нужно || 0, цена_за_шт]);
      
      // Обновляем склад (уменьшаем количество на использованное)
      if (использовано > 0) {
        await client.query(`
          UPDATE part_stock 
          SET "количество_на_складе" = "количество_на_складе" - $1,
              updated_at = now()
          WHERE part_model_id = $2
        `, [использовано, деталь_id]);
      }
      
      addedParts.push(result.rows[0]);
    }
    
    await client.query("COMMIT");
    res.status(201).json(addedParts);
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка добавления запчастей:", error);
    res.status(400).json({ error: error.message || "Ошибка при добавлении запчастей" });
  } finally {
    client.release();
  }
});

// PUT /api/maintenance/:eventId/parts/:partId - обновить запчасть в событии
router.put("/:eventId/parts/:partId", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query("BEGIN");
    
    const { eventId, partId } = req.params;
    const { использовано, нужно } = req.body;
    
    // Получаем текущую информацию о запчасти
    const currentPart = await client.query(
      "SELECT * FROM maintenance_parts WHERE id = $1 AND \"событие_id\" = $2",
      [partId, eventId]
    );
    
    if (currentPart.rows.length === 0) {
      throw new Error("Запчасть в событии не найдена");
    }
    
    const oldUsed = currentPart.rows[0].использовано;
    const difference = использовано - oldUsed;
    
    // Обновляем запчасть
    const result = await client.query(`
      UPDATE maintenance_parts 
      SET "использовано" = $1, "нужно" = $2, updated_at = now()
      WHERE id = $3
      RETURNING *
    `, [использовано, нужно, partId]);
    
    // Обновляем склад
    if (difference !== 0) {
      await client.query(`
        UPDATE part_stock 
        SET "количество_на_складе" = "количество_на_складе" - $1,
            updated_at = now()
        WHERE part_model_id = $2
      `, [difference, currentPart.rows[0].деталь_id]);
    }
    
    await client.query("COMMIT");
    res.json(result.rows[0]);
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка обновления запчасти:", error);
    res.status(400).json({ error: error.message || "Ошибка при обновлении запчасти" });
  } finally {
    client.release();
  }
});

// DELETE /api/maintenance/:eventId/parts/:partId - удалить запчасть из события
router.delete("/:eventId/parts/:partId", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query("BEGIN");
    
    const { eventId, partId } = req.params;
    
    // Получаем информацию о запчасти перед удалением
    const partInfo = await client.query(
      "SELECT * FROM maintenance_parts WHERE id = $1 AND \"событие_id\" = $2",
      [partId, eventId]
    );
    
    if (partInfo.rows.length === 0) {
      throw new Error("Запчасть в событии не найдена");
    }
    
    const { деталь_id, использовано } = partInfo.rows[0];
    
    // Удаляем запчасть
    await client.query(
      "DELETE FROM maintenance_parts WHERE id = $1",
      [partId]
    );
    
    // Возвращаем на склад использованное количество
    if (использовано > 0) {
      await client.query(`
        UPDATE part_stock 
        SET "количество_на_складе" = "количество_на_складе" + $1,
            updated_at = now()
        WHERE part_model_id = $2
      `, [использовано, деталь_id]);
    }
    
    await client.query("COMMIT");
    res.json({ message: "Запчасть удалена из события" });
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка удаления запчасти:", error);
    res.status(400).json({ error: error.message || "Ошибка при удалении запчасти" });
  } finally {
    client.release();
  }
});

// ====================================================================
// НОВЫЕ ENDPOINTS ДЛЯ РАСШИРЕННОЙ СИСТЕМЫ РЕМОНТОВ
// ====================================================================

// PATCH /api/maintenance/:id/status - быстрое изменение статуса ремонта
router.patch("/:id/status", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query("BEGIN");
    
    const { id } = req.params;
    const { status, notes } = req.body;
    
    // Проверяем существование события
    const currentEvent = await client.query(
      "SELECT * FROM maintenance_events WHERE id = $1",
      [id]
    );
    
    if (currentEvent.rows.length === 0) {
      return res.status(404).json({ error: "Событие не найдено" });
    }
    
    // Обновляем статус
    const result = await client.query(`
      UPDATE maintenance_events 
      SET "статус_ремонта" = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [status, id]);
    
    // Добавляем запись в историю с заметкой
    if (notes) {
      await client.query(`
        INSERT INTO repair_status_history (repair_id, old_status, new_status, notes)
        VALUES ($1, $2, $3, $4)
      `, [id, currentEvent.rows[0]["статус_ремонта"], status, notes]);
    }
    
    await client.query("COMMIT");
    res.json(result.rows[0]);
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка изменения статуса:", error);
    res.status(400).json({ error: error.message || "Ошибка при изменении статуса" });
  } finally {
    client.release();
  }
});

// GET /api/maintenance/:id/history - получить историю изменений статусов
router.get("/:id/history", async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT 
        rsh.*,
        u.name as changed_by_name
      FROM repair_status_history rsh
      LEFT JOIN users u ON rsh.changed_by_id = u.id
      WHERE rsh.repair_id = $1
      ORDER BY rsh.changed_at DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка получения истории:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/maintenance/weekly-schedule - получить расписание еженедельных ремонтов
router.get("/weekly-schedule", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        ws.*,
        b.id as bike_id,
        b.name as bike_name,
        b.model,
        b.status as bike_status,
        CASE ws.day_of_week
          WHEN 1 THEN 'Понедельник'
          WHEN 2 THEN 'Вторник' 
          WHEN 3 THEN 'Среда'
          WHEN 4 THEN 'Четверг'
          WHEN 5 THEN 'Пятница'
          WHEN 6 THEN 'Суббота'
          WHEN 7 THEN 'Воскресенье'
        END as day_name
      FROM weekly_repair_schedule ws
      LEFT JOIN bikes b ON ws.bike_id = b.id
      WHERE ws.is_active = true
      ORDER BY ws.day_of_week, b.name
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка получения расписания:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// PUT /api/maintenance/weekly-schedule - обновить расписание еженедельных ремонтов
router.put("/weekly-schedule", async (req, res) => {
  const client = await db.connect();
  
  try {
    await client.query("BEGIN");
    
    const { schedules } = req.body; // Массив объектов {bike_id, day_of_week, is_active}
    
    for (const schedule of schedules) {
      const { bike_id, day_of_week, is_active = true } = schedule;
      
      // Используем UPSERT (INSERT ... ON CONFLICT)
      await client.query(`
        INSERT INTO weekly_repair_schedule (bike_id, day_of_week, is_active)
        VALUES ($1, $2, $3)
        ON CONFLICT (bike_id) 
        DO UPDATE SET 
          day_of_week = EXCLUDED.day_of_week,
          is_active = EXCLUDED.is_active,
          updated_at = NOW()
      `, [bike_id, day_of_week, is_active]);
    }
    
    await client.query("COMMIT");
    res.json({ message: "Расписание обновлено успешно" });
    
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ошибка обновления расписания:", error);
    res.status(400).json({ error: error.message || "Ошибка при обновлении расписания" });
  } finally {
    client.release();
  }
});

// POST /api/maintenance/generate-weekly - генерация еженедельных ремонтов
router.post("/generate-weekly", async (req, res) => {
  try {
    const { target_date } = req.body; // Опциональная дата, по умолчанию следующий понедельник
    
    const result = await db.query(
      "SELECT generate_weekly_repairs($1) as created_count",
      [target_date || null]
    );
    
    const createdCount = result.rows[0].created_count;
    
    res.json({ 
      message: `Создано ${createdCount} еженедельных ремонтов`,
      created_count: createdCount 
    });
    
  } catch (error) {
    console.error("Ошибка генерации еженедельных ремонтов:", error);
    res.status(500).json({ error: "Ошибка при генерации ремонтов" });
  }
});

// GET /api/maintenance/analytics/summary - сводка по ремонтам
router.get("/analytics/summary", async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    
    let whereClause = "";
    let queryParams = [];
    
    if (date_from && date_to) {
      whereClause = `WHERE me.created_at BETWEEN $1 AND $2`;
      queryParams = [date_from, date_to];
    }
    
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_repairs,
        COUNT(CASE WHEN me."статус_ремонта" = 'запланирован' THEN 1 END) as planned,
        COUNT(CASE WHEN me."статус_ремонта" = 'в ремонте' THEN 1 END) as in_progress,
        COUNT(CASE WHEN me."статус_ремонта" = 'ожидает деталей' THEN 1 END) as waiting_parts,
        COUNT(CASE WHEN me."статус_ремонта" = 'ремонт выполнен' THEN 1 END) as completed,
        COUNT(CASE WHEN me.repair_type = 'current' THEN 1 END) as current_repairs,
        COUNT(CASE WHEN me.repair_type = 'weekly' THEN 1 END) as weekly_repairs,
        COUNT(CASE WHEN me.repair_type = 'longterm' THEN 1 END) as longterm_repairs,
        AVG(me.actual_duration) as avg_duration,
        SUM(me.actual_cost) as total_cost,
        COUNT(CASE WHEN me."ремонт_запланирован_на" < CURRENT_DATE AND me."статус_ремонта" != 'ремонт выполнен' THEN 1 END) as overdue
      FROM maintenance_events me
      ${whereClause}
    `, queryParams);
    
    res.json(result.rows[0]);
    
  } catch (error) {
    console.error("Ошибка получения сводки:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/maintenance/analytics/bike-downtime/:bikeId - время простоя конкретного велосипеда
router.get("/analytics/bike-downtime/:bikeId", async (req, res) => {
  try {
    const { bikeId } = req.params;
    const { date_from, date_to } = req.query;
    
    let whereClause = "WHERE bsh.bike_id = $1";
    let queryParams = [bikeId];
    
    if (date_from && date_to) {
      whereClause += ` AND bsh.changed_at BETWEEN $2 AND $3`;
      queryParams.push(date_from, date_to);
    }
    
    const result = await db.query(`
      SELECT 
        bsh.*,
        u.name as changed_by_name,
        CASE 
          WHEN bsh.reason = 'repair_started' THEN 'Начало ремонта'
          WHEN bsh.reason = 'repair_completed' THEN 'Завершение ремонта'
          ELSE bsh.reason 
        END as reason_display
      FROM bike_status_history bsh
      LEFT JOIN users u ON bsh.changed_by_id = u.id
      ${whereClause}
      ORDER BY bsh.changed_at DESC
    `, queryParams);
    
    // Вычисляем общее время простоя
    const downtimeResult = await db.query(`
      SELECT 
        SUM(bsh.duration_in_previous_status) as total_downtime_minutes,
        COUNT(CASE WHEN bsh.new_status = 'в ремонте' THEN 1 END) as repair_periods
      FROM bike_status_history bsh
      ${whereClause}
      AND bsh.new_status IN ('в ремонте', 'в наличии')
    `, queryParams);
    
    res.json({
      history: result.rows,
      summary: downtimeResult.rows[0]
    });
    
  } catch (error) {
    console.error("Ошибка получения истории велосипеда:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/maintenance/parts-needs - получить потребности в запчастях из активных ремонтов
router.get("/parts-needs", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        me.id as repair_id,
        me.bike_id,
        b.id as bike_id,
        b.name as bike_name,
        b.model,
        me."тип_ремонта" as repair_type_ru,
        me.repair_type,
        me."статус_ремонта" as status,
        me.priority,
        mp."деталь_id" as part_id,
        pm."название" as part_name,
        pm."описание" as part_description,
        mp."нужно" as needed_quantity,
        mp."использовано" as used_quantity,
        (mp."нужно" - mp."использовано") as remaining_needed,
        ps."количество_на_складе" as stock_quantity,
        CASE 
          WHEN (mp."нужно" - mp."использовано") > ps."количество_на_складе" 
          THEN (mp."нужно" - mp."использовано") - ps."количество_на_складе"
          ELSE 0 
        END as shortage_quantity,
        pm.purchase_price,
        me."ремонт_запланирован_на" as planned_date
      FROM maintenance_events me
      JOIN maintenance_parts mp ON me.id = mp."событие_id"
      JOIN part_models pm ON mp."деталь_id" = pm.id
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      LEFT JOIN bikes b ON me.bike_id = b.id
      WHERE me."статус_ремонта" IN ('запланирован', 'в ремонте', 'ожидает деталей')
        AND mp."нужно" > mp."использовано"
      ORDER BY 
        me.priority ASC,
        me."ремонт_запланирован_на" ASC NULLS LAST,
        shortage_quantity DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка получения потребностей в запчастях:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/maintenance/:id - получить конкретное событие (размещен в конце чтобы не перехватывать специфичные роуты)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Проверяем, что ID является числом
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ error: "Неверный формат ID события" });
    }
    
    const result = await db.query(
      `
      SELECT 
        me.*,
        b.id as bike_id,
        b.name as bike_name,
        b.model,
        b.status as bike_status,
        manager.username as manager_name,
        executor.username as executor_name
      FROM maintenance_events me
      LEFT JOIN bikes b ON me.bike_id = b.id
      LEFT JOIN users manager ON me."менеджер_id" = manager.id
      LEFT JOIN users executor ON me."исполнitель_id" = executor.id
      WHERE me.id = $1
    `,
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
