import express from "express";
import pool from "../db.js";

const router = express.Router();

// Получить все запчасти с информацией о складских остатках
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        pm.*,
        COALESCE(ps."количество_на_складе", 0) as "количество_на_складе"
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      ORDER BY pm.id
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении запчастей:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Получить запчасть по ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `
      SELECT 
        pm.*,
        COALESCE(ps."количество_на_складе", 0) as "количество_на_складе"
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pm.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Запчасть не найдена" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при получении запчасти:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Создать новую запчасть
router.post("/", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      название,
      описание,
      совместимые_с,
      количество_на_складе = 0,
    } = req.body;

    await client.query("BEGIN");

    // Создаем модель запчасти
    const partResult = await client.query(
      `
      INSERT INTO part_models ("название", "описание", "совместимые_с")
      VALUES ($1, $2, $3)
      RETURNING *
    `,
      [название, описание, совместимые_с]
    );

    const partId = partResult.rows[0].id;

    // Создаем запись на складе
    await client.query(
      `
      INSERT INTO part_stock (part_model_id, "количество_на_складе")
      VALUES ($1, $2)
    `,
      [partId, количество_на_складе]
    );

    await client.query("COMMIT");

    // Возвращаем созданную запчасть с количеством на складе
    const result = await pool.query(
      `
      SELECT 
        pm.*,
        ps."количество_на_складе"
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pm.id = $1
    `,
      [partId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при создании запчасти:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

// Обновить запчасть
router.put("/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { название, описание, совместимые_с, количество_на_складе } =
      req.body;

    await client.query("BEGIN");

    // Обновляем модель запчасти
    const partResult = await client.query(
      `
      UPDATE part_models 
      SET "название" = $1, "описание" = $2, "совместимые_с" = $3, updated_at = now()
      WHERE id = $4
      RETURNING *
    `,
      [название, описание, совместимые_с, id]
    );

    if (partResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Запчасть не найдена" });
    }

    // Обновляем количество на складе (или создаем запись если её нет)
    if (количество_на_складе !== undefined) {
      await client.query(
        `
        INSERT INTO part_stock (part_model_id, "количество_на_складе")
        VALUES ($1, $2)
        ON CONFLICT (part_model_id)
        DO UPDATE SET "количество_на_складе" = $2, updated_at = now()
      `,
        [id, количество_на_складе]
      );
    }

    await client.query("COMMIT");

    // Возвращаем обновленную запчасть
    const result = await pool.query(
      `
      SELECT 
        pm.*,
        COALESCE(ps."количество_на_складе", 0) as "количество_на_складе"
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pm.id = $1
    `,
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при обновлении запчасти:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  } finally {
    client.release();
  }
});

// Удалить запчасть
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // part_stock удалится автоматически благодаря CASCADE
    const result = await pool.query(
      "DELETE FROM part_models WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Запчасть не найдена" });
    }

    res.json({ message: "Запчасть удалена успешно" });
  } catch (err) {
    console.error("Ошибка при удалении запчасти:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Обновить только количество на складе
router.patch("/:id/stock", async (req, res) => {
  try {
    const { id } = req.params;
    const { количество_на_складе } = req.body;

    // Проверяем, существует ли запчасть
    const partCheck = await pool.query(
      "SELECT id FROM part_models WHERE id = $1",
      [id]
    );
    if (partCheck.rows.length === 0) {
      return res.status(404).json({ error: "Запчасть не найдена" });
    }

    // Обновляем или создаем запись на складе
    await pool.query(
      `
      INSERT INTO part_stock (part_model_id, "количество_на_складе")
      VALUES ($1, $2)
      ON CONFLICT (part_model_id)
      DO UPDATE SET "количество_на_складе" = $2, updated_at = now()
    `,
      [id, количество_на_складе]
    );

    // Возвращаем обновленную информацию
    const result = await pool.query(
      `
      SELECT 
        pm.*,
        ps."количество_на_складе"
      FROM part_models pm
      LEFT JOIN part_stock ps ON pm.id = ps.part_model_id
      WHERE pm.id = $1
    `,
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка при обновлении количества на складе:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Получить историю использования запчасти
router.get("/:id/usage", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        mp.*,
        me.дата_начала,
        me.статус_ремонта,
        b.bike_number,
        b.model as bike_model
      FROM maintenance_parts mp
      JOIN maintenance_events me ON mp.событие_id = me.id
      JOIN bikes b ON me.bike_id = b.id
      WHERE mp.деталь_id = $1
      ORDER BY me.дата_начала DESC
    `,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении истории использования:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
