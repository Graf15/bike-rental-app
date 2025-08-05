import express from "express";
import db from "../db.js";

const router = express.Router();

// GET /api/maintenance - получить все события обслуживания
router.get("/", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        me.*,
        b.bike_number,
        b.model,
        b.status as bike_status,
        manager.username as manager_name,
        executor.username as executor_name
      FROM maintenance_events me
      LEFT JOIN bikes b ON me.bike_id = b.id
      LEFT JOIN users manager ON me."менеджер_id" = manager.id
      LEFT JOIN users executor ON me."исполнитель_id" = executor.id
      ORDER BY me.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Ошибка получения событий обслуживания:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/maintenance/:id - получить конкретное событие
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      `
      SELECT 
        me.*,
        b.bike_number,
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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Событие не найдено" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Ошибка получения события:", error);
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
    } = req.body;

    // Проверяем существование велосипеда
    const bikeCheck = await client.query(
      "SELECT id, status FROM bikes WHERE id = $1",
      [bike_id]
    );

    if (bikeCheck.rows.length === 0) {
      throw new Error("Велосипед не найден");
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
        "обкатка_выполнена"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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
      ]
    );

    // Обновляем статус велосипеда, если нужно
    if (статус_ремонта === "в ремонте") {
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
        b.bike_number,
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
        b.bike_number,
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

export default router;
