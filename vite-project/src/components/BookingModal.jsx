import React, { useState, useEffect, useRef, useCallback } from "react";
import "./Modal.css";

const INITIAL_FORM = {
  customer_id: "",
  issued_by: "",
  booked_start: "",
  booked_end: "",
  deposit_type: "none",
  deposit_value: "",
  notes_issue: "",
};

const INITIAL_ITEM = {
  item_type: "bike",
  bike_id: "",
  equipment_model_id: "",
  equipment_name: "",
  tariff_id: "",
  tariff_type: "hourly",
  price: "",
  quantity: 1,
  prepaid: false,
};

const DEPOSIT_TYPES = [
  { value: "none",     label: "Без залога" },
  { value: "money",    label: "Денежный залог" },
  { value: "document", label: "Документ" },
];

const toLocalStr = (date) => {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDt = (dateStr) => {
  if (!dateStr) return null;
  try { return new Date(dateStr).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return null; }
};

const TARIFF_OPTIONS = ["kids", "econom", "standart", "premium", "эл.вел", "эл.самокат"];
const WHEEL_OPTIONS  = ["16", "18", "20", "24", "26", "27.5", "29"];

// Рекомендуемые размеры рамы по росту
const heightToFrameRec = (height) => {
  const h = parseInt(height);
  if (!h) return null;
  if (h < 115) return { label: "д20", sizes: ["д20"], wheel: "20" };
  if (h < 135) return { label: "д24", sizes: ["д24"], wheel: "24" };
  if (h < 150) return { label: "XS / 13–14\"", sizes: ["XS", "13", "14"] };
  if (h < 162) return { label: "S / 15–16\"", sizes: ["S", "15", "15,5", "16", "16,5"] };
  if (h < 173) return { label: "M / 17–18\"", sizes: ["M", "17", "17,5", "18", "18,5"] };
  if (h < 183) return { label: "L / 19–20\"", sizes: ["L", "19", "19,5", "20", "20,5"] };
  return { label: "XL / 21\"+", sizes: ["XL", "XXL", "21", "21,5", "22", "22,5", "23", "23,5"] };
};

const BookingModal = ({ onClose, onSave }) => {
  const [form, setForm]           = useState(INITIAL_FORM);
  const [items, setItems]         = useState([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [dateError, setDateError] = useState(null);
  const mouseDownOnOverlay        = useRef(false);

  const [customers, setCustomers]   = useState([]);
  const [users, setUsers]           = useState([]);
  const [allBikes, setAllBikes]     = useState([]); // для отображения карточек
  const [tariffs, setTariffs]       = useState([]);
  const [equipment, setEquipment]   = useState([]);
  const [bikesLoading, setBikesLoading] = useState(false);

  // Фильтры
  const [filterTariff, setFilterTariff] = useState("");
  const [filterWheel, setFilterWheel]   = useState("");
  const [filterHeight, setFilterHeight] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  // Попап количества оборудования
  const [qtyPopup, setQtyPopup] = useState(null);
  const [qtyValue, setQtyValue] = useState(1);
  const qtyInputRef             = useRef(null);

  // Поиск клиента
  const [customerSearch, setCustomerSearch]     = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown]         = useState(false);
  const [customerFocused, setCustomerFocused]   = useState(-1);
  const customerInputRef                        = useRef(null);
  const dropdownRef                             = useRef(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers").then(r => r.json()),
      fetch("/api/users").then(r => r.json()),
      fetch("/api/tariffs").then(r => r.json()),
      fetch("/api/equipment").then(r => r.json()),
    ]).then(([c, u, t, e]) => {
      setCustomers(Array.isArray(c) ? c : []);
      setUsers(Array.isArray(u) ? u : []);
      setTariffs(Array.isArray(t) ? t.filter(x => x.is_active) : []);
      setEquipment(Array.isArray(e) ? e : []);
    }).catch(console.error);
  }, []);

  useEffect(() => { setTimeout(() => customerInputRef.current?.focus(), 50); }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Загружаем велосипеды при изменении дат
  useEffect(() => {
    if (!form.booked_start || !form.booked_end) {
      // без дат — грузим без фильтра по времени
      const url = "/api/bikes/for-rental";
      setBikesLoading(true);
      fetch(url).then(r => r.json()).then(b => setAllBikes(Array.isArray(b) ? b : [])).catch(console.error).finally(() => setBikesLoading(false));
      return;
    }
    if (dateError) return;
    setBikesLoading(true);
    const url = `/api/bikes/for-rental?start=${encodeURIComponent(form.booked_start)}&end=${encodeURIComponent(form.booked_end)}`;
    fetch(url).then(r => r.json()).then(b => setAllBikes(Array.isArray(b) ? b : [])).catch(console.error).finally(() => setBikesLoading(false));
  }, [form.booked_start, form.booked_end, dateError]);

  // ── Расчёт цены ─────────────────────────────────────────────────────────────

  const fetchPrice = useCallback(async (tariff_id, start_time, end_time) => {
    if (!tariff_id || !start_time || !end_time) return null;
    const start = new Date(start_time), end = new Date(end_time);
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    try {
      const r = await fetch("/api/calculate/price", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tariff_id, start_time, end_time }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }, []);

  const recalcAll = useCallback(async (startTime, endTime, currentItems) => {
    if (!startTime || !endTime) return;
    const start = new Date(startTime), end = new Date(endTime);
    if (isNaN(start) || isNaN(end) || end <= start) return;
    const updated = await Promise.all(
      currentItems.map(async (item) => {
        if (!item.tariff_id) return item;
        const result = await fetchPrice(item.tariff_id, startTime, endTime);
        if (!result || result.price == null) return item;
        return { ...item, price: result.price, tariff_type: result.type || item.tariff_type };
      })
    );
    setItems(updated);
  }, [fetchPrice]);

  // ── Клиент ──────────────────────────────────────────────────────────────────

  const filteredCustomers = customerSearch.length >= 2
    ? customers.filter(c =>
        `${c.last_name} ${c.first_name} ${c.middle_name || ""} ${c.phone}`
          .toLowerCase().includes(customerSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setForm(prev => ({ ...prev, customer_id: customer.id }));
    setCustomerSearch(`${customer.last_name} ${customer.first_name}${customer.middle_name ? " " + customer.middle_name : ""}`);
    setShowDropdown(false); setCustomerFocused(-1);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setForm(prev => ({ ...prev, customer_id: "" }));
    setCustomerSearch("");
    setTimeout(() => customerInputRef.current?.focus(), 0);
  };

  const handleCustomerKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault(); setShowDropdown(true);
      setCustomerFocused(prev => filteredCustomers.length === 0 ? -1 : prev >= filteredCustomers.length - 1 ? 0 : prev + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); setShowDropdown(true);
      setCustomerFocused(prev => filteredCustomers.length === 0 ? -1 : prev <= 0 ? filteredCustomers.length - 1 : prev - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = customerFocused >= 0 ? filteredCustomers[customerFocused]
        : filteredCustomers.length === 1 ? filteredCustomers[0] : null;
      if (target) handleCustomerSelect(target);
    } else if (e.key === "Escape") {
      setShowDropdown(false); setCustomerFocused(-1);
    }
  };

  // ── Даты ────────────────────────────────────────────────────────────────────

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    const newStart = name === "booked_start" ? value : form.booked_start;
    const newEnd   = name === "booked_end"   ? value : form.booked_end;
    setForm(prev => ({ ...prev, [name]: value }));
    if (newStart && newEnd && new Date(newEnd) <= new Date(newStart)) {
      setDateError("Время окончания должно быть позже времени начала"); return;
    }
    setDateError(null);
    recalcAll(newStart, newEnd, items);
  };

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Велосипеды — фильтры и выбор ────────────────────────────────────────────

  const heightRec = heightToFrameRec(filterHeight);

  const filteredBikes = allBikes.filter(b => {
    if (filterTariff && b.tariff_name !== filterTariff) return false;
    if (filterWheel && String(b.wheel_size) !== filterWheel) return false;
    if (heightRec && !heightRec.sizes.some(s => b.frame_size === s)) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!(b.internal_article || "").toLowerCase().includes(q) && !b.model.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const addBikeFromList = async (bike) => {
    if (items.some(i => String(i.bike_id) === String(bike.id))) return;
    const newItem = { ...INITIAL_ITEM, bike_id: String(bike.id), tariff_id: bike.tariff_id ? String(bike.tariff_id) : "" };
    if (newItem.tariff_id && form.booked_start && form.booked_end && !dateError) {
      const result = await fetchPrice(newItem.tariff_id, form.booked_start, form.booked_end);
      if (result?.price != null) { newItem.price = result.price; newItem.tariff_type = result.type || newItem.tariff_type; }
    }
    setItems(prev => [...prev, newItem]);
  };

  // ── Оборудование ─────────────────────────────────────────────────────────────

  const [eqSearch, setEqSearch]     = useState("");
  const [eqActive, setEqActive]     = useState(false);
  const [eqFocused, setEqFocused]   = useState(-1);
  const eqInputRef                  = useRef(null);

  const filteredEq = eqSearch.length >= 2
    ? equipment.filter(eq => eq.name.toLowerCase().includes(eqSearch.toLowerCase())).slice(0, 10)
    : [];

  const handleEqKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setEqFocused(prev => filteredEq.length === 0 ? -1 : prev >= filteredEq.length - 1 ? 0 : prev + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setEqFocused(prev => filteredEq.length === 0 ? -1 : prev <= 0 ? filteredEq.length - 1 : prev - 1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const target = eqFocused >= 0 ? filteredEq[eqFocused] : filteredEq.length === 1 ? filteredEq[0] : null;
      if (target) selectEquipment(target);
    } else if (e.key === "Escape") { setEqActive(false); setEqFocused(-1); }
  };

  const selectEquipment = (eq) => {
    if (items.some(i => String(i.equipment_model_id) === String(eq.id))) {
      setEqSearch(""); setEqActive(false); setEqFocused(-1); return;
    }
    setEqSearch(""); setEqActive(false); setEqFocused(-1);
    setQtyValue(1);
    setQtyPopup({ eq });
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const confirmEquipmentAdd = async () => {
    if (!qtyPopup) return;
    const eq = qtyPopup.eq;
    const qty = Math.max(1, parseInt(qtyValue) || 1);
    const newItem = {
      ...INITIAL_ITEM, item_type: "equipment",
      equipment_model_id: String(eq.id),
      tariff_id: eq.rental_tariff_id ? String(eq.rental_tariff_id) : "",
      price: "", quantity: qty,
    };
    if (newItem.tariff_id && form.booked_start && form.booked_end && !dateError) {
      const result = await fetchPrice(newItem.tariff_id, form.booked_start, form.booked_end);
      if (result?.price != null) { newItem.price = result.price; newItem.tariff_type = result.type || newItem.tariff_type; }
    }
    setItems(prev => [...prev, newItem]);
    setQtyPopup(null); setQtyValue(1);
    setTimeout(() => eqInputRef.current?.focus(), 0);
  };

  // ── Позиции ─────────────────────────────────────────────────────────────────

  const handleItemChange = async (index, field, value) => {
    let newItems = items.map((item, i) => i === index ? { ...item, [field]: value } : item);
    if (field === "tariff_id" && value && form.booked_start && form.booked_end && !dateError) {
      const result = await fetchPrice(value, form.booked_start, form.booked_end);
      if (result?.price != null) {
        newItems[index] = { ...newItems[index], price: result.price, tariff_type: result.type || newItems[index].tariff_type };
      }
    }
    setItems(newItems);
  };

  const removeItem = (index) => setItems(prev => prev.filter((_, i) => i !== index));

  const totalPrice = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1), 0);

  // ── Отправка ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    if (!form.customer_id)  { setError("Выберите клиента"); return; }
    if (!form.booked_start) { setError("Укажите время начала брони"); return; }
    if (!form.booked_end)   { setError("Укажите время окончания брони"); return; }
    if (dateError)          { setError(dateError); return; }
    if (items.length === 0) { setError("Добавьте хотя бы один велосипед или оборудование"); return; }

    setSaving(true);
    try {
      const body = {
        ...form,
        initial_status: "booked",
        customer_id: parseInt(form.customer_id),
        issued_by: form.issued_by ? parseInt(form.issued_by) : null,
        items: items.map(i => ({
          ...i,
          bike_id:            i.bike_id            ? parseInt(i.bike_id)            : null,
          equipment_model_id: i.equipment_model_id ? parseInt(i.equipment_model_id) : null,
          tariff_id:          i.tariff_id           ? parseInt(i.tariff_id)          : null,
          price:              i.price !== ""        ? parseFloat(i.price)            : null,
          quantity:           parseInt(i.quantity)  || 1,
        })),
      };
      const response = await fetch("/api/rentals", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Ошибка"); }
      onSave(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Рендер ───────────────────────────────────────────────────────────────────

  const hasDateRange = form.booked_start && form.booked_end && !dateError;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e)   => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content" style={{ maxWidth: 980 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📅 Создать бронь</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-form">

            {/* ── 1. Даты (вверху — обязательны для подбора велосипедов) ── */}
            <div className="form-section">
              <h3>Даты брони <span style={{ color: "var(--color-primary-red)", fontSize: 13 }}>*</span></h3>
              <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="form-group">
                  <label className="required-label">Начало</label>
                  <input className="form-input" type="datetime-local" name="booked_start" value={form.booked_start} onChange={handleDateChange} />
                </div>
                <div className="form-group">
                  <label className="required-label">Окончание</label>
                  <input className="form-input" type="datetime-local" name="booked_end" value={form.booked_end} onChange={handleDateChange}
                    style={dateError ? { borderColor: "var(--color-primary-red)" } : {}} />
                  {dateError && <span style={{ color: "var(--color-primary-red)", fontSize: 12, marginTop: 4, display: "block" }}>{dateError}</span>}
                </div>
                <div className="form-group">
                  <label>Принял заявку</label>
                  <select className="form-select" name="issued_by" value={form.issued_by} onChange={handleChange}>
                    <option value="">— Не указан —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              {hasDateRange && (
                <div style={{ fontSize: 12, color: "#059669", marginTop: 4 }}>
                  ✓ Показаны велосипеды, свободные в указанный период
                </div>
              )}
            </div>

            {/* ── 2. Клиент ── */}
            <div className="form-section">
              <h3>Клиент</h3>
              {selectedCustomer ? (
                <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #10b981", borderRadius: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#065f46" }}>{selectedCustomer.last_name} {selectedCustomer.first_name} {selectedCustomer.middle_name || ""}</span>
                  <span style={{ color: "#047857" }}>{selectedCustomer.phone}</span>
                  {selectedCustomer.is_veteran && <span style={{ color: "var(--color-primary-blue)", fontSize: 13, fontWeight: 500 }}>🎖 УБД — скидка −20%</span>}
                  {selectedCustomer.no_show_count > 0 && <span style={{ color: "var(--color-primary-orange)", fontSize: 13, fontWeight: 500 }}>⚠ Неявок: {selectedCustomer.no_show_count}</span>}
                  {selectedCustomer.status !== "active" && <span style={{ color: "var(--color-primary-red)", fontWeight: 500 }}>⛔ {selectedCustomer.status === "no_booking" ? "Запрет брони" : "Запрет выдачи"}</span>}
                  {(() => {
                    if (!selectedCustomer.birth_date) return null;
                    const bd = new Date(selectedCustomer.birth_date), today = new Date();
                    const bday = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
                    const diff = Math.floor((today - bday) / 86400000);
                    if (diff >= 0 && diff <= 7) return <span style={{ color: "#7c3aed", fontSize: 13, fontWeight: 500 }}>🎂 Именинник — скидка −50%!</span>;
                    return null;
                  })()}
                  <button type="button" onClick={clearCustomer} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16, padding: "2px 6px" }} title="Сменить клиента">✕</button>
                </div>
              ) : (
                <div ref={dropdownRef} style={{ position: "relative" }}>
                  <div className="form-group">
                    <label className="required-label">Поиск клиента</label>
                    <input ref={customerInputRef} className="form-input" value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setForm(p => ({ ...p, customer_id: "" })); setShowDropdown(true); setCustomerFocused(-1); }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => { setShowDropdown(false); setCustomerFocused(-1); }, 150)}
                      onKeyDown={handleCustomerKeyDown}
                      placeholder="Введите фамилию, имя или номер телефона..." autoComplete="off" />
                  </div>
                  {showDropdown && filteredCustomers.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #d1d5db", borderRadius: 6, zIndex: 200, maxHeight: 240, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
                      {filteredCustomers.map((c, i) => (
                        <div key={c.id} onMouseDown={() => handleCustomerSelect(c)} onMouseEnter={() => setCustomerFocused(i)} onMouseLeave={() => setCustomerFocused(-1)}
                          style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10, background: i === customerFocused ? "#f0fdf4" : "white" }}>
                          <span style={{ fontWeight: 500 }}>{c.last_name} {c.first_name} {c.middle_name || ""}</span>
                          <span style={{ color: "#6b7280", fontSize: 13 }}>{c.phone}</span>
                          {c.status !== "active" && (
                            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 500, color: c.status === "no_rental" ? "var(--color-primary-red)" : "var(--color-primary-orange)" }}>
                              {c.status === "no_booking" ? "⚠ Запрет брони" : "⛔ Запрет выдачи"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 3. Подбор велосипедов ── */}
            <div className="form-section">
              <h3>Велосипеды</h3>

              {/* Фильтры подбора */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <select className="form-select" value={filterTariff} onChange={e => setFilterTariff(e.target.value)} style={{ width: 150, fontSize: 13 }}>
                  <option value="">Все типы</option>
                  {TARIFF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="form-select" value={filterWheel} onChange={e => setFilterWheel(e.target.value)} style={{ width: 120, fontSize: 13 }}>
                  <option value="">Все колёса</option>
                  {WHEEL_OPTIONS.map(w => <option key={w} value={w}>{w}"</option>)}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input className="form-input" type="number" placeholder="Рост см" value={filterHeight} onChange={e => setFilterHeight(e.target.value)}
                    style={{ width: 90, fontSize: 13 }} />
                  {heightRec && <span style={{ fontSize: 11, color: "#059669", whiteSpace: "nowrap" }}>→ {heightRec.label}</span>}
                </div>
                <input className="form-input" placeholder="Поиск (артикул, модель)" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} style={{ width: 200, fontSize: 13 }} />
                {(filterTariff || filterWheel || filterHeight || filterSearch) && (
                  <button type="button" onClick={() => { setFilterTariff(""); setFilterWheel(""); setFilterHeight(""); setFilterSearch(""); }}
                    style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>× сбросить</button>
                )}
              </div>

              {/* Список велосипедов */}
              {bikesLoading ? (
                <div style={{ color: "#6b7280", fontSize: 13, padding: "12px 0" }}>Загрузка...</div>
              ) : filteredBikes.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>
                  {allBikes.length === 0 ? "Нет доступных велосипедов" : "Велосипеды с такими параметрами не найдены"}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                  {filteredBikes.map(bike => {
                    const isAdded    = items.some(i => String(i.bike_id) === String(bike.id));
                    const isAvail    = bike.is_available !== false;
                    const isBooked   = bike.condition_status === "бронь";
                    const isRepair   = bike.condition_status === "в ремонте";
                    const conflictEnd = formatDt(bike.conflict_info?.booked_end);
                    const photo      = bike.photos?.urls?.length ? bike.photos.urls[bike.photos.main ?? 0] : null;

                    let bgColor = "white", borderColor = "#e5e7eb", statusText = null, statusColor = "#6b7280";
                    if (isAdded)      { bgColor = "#f0fdf4"; borderColor = "#10b981"; statusText = "✓ добавлен"; statusColor = "#059669"; }
                    else if (!isAvail && !isBooked) { bgColor = "#fef2f2"; borderColor = "#fca5a5"; statusText = "занят"; statusColor = "#ef4444"; }
                    else if (isBooked) { bgColor = "#fffbeb"; borderColor = "#fcd34d"; statusText = conflictEnd ? `бронь до ${conflictEnd}` : "есть бронь"; statusColor = "#d97706"; }
                    else if (isRepair) { bgColor = "#f9fafb"; borderColor = "#d1d5db"; statusText = "в ремонте"; statusColor = "#9ca3af"; }

                    return (
                      <div key={bike.id}
                        onClick={() => !isAdded && isAvail && !isRepair && addBikeFromList(bike)}
                        style={{
                          border: `1px solid ${borderColor}`, borderRadius: 8, padding: "8px 10px",
                          background: bgColor, cursor: isAdded ? "default" : (!isAvail && !isBooked) || isRepair ? "not-allowed" : "pointer",
                          display: "flex", flexDirection: "column", gap: 4, transition: "box-shadow 0.15s",
                          opacity: (!isAvail && !isBooked) || isRepair ? 0.7 : 1,
                        }}
                        onMouseEnter={e => { if (!isAdded && isAvail && !isRepair) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {photo
                            ? <img src={photo} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />
                            : <div style={{ width: 40, height: 40, background: "#e5e7eb", borderRadius: 5, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚲</div>
                          }
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>{bike.internal_article || "—"}</div>
                            <div style={{ fontSize: 11, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bike.model}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#6b7280" }}>
                            {[bike.wheel_size ? `${bike.wheel_size}"` : null, bike.frame_size || null].filter(Boolean).join(" · ")}
                          </span>
                          {bike.tariff_name && (
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>{bike.tariff_name}</span>
                          )}
                        </div>
                        {statusText && (
                          <div style={{ fontSize: 11, fontWeight: 500, color: statusColor }}>{statusText}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Бронирование с занятостью */}
              {isBooked => false /* note for booked-but-selectable bikes — handled via card click allowing it */}
            </div>

            {/* ── 4. Оборудование ── */}
            <div className="form-section">
              <h3>Доп. оборудование</h3>
              <div style={{ position: "relative" }}>
                <input ref={eqInputRef} className="form-input"
                  placeholder="Поиск оборудования (фонарик, замок, сумка...)"
                  value={eqSearch}
                  onChange={e => { setEqSearch(e.target.value); setEqFocused(-1); setEqActive(true); }}
                  onFocus={() => setEqActive(true)}
                  onBlur={() => setTimeout(() => { setEqActive(false); setEqFocused(-1); }, 150)}
                  onKeyDown={handleEqKeyDown} autoComplete="off" />
                {eqActive && filteredEq.length > 0 && (
                  <div style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 4px)", zIndex: 300, background: "white", border: "1px solid #d1d5db", borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.13)", maxHeight: 220, overflowY: "auto" }}>
                    {filteredEq.map((eq, i) => {
                      const isDuplicate = items.some(it => String(it.equipment_model_id) === String(eq.id));
                      return (
                        <div key={eq.id} onMouseDown={() => selectEquipment(eq)} onMouseEnter={() => setEqFocused(i)} onMouseLeave={() => setEqFocused(-1)}
                          style={{ padding: "8px 12px", cursor: isDuplicate ? "not-allowed" : "pointer", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10, background: isDuplicate ? "#fef9c3" : i === eqFocused ? "#f0fdf4" : "white", opacity: isDuplicate ? 0.65 : 1 }}>
                          <span>⛑️</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{eq.name}</div>
                            {eq.category && <div style={{ fontSize: 11, color: "#6b7280" }}>{eq.category}</div>}
                          </div>
                          <span style={{ fontSize: 12, color: isDuplicate ? "#a16207" : "#059669", fontWeight: 500 }}>
                            {isDuplicate ? "добавлен" : eq.available_quantity != null ? `${eq.available_quantity} шт.` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── 5. Добавленные позиции ── */}
            {items.length > 0 && (
              <div className="form-section">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Позиции договора</h3>
                  {(() => {
                    const bikeCount = items.filter(i => i.item_type === "bike").length;
                    const eqCount   = items.filter(i => i.item_type === "equipment").length;
                    return (
                      <>
                        {bikeCount > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>🚲 {bikeCount}</span>}
                        {eqCount   > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>⛑️ {eqCount}</span>}
                      </>
                    );
                  })()}
                  {totalPrice > 0 && (
                    <span style={{ marginLeft: "auto", fontWeight: 700, color: "#111827", fontSize: 15 }}>Итого: {totalPrice} ₴</span>
                  )}
                </div>
                {[...items].reverse().map((item, revIndex) => {
                  const realIndex = items.length - 1 - revIndex;
                  const bike = item.item_type === "bike" && item.bike_id ? allBikes.find(b => String(b.id) === String(item.bike_id)) : null;
                  const eq   = item.item_type === "equipment" && item.equipment_model_id ? equipment.find(e => String(e.id) === String(item.equipment_model_id)) : null;
                  const tariffName = bike?.tariff_name || eq?.tariff_name || (item.tariff_id ? tariffs.find(t => String(t.id) === String(item.tariff_id))?.name : null);
                  return (
                    <div key={realIndex} style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center", padding: "6px 10px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", width: 18, textAlign: "center", flexShrink: 0 }}>{realIndex + 1}</span>
                      {item.item_type === "bike" && bike ? (() => {
                        const photo = bike.photos?.urls?.length ? bike.photos.urls[bike.photos.main ?? 0] : null;
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            {photo ? <img src={photo} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                              : <div style={{ width: 36, height: 36, background: "#e5e7eb", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🚲</div>}
                            <div style={{ fontSize: 12, lineHeight: 1.4, minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                                {bike.internal_article && <span style={{ fontWeight: 700 }}>{bike.internal_article}</span>}
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bike.model}</span>
                              </div>
                              <div style={{ color: "#6b7280", fontSize: 11 }}>{[bike.wheel_size ? `${bike.wheel_size}"` : null, bike.frame_size || null].filter(Boolean).join(" · ")}</div>
                            </div>
                          </div>
                        );
                      })() : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 36, height: 36, background: "#e0f2fe", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⛑️</div>
                          <div style={{ fontSize: 12, lineHeight: 1.4, minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{eq?.name || "Оборудование"}</div>
                            {eq?.category && <div style={{ color: "#6b7280", fontSize: 11 }}>{eq.category}</div>}
                          </div>
                        </div>
                      )}
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 10, flexShrink: 0, background: tariffName ? "#dcfce7" : "transparent", color: "#15803d", fontWeight: 600, width: 100, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                        {tariffName || ""}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        {item.item_type === "bike" ? (
                          <span style={{ width: 36, textAlign: "center", display: "inline-block", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 4px", background: "#f9fafb", fontSize: 12, color: "#9ca3af", lineHeight: "normal" }}>1</span>
                        ) : (
                          <input className="form-input" type="number" min="1" value={item.quantity}
                            onChange={e => handleItemChange(realIndex, "quantity", parseInt(e.target.value) || 1)}
                            style={{ width: 36, fontSize: 12, padding: "8px 4px", textAlign: "center" }} />
                        )}
                        <span style={{ fontSize: 11, color: "#6b7280" }}>×</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <input className="form-input" type="number" min="0" value={item.price}
                          onChange={e => handleItemChange(realIndex, "price", e.target.value)}
                          placeholder="0" style={{ width: 80, fontSize: 12 }} />
                        <span style={{ fontSize: 11, color: "#6b7280" }}>₴</span>
                        {item.tariff_id && form.booked_start && form.booked_end && !dateError && (
                          <span style={{ fontSize: 10, color: "#059669", fontWeight: 500 }}>авто</span>
                        )}
                      </div>
                      <button type="button" onClick={() => removeItem(realIndex)}
                        style={{ padding: "4px 8px", background: "none", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", color: "#ef4444", flexShrink: 0, fontSize: 12 }} title="Удалить">✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── 6. Залог ── */}
            <div className="form-section">
              <h3>Залог</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Тип залога</label>
                  <select className="form-select" name="deposit_type" value={form.deposit_type} onChange={handleChange}>
                    {DEPOSIT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                {form.deposit_type !== "none" && (
                  <div className="form-group">
                    <label>{form.deposit_type === "money" ? "Сумма залога (грн)" : "Документ (серия и номер)"}</label>
                    <input className="form-input" name="deposit_value" value={form.deposit_value} onChange={handleChange} placeholder={form.deposit_type === "money" ? "500" : "АА 123456"} />
                  </div>
                )}
              </div>
            </div>

            {/* ── 7. Заметки ── */}
            <div className="form-section">
              <h3>Заметки</h3>
              <div className="form-group">
                <textarea className="form-textarea" name="notes_issue" value={form.notes_issue} onChange={handleChange} placeholder="Особые условия, пожелания клиента..." rows={2} />
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={onClose}>Отмена</button>
          <button type="button" style={{ background: "var(--color-primary-blue, #3b82f6)", color: "white", border: "none", padding: "8px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 14 }} onClick={handleSubmit} disabled={saving}>
            {saving ? "Сохранение..." : "Создать бронь"}
          </button>
        </div>

        {/* Попап количества оборудования */}
        {qtyPopup && (
          <div style={{ position: "absolute", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.18)", borderRadius: "inherit" }}
            onMouseDown={() => setQtyPopup(null)}>
            <div onMouseDown={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.22)", minWidth: 270, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                ⛑️ {qtyPopup.eq.name}
                {qtyPopup.eq.category && <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 12, marginLeft: 8 }}>{qtyPopup.eq.category}</span>}
              </div>
              {qtyPopup.eq.available_quantity != null && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>Доступно: <strong style={{ color: "#111" }}>{qtyPopup.eq.available_quantity}</strong> шт.</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>Количество:</span>
                <input ref={qtyInputRef} type="number" min="1" max={qtyPopup.eq.available_quantity || 999} value={qtyValue}
                  onChange={e => setQtyValue(Math.max(1, parseInt(e.target.value) || 1))}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); confirmEquipmentAdd(); }
                    if (e.key === "Escape") { e.preventDefault(); setQtyPopup(null); setTimeout(() => eqInputRef.current?.focus(), 0); }
                  }}
                  style={{ width: 72, padding: "8px 10px", fontSize: 18, fontWeight: 600, border: "2px solid #3b82f6", borderRadius: 6, textAlign: "center", outline: "none" }} />
                <span style={{ fontSize: 13, color: "#374151" }}>шт.</span>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setQtyPopup(null); setTimeout(() => eqInputRef.current?.focus(), 0); }}
                  style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 13 }}>Отмена</button>
                <button type="button" style={{ background: "#3b82f6", color: "white", border: "none", padding: "7px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }} onClick={confirmEquipmentAdd}>Добавить</button>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>↑↓ стрелки · Enter — добавить · Esc — отмена</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingModal;
