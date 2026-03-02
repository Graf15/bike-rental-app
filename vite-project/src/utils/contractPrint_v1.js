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

const TABLE_ROWS = 8;

export const printContract = ({ form, items, selectedCustomer, bikes }) => {
  const c        = selectedCustomer || {};
  const fullName = [c.last_name, c.first_name, c.middle_name].filter(Boolean).join(' ');
  const phone    = c.phone || '';
  const bd       = fmtBirthDate(c.birth_date);

  const cd = fmtDateUA(form.booked_start || new Date().toISOString());
  const sd = fmtDateUA(form.booked_start);
  const ed = fmtDateUA(form.booked_end);
  const st = fmtTime(form.booked_start);
  const et = fmtTime(form.booked_end);

  const total     = Math.round(items.reduce((s,i) => s + (parseFloat(i.final_price)||0), 0));
  const isPrepaid = items.some(i => i.prepaid);
  const dt        = Array.isArray(form.deposit_type) ? form.deposit_type : ['none'];
  const depAmt    = dt.includes('money')    ? (form.deposit_amount || '') : '';
  const depDoc    = dt.includes('document') ? (form.deposit_value  || '') : '';

  const rows = items.map((item, i) => {
    let name = '';
    if (item.item_type === 'bike' && item.bike_id) {
      const b = bikes.find(b => String(b.id) === String(item.bike_id));
      name = b ? [b.internal_article, b.model].filter(Boolean).join(' ') : `Велосипед #${item.bike_id}`;
    } else {
      name = item.equipment_name || 'Обладнання';
    }
    return `<tr style="height:5.2mm;">
      <td style="text-align:center;border:0.5px solid #000;padding:0.3mm 1mm;">${i+1}</td>
      <td style="border:0.5px solid #000;padding:0.3mm 1.5mm;">${name}</td>
      <td style="border:0.5px solid #000;"></td>
      <td style="text-align:center;border:0.5px solid #000;padding:0.3mm 1mm;">${item.quantity||1}</td>
    </tr>`;
  });
  while (rows.length < TABLE_ROWS) {
    rows.push(`<tr style="height:5.2mm;">
      <td style="border:0.5px solid #000;">&nbsp;</td>
      <td style="border:0.5px solid #000;"></td>
      <td style="border:0.5px solid #000;"></td>
      <td style="border:0.5px solid #000;"></td>
    </tr>`);
  }

  // ── CSS ──────────────────────────────────────────────────────────────────
  const CSS = `
    /* margin:0 прибирає колонтитули браузера (дата, URL, номер сторінки) */
    @page { size: A5 portrait; margin: 0; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body { font-family: 'Times New Roman', Times, serif; font-size: 8pt; line-height: 1.25; color: #000; }

    /* Кожен .page = рівно одна сторінка A5 (148×210 мм).
       overflow:hidden гарантує, що вміст не виходить на наступну сторінку. */
    .page {
      display: block;
      width:  148mm;
      height: 210mm;
      padding: 8mm 10mm;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .page:last-of-type { page-break-after: auto; break-after: auto; }

    .hdr   { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:2.5mm; }
    .logo  { font-size:9pt; font-weight:bold; line-height:1.1; }
    .logo small { font-size:7.5pt; font-weight:normal; display:block; }

    .title    { text-align:center; font-size:10pt; font-weight:bold; margin-bottom:1.5mm; }
    .city-row { display:flex; justify-content:space-between; margin-bottom:2mm; }

    .sec  { margin-bottom:1.5mm; }
    .b    { font-weight:bold; }

    table { width:100%; border-collapse:collapse; margin:1.2mm 0; font-size:7.8pt; }
    table th { border:0.5px solid #000; text-align:center; font-weight:bold;
               font-size:7.5pt; padding:0.8mm 1mm; height:6.5mm; vertical-align:middle; }

    .sig   { display:flex; align-items:baseline; gap:1.5mm; margin-bottom:3mm; }
    .sb    { border-bottom:0.5px solid #000; flex:0 0 20mm; }
    .sn    { border-bottom:0.5px solid #000; flex:1; }
    .sl    { font-size:10pt; }

    @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  `;

  // ── HTML ─────────────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="uk"><head><meta charset="UTF-8"><title>Договір оренди</title>
<style>${CSS}</style></head><body>

<!-- ═══ СТОРІНКА 1 ═══ -->
<div class="page">

<div class="hdr">
  <div class="logo">Vel&#x1F6B2;<br><small>prokatik.com</small></div>
  <div>тел. (096) 621 83 85</div>
</div>

<div class="title">Договір оренди</div>
<div class="city-row">
  <span>м. Харків</span>
  <span>«${cd.day}»&thinsp;${cd.month}&thinsp;202${cd.yearLast}&thinsp;р.</span>
</div>

<div class="sec">
  ФОП Панасенко Д.Д. реєстраційний номер облікової картки платника податків
  3123408633, надалі <span class="b">Орендодавець</span>, і громадянин
  ${uLine(fullName)}
  ${uRow('зареєстрований за адресою', '')}
  ${uRow('документ', '')}
  <div style="display:flex;align-items:flex-end;gap:2mm;min-height:4.5mm;">
    <span style="white-space:nowrap;flex-shrink:0;">дата народження</span>
    <span style="border-bottom:0.5px solid #000;min-width:22mm;padding-bottom:0.2mm;">${bd}</span>
    <span style="white-space:nowrap;flex-shrink:0;">, тел.</span>
    <span style="flex:1;border-bottom:0.5px solid #000;padding-bottom:0.2mm;">${phone}</span>
  </div>
  надалі <span class="b">Орендар</span>, уклали цей договір про наступне:
</div>

<div class="sec">
  <span class="b">1. Предмет договору</span><br>
  1.1 Орендодавець передає, а Орендар приймає в тимчасове користування таке майно:
</div>

<table>
  <thead><tr>
    <th style="width:5.5mm;">№</th>
    <th>Найменування</th>
    <th style="width:16mm;">Оцінювальна<br>вартість</th>
    <th style="width:7.5mm;">шт.</th>
  </tr></thead>
  <tbody>${rows.join('')}</tbody>
</table>

<div class="sec">
  <span class="b">2. Порядок оренди</span><br>
  2.1 Термін оренди майна:&ensp;з&ensp;${u(st.h,'5.5mm')}&thinsp;:&thinsp;${u(st.m,'5.5mm')}&ensp;«${u(sd.day,'4.5mm')}»&thinsp;${u(sd.month,'19mm')}&thinsp;202${sd.yearLast}&thinsp;р<br>
  <span style="padding-left:34mm;">по&ensp;${u(et.h,'5.5mm')}&thinsp;:&thinsp;${u(et.m,'5.5mm')}&ensp;«${u(ed.day,'4.5mm')}»&thinsp;${u(ed.month,'19mm')}&thinsp;202${ed.yearLast}&thinsp;р</span>
</div>

<div class="sec">
  <span class="b">3. Орендна плата, застава інше.</span><br>
  3.1 Орендна плата встановлюється у розмірі ${u(total||'','13mm')} грн.<br>
  Сплачується під час укладання договору: так ${cb(isPrepaid)}, ні ${cb(!isPrepaid)}<br>
  3.2 Застава ${u(depAmt,'11mm')} грн.<br>
  3.3 Орендар залишає Орендодавцю на зберігання документ ${u(depDoc,'26mm')}
</div>

<div class="sec">
  <span class="b">4. Обов'язки Орендодавця.</span><br>
  4.1 Надати в оренду Орендарю технічно справне майно, вказане в п.1.1<br>
  4.2 Провести інструктаж з правил технічної експлуатації.<br>
  4.3 Повернути Орендарю заставу і документ зазначений в п.&thinsp;3.3 по поверненні орендованого майна в технічно справному та чистому стані в строк згідно п.&thinsp;2.1
</div>

<div class="sec">
  <span class="b">5. Обов'язки Орендаря.</span><br>
  5.1 Використовувати майно за його цільовим призначенням без права суборенди, передачі в користування третім особам, використання майна в якості застави.<br>
  5.2 Використовувати майно строго з дотриманням ПДР та правил його технічної експлуатації передбачених виробниками.<br>
  5.3 Своєчасно повернути майно в чистому вигляді та без ушкоджень.
</div>

</div>

<!-- ═══ СТОРІНКА 2 ═══ -->
<div class="page">

<div class="sec">
  5.4 В разі неможливості самостійно повернути майно в чистому вигляді, Орендар має сплатити за послуги мийки та/або змазки від 20 до 60 грн. за кожну одиницю майна в залежності від рівня забрудненості.<br>
  5.5 Провести оплату за пошкодження або втрату майна згідно з оцінювальною вартістю.
</div>

<div class="sec">
  <span class="b">6. Порядок передачі і повернення майна.</span><br>
  6.1 Передача майна Орендарю підтверджується підписанням цього договору. Також Орендар підтверджує що самостійно переконався у справному стані орендованого майна до початку його експлуатації, ознайомлений з правилами експлуатації та ПДР України.<br>
  6.2 Майно має бути повернене Орендодавцю в справному стані та чистим, або із відшкодуванням витрат Орнедодавця на відновлення та мийку, не пізніше строку зазначеного в п.&thinsp;2.1 В разі неповернення в зазначені строки з будь яких причин, до вартості оренди додається ___ грн. за кожні сутки затримки.<br>
  6.3 Факт повернення Орендарем майна Орендодавцю після перевірки його технічного стану підтверджується сторонами шляхом підписання відповідної графи цього договору, що вважається актом прийому-передачі.<br>
  6.4 У випадку, якщо Орендар з якихось причин поверне майно раніше терміну, зазначеного в п.&thinsp;2.1, Орендар не має права вимагати від Орендодавця відповідного зменшення загальної суми орендної плати.
</div>

<div class="sec">
  <span class="b">7. Відповідальність сторін.</span><br>
  7.1 У разі заподіяння орендованому майну ушкоджень будь ким та з будь яких причин, його втрати, крадіжки, пошкодження внаслідок дорожньо транспортної пригоди, військових дій, тощо, Орендар зобов'язаний оплачувати витрати на його ремонт та придбання пошкоджених частин, або, в разі неможливості відновлення, відшкодувати повну вартість майна. Навіть в разі доведення невинуватості Орендаря, зобов'язання за цим договором і всі виплати сплачує Орендар, та самостійно вимагає компенсації від винуватця<br>
  7.2 Орендодавець не несе відповідальності за здоров'я й життя Орендаря та/або третіх осіб на протязі всього часу оренди майна в т.ч. у випадках виникненя будь яких технічних збоїв у роботі орендованого обладнання.<br>
  7.3 Неповернення майна в строки з п.&thinsp;2.1 може розцінюватись як злочин згідно ст.&thinsp;190 або 191 ККУ.
</div>

<div class="sec">
  <span class="b">8. Інше</span><br>
  Орендар дає згоду на зберігання та обробку своїх персональних даних.<br>
  Будь які зміни та доповнення до цього договору мають чинність у випадку, якщо вони укладені письмово і підписані сторонами.<br>
  Цей договір набирає чинності з моменту підписання його сторонами, і діє до повного виконання сторонами зобов'язань по ньому.
</div>

<div style="margin-top:4mm;">
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
  <div style="margin:3mm 0 1.5mm;"><span class="b">Орендоване майно повернуто:</span></div>
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
