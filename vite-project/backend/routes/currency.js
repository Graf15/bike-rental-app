import express from "express";
import pool from "../db.js";

const router = express.Router();

// Функция для получения курса ПриватБанка
const fetchPrivatBankRate = async (date = null) => {
  try {
    let url;
    
    if (date) {
      // Для исторических данных
      const formattedDate = date.split('-').reverse().join('.'); // YYYY-MM-DD -> DD.MM.YYYY
      url = `https://api.privatbank.ua/p24api/exchange_rates?json&date=${formattedDate}`;
    } else {
      // Для текущего курса
      url = 'https://api.privatbank.ua/p24api/pubinfo?json&exchange&coursid=5';
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    let usdSaleRate;
    
    if (date) {
      // Для исторических данных структура другая
      const usdData = data.exchangeRate?.find(rate => rate.currency === 'USD');
      // Приоритет коммерческому курсу ПриватБанка, а не НБУ
      usdSaleRate = usdData?.saleRate || usdData?.saleRateNB;
    } else {
      // Для текущих данных
      const usdData = data.find(rate => rate.ccy === 'USD' && rate.base_ccy === 'UAH');
      usdSaleRate = usdData?.sale;
    }

    if (!usdSaleRate) {
      throw new Error('USD sale rate not found in PrivatBank response');
    }

    return parseFloat(usdSaleRate);
  } catch (error) {
    console.error('Error fetching PrivatBank rate:', error);
    throw error;
  }
};

// GET /api/currency/rate?date=YYYY-MM-DD - получить курс USD/UAH на дату
router.get('/rate', async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0]; // Сегодня если дата не указана

    // Сначала проверяем наш кеш
    const cachedRate = await pool.query(
      "SELECT rate_to_uah FROM currency_rates WHERE currency_code = 'USD' AND date = $1",
      [targetDate]
    );

    if (cachedRate.rows.length > 0) {
      const usdToUah = parseFloat(cachedRate.rows[0].rate_to_uah);
      
      return res.json({
        date: targetDate,
        usd_to_uah: parseFloat(usdToUah.toFixed(2)), // Округляем до 2 знаков (копейки)
        source: 'cache',
        cached: true
      });
    }

    // Если в кеше нет, получаем из ПриватБанка
    const usdSaleRate = await fetchPrivatBankRate(date);

    // Сохраняем в кеш (теперь храним USD→UAH курс напрямую)
    await pool.query(`
      INSERT INTO currency_rates (currency_code, rate_to_uah, date, created_at) 
      VALUES ('USD', $1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (currency_code, date) 
      DO UPDATE SET rate_to_uah = EXCLUDED.rate_to_uah, created_at = CURRENT_TIMESTAMP
    `, [usdSaleRate, targetDate]);

    res.json({
      date: targetDate,
      usd_to_uah: parseFloat(usdSaleRate.toFixed(2)), // Округляем до 2 знаков (копейки)
      source: 'privatbank',
      cached: false
    });

  } catch (error) {
    console.error('Error getting exchange rate:', error);
    
    // Если не можем получить курс, возвращаем последний известный
    try {
      const fallbackRate = await pool.query(
        "SELECT rate_to_uah, date FROM currency_rates WHERE currency_code = 'USD' ORDER BY date DESC LIMIT 1"
      );
      
      if (fallbackRate.rows.length > 0) {
        const usdToUah = parseFloat(fallbackRate.rows[0].rate_to_uah);
        
        return res.json({
          date: fallbackRate.rows[0].date,
          usd_to_uah: parseFloat(usdToUah.toFixed(2)), // Округляем до 2 знаков (копейки)
          source: 'fallback',
          cached: true,
          warning: 'Could not get current rate, using last known rate'
        });
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }

    res.status(500).json({ 
      error: 'Could not retrieve exchange rate',
      details: error.message 
    });
  }
});

// POST /api/currency/convert - конвертировать валюты
router.post('/convert', async (req, res) => {
  try {
    const { amount, from, to, date } = req.body;

    if (!amount || !from || !to) {
      return res.status(400).json({ error: 'Missing required fields: amount, from, to' });
    }

    if (from === to) {
      return res.json({ 
        amount: parseFloat(amount), 
        from, 
        to, 
        result: parseFloat(amount),
        rate: 1,
        date: date || new Date().toISOString().split('T')[0]
      });
    }

    // Получаем курс
    const rateResponse = await fetch(`${req.protocol}://${req.get('host')}/api/currency/rate${date ? `?date=${date}` : ''}`);
    if (!rateResponse.ok) {
      throw new Error('Failed to get exchange rate');
    }

    const rateData = await rateResponse.json();
    const usdToUah = rateData.usd_to_uah;
    
    let result, rate;
    
    if (from === 'USD' && to === 'UAH') {
      result = amount * usdToUah;
      rate = usdToUah;
    } else if (from === 'UAH' && to === 'USD') {
      result = amount / usdToUah;
      rate = 1 / usdToUah;
    } else {
      return res.status(400).json({ error: 'Only USD/UAH conversion supported' });
    }

    res.json({
      amount: parseFloat(amount),
      from,
      to,
      result: parseFloat(result.toFixed(2)),
      rate: parseFloat(rate.toFixed(4)),
      date: rateData.date,
      source: rateData.source
    });

  } catch (error) {
    console.error('Error converting currency:', error);
    res.status(500).json({ 
      error: 'Currency conversion failed',
      details: error.message 
    });
  }
});

export default router;