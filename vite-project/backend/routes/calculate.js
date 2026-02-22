/**
 * Логика расчёта стоимости проката.
 * Документация: /docs/pricing-guide.md
 */

import express from "express";
import pool from "../db.js";

const router = express.Router();

// Округление до 10 грн по математическим правилам
const roundTo10 = (amount) => Math.round(amount / 10) * 10;

/**
 * Определяет попадает ли период проката в выходной диапазон.
 * Выходной диапазон: суббота 11:00 – воскресенье 19:30
 * Прокат считается выходным если его период ПЕРЕСЕКАЕТСЯ с этим диапазоном.
 */
const isWeekendRental = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  // Находим все субботние окна, которые могут пересекаться с прокатом
  // Достаточно проверить субботу на неделе старта и предыдущую субботу
  const findWeekendWindow = (referenceDate) => {
    const d = new Date(referenceDate);
    const day = d.getDay(); // 0=вс, 1=пн, ..., 6=сб
    const daysToSat = (6 - day + 7) % 7;
    const satStart = new Date(d);
    satStart.setDate(d.getDate() + daysToSat);
    satStart.setHours(11, 0, 0, 0);
    const sunEnd = new Date(satStart);
    sunEnd.setDate(satStart.getDate() + 1);
    sunEnd.setHours(19, 30, 0, 0);
    return { satStart, sunEnd };
  };

  const windows = [
    findWeekendWindow(start),
    findWeekendWindow(new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000)),
    findWeekendWindow(new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)),
  ];

  return windows.some(({ satStart, sunEnd }) => start < sunEnd && end > satStart);
};

/**
 * Основная функция расчёта цены.
 * Возвращает { price, type, is_weekend, breakdown, overcharge_recommendation? }
 */
const calculatePrice = (tariff, startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end - start;
  const durationMinutes = durationMs / (1000 * 60);
  const durationHours = durationMinutes / 60;
  const durationDays = durationHours / 24;

  const isWeekend = tariff.has_weekend_pricing && isWeekendRental(start, end);

  // Выбираем ценовые параметры
  let firstHour, nextHour, dayPrice, price24h;
  if (tariff.has_weekend_pricing && isWeekend) {
    firstHour = parseFloat(tariff.price_first_hour_we) || null;
    nextHour  = parseFloat(tariff.price_next_hour_we) || null;
    dayPrice  = parseFloat(tariff.price_day_we) || null;
    price24h  = parseFloat(tariff.price_24h_we) || null;
  } else if (tariff.has_weekend_pricing) {
    firstHour = parseFloat(tariff.price_first_hour_wd) || null;
    nextHour  = parseFloat(tariff.price_next_hour_wd) || null;
    dayPrice  = parseFloat(tariff.price_day_wd) || null;
    price24h  = parseFloat(tariff.price_24h_wd) || null;
  } else {
    firstHour = parseFloat(tariff.price_first_hour) || null;
    nextHour  = parseFloat(tariff.price_next_hour) || null;
    dayPrice  = parseFloat(tariff.price_day) || null;
    price24h  = parseFloat(tariff.price_24h) || null;
  }

  const priceWeek   = tariff.price_week   ? parseFloat(tariff.price_week)   : null;
  const price2weeks = tariff.price_2weeks ? parseFloat(tariff.price_2weeks) : null;
  const priceMonth  = tariff.price_month  ? parseFloat(tariff.price_month)  : null;

  // Длинные периоды: от недели и выше
  if (priceMonth && durationDays >= 30) {
    return {
      price: roundTo10(durationDays * priceMonth / 30),
      type: "month",
      is_weekend: false,
      breakdown: `${Math.round(durationDays)} дн × ${(priceMonth / 30).toFixed(2)} грн/дн`,
    };
  }
  if (price2weeks && durationDays >= 14) {
    return {
      price: roundTo10(durationDays * price2weeks / 14),
      type: "2weeks",
      is_weekend: false,
      breakdown: `${Math.round(durationDays)} дн × ${(price2weeks / 14).toFixed(2)} грн/дн`,
    };
  }
  if (priceWeek && durationDays >= 7) {
    return {
      price: roundTo10(durationDays * priceWeek / 7),
      type: "week",
      is_weekend: false,
      breakdown: `${Math.round(durationDays)} дн × ${(priceWeek / 7).toFixed(2)} грн/дн`,
    };
  }

  // Несколько суток (2–6 дней): кратное price_24h
  if (price24h && durationHours >= 48) {
    const fullDays = Math.ceil(durationHours / 24);
    return {
      price: fullDays * price24h,
      type: "24h",
      is_weekend: isWeekend,
      breakdown: `${fullDays} × ${price24h} грн (сутки)`,
    };
  }

  // Сутки (24 часа) с возможной доплатой за незначительное превышение
  if (price24h && durationHours >= 24) {
    const overMinutes = durationMinutes - 1440;
    const result = {
      price: price24h,
      type: "24h",
      is_weekend: isWeekend,
      breakdown: `Сутки ${price24h} грн`,
    };
    if (overMinutes > 0 && nextHour) {
      result.overcharge_recommendation = roundTo10((overMinutes / 60) * nextHour * 0.5);
      result.over_minutes = Math.round(overMinutes);
    }
    return result;
  }

  // Нет данных о ценах — не можем рассчитать
  if (!firstHour) {
    return { price: null, type: null, is_weekend: isWeekend, error: "Нет данных о ценах для этого периода" };
  }

  // Почасовой расчёт
  let hourlyPrice;
  if (durationMinutes <= 60) {
    hourlyPrice = firstHour;
  } else {
    const extraMinutes = durationMinutes - 60;
    hourlyPrice = firstHour + (extraMinutes / 60) * (nextHour || 0);
  }

  // Кэп на тариф «День»
  if (dayPrice && hourlyPrice >= dayPrice) {
    return {
      price: dayPrice,
      type: "day",
      is_weekend: isWeekend,
      breakdown: `Тариф «День» ${dayPrice} грн (до закрытия)`,
    };
  }

  return {
    price: roundTo10(hourlyPrice),
    type: "hourly",
    is_weekend: isWeekend,
    breakdown: durationMinutes <= 60
      ? `Первый час ${firstHour} грн`
      : `${firstHour} + ${((durationMinutes - 60) / 60).toFixed(2)} ч × ${nextHour} грн/ч`,
  };
};

/**
 * POST /api/calculate/price
 * Body: { tariff_id, start_time, end_time }
 * Returns: { price, type, is_weekend, breakdown, overcharge_recommendation?, over_minutes? }
 */
router.post("/price", async (req, res) => {
  try {
    const { tariff_id, start_time, end_time } = req.body;
    if (!tariff_id || !start_time || !end_time) {
      return res.status(400).json({ error: "Необходимы tariff_id, start_time, end_time" });
    }

    const start = new Date(start_time);
    const end   = new Date(end_time);
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: "Некорректный формат даты" });
    }
    if (end <= start) {
      return res.status(400).json({ error: "Время возврата должно быть позже времени выдачи" });
    }

    const tariffResult = await pool.query("SELECT * FROM tariffs WHERE id = $1", [tariff_id]);
    if (tariffResult.rows.length === 0) {
      return res.status(404).json({ error: "Тариф не найден" });
    }

    const result = calculatePrice(tariffResult.rows[0], start_time, end_time);
    res.json(result);
  } catch (err) {
    console.error("Ошибка при расчёте стоимости:", err);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

export { calculatePrice, isWeekendRental, roundTo10 };
export default router;
