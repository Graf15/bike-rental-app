// contractPrint.js — v2: тариф замість суми, час повернення — від руки
// Резервна копія попередньої версії: contractPrint_v1.js

// ── Дані орендодавця ─────────────────────────────────────────────────────────
const LANDLORD = {
  name:   'ФОП Панасенко Д.Д.',
  rnokpp: '3123408633',
  phone:  '(096) 621 83 85',
};

const UA_MONTHS_GEN = [
  'січня','лютого','березня','квітня','травня','червня',
  'липня','серпня','вересня','жовтня','листопада','грудня',
];

const fmtDateUA = (isoStr) => {
  if (!isoStr) return { day: '___', month: '__________', yearLast: '_' };
  const d = new Date(isoStr);
  return {
    day:      String(d.getDate()).padStart(2, '0'),
    month:    UA_MONTHS_GEN[d.getMonth()],
    yearLast: String(d.getFullYear()).slice(-1),
  };
};

const fmtTime = (isoStr) => {
  if (!isoStr) return { h: '__', m: '__' };
  const d = new Date(isoStr);
  return { h: String(d.getHours()).padStart(2,'0'), m: String(d.getMinutes()).padStart(2,'0') };
};

const fmtBirthDate = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
};


const u = (text = '', w = '20mm') =>
  `<span style="display:inline-block;border-bottom:1px solid #000;min-width:${w};padding:0 0.5mm;">${text}</span>`;

const uRow = (label, value = '') =>
  `<div style="display:flex;align-items:flex-end;gap:1.5mm;min-height:4.5mm;">
     <span style="white-space:nowrap;flex-shrink:0;">${label}</span>
     <span style="flex:1;border-bottom:1px solid #000;padding-bottom:0.2mm;">${value}</span>
   </div>`;

const uLine = (value = '') =>
  `<div style="border-bottom:1px solid #000;min-height:4.5mm;padding-bottom:0.2mm;width:100%;">${value}</div>`;

const cb = (checked) =>
  `<span style="display:inline-block;width:2.8mm;height:2.8mm;border:0.5px solid #000;
   vertical-align:middle;text-align:center;font-size:6pt;line-height:2.8mm;">${checked?'✓':''}</span>`;

const TABLE_ROWS = 7;

// ── Таблиця ставок тарифів ────────────────────────────────────────────────────
const buildTariffTable = (usedTariffIds, tariffs) => {
  const n = (v) => (v && Number(v) > 0) ? Number(v) : '—';

  const rows = [...usedTariffIds].flatMap(tid => {
    const t = tariffs.find(t => String(t.id) === tid);
    if (!t) return [];
    const td = (val, align = 'center') =>
      `<td style="border:0.5px solid #000;padding:0.3mm 1mm;text-align:${align};">${val}</td>`;

    if (t.has_weekend_pricing) {
      return [
        `<tr>
          ${td(t.name + ' (субота, неділя, святкові дні)', 'left')}
          ${td(n(t.price_first_hour_we))}
          ${td(n(t.price_next_hour_we))}
          ${td(n(t.price_day_we))}
          ${td(n(t.price_24h_we))}
        </tr>`,
        `<tr>
          ${td(t.name + ' (всі інші дні)', 'left')}
          ${td(n(t.price_first_hour_wd))}
          ${td(n(t.price_next_hour_wd))}
          ${td(n(t.price_day_wd))}
          ${td(n(t.price_24h_wd))}
        </tr>`,
      ];
    } else {
      return [`<tr>
        ${td(t.name, 'left')}
        ${td(n(t.price_first_hour))}
        ${td(n(t.price_next_hour))}
        ${td(n(t.price_day))}
        ${td(n(t.price_24h))}
      </tr>`];
    }
  });

  if (rows.length === 0) {
    return `<div>${u('', '60mm')}</div>`;
  }

  const th = (label, w = '') =>
    `<th style="border:0.5px solid #000;padding:0.5mm 1mm;${w ? `width:${w};` : ''}font-size:7pt;">${label}</th>`;

  return `<table style="margin:0.8mm 0;">
    <thead><tr>
      ${th('Тариф', '')}
      ${th('1-а год,<br>грн', '16mm')}
      ${th('Кожна<br>наступна', '13mm')}
      ${th('День,<br>грн', '13mm')}
      ${th('Доба,<br>грн', '13mm')}
    </tr></thead>
    <tbody style="font-size:7.5pt;">${rows.join('')}</tbody>
  </table>`;
};

