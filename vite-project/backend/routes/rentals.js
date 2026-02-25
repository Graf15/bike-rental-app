import express from "express";
import pool from "../db.js";

const router = express.Router();

// GET /api/rentals - все договоры с краткой инфо
router.get("/", async (req, res) => {
  try {
    const { status, customer_id, date_from, date_to } = req.query;

    let where = [];
    let params = [];
    let i = 1;

    if (status) { where.push(`rc.status = $${i++}`); params.push(status); }
    if (customer_id) { where.push(`rc.customer_id = $${i++}`); params.push(customer_id); }
    if (date_from) { where.push(`rc.booked_start >= $${i++}`); params.push(date_from); }
    if (date_to) { where.push(`rc.booked_start <= $${i++}`); params.push(date_to); }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

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
    `, params);

    res.json(result.rows);
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
        c.last_name, c.first_name, c.middle_name, c.phone, c.status as customer_status,
        c.no_show_count,
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
        br.name as brand_name,
        em.name as equipment_model_name,
        t.name as tariff_name,
        received_user.name as received_by_name
      FROM rental_items ri
      LEFT JOIN bikes b ON ri.bike_id = b.id
      LEFT JOIN brands br ON b.brand_id = br.id
      LEFT JOIN equipment_models em ON ri.equipment_model_id = em.id
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
      deposit_type = "none", deposit_value,
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
        (customer_id, issued_by, booked_start, booked_end, status, deposit_type, deposit_value, notes_issue,
         actual_start)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, $9)
      RETURNING *
    `, [customer_id, issued_by || null, booked_start || null, booked_end || null,
        contractStatus, deposit_type, deposit_value || null, notes_issue || null,
        contractStatus === "active" ? new Date() : null]);

    const contract = contractResult.rows[0];

    // Создаём позиции
    for (const item of items) {
      await client.query(`
        INSERT INTO rental_items
          (contract_id, item_type, bike_id, equipment_model_id, equipment_name,
           tariff_id, tariff_type, price, prepaid, status, quantity,
           actual_start)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11)
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
        contractStatus === "active" ? new Date() : null
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
    const { status, received_by, notes_return, total_price } = req.body;

    const contractCheck = await client.query("SELECT * FROM rental_contracts WHERE id = $1", [id]);
    if (contractCheck.rows.length === 0) throw new Error("Договор не найден");
    const contract = contractCheck.rows[0];

    // При активации — проставляем actual_start, велосипеды → в прокате
    if (status === "active") {
      await client.query(
        "UPDATE rental_contracts SET status=$1, actual_start=NOW(), updated_at=NOW() WHERE id=$2",
        [status, id]
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

    // При no_show — счётчик клиента, велосипеды → в наличии
    else if (status === "no_show") {
      await client.query(
        "UPDATE rental_contracts SET status=$1, updated_at=NOW() WHERE id=$2",
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

// PATCH /api/rentals/:contractId/items/:itemId/return - вернуть отдельную позицию
router.patch("/:contractId/items/:itemId/return", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { contractId, itemId } = req.params;
    const { received_by, condition_after, status = "returned", loss_charge_amount, notes } = req.body;

    await client.query(`
      UPDATE rental_items SET
        status=$1, actual_end=NOW(), received_by=$2,
        condition_after=$3, loss_charge_amount=$4, notes=$5
      WHERE id=$6 AND contract_id=$7
    `, [status, received_by || null, condition_after || null,
        loss_charge_amount || null, notes || null, itemId, contractId]);

    // Если велосипед украден/потерян — обновляем его статус
    if (status === "stolen") {
      const item = await client.query("SELECT bike_id FROM rental_items WHERE id = $1", [itemId]);
      if (item.rows[0]?.bike_id) {
        await client.query(
          "UPDATE bikes SET condition_status='украден', updated_at=NOW() WHERE id=$1",
          [item.rows[0].bike_id]
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
