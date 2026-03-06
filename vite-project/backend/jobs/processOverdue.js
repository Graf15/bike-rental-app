import pool from "../db.js";

/**
 * Фоновая обработка просроченных броней.
 *
 * Сценарий:
 *  +15 мин после booked_start: booked → no_show (промежуточный, без штрафа)
 *  +30 мин после booked_start: no_show (авто) → финальный: штраф клиенту + освобождение велосипедов
 *
 * penalty_applied = false означает что штраф ещё не применён (авто-переход на 15 мин).
 * penalty_applied = true  означает что штраф уже применён (вручную или авто на 30 мин).
 */
export async function processOverdueBookings() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. booked → no_show через 15 минут ───────────────────────────────────
    const marked = await client.query(`
      UPDATE rental_contracts
      SET status = 'no_show', updated_at = NOW()
      WHERE status = 'booked'
        AND booked_start < NOW() - INTERVAL '15 minutes'
      RETURNING id, customer_id
    `);
    if (marked.rows.length > 0) {
      console.log(`[overdue] Помечено как no_show: ${marked.rows.map(r => r.id).join(", ")}`);
    }

    // ── 2. no_show (авто, без штрафа) → финальный через 30 минут ─────────────
    const toClose = await client.query(`
      SELECT rc.id, rc.customer_id
      FROM rental_contracts rc
      WHERE rc.status = 'no_show'
        AND rc.actual_start IS NULL
        AND rc.penalty_applied = FALSE
        AND rc.booked_start < NOW() - INTERVAL '30 minutes'
    `);

    for (const { id, customer_id } of toClose.rows) {
      // Освобождаем велосипеды и оборудование
      await client.query(`
        UPDATE bikes SET condition_status = 'в наличии', updated_at = NOW()
        WHERE id IN (
          SELECT bike_id FROM rental_items WHERE contract_id = $1 AND bike_id IS NOT NULL
        )
      `, [id]);

      // Штраф: счётчик неявок
      await client.query(
        "UPDATE customers SET no_show_count = no_show_count + 1, updated_at = NOW() WHERE id = $1",
        [customer_id]
      );

      // Автоблокировка при 2+ неявках
      await client.query(`
        UPDATE customers SET status = 'no_booking',
          restriction_reason = 'Автоблокировка: 2 и более неявок по брони',
          updated_at = NOW()
        WHERE id = $1 AND no_show_count >= 2 AND status = 'active'
      `, [customer_id]);

      // Помечаем штраф применён
      await client.query(
        "UPDATE rental_contracts SET penalty_applied = TRUE, updated_at = NOW() WHERE id = $1",
        [id]
      );

      console.log(`[overdue] Авто-закрыта бронь #${id}, клиент #${customer_id} получил штраф`);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[overdue] Ошибка при обработке просроченных броней:", err.message);
  } finally {
    client.release();
  }
}