export const printContract = ({ form, items, selectedCustomer, bikes, equipment = [], tariffs = [] }) => {
  const c        = selectedCustomer || {};
  const fullName = [c.last_name, c.first_name, c.middle_name].filter(Boolean).join(' ');
  const phone    = c.phone || '';
  const bd       = fmtBirthDate(c.birth_date);

  const cd     = fmtDateUA(form.booked_start || new Date().toISOString());
  const st     = fmtTime(form.booked_start);
  const isPaid = !!form.is_paid;
  const ed     = fmtDateUA(form.booked_end);
  const et     = fmtTime(form.booked_end);

  const dt       = Array.isArray(form.deposit_type) ? form.deposit_type : ['none'];
  const noDeposit = dt.includes('none') && dt.length === 1;
  const depAmt   = dt.includes('money')    ? (form.deposit_amount || '') : '—';
  const depDoc   = dt.includes('document') ? (form.deposit_value  || '') : '—';

  // ── Таблиця позицій ──────────────────────────────────────────────────────
  const td = (val, align = 'left') =>
    `<td style="border:0.5px solid #000;padding:0.3mm 1mm;text-align:${align};">${val}</td>`;

  const rows = items.map((item, i) => {
    let article = '';
    let name    = '';
    let tariffName = '';

    if (item.item_type === 'bike' && item.bike_id) {
      const b = bikes.find(b => String(b.id) === String(item.bike_id));
      article    = b?.internal_article || '';
      name       = b ? b.model : `Велосипед #${item.bike_id}`;
      tariffName = b?.tariff_name || '';
    } else if (item.equipment_model_id) {
      const eq   = equipment.find(e => String(e.id) === String(item.equipment_model_id));
      article    = eq?.internal_article || '';
      name       = eq?.name || item.equipment_name || 'Обладнання';
      tariffName = eq?.tariff_name || (item.tariff_id ? tariffs.find(t => String(t.id) === String(item.tariff_id))?.name : '') || '';
    } else {
      name = item.equipment_name || 'Обладнання';
    }

    return `<tr style="height:4.5mm;">
      ${td(i + 1, 'center')}
      ${td(article, 'center')}
      ${td(name)}
      ${td(tariffName, 'center')}
      ${td('', 'center')}
      ${td(item.quantity || 1, 'center')}
    </tr>`;
  });

  // Дополняем таблицу прочерками до минимума
  const MIN_ROWS = 9;
  while (rows.length < MIN_ROWS) {
    rows.push(`<tr style="height:4.5mm;">
      ${td('—', 'center')}
      ${td('—', 'center')}
      ${td('—')}
      ${td('—', 'center')}
      ${td('—', 'center')}
      ${td('—', 'center')}
    </tr>`);
  }

  // ── Унікальні тарифи по позиціям ─────────────────────────────────────────
  const usedTariffIds = new Set();
  items.forEach(item => {
    if (item.item_type === 'bike' && item.bike_id) {
      const b = bikes.find(b => String(b.id) === String(item.bike_id));
      if (b?.tariff_id) usedTariffIds.add(String(b.tariff_id));
    }
    if (item.tariff_id) usedTariffIds.add(String(item.tariff_id));
  });

  const tariffTable = buildTariffTable(usedTariffIds, tariffs);

  // ── Загальна сума (тільки якщо оплачено) ─────────────────────────────────
  const totalPaid = isPaid
    ? Math.round(items.reduce((s, i) => s + (parseFloat(i.final_price) || parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1), 0) / 10) * 10
    : null;

  // ── Добова ставка штрафу за прострочення ─────────────────────────────────
  const dailyPenalty = items.reduce((sum, item) => {
    if (item.item_type !== 'bike' || !item.bike_id) return sum;
    const b = bikes.find(b => String(b.id) === String(item.bike_id));
    if (!b?.tariff_id) return sum;
    const t = tariffs.find(t => String(t.id) === String(b.tariff_id));
    if (!t) return sum;
    const n = (v) => (v && Number(v) > 0) ? Number(v) : 0;
    const rate = t.has_weekend_pricing
      ? (n(t.price_24h_we) || n(t.price_day_we))
      : (n(t.price_24h)    || n(t.price_day));
    return sum + rate * (item.quantity || 1);
  }, 0);
  const penaltyStr = dailyPenalty > 0 ? String(Math.round(dailyPenalty / 10) * 10) : '___';

  // ── CSS ──────────────────────────────────────────────────────────────────
  const CSS = `
    @page { size: A5 portrait; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 8pt; line-height: 1.25; color: #000; }
    .page {
      display: flex;
      flex-direction: column;
      width:  148mm;
      height: 210mm;
      padding: 5mm 7mm 14mm;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .page:last-of-type { page-break-after: auto; break-after: auto; }
    .spacer { flex: 1; }
    .hdr   { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5mm; }
    .logo  { font-size:9pt; font-weight:bold; line-height:1.1; }
    .logo small { font-size:7.5pt; font-weight:normal; display:block; }
    .title    { text-align:center; font-size:10pt; font-weight:bold; margin-bottom:0.8mm; }
    .city-row { display:flex; justify-content:space-between; margin-bottom:1mm; }
    .sec  { margin-bottom:1mm; }
    .b    { font-weight:bold; }
    table { width:100%; border-collapse:collapse; font-size:7.8pt; }
    table th { border:0.5px solid #000; text-align:center; font-weight:bold;
               font-size:7.5pt; padding:0.4mm 1mm; height:5mm; vertical-align:middle; }
    .sig   { display:flex; align-items:baseline; gap:1.5mm; margin-bottom:3mm; }
    .sb    { border-bottom:0.5px solid #000; flex:0 0 20mm; }
    .sn    { border-bottom:0.5px solid #000; flex:1; }
    .sl    { font-size:10pt; }
    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  `;

  const html = `<!DOCTYPE html>
<html lang="uk"><head><meta charset="UTF-8"><title>Договір оренди</title>
<style>${CSS}</style></head><body>

<!-- ═══ СТОРІНКА 1 ═══ -->
<div class="page">

<div class="hdr">
  <div class="logo">Vel&#x1F6B2;<br><small>prokatik.com</small></div>
  <div>тел. ${LANDLORD.phone}</div>
</div>

<div class="title">Договір оренди</div>
<div class="city-row">
  <span>м. Харків</span>
  <span>«${cd.day}»&thinsp;${cd.month}&thinsp;202${cd.yearLast}&thinsp;р.</span>
</div>

<div class="sec">
  ${LANDLORD.name} реєстраційний номер облікової картки платника податків ${LANDLORD.rnokpp},
  надалі <span class="b">Орендодавець</span>, і громадянин
  <span style="border-bottom:1px solid #000;padding:0 1mm 0.2mm;">${fullName || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span>,
  дата народження <span style="border-bottom:1px solid #000;padding:0 1mm 0.2mm;">${bd || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span>,
  тел. <span style="border-bottom:1px solid #000;padding:0 1mm 0.2mm;">${phone || '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}</span>,
  надалі <span class="b">Орендар</span>, уклали цей договір про наступне:
</div>

<div style="margin-bottom:0.8mm;">
  <span class="b">1. Предмет договору</span>
  1.1 Орендодавець передає, а Орендар приймає в тимчасове користування таке майно:
</div>

<table style="margin:0 0 1.5mm;">
  <thead><tr>
    <th style="width:5.5mm;">№</th>
    <th style="width:14mm;">Артикул</th>
    <th>Найменування</th>
    <th style="width:22mm;">Тариф</th>
    <th style="width:14mm;">Оцінювальна вартість</th>
    <th style="width:7mm;">шт.</th>
  </tr></thead>
  <tbody>${rows.join('')}</tbody>
</table>

<div style="margin-bottom:1.5mm;">
  <div style="margin-bottom:0.5mm;font-size:7.5pt;"><span class="b">Заміна майна</span></div>
  <table style="font-size:7.5pt;">
    <thead>
      <tr>
        <th rowspan="2" style="border:0.5px solid #000;padding:0.4mm 1mm;width:13mm;vertical-align:middle;">Повернуто<br>артикул</th>
        <th colspan="5" style="border:0.5px solid #000;padding:0.4mm 1mm;">видано замість повернутого</th>
      </tr>
      <tr>
        <th style="border:0.5px solid #000;padding:0.4mm 1mm;width:13mm;">Артикул</th>
        <th style="border:0.5px solid #000;padding:0.4mm 1mm;">Найменування</th>
        <th style="border:0.5px solid #000;padding:0.4mm 1mm;width:22mm;">Тариф</th>
        <th style="border:0.5px solid #000;padding:0.4mm 1mm;width:14mm;">Оцін.<br>вартість</th>
        <th style="border:0.5px solid #000;padding:0.4mm 1mm;width:6mm;">шт.</th>
      </tr>
    </thead>
    <tbody>
      <tr style="height:4.5mm;">
        <td style="border:0.5px solid #000;"></td><td style="border:0.5px solid #000;"></td>
        <td style="border:0.5px solid #000;"></td><td style="border:0.5px solid #000;"></td>
        <td style="border:0.5px solid #000;"></td><td style="border:0.5px solid #000;"></td>
      </tr>
      <tr style="height:4.5mm;">
        <td style="border:0.5px solid #000;"></td><td style="border:0.5px solid #000;"></td>
        <td style="border:0.5px solid #000;"></td><td style="border:0.5px solid #000;"></td>
        <td style="border:0.5px solid #000;"></td><td style="border:0.5px solid #000;"></td>
      </tr>
    </tbody>
  </table>
</div>

<div class="sec">
  <span class="b">2. Порядок оренди</span><br>
  2.1 Термін оренди майна:&ensp;з&ensp;${u(st.h,'5.5mm')}&thinsp;:&thinsp;${u(st.m,'5.5mm')}&ensp;«${u(cd.day,'4.5mm')}»&thinsp;${u(cd.month,'19mm')}&thinsp;202${cd.yearLast}&thinsp;р${
    isPaid
      ? `<br>  <span style="padding-left:34mm;">по&ensp;${u(et.h,'5.5mm')}&thinsp;:&thinsp;${u(et.m,'5.5mm')}&ensp;«${u(ed.day,'4.5mm')}»&thinsp;${u(ed.month,'19mm')}&thinsp;202${ed.yearLast}&thinsp;р</span>`
      : `<br>  2.2 Максимальний строк оренди — до 21:00 ${fmtBirthDate(form.booked_start || new Date().toISOString())}&thinsp;р.`
  }
</div>

<div class="sec">
  <span class="b">3. Орендна плата, застава інше.</span><br>
  3.1 Орендна плата розраховується за тарифом:
  ${tariffTable}
</div>

<div class="spacer"></div>

<div class="sec">
  ${isPaid
    ? `Загальна сума: ${u(totalPaid || '','20mm')} грн<br>`
    : `Загальна вартість розраховується за тарифами з точністю до хвилини з округленням до 10&thinsp;грн під час повернення. Мінімальна оплата — 1 година.<br>`
  }
  Сплачується під час укладання договору: так ${cb(isPaid)}, ні ${cb(!isPaid)}<br>
  3.2 Застава ${noDeposit ? u('—','11mm') : u(depAmt,'11mm')} грн.<br>
  3.3 Орендар залишає Орендодавцю на зберігання документ ${u(depDoc,'26mm')}
</div>

<div class="sec">
  <span class="b">4. Обов'язки Орендодавця.</span><br>
  4.1 Надати в оренду Орендарю технічно справне майно, вказане в п.1.1<br>
  4.2 Провести інструктаж з правил технічної експлуатації.<br>
  4.3 Повернути Орендарю заставу і документ зазначений в п.&thinsp;3.3 по поверненні орендованого майна в технічно справному та чистому стані в строк згідно п.&thinsp;2.1
</div>

</div>

<!-- ═══ СТОРІНКА 2 ═══ -->
<div class="page">

<div class="sec">
  <span class="b">5. Обов'язки Орендаря.</span><br>
  5.1 Використовувати майно за його цільовим призначенням без права суборенди, передачі в користування третім особам, використання майна в якості застави.<br>
  5.2 Використовувати майно строго з дотриманням ПДР та правил його технічної експлуатації передбачених виробниками.<br>
  5.3 Своєчасно повернути майно в чистому вигляді та без ушкоджень.<br>
  5.4 Не здійснювати самостійний ремонт, регулювання або технічне обслуговування орендованого майна, а також не передавати його до сторонніх майстерень без згоди Орендодавця.<br>
  5.5 У разі виявлення несправності негайно припинити експлуатацію майна та повідомити Орендодавця за тел. ${LANDLORD.phone}.<br>
  5.6 Доставка несправного майна до Орендодавця здійснюється Орендарем самостійно та за його рахунок. Час оренди зупиняється лише з моменту телефонного повідомлення про несправність згідно п.&thinsp;5.5<br>
  5.7 В разі неможливості самостійно повернути майно в чистому вигляді, Орендар має сплатити за послуги мийки та/або змазки від 50 до 100 грн. за кожну одиницю майна на розсуд Орендодавця.<br>
  5.8 Провести оплату за пошкодження або втрату майна згідно з оцінювальною вартістю.
</div>

<div class="sec">
  <span class="b">6. Порядок передачі і повернення майна.</span><br>
  6.1 Передача майна Орендарю підтверджується підписанням цього договору. Також Орендар підтверджує що самостійно переконався у справному стані орендованого майна до початку його експлуатації, ознайомлений з правилами експлуатації та ПДР України.<br>
  6.2 Майно має бути повернене Орендодавцю в справному стані та чистим, або із відшкодуванням витрат Орендодавця на відновлення та мийку, не пізніше строку зазначеного в п.&thinsp;${isPaid ? '2.1' : '2.2'} В разі неповернення в зазначені строки з будь яких причин, до вартості оренди додається ${penaltyStr} грн. за кожні сутки затримки.<br>
  6.3 Факт повернення Орендарем майна Орендодавцю після перевірки його технічного стану підтверджується сторонами шляхом підписання відповідної графи цього договору, що вважається актом прийому-передачі.<br>
  6.4 Орендодавець має право замінити несправне орендоване майно на аналогічне без додаткового підписання договору. Факт заміни фіксується в розділі «Заміна майна» цього договору.${isPaid
    ? `<br>  6.5 У випадку, якщо Орендар з якихось причин поверне майно раніше терміну, зазначеного в п.&thinsp;2.1, Орендар не має права вимагати від Орендодавця відповідного зменшення загальної суми орендної плати.`
    : ''
  }
</div>

<div class="sec">
  <span class="b">7. Відповідальність сторін.</span><br>
  7.1 У разі заподіяння орендованому майну ушкоджень будь ким та з будь яких причин, його втрати, крадіжки, пошкодження внаслідок дорожньо транспортної пригоди, військових дій, тощо, Орендар зобов'язаний оплачувати витрати на його ремонт та придбання пошкоджених частин, або, в разі неможливості відновлення, відшкодувати повну вартість майна. Навіть в разі доведення невинуватості Орендаря, зобов'язання за цим договором і всі виплати сплачує Орендар, та самостійно вимагає компенсації від винуватця<br>
  7.2 Орендодавець не несе відповідальності за здоров'я й життя Орендаря та/або третіх осіб на протязі всього часу оренди майна в т.ч. у випадках виникненя будь яких технічних збоїв у роботі орендованого обладнання.<br>
  7.3 Неповернення майна в строки з п.&thinsp;${isPaid ? '2.1' : '2.2'} може розцінюватись як злочин згідно ст.&thinsp;190 або 191 ККУ.
</div>

<div class="sec">
  <span class="b">8. Інше</span><br>
  Орендар дає згоду на зберігання та обробку своїх персональних даних.<br>
  Будь які зміни та доповнення до цього договору мають чинність у випадку, якщо вони укладені письмово і підписані сторонами.<br>
  Цей договір набирає чинності з моменту підписання його сторонами, і діє до повного виконання сторонами зобов'язань по ньому.
</div>

<div>
  <div class="sig">
    <span>Орендар:</span>
    <span class="sl">/</span><span class="sb"></span><span class="sl">/</span>
    <span class="sn">${fullName}</span>
  </div>
  <div class="sig">
    <span>Орендодавець:</span>
    <span class="sl">/</span><span class="sb"></span><span class="sl">/</span>
    <span class="sn"></span>
  </div>
  <div style="margin:2mm 0 1.5mm;"><span class="b">Орендоване майно повернуто:</span></div>
  <div class="sig">
    <span>Орендар:</span>
    <span class="sl">/</span><span class="sb"></span><span class="sl">/</span>
    <span class="sn">${fullName}</span>
  </div>
  <div class="sig">
    <span>Орендодавець:</span>
    <span class="sl">/</span><span class="sb"></span><span class="sl">/</span>
    <span class="sn"></span>
  </div>
</div>

</div>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { alert('Дозвольте відкриття спливаючих вікон для друку договору'); return; }
  win.document.write(html);
  win.document.close();
  setTimeout(() => { try { win.print(); } catch (_) {} }, 500);
};
