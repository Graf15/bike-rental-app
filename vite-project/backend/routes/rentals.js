import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/rentals/overdue-alerts - просроченные брони для уведомлений менеджера
router.get("/overdue-alerts", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        rc.id, rc.booked_start, rc.booked_end,
        c.last_name, c.first_name, c.phone,
        EXTRACT(EPOCH FROM (NOW() - rc.booked_start)) / 60 AS minutes_overdue,
        json_agg(
          json_build_object('bike_id', ri.bike_id, 'internal_article',
            (SELECT internal_article FROM bikes WHERE id = ri.bike_id))
          ORDER BY ri.id
        ) FILTER (WHERE ri.bike_id IS NOT NULL) AS bikes
      FROM rental_contracts rc
      JOIN customers c ON c.id = rc.customer_id
      LEFT JOIN rental_items ri ON ri.contract_id = rc.id AND ri.status = 'active'
      WHERE rc.status = 'overdue'
        AND rc.actual_start IS NULL
        AND rc.penalty_applied = FALSE
        AND rc.booked_start < NOW() - INTERVAL '15 minutes'
        AND rc.booked_start > NOW() - INTERVAL '2 hours'
      GROUP BY rc.id, rc.booked_start, rc.booked_end, c.last_name, c.first_name, c.phone
      ORDER BY rc.booked_start
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка при получении overdue-alerts:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/rentals - договоры с пагинацией и счётчиками статусов
router.get("/", async (req, res) => {
  try {
    const { status, customer_id, date_from, date_to, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    let params = [];
    let i = 1;

    if (status) { where.push(`rc.status = $${i++}`); params.push(status); }
    if (customer_id) { where.push(`rc.customer_id = $${i++}`); params.push(customer_id); }
    if (date_from) { where.push(`rc.booked_start >= $${i++}`); params.push(date_from); }
    if (date_to) { where.push(`rc.booked_start <= $${i++}`); params.push(date_to); }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // Основные данные с пагинацией
    const dataParams = [...params, parseInt(limit), offset];
    const result = await pool.query(`
      SELECT
        rc.*,
        c.last_name, c.first_name, c.middle_name, c.phone, c.status as customer_status,
        issued_user.name as issued_by_name,
        COUNT(ri.id) as items_count,
        COUNT(ri.id) FILTER (WHERE ri.status = 'active') as active_items_count,
        COUNT(ri.id) FILTER (WHERE ri.item_type = 'bike') as bikes_count,
        STRING_AGG(b.model, ', ') FILTER (WHERE ri.item_type = 'bike') as bike_models
      FROM rental_contracts rc
      JOIN customers c ON rc.customer_id = c.id
      LEFT JOIN users issued_user ON rc.issued_by = issued_user.id
      LEFT JOIN rental_items ri ON ri.contract_id = rc.id
      LEFT JOIN bikes b ON ri.bike_id = b.id
      ${whereSQL}
      GROUP BY rc.id, c.id, issued_user.id
      ORDER BY rc.id DESC
      LIMIT $${i++} OFFSET $${i++}
    `, dataParams);

    // Счётчики статусов (всегда по всем записям, без фильтра статуса)
    const countWhere = [];
    const countParams = [];
    let ci = 1;
    if (customer_id) { countWhere.push(`customer_id = $${ci++}`); countParams.push(customer_id); }
    if (date_from) { countWhere.push(`booked_start >= $${ci++}`); countParams.push(date_from); }
    if (date_to) { countWhere.push(`booked_start <= $${ci++}`); countParams.push(date_to); }
    const countWhereSQL = countWhere.length ? `WHERE ${countWhere.join(" AND ")}` : "";

    const countsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active')  as active,
        COUNT(*) FILTER (WHERE status = 'booked')  as booked,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue
      FROM rental_contracts
      ${countWhereSQL}
    `, countParams);

    res.json({
      rows: result.rows,
      total: parseInt(countsResult.rows[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
      counts: {
        active:  parseInt(countsResult.rows[0].active),
        booked:  parseInt(countsResult.rows[0].booked),
        overdue: parseInt(countsResult.rows[0].overdue),
        total:   parseInt(countsResult.rows[0].total),
      },
    });
  } catch (err) {
    console.error("Ошибка при получении договоров:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// GET /api/rentals/:id - договор с позициями
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const contractResult = await pool.query(`
      SELECT rc.*,
        c.last_name, c.first_name, c.middle_name, c.phone, c.birth_date, c.gender, c.is_veteran,
        c.status as customer_status, c.no_show_count,
        issued_user.name as issued_by_name,
        received_user.name as received_by_name
      FROM rental_contracts rc
      JOIN customers c ON rc.customer_id = c.id
      LEFT JOIN users issued_user ON rc.issued_by = issued_user.id
      LEFT JOIN users received_user ON rc.received_by = received_user.id
      WHERE rc.id = $1
    `, [id]);

    if (contractResult.rows.length === 0)
      return res.status(404).json({ error: "Договор не найден" });

    const itemsResult = await pool.query(`
      SELECT ri.*,
        b.model as bike_model, b.internal_article, b.condition_status,
        b.wheel_size as bike_wheel_size, b.frame_size, b.photos,
        br.name as brand_name,
        em.name as equipment_model_name,
        t.name as tariff_name,
        received_user.name as received_by_name
      FROM rental_items ri
      LEFT JOIN bikes b ON ri.bike_id = b.id
      LEFT JOIN brands br ON b.brand_id = br.id
      LEFT JOIN part_models em ON ri.equipment_model_id = em.id
      LEFT JOIN tariffs t ON ri.tariff_id = t.id
      LEFT JOIN users received_user ON ri.received_by = received_user.id
      WHERE ri.contract_id = $1
      ORDER BY ri.id
    `, [id]);

    res.json({ ...contractResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error("Ошибка при получении договора:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// POST /api/rentals - создать договор с позициями
router.post("/", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      customer_id, issued_by,
      booked_start, booked_end,
      deposit_type = "none", deposit_value, deposit_amount,
      prepayment_amount,
      notes_issue,
      initial_status = "booked",
      items = []
    } = req.body;

    const contractStatus = ["active", "booked"].includes(initial_status) ? initial_status : "booked";

    if (!customer_id) throw new Error("Клиент обязателен");
    if (items.length === 0) throw new Error("Добавьте хотя бы одну позицию");

    // Проверяем статус клиента
    const customerCheck = await client.query(
      "SELECT status, no_show_count FROM customers WHERE id = $1", [customer_id]
    );
    if (customerCheck.rows.length === 0) throw new Error("Клиент не найден");
    const customer = customerCheck.rows[0];
    if (customer.status === "no_rental") throw new Error("Клиенту запрещена выдача велосипедов");
    if (customer.status === "no_booking") throw new Error("Клиенту запрещено бронирование");

    // Проверяем конфликты велосипедов по времени
    for (const item of items) {
      if (item.item_type === "bike" && item.bike_id && booked_start && booked_end) {
        const conflict = await client.query(`
          SELECT rc.id FROM rental_items ri
          JOIN rental_contracts rc ON ri.contract_id = rc.id
          WHERE ri.bike_id = $1
            AND ri.status IN ('active')
            AND rc.status IN ('booked', 'active')
            AND rc.booked_start < $3
            AND rc.booked_end > $2
        `, [item.bike_id, booked_start, booked_end]);

        if (conflict.rows.length > 0) {
          const bikeInfo = await client.query("SELECT model FROM bikes WHERE id = $1", [item.bike_id]);
          throw new Error(`Велосипед "${bikeInfo.rows[0]?.model}" уже забронирован на это время (договор #${conflict.rows[0].id})`);
        }
      }
    }

    // Создаём договор
    const contractResult = await client.query(`
      INSERT INTO rental_contracts
        (customer_id, issued_by, booked_start, booked_end, status, deposit_type, deposit_value, deposit_amount,
         prepayment_amount, notes_issue, actual_start)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [customer_id, issued_by || null, booked_start || null, booked_end || null,
        contractStatus, deposit_type, deposit_value || null, deposit_amount || null,
        prepayment_amount || null, notes_issue || null,
        contractStatus === "active" ? new Date() : null]);

    const contract = contractResult.rows[0];

    // Создаём позиции
    for (const item of items) {
      await client.query(`
        INSERT INTO rental_items
          (contract_id, item_type, bike_id, equipment_model_id, equipment_name,
           tariff_id, tariff_type, price, prepaid, status, quantity,
           actual_start, discount_type, discount_percent, discount_notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$12,$13,$14)
      `, [
        contract.id,
        item.item_type || "bike",
        item.bike_id || null,
        item.equipment_model_id || null,
        item.equipment_name || null,
        item.tariff_id || null,
        item.tariff_type || null,
        item.price || null,
        item.prepaid || false,
        item.quantity || 1,
        contractStatus === "active" ? new Date() : null,
        item.discount_type || null,
        item.discount_percent > 0 ? item.discount_percent : null,
        item.discount_notes || null,
      ]);
    }

    // Обновляем статусы велосипедов
    const bikeStatus = contractStatus === "active" ? "в прокате" : "бронь";
    for (const item of items) {
      if (item.item_type === "bike" && item.bike_id) {
        await client.query(
          "UPDATE bikes SET condition_status=$1, updated_at=NOW() WHERE id=$2",
          [bikeStatus, item.bike_id]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json(contract);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при создании договора:", err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/rentals/:id/status - смена статуса договора
router.patch("/:id/status", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const { status, received_by, notes_return, total_price,
            issued_by, deposit_type, deposit_amount, deposit_value, notes_issue,
            active_item_payments } = req.body;

    const contractCheck = await client.query("SELECT * FROM rental_contracts WHERE id = $1", [id]);
    if (contractCheck.rows.length === 0) throw new Error("Договор не найден");
    const contract = contractCheck.rows[0];

    // При активации — проставляем actual_start, велосипеды → в прокате
    if (status === "active") {
      await client.query(`
        UPDATE rental_contracts SET
          status=$1, actual_start=NOW(), updated_at=NOW(),
          issued_by      = COALESCE($3, issued_by),
          deposit_type   = COALESCE($4, deposit_type),
          deposit_amount = COALESCE($5, deposit_amount),
          deposit_value  = COALESCE($6, deposit_value),
          notes_issue    = COALESCE($7, notes_issue)
        WHERE id=$2`,
        [status, id,
         issued_by     || null,
         deposit_type  || null,
         deposit_amount != null ? parseFloat(deposit_amount) : null,
         deposit_value  || null,
         notes_issue    || null]
      );
      await client.query(
        "UPDATE rental_items SET actual_start=NOW() WHERE contract_id=$1 AND status='active'",
        [id]
      );
      await client.query(`
        UPDATE bikes SET condition_status='в прокате', updated_at=NOW()
        WHERE id IN (
          SELECT bike_id FROM rental_items WHERE contract_id=$1 AND status='active' AND bike_id IS NOT NULL
        )
      `, [id]);
    }

    // При завершении — закрываем позиции, велосипеды → в наличии
    else if (status === "completed") {
      await client.query(`
        UPDATE rental_contracts SET
          status=$1, actual_end=NOW(), received_by=$2, notes_return=$3,
          total_price=COALESCE($4, total_price), updated_at=NOW()
        WHERE id=$5
      `, [status, received_by || null, notes_return || null, total_price || null, id]);

      // Сохраняем paid_amount для активных позиций перед закрытием
      if (Array.isArray(active_item_payments) && active_item_payments.length > 0) {
        for (const { id: itemId, paid_amount } of active_item_payments) {
          if (itemId && paid_amount != null) {
            await client.query(
              "UPDATE rental_items SET paid_amount=$1 WHERE id=$2 AND contract_id=$3 AND status='active'",
              [paid_amount, itemId, id]
            );
          }
        }
      }

      await client.query(`
        UPDATE rental_items SET status='returned', actual_end=NOW(), received_by=$1
        WHERE contract_id=$2 AND status='active'
      `, [received_by || null, id]);

      await client.query(`
        UPDATE bikes SET condition_status='в наличии', updated_at=NOW()
        WHERE id IN (
          SELECT bike_id FROM rental_items WHERE contract_id=$1 AND bike_id IS NOT NULL
        )
      `, [id]);
    }

    // При no_show — счётчик клиента, велосипеды → в наличии, penalty_applied=true
    else if (status === "no_show") {
      await client.query(
        "UPDATE rental_contracts SET status=$1, penalty_applied=TRUE, updated_at=NOW() WHERE id=$2",
        [status, id]
      );
      await client.query(
        "UPDATE customers SET no_show_count = no_show_count + 1, updated_at=NOW() WHERE id=$1",
        [contract.customer_id]
      );
      await client.query(`
        UPDATE customers SET status='no_booking',
          restriction_reason='Автоблокировка: 2 и более неявок по брони',
          updated_at=NOW()
        WHERE id=$1 AND no_show_count >= 2 AND status = 'active'
      `, [contract.customer_id]);
      await client.query(`
        UPDATE bikes SET condition_status='в наличии', updated_at=NOW()
        WHERE id IN (
          SELECT bike_id FROM rental_items WHERE contract_id=$1 AND bike_id IS NOT NULL
        )
      `, [id]);
    }

    // Cancelled → велосипеды в наличии
    else if (status === "cancelled") {
      await client.query(
        "UPDATE rental_contracts SET status=$1, updated_at=NOW() WHERE id=$2",
        [status, id]
      );
      await client.query(`
        UPDATE bikes SET condition_status='в наличии', updated_at=NOW()
        WHERE id IN (
          SELECT bike_id FROM rental_items WHERE contract_id=$1 AND bike_id IS NOT NULL
        )
      `, [id]);
    }

    // Остальные статусы (overdue)
    else {
      await client.query(
        "UPDATE rental_contracts SET status=$1, updated_at=NOW() WHERE id=$2",
        [status, id]
      );
    }

    await client.query("COMMIT");

    const updated = await pool.query("SELECT * FROM rental_contracts WHERE id = $1", [id]);
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при смене статуса:", err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/rentals/:contractId/items/:itemId/swap - заменить велосипед в позиции
router.patch("/:contractId/items/:itemId/swap", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { contractId, itemId } = req.params;
    const { new_bike_id, old_bike_status = "в ремонте" } = req.body;

    if (!new_bike_id) throw new Error("Не указан новый велосипед");

    // Получаем текущую позицию
    const itemRes = await client.query(
      "SELECT ri.*, rc.status as contract_status FROM rental_items ri JOIN rental_contracts rc ON ri.contract_id = rc.id WHERE ri.id = $1 AND ri.contract_id = $2",
      [itemId, contractId]
    );
    if (itemRes.rows.length === 0) throw new Error("Позиция не найдена");
    const item = itemRes.rows[0];
    if (item.item_type !== "bike") throw new Error("Заменить можно только велосипед");
    if (item.status !== "active") throw new Error("Позиция не активна");

    // Проверяем, что новый велосипед существует и не занят
    const newBikeRes = await client.query("SELECT * FROM bikes WHERE id = $1", [new_bike_id]);
    if (newBikeRes.rows.length === 0) throw new Error("Велосипед не найден");
    const newBike = newBikeRes.rows[0];
    if (["в прокате", "украден", "продан", "невозврат"].includes(newBike.condition_status)) {
      throw new Error(`Велосипед "${newBike.model}" недоступен (${newBike.condition_status})`);
    }

    // Обновляем позицию: меняем bike_id
    await client.query(
      "UPDATE rental_items SET bike_id = $1 WHERE id = $2",
      [new_bike_id, itemId]
    );

    // Старый велосипед → переданный статус (в ремонте / в наличии)
    if (item.bike_id) {
      await client.query(
        "UPDATE bikes SET condition_status = $1, updated_at = NOW() WHERE id = $2",
        [old_bike_status, item.bike_id]
      );
    }

    // Новый велосипед → статус в соответствии с договором
    const newBikeStatus = item.contract_status === "active" ? "в прокате" : "бронь";
    await client.query(
      "UPDATE bikes SET condition_status = $1, updated_at = NOW() WHERE id = $2",
      [newBikeStatus, new_bike_id]
    );

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при замене велосипеда:", err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/rentals/:contractId/items/:itemId/return - вернуть отдельную позицию
router.patch("/:contractId/items/:itemId/return", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { contractId, itemId } = req.params;
    const {
      received_by, condition_after, status = "returned", loss_charge_amount, notes,
      actual_end, paid_amount, quantity_return, discount_type, discount_percent,
    } = req.body;

    // Получаем текущую позицию
    const itemRes = await client.query(
      "SELECT * FROM rental_items WHERE id = $1 AND contract_id = $2",
      [itemId, contractId]
    );
    if (itemRes.rows.length === 0) throw new Error("Позиция не найдена");
    const currentItem = itemRes.rows[0];

    const returnTime = actual_end ? new Date(actual_end) : new Date();
    const qReturn = quantity_return ? parseInt(quantity_return) : null;
    const isPartial = qReturn && currentItem.item_type === "equipment"
      && qReturn < currentItem.quantity && qReturn > 0;

    if (isPartial) {
      // Частичный возврат оборудования: уменьшаем кол-во в активной позиции
      await client.query(
        "UPDATE rental_items SET quantity = quantity - $1 WHERE id = $2",
        [qReturn, itemId]
      );
      // Создаём отдельную строку для возвращённой части
      await client.query(`
        INSERT INTO rental_items
          (contract_id, item_type, equipment_model_id, equipment_name, tariff_id, tariff_type,
           price, status, quantity, actual_start, actual_end, received_by, condition_after, notes, paid_amount, paid_at)
        SELECT contract_id, item_type, equipment_model_id, equipment_name, tariff_id, tariff_type,
               price, 'returned', $1, actual_start, $2, $3, $4, $5, $6, $7
        FROM rental_items WHERE id = $8
      `, [qReturn, returnTime, received_by || null, condition_after || null, notes || null,
          paid_amount ? parseFloat(paid_amount) : null, paid_amount ? new Date() : null, itemId]);
    } else {
      await client.query(`
        UPDATE rental_items SET
          status=$1, actual_end=$2, received_by=$3,
          condition_after=$4, loss_charge_amount=$5, notes=$6,
          paid_amount=$7, paid_at=$8,
          discount_type=COALESCE($9, discount_type),
          discount_percent=COALESCE($10, discount_percent)
        WHERE id=$11 AND contract_id=$12
      `, [status, returnTime, received_by || null, condition_after || null,
          loss_charge_amount || null, notes || null,
          paid_amount ? parseFloat(paid_amount) : null,
          paid_amount ? new Date() : null,
          discount_type || null,
          discount_percent != null ? parseFloat(discount_percent) : null,
          itemId, contractId]);

      // Велосипед → обновляем статус
      if (currentItem.bike_id) {
        const newBikeStatus = status === "stolen" ? "украден"
          : status === "lost" ? "невозврат"
          : "в наличии";
        await client.query(
          "UPDATE bikes SET condition_status=$1, updated_at=NOW() WHERE id=$2",
          [newBikeStatus, currentItem.bike_id]
        );
      }
    }

    // Проверяем, все ли позиции возвращены — если да, закрываем договор
    const activeItems = await client.query(
      "SELECT COUNT(*) FROM rental_items WHERE contract_id=$1 AND status='active'",
      [contractId]
    );
    if (parseInt(activeItems.rows[0].count) === 0) {
      await client.query(
        "UPDATE rental_contracts SET status='completed', actual_end=NOW(), updated_at=NOW() WHERE id=$1",
        [contractId]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при возврате позиции:", err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/rentals/:id - обновить бронь (поля + позиции), только для status='booked'
router.patch("/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { id } = req.params;
    const {
      customer_id, issued_by,
      booked_start, booked_end,
      deposit_type = "none", deposit_value, deposit_amount,
      prepayment_amount,
      notes_issue,
      items = []
    } = req.body;

    const contractCheck = await client.query("SELECT * FROM rental_contracts WHERE id = $1", [id]);
    if (contractCheck.rows.length === 0) throw new Error("Договор не найден");
    if (contractCheck.rows[0].status !== "booked") throw new Error("Редактировать можно только забронированный договор");

    if (!customer_id) throw new Error("Клиент обязателен");
    if (items.length === 0) throw new Error("Добавьте хотя бы одну позицию");

    // Получаем старые велосипеды чтобы сбросить их статус
    const oldBikeRes = await client.query(
      "SELECT bike_id FROM rental_items WHERE contract_id = $1 AND bike_id IS NOT NULL", [id]
    );
    const oldBikeIds = oldBikeRes.rows.map(r => r.bike_id);

    // Проверяем конфликты для новых велосипедов (исключая текущий договор)
    for (const item of items) {
      if (item.item_type === "bike" && item.bike_id && booked_start && booked_end) {
        const conflict = await client.query(`
          SELECT rc.id FROM rental_items ri
          JOIN rental_contracts rc ON ri.contract_id = rc.id
          WHERE ri.bike_id = $1
            AND ri.status = 'active'
            AND rc.status IN ('booked', 'active')
            AND rc.id != $4
            AND rc.booked_start < $3
            AND rc.booked_end > $2
        `, [item.bike_id, booked_start, booked_end, id]);
        if (conflict.rows.length > 0) {
          const bikeInfo = await client.query("SELECT model FROM bikes WHERE id = $1", [item.bike_id]);
          throw new Error(`Велосипед "${bikeInfo.rows[0]?.model}" уже забронирован на это время (договор #${conflict.rows[0].id})`);
        }
      }
    }

    // Обновляем договор
    await client.query(`
      UPDATE rental_contracts SET
        customer_id=$1, issued_by=$2, booked_start=$3, booked_end=$4,
        deposit_type=$5, deposit_value=$6, deposit_amount=$7,
        prepayment_amount=$8, notes_issue=$9, updated_at=NOW()
      WHERE id=$10
    `, [customer_id, issued_by || null, booked_start || null, booked_end || null,
        deposit_type, deposit_value || null, deposit_amount || null,
        prepayment_amount || null, notes_issue || null, id]);

    // Удаляем старые позиции и сбрасываем статусы велосипедов
    await client.query("DELETE FROM rental_items WHERE contract_id = $1", [id]);
    if (oldBikeIds.length > 0) {
      await client.query(
        "UPDATE bikes SET condition_status='в наличии', updated_at=NOW() WHERE id = ANY($1::int[])",
        [oldBikeIds]
      );
    }

    // Вставляем новые позиции
    const newBikeIds = [];
    for (const item of items) {
      await client.query(`
        INSERT INTO rental_items
          (contract_id, item_type, bike_id, equipment_model_id, equipment_name,
           tariff_id, tariff_type, price, prepaid, status, quantity,
           discount_type, discount_percent, discount_notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$12,$13)
      `, [
        id,
        item.item_type || "bike",
        item.bike_id || null,
        item.equipment_model_id || null,
        item.equipment_name || null,
        item.tariff_id || null,
        item.tariff_type || null,
        item.price || null,
        item.prepaid || false,
        item.quantity || 1,
        item.discount_type || null,
        item.discount_percent > 0 ? item.discount_percent : null,
        item.discount_notes || null,
      ]);
      if (item.item_type === "bike" && item.bike_id) newBikeIds.push(parseInt(item.bike_id));
    }

    // Новые велосипеды → бронь
    if (newBikeIds.length > 0) {
      await client.query(
        "UPDATE bikes SET condition_status='бронь', updated_at=NOW() WHERE id = ANY($1::int[])",
        [newBikeIds]
      );
    }

    await client.query("COMMIT");
    const updated = await pool.query("SELECT * FROM rental_contracts WHERE id = $1", [id]);
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Ошибка при обновлении брони:", err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PATCH /api/rentals/:id/notes - обновить заметки договора (в любом статусе)
router.patch("/:id/notes", async (req, res) => {
  try {
    const { id } = req.params;
    const { notes_issue } = req.body;
    await pool.query(
      "UPDATE rental_contracts SET notes_issue=$1, updated_at=NOW() WHERE id=$2",
      [notes_issue ?? null, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("Ошибка при обновлении заметок:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// DELETE /api/rentals/:id - удалить только черновик (booked)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query("SELECT status FROM rental_contracts WHERE id=$1", [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Договор не найден" });
    if (check.rows[0].status !== "booked") {
      return res.status(400).json({ error: "Удалить можно только договор со статусом 'booked'" });
    }
    await pool.query("DELETE FROM rental_contracts WHERE id=$1", [id]);
    res.json({ message: "Договор удалён" });
  } catch (err) {
    console.error("Ошибка при удалении договора:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export default router;
