import pool from "../db.js";

const ts = () => new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", hour12: false });

/**
 * Фоновая обработка просроченных броней.
 *
 * Стадии (считаются от booked_start):
 *  +15 мин: booked → overdue (промежуточный, клиент опаздывает, велосипед ещё занят)
 *  +2 часа: overdue + penalty_applied=false → no_show + авто-штраф (менеджер не отреагировал)
 *
 * Уведомления на +15/+30/+60 мин показывает фронтенд через polling /api/rentals/overdue-alerts.
 */
export async function processOverdueBookings() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. booked → overdue через 15 минут (клиент опаздывает, велосипед ещё занят) ────────────
    const marked = await client.query(`
      UPDATE rental_contracts
      SET status = 'overdue', updated_at = NOW()
      WHERE status = 'booked'
        AND booked_start < NOW() - INTERVAL '15 minutes'
      RETURNING id, customer_id
    `);
    if (marked.rows.length > 0) {
      console.log(`[${ts()}] [overdue] Опаздывают (overdue): договоры ${marked.rows.map(r => r.id).join(", ")}`);
    }

    // ── 2. overdue → no_show + авто-штраф через 2 часа (менеджер не отреагировал) ───────────
    const toClose = await client.query(`
      SELECT rc.id, rc.customer_id
      FROM rental_contracts rc
      WHERE rc.status = 'overdue'
        AND rc.actual_start IS NULL
        AND rc.penalty_applied = FALSE
        AND rc.booked_start < NOW() - INTERVAL '2 hours'
    `);

    for (const { id, customer_id } of toClose.rows) {
      await client.query(`
        UPDATE bikes SET condition_status = 'в наличии', updated_at = NOW()
        WHERE id IN (
          SELECT bike_id FROM rental_items WHERE contract_id = $1 AND bike_id IS NOT NULL
        )
      `, [id]);

      await client.query(
        "UPDATE customers SET no_show_count = no_show_count + 1, updated_at = NOW() WHERE id = $1",
        [customer_id]
      );

      await client.query(`
        UPDATE customers SET status = 'no_booking',
          restriction_reason = 'Автоблокировка: 2 и более неявок по брони',
          updated_at = NOW()
        WHERE id = $1 AND no_show_count >= 2 AND status = 'active'
      `, [customer_id]);

      await client.query(
        "UPDATE rental_contracts SET status='no_show', penalty_applied=TRUE, updated_at=NOW() WHERE id=$1",
        [id]
      );
      console.log(`[${ts()}] [overdue] Авто-штраф + no_show: договор #${id}, клиент #${customer_id} (2+ часа без реакции)`);
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`[${ts()}] [overdue] Ошибка:`, err.message);
  } finally {
    client.release();
  }
}
