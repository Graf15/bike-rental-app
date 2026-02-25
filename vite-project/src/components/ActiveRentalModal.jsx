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

const QUICK_DURATIONS = [
  { label: "1ч",     minutes: 60 },
  { label: "2ч",     minutes: 120 },
  { label: "3ч",     minutes: 180 },
  { label: "Сутки",  minutes: 1440 },
  { label: "Неделя", minutes: 10080 },
  { label: "2 нед",  minutes: 20160 },
];

const toLocalStr = (date) => {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatConflictTime = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return null; }
};

const TARIFF_OPTIONS = ["kids", "econom", "standart", "premium", "эл.вел", "эл.самокат"];
const WHEEL_OPTIONS  = ["16", "18", "20", "24", "26", "27.5", "29"];

const ActiveRentalModal = ({ onClose, onSave }) => {
  const [form, setForm]           = useState({ ...INITIAL_FORM, booked_start: toLocalStr(new Date()) });
  const [items, setItems]         = useState([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [dateError, setDateError] = useState(null);
  const mouseDownOnOverlay        = useRef(false);

  const [customers, setCustomers] = useState([]);
  const [users, setUsers]         = useState([]);
  const [bikes, setBikes]         = useState([]);
  const [tariffs, setTariffs]     = useState([]);
  const [equipment, setEquipment] = useState([]);

  // Фильтры (сворачиваемые)
  const [showFilters, setShowFilters]   = useState(false);
  const [filterTariff, setFilterTariff] = useState("");
  const [filterWheel, setFilterWheel]   = useState("");

  // Поиск велосипеда / оборудования
  const [addBikeSearch, setAddBikeSearch]   = useState("");
  const [addBikeActive, setAddBikeActive]   = useState(false);
  const [addBikeFocused, setAddBikeFocused] = useState(-1);
  const [dropUp, setDropUp]                 = useState(false);
  const addBikeInputRef                     = useRef(null);

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
      fetch("/api/bikes/for-rental").then(r => r.json()),
      fetch("/api/tariffs").then(r => r.json()),
      fetch("/api/equipment").then(r => r.json()),
    ]).then(([c, u, b, t, e]) => {
      setCustomers(Array.isArray(c) ? c : []);
      setUsers(Array.isArray(u) ? u : []);
      setBikes(Array.isArray(b) ? b : []);
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

  // ── Расчёт цены ─────────────────────────────────────────────────────────────

  const fetchPrice = useCallback(async (tariff_id, start_time, end_time) => {
    if (!tariff_id || !start_time || !end_time) return null;
    const start = new Date(start_time), end = new Date(end_time);
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    try {
      const r = await fetch("/api/calculate/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    setShowDropdown(false);
    setCustomerFocused(-1);
    setTimeout(() => addBikeInputRef.current?.focus(), 50);
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
      setDateError("Время окончания должно быть позже времени начала");
      return;
    }
    setDateError(null);
    recalcAll(newStart, newEnd, items);
  };

  const applyQuickDuration = (minutes) => {
    if (!form.booked_start) return;
    const endStr = toLocalStr(new Date(new Date(form.booked_start).getTime() + minutes * 60000));
    setForm(prev => ({ ...prev, booked_end: endStr }));
    setDateError(null);
    recalcAll(form.booked_start, endStr, items);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
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

  // Велосипеды: показываем в наличии + бронь (с предупреждением), скрываем в прокате
  const selectableBikes = bikes.filter(b => b.condition_status !== "в прокате");

  // Фильтрованный список с учётом фильтров
  const filteredByOptions = selectableBikes.filter(b => {
    if (filterTariff && b.tariff_name !== filterTariff) return false;
    if (filterWheel && String(b.wheel_size) !== filterWheel) return false;
    return true;
  });

  const filteredAddItems = addBikeSearch.length >= 2
    ? (() => {
        const q = addBikeSearch.toLowerCase();
        const bikePriority = (b) => {
          const art = (b.internal_article || "").toLowerCase();
          if (art === q) return 0; if (art.startsWith(q)) return 1; if (art.includes(q)) return 2; return 3;
        };
        const filteredBikes = filteredByOptions
          .filter(b => (b.internal_article || "").toLowerCase().includes(q) || b.model.toLowerCase().includes(q))
          .sort((a, b) => bikePriority(a) - bikePriority(b))
          .map(b => ({ _type: "bike", ...b }));

        const filteredEquipment = equipment
          .filter(eq => eq.name.toLowerCase().includes(q))
          .map(eq => ({ _type: "equipment", ...eq }));

        return [...filteredBikes, ...filteredEquipment].slice(0, 12);
      })()
    : [];

  const addBikeItem = async (bike) => {
    if (items.some(i => String(i.bike_id) === String(bike.id))) {
      setAddBikeSearch(""); setAddBikeActive(false); setAddBikeFocused(-1);
      setTimeout(() => addBikeInputRef.current?.focus(), 0); return;
    }
    setAddBikeSearch(""); setAddBikeActive(false); setAddBikeFocused(-1);
    const newItem = { ...INITIAL_ITEM, bike_id: String(bike.id), tariff_id: bike.tariff_id ? String(bike.tariff_id) : "" };
    if (newItem.tariff_id && form.booked_start && form.booked_end && !dateError) {
      const result = await fetchPrice(newItem.tariff_id, form.booked_start, form.booked_end);
      if (result?.price != null) { newItem.price = result.price; newItem.tariff_type = result.type || newItem.tariff_type; }
    }
    setItems(prev => [...prev, newItem]);
    setTimeout(() => addBikeInputRef.current?.focus(), 0);
  };

  const addEquipmentItem = (eq) => {
    if (items.some(i => String(i.equipment_model_id) === String(eq.id))) {
      setAddBikeSearch(""); setAddBikeActive(false); setAddBikeFocused(-1);
      setTimeout(() => addBikeInputRef.current?.focus(), 0); return;
    }
    setAddBikeSearch(""); setAddBikeActive(false); setAddBikeFocused(-1);
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
    setTimeout(() => addBikeInputRef.current?.focus(), 0);
  };

  const handleAddBikeFocus = () => {
    if (addBikeInputRef.current) {
      const rect = addBikeInputRef.current.getBoundingClientRect();
      setDropUp(window.innerHeight - rect.bottom < 300);
      addBikeInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setAddBikeActive(true);
  };

  const handleAddBikeKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAddBikeFocused(prev => filteredAddItems.length === 0 ? -1 : prev >= filteredAddItems.length - 1 ? 0 : prev + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAddBikeFocused(prev => filteredAddItems.length === 0 ? -1 : prev <= 0 ? filteredAddItems.length - 1 : prev - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = addBikeFocused >= 0 ? filteredAddItems[addBikeFocused]
        : filteredAddItems.length === 1 ? filteredAddItems[0] : null;
      if (target) { if (target._type === "bike") addBikeItem(target); else addEquipmentItem(target); }
    } else if (e.key === "Escape") {
      setAddBikeActive(false); setAddBikeFocused(-1);
    }
  };

  const totalPrice = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1), 0);

  // ── Отправка ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    if (!form.customer_id)  { setError("Выберите клиента"); return; }
    if (items.length === 0) { setError("Добавьте хотя бы одну позицию"); return; }
    if (dateError)          { setError(dateError); return; }

    setSaving(true);
    try {
      const body = {
        ...form,
        initial_status: "active",
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

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e)   => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content" style={{ maxWidth: 920 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🚲 Прокат сейчас</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-form">

            {/* ── 1. Клиент ── */}
            <div className="form-section">
              <h3>Клиент</h3>
              {selectedCustomer ? (
                <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #10b981", borderRadius: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#065f46" }}>
                    {selectedCustomer.last_name} {selectedCustomer.first_name} {selectedCustomer.middle_name || ""}
                  </span>
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
                    <input
                      ref={customerInputRef} className="form-input" value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setForm(p => ({ ...p, customer_id: "" })); setShowDropdown(true); setCustomerFocused(-1); }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => { setShowDropdown(false); setCustomerFocused(-1); }, 150)}
                      onKeyDown={handleCustomerKeyDown}
                      placeholder="Введите фамилию, имя или номер телефона..." autoComplete="off"
                    />
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

            {/* ── 2. Позиции ── */}
            <div className="form-section">

              {/* Сворачиваемые фильтры */}
              <div style={{ marginBottom: 8 }}>
                <button type="button" onClick={() => setShowFilters(v => !v)}
                  style={{ fontSize: 12, color: "#6b7280", background: "none", border: "1px solid #e5e7eb", borderRadius: 5, padding: "3px 10px", cursor: "pointer" }}>
                  {showFilters ? "▲ Скрыть фильтры" : "▼ Фильтр по типу / колесу"}
                </button>
                {showFilters && (
                  <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                    <select className="form-select" value={filterTariff} onChange={e => setFilterTariff(e.target.value)} style={{ width: 160, fontSize: 13 }}>
                      <option value="">Все типы</option>
                      {TARIFF_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select className="form-select" value={filterWheel} onChange={e => setFilterWheel(e.target.value)} style={{ width: 130, fontSize: 13 }}>
                      <option value="">Все колёса</option>
                      {WHEEL_OPTIONS.map(w => <option key={w} value={w}>{w}"</option>)}
                    </select>
                    {(filterTariff || filterWheel) && (
                      <button type="button" onClick={() => { setFilterTariff(""); setFilterWheel(""); }} style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>× сбросить</button>
                    )}
                  </div>
                )}
              </div>

              {/* Поиск */}
              <div style={{ position: "relative" }}>
                <input
                  ref={addBikeInputRef} className="form-input"
                  placeholder="Добавить велосипед или оборудование (артикул, модель, от 2 символов)..."
                  value={addBikeSearch}
                  onChange={e => { setAddBikeSearch(e.target.value); setAddBikeFocused(-1); setAddBikeActive(true); }}
                  onFocus={handleAddBikeFocus}
                  onBlur={() => setTimeout(() => { setAddBikeActive(false); setAddBikeFocused(-1); }, 150)}
                  onKeyDown={handleAddBikeKeyDown} autoComplete="off"
                />
                {addBikeActive && filteredAddItems.length > 0 && (
                  <div style={{ position: "absolute", left: 0, right: 0, zIndex: 300, ...(dropUp ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }), background: "white", border: "1px solid #d1d5db", borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.13)", maxHeight: 300, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <tbody>
                        {filteredAddItems.map((item, i) => {
                          if (item._type === "bike") {
                            const photo = item.photos?.urls?.length ? item.photos.urls[item.photos.main ?? 0] : null;
                            const isDuplicate = items.some(it => String(it.bike_id) === String(item.id));
                            const isBooked = item.condition_status === "бронь";
                            const conflictEnd = isBooked ? formatConflictTime(item.conflict_info?.booked_end) : null;
                            return (
                              <tr key={`bike-${item.id}`}
                                onMouseDown={() => addBikeItem(item)} onMouseEnter={() => setAddBikeFocused(i)} onMouseLeave={() => setAddBikeFocused(-1)}
                                style={{ cursor: isDuplicate ? "not-allowed" : "pointer", borderBottom: "1px solid #f3f4f6", background: isDuplicate ? "#fef9c3" : i === addBikeFocused ? "#f0fdf4" : "white", opacity: isDuplicate ? 0.65 : 1 }}>
                                <td style={{ padding: "5px 8px", width: 38 }}>
                                  {photo ? <img src={photo} alt="" style={{ width: 30, height: 30, objectFit: "cover", borderRadius: 3, display: "block" }} />
                                    : <div style={{ width: 30, height: 30, background: "#e5e7eb", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🚲</div>}
                                </td>
                                <td style={{ padding: "5px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>{item.internal_article || "—"}</td>
                                <td style={{ padding: "5px 8px" }}>{item.model}</td>
                                <td style={{ padding: "5px 8px", whiteSpace: "nowrap", color: "#6b7280" }}>{item.wheel_size ? `${item.wheel_size}"` : "—"}</td>
                                <td style={{ padding: "5px 8px", whiteSpace: "nowrap", color: "#6b7280" }}>{item.frame_size || "—"}</td>
                                <td style={{ padding: "5px 8px", whiteSpace: "nowrap", fontWeight: 500, color: isDuplicate ? "#a16207" : isBooked ? "#d97706" : "#059669" }}>
                                  {isDuplicate ? "уже добавлен" : isBooked ? `🟡 бронь${conflictEnd ? " до " + conflictEnd : ""}` : (item.tariff_name || "—")}
                                </td>
                              </tr>
                            );
                          } else {
                            const isDuplicate = items.some(it => String(it.equipment_model_id) === String(item.id));
                            return (
                              <tr key={`eq-${item.id}`}
                                onMouseDown={() => addEquipmentItem(item)} onMouseEnter={() => setAddBikeFocused(i)} onMouseLeave={() => setAddBikeFocused(-1)}
                                style={{ cursor: isDuplicate ? "not-allowed" : "pointer", borderBottom: "1px solid #f3f4f6", background: isDuplicate ? "#fef9c3" : i === addBikeFocused ? "#f0fdf4" : "white", opacity: isDuplicate ? 0.65 : 1 }}>
                                <td style={{ padding: "5px 8px", width: 38 }}><div style={{ width: 30, height: 30, background: "#e0f2fe", borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⛑️</div></td>
                                <td style={{ padding: "5px 8px", fontWeight: 600, whiteSpace: "nowrap", color: "#0369a1" }}>доп</td>
                                <td style={{ padding: "5px 8px" }}>{item.name}</td>
                                <td style={{ padding: "5px 8px", color: "#6b7280" }}>{item.category || "—"}</td>
                                <td style={{ padding: "5px 8px", color: "#6b7280" }}>{item.available_quantity != null ? `доступно: ${item.available_quantity}` : ""}</td>
                                <td style={{ padding: "5px 8px", whiteSpace: "nowrap", fontWeight: 500, color: isDuplicate ? "#a16207" : "#059669" }}>
                                  {isDuplicate ? "уже добавлен" : (item.tariff_name || "—")}
                                </td>
                              </tr>
                            );
                          }
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Заголовок + итого */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0 8px" }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Позиции договора</h3>
                {items.length > 0 && (() => {
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

              {/* Список позиций */}
              {[...items].reverse().map((item, revIndex) => {
                const realIndex = items.length - 1 - revIndex;
                const bike = item.item_type === "bike" && item.bike_id ? bikes.find(b => String(b.id) === String(item.bike_id)) : null;
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
                            <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
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

            {/* ── 3. Время ── */}
            <div className="form-section">
              <h3>Время и менеджер</h3>
              <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="form-group">
                  <label className="required-label">Начало</label>
                  <input className="form-input" type="datetime-local" name="booked_start" value={form.booked_start} onChange={handleDateChange} />
                </div>
                <div className="form-group">
                  <label>Планируемый возврат</label>
                  <input className="form-input" type="datetime-local" name="booked_end" value={form.booked_end} onChange={handleDateChange}
                    style={dateError ? { borderColor: "var(--color-primary-red)" } : {}} />
                  {dateError && <span style={{ color: "var(--color-primary-red)", fontSize: 12, marginTop: 4, display: "block" }}>{dateError}</span>}
                </div>
                <div className="form-group">
                  <label>Выдал</label>
                  <select className="form-select" name="issued_by" value={form.issued_by} onChange={handleChange}>
                    <option value="">— Не указан —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#6b7280", marginRight: 2 }}>Быстро:</span>
                {QUICK_DURATIONS.map(({ label, minutes }) => (
                  <button key={label} type="button" onClick={() => applyQuickDuration(minutes)} disabled={!form.booked_start}
                    style={{ padding: "3px 10px", fontSize: 12, borderRadius: 4, cursor: "pointer", border: "1px solid #d1d5db", background: form.booked_start ? "#f9fafb" : "#f3f4f6", color: form.booked_start ? "#374151" : "#9ca3af" }}
                    onMouseEnter={e => { if (form.booked_start) e.currentTarget.style.background = "#e5e7eb"; }}
                    onMouseLeave={e => { if (form.booked_start) e.currentTarget.style.background = "#f9fafb"; }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 4. Залог ── */}
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

            {/* ── 5. Заметки ── */}
            <div className="form-section">
              <h3>Заметки при выдаче</h3>
              <div className="form-group">
                <textarea className="form-textarea" name="notes_issue" value={form.notes_issue} onChange={handleChange} placeholder="Особые условия, пожелания клиента..." rows={2} />
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary-green btn-primary-small" onClick={handleSubmit} disabled={saving}>
            {saving ? "Сохранение..." : "Выдать велосипед"}
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
                    if (e.key === "Escape") { e.preventDefault(); setQtyPopup(null); setTimeout(() => addBikeInputRef.current?.focus(), 0); }
                  }}
                  style={{ width: 72, padding: "8px 10px", fontSize: 18, fontWeight: 600, border: "2px solid var(--color-primary-green)", borderRadius: 6, textAlign: "center", outline: "none" }} />
                <span style={{ fontSize: 13, color: "#374151" }}>шт.</span>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setQtyPopup(null); setTimeout(() => addBikeInputRef.current?.focus(), 0); }}
                  style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 13 }}>Отмена</button>
                <button type="button" className="btn btn-primary-green btn-primary-small" onClick={confirmEquipmentAdd}>Добавить</button>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>↑↓ стрелки · Enter — добавить · Esc — отмена</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveRentalModal;
