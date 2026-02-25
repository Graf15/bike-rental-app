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

const RentalModal = ({ onClose, onSave }) => {
  const [form, setForm]           = useState(INITIAL_FORM);
  const [items, setItems]         = useState([{ ...INITIAL_ITEM }]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [dateError, setDateError] = useState(null);
  const mouseDownOnOverlay        = useRef(false);

  const [customers, setCustomers] = useState([]);
  const [users, setUsers]         = useState([]);
  const [bikes, setBikes]         = useState([]);
  const [tariffs, setTariffs]     = useState([]);
  const [equipment, setEquipment] = useState([]);

  // Поиск велосипеда
  const [addBikeSearch, setAddBikeSearch]   = useState("");
  const [addBikeActive, setAddBikeActive]   = useState(false);
  const [addBikeFocused, setAddBikeFocused] = useState(-1);
  const [dropUp, setDropUp]                 = useState(false);
  const addBikeInputRef                     = useRef(null);

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
      fetch("/api/bikes").then(r => r.json()),
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

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Расчёт цены ─────────────────────────────────────────────────────────────

  const fetchPrice = useCallback(async (tariff_id, start_time, end_time) => {
    if (!tariff_id || !start_time || !end_time) return null;
    const start = new Date(start_time);
    const end   = new Date(end_time);
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
    const start = new Date(startTime);
    const end   = new Date(endTime);
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
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setForm(prev => ({ ...prev, customer_id: "" }));
    setCustomerSearch("");
    setTimeout(() => customerInputRef.current?.focus(), 0);
  };

  const handleCustomerKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setShowDropdown(true);
      setCustomerFocused(prev =>
        filteredCustomers.length === 0 ? -1
          : prev >= filteredCustomers.length - 1 ? 0
          : prev + 1
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setShowDropdown(true);
      setCustomerFocused(prev =>
        filteredCustomers.length === 0 ? -1
          : prev <= 0 ? filteredCustomers.length - 1
          : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = customerFocused >= 0
        ? filteredCustomers[customerFocused]
        : filteredCustomers.length === 1 ? filteredCustomers[0]
        : null;
      if (target) handleCustomerSelect(target);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setCustomerFocused(-1);
    }
  };

  // ── Даты ────────────────────────────────────────────────────────────────────

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    const newStart = name === "booked_start" ? value : form.booked_start;
    const newEnd   = name === "booked_end"   ? value : form.booked_end;
    setForm(prev => ({ ...prev, [name]: value }));
    if (newStart && newEnd) {
      if (new Date(newEnd) <= new Date(newStart)) {
        setDateError("Время окончания должно быть позже времени начала");
        return;
      }
    }
    setDateError(null);
    recalcAll(newStart, newEnd, items);
  };

  const applyQuickDuration = (minutes) => {
    if (!form.booked_start) return;
    const endDate = new Date(new Date(form.booked_start).getTime() + minutes * 60000);
    const endStr  = toLocalStr(endDate);
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
    let newItems = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    if (field === "tariff_id" && value && form.booked_start && form.booked_end && !dateError) {
      const result = await fetchPrice(value, form.booked_start, form.booked_end);
      if (result?.price != null) {
        newItems[index] = { ...newItems[index], price: result.price, tariff_type: result.type || newItems[index].tariff_type };
      }
    }
    setItems(newItems);
  };

  const removeItem = (index) => setItems(prev => prev.filter((_, i) => i !== index));

  const availableBikes = bikes.filter(b => b.condition_status === "в наличии");

  // ── Добавление велосипеда через поиск ────────────────────────────────────────

  const filteredAddBikes = addBikeSearch.length >= 2
    ? (() => {
        const q = addBikeSearch.toLowerCase();
        const priority = (b) => {
          const art = (b.internal_article || "").toLowerCase();
          if (art === q)              return 0; // точное совпадение артикула
          if (art.startsWith(q))     return 1; // артикул начинается с запроса
          if (art.includes(q))       return 2; // артикул содержит запрос
          return 3;                             // совпадение в названии модели
        };
        return availableBikes
          .filter(b =>
            (b.internal_article || "").toLowerCase().includes(q) ||
            b.model.toLowerCase().includes(q)
          )
          .sort((a, b) => priority(a) - priority(b))
          .slice(0, 10);
      })()
    : [];

  const addBikeItem = async (bike) => {
    // Защита от дублей
    if (items.some(i => String(i.bike_id) === String(bike.id))) {
      setAddBikeSearch("");
      setAddBikeActive(false);
      setAddBikeFocused(-1);
      setTimeout(() => addBikeInputRef.current?.focus(), 0);
      return;
    }
    setAddBikeSearch("");
    setAddBikeActive(false);
    setAddBikeFocused(-1);
    const newItem = {
      ...INITIAL_ITEM,
      bike_id: String(bike.id),
      tariff_id: bike.tariff_id ? String(bike.tariff_id) : "",
    };
    if (newItem.tariff_id && form.booked_start && form.booked_end && !dateError) {
      const result = await fetchPrice(newItem.tariff_id, form.booked_start, form.booked_end);
      if (result?.price != null) {
        newItem.price = result.price;
        newItem.tariff_type = result.type || newItem.tariff_type;
      }
    }
    setItems(prev => [...prev, newItem]);
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
      setAddBikeFocused(prev =>
        filteredAddBikes.length === 0 ? -1
          : prev >= filteredAddBikes.length - 1 ? 0
          : prev + 1
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAddBikeFocused(prev =>
        filteredAddBikes.length === 0 ? -1
          : prev <= 0 ? filteredAddBikes.length - 1
          : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = addBikeFocused >= 0
        ? filteredAddBikes[addBikeFocused]
        : filteredAddBikes.length === 1 ? filteredAddBikes[0]
        : null;
      if (target) addBikeItem(target);
    } else if (e.key === "Escape") {
      setAddBikeActive(false);
      setAddBikeFocused(-1);
    }
  };

  const totalPrice = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);

  // ── Отправка ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    if (!form.customer_id) { setError("Выберите клиента"); return; }
    if (items.length === 0) { setError("Добавьте хотя бы одну позицию"); return; }
    if (dateError) { setError(dateError); return; }
    if (items.some(i => i.item_type === "bike" && !i.bike_id)) {
      setError("Выберите велосипед для каждой позиции типа «Велосипед»"); return;
    }
    if (items.some(i => i.item_type === "equipment" && !i.equipment_model_id)) {
      setError("Выберите модель для каждой позиции типа «Оборудование»"); return;
    }

    setSaving(true);
    try {
      const body = {
        ...form,
        customer_id: parseInt(form.customer_id),
        issued_by: form.issued_by ? parseInt(form.issued_by) : null,
        items: items.map(i => ({
          ...i,
          bike_id:            i.bike_id            ? parseInt(i.bike_id)            : null,
          equipment_model_id: i.equipment_model_id ? parseInt(i.equipment_model_id) : null,
          tariff_id:          i.tariff_id           ? parseInt(i.tariff_id)          : null,
          price:              i.price !== ""        ? parseFloat(i.price)            : null,
        })),
      };

      const response = await fetch("/api/rentals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Ошибка при создании договора");
      }

      const created = await response.json();
      onSave(created);
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
          <h2>Создать договор проката</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-form">

            {/* ── 1. Клиент ──────────────────────────────────────────────────── */}
            <div className="form-section">
              <h3>Клиент</h3>
              {selectedCustomer ? (
                /* Компактная зелёная карточка — поле поиска скрыто */
                <div style={{
                  padding: "10px 14px",
                  background: "#f0fdf4", border: "1px solid #10b981",
                  borderRadius: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap"
                }}>
                  <span style={{ fontWeight: 600, color: "#065f46" }}>
                    {selectedCustomer.last_name} {selectedCustomer.first_name} {selectedCustomer.middle_name || ""}
                  </span>
                  <span style={{ color: "#047857" }}>{selectedCustomer.phone}</span>
                  {selectedCustomer.is_veteran && (
                    <span style={{ color: "var(--color-primary-blue)", fontSize: 13, fontWeight: 500 }}>
                      🎖 УБД — скидка −20% на 1 велосипед
                    </span>
                  )}
                  {selectedCustomer.no_show_count > 0 && (
                    <span style={{ color: "var(--color-primary-orange)", fontSize: 13, fontWeight: 500 }}>
                      ⚠ Неявок: {selectedCustomer.no_show_count}
                    </span>
                  )}
                  {selectedCustomer.status !== "active" && (
                    <span style={{ color: "var(--color-primary-red)", fontWeight: 500 }}>
                      ⛔ {selectedCustomer.status === "no_booking" ? "Запрет брони" : "Запрет выдачи"}
                    </span>
                  )}
                  {(() => {
                    if (!selectedCustomer.birth_date) return null;
                    const bd    = new Date(selectedCustomer.birth_date);
                    const today = new Date();
                    const bday  = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
                    const diff  = Math.floor((today - bday) / 86400000);
                    if (diff >= 0 && diff <= 7) {
                      return (
                        <span style={{ color: "#7c3aed", fontSize: 13, fontWeight: 500 }}>
                          🎂 Именинник — скидка −50% на 1 велосипед!
                        </span>
                      );
                    }
                    return null;
                  })()}
                  <button
                    type="button"
                    onClick={clearCustomer}
                    style={{
                      marginLeft: "auto", background: "none", border: "none",
                      cursor: "pointer", color: "#6b7280", fontSize: 16, padding: "2px 6px"
                    }}
                    title="Сменить клиента"
                  >✕</button>
                </div>
              ) : (
                /* Поле поиска */
                <div ref={dropdownRef} style={{ position: "relative" }}>
                  <div className="form-group">
                    <label className="required-label">Поиск клиента</label>
                    <input
                      ref={customerInputRef}
                      className="form-input"
                      value={customerSearch}
                      onChange={e => {
                        setCustomerSearch(e.target.value);
                        setSelectedCustomer(null);
                        setForm(p => ({ ...p, customer_id: "" }));
                        setShowDropdown(true);
                        setCustomerFocused(-1);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => { setShowDropdown(false); setCustomerFocused(-1); }, 150)}
                      onKeyDown={handleCustomerKeyDown}
                      placeholder="Введите фамилию, имя или номер телефона..."
                      autoComplete="off"
                    />
                  </div>
                  {showDropdown && filteredCustomers.length > 0 && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0,
                      background: "white", border: "1px solid #d1d5db",
                      borderRadius: 6, zIndex: 200, maxHeight: 240, overflowY: "auto",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)"
                    }}>
                      {filteredCustomers.map((c, i) => (
                        <div
                          key={c.id}
                          onMouseDown={() => handleCustomerSelect(c)}
                          onMouseEnter={() => setCustomerFocused(i)}
                          onMouseLeave={() => setCustomerFocused(-1)}
                          style={{
                            padding: "10px 14px", cursor: "pointer",
                            borderBottom: "1px solid #f3f4f6",
                            display: "flex", alignItems: "center", gap: 10,
                            background: i === customerFocused ? "#f0fdf4" : "white",
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>
                            {c.last_name} {c.first_name} {c.middle_name || ""}
                          </span>
                          <span style={{ color: "#6b7280", fontSize: 13 }}>{c.phone}</span>
                          {c.status !== "active" && (
                            <span style={{
                              marginLeft: "auto", fontSize: 12, fontWeight: 500,
                              color: c.status === "no_rental" ? "var(--color-primary-red)" : "var(--color-primary-orange)"
                            }}>
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

            {/* ── 2. Позиции договора ────────────────────────────────────────── */}
            <div className="form-section">
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <h3 style={{ margin: 0 }}>Позиции договора</h3>
                {items.length > 0 && (
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {(() => {
                      const bikeCount = items.filter(i => i.item_type === "bike").length;
                      const eqCount   = items.filter(i => i.item_type === "equipment").length;
                      return [
                        bikeCount > 0 ? `🚲 ${bikeCount}` : null,
                        eqCount   > 0 ? `⛑️ ${eqCount}`  : null,
                      ].filter(Boolean).join(" · ");
                    })()}
                  </span>
                )}
              </div>
              {!form.booked_start && (
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>
                  Введите время начала и окончания — цена рассчитается автоматически
                </div>
              )}

              {/* Список добавленных позиций */}
              {items.map((item, index) => {
                const bike = item.item_type === "bike" && item.bike_id
                  ? bikes.find(b => String(b.id) === String(item.bike_id))
                  : null;
                const tariffName = bike?.tariff_name
                  || (item.tariff_id ? tariffs.find(t => String(t.id) === String(item.tariff_id))?.name : null);

                return (
                  <div key={index} style={{
                    display: "flex", gap: 8, marginBottom: 4, alignItems: "center",
                    padding: "6px 10px", background: "#f9fafb", borderRadius: 6,
                    border: "1px solid #e5e7eb"
                  }}>
                    {/* Номер строки */}
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: "#9ca3af",
                      width: 18, textAlign: "center", flexShrink: 0
                    }}>{index + 1}</span>

                    {item.item_type === "bike" && bike ? (() => {
                      const photo = bike.photos?.urls?.length ? bike.photos.urls[bike.photos.main ?? 0] : null;
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                          {photo
                            ? <img src={photo} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                            : <div style={{ width: 36, height: 36, background: "#e5e7eb", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🚲</div>
                          }
                          <div style={{ fontSize: 12, lineHeight: 1.4, minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                              {bike.internal_article && <span style={{ fontWeight: 700 }}>{bike.internal_article}</span>}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bike.model}</span>
                            </div>
                            <div style={{ color: "#6b7280", fontSize: 11 }}>
                              {[bike.wheel_size ? `${bike.wheel_size}"` : null, bike.frame_size || null]
                                .filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>⛑️</span>
                        <select
                          className="form-select"
                          style={{ flex: 1, fontSize: 12 }}
                          value={item.equipment_model_id}
                          onChange={e => handleItemChange(index, "equipment_model_id", e.target.value)}
                        >
                          <option value="">Выберите модель...</option>
                          {equipment.map(eq => (
                            <option key={eq.id} value={eq.id}>
                              {eq.name}{eq.available_quantity != null ? ` (доступно: ${eq.available_quantity})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Тариф-бейдж */}
                    {tariffName && (
                      <span style={{
                        fontSize: 11, padding: "2px 8px", borderRadius: 10, flexShrink: 0,
                        background: "#dcfce7", color: "#15803d", fontWeight: 600,
                      }}>{tariffName}</span>
                    )}

                    {/* Цена */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <input
                        className="form-input"
                        type="number" min="0"
                        value={item.price}
                        onChange={e => handleItemChange(index, "price", e.target.value)}
                        placeholder="0"
                        style={{ width: 80, fontSize: 12 }}
                      />
                      <span style={{ fontSize: 11, color: "#6b7280" }}>₴</span>
                      {item.tariff_id && form.booked_start && form.booked_end && !dateError && (
                        <span style={{ fontSize: 10, color: "#059669", fontWeight: 500 }}>авто</span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      style={{ padding: "4px 8px", background: "none", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", color: "#ef4444", flexShrink: 0, fontSize: 12 }}
                      title="Удалить"
                    >✕</button>
                  </div>
                );
              })}

              {/* Строка поиска велосипеда */}
              <div style={{ position: "relative", marginTop: items.length > 0 ? 6 : 0 }}>
                <input
                  ref={addBikeInputRef}
                  className="form-input"
                  placeholder="Добавить велосипед — артикул или модель (от 2 символов)..."
                  value={addBikeSearch}
                  onChange={e => { setAddBikeSearch(e.target.value); setAddBikeFocused(-1); setAddBikeActive(true); }}
                  onFocus={handleAddBikeFocus}
                  onBlur={() => setTimeout(() => { setAddBikeActive(false); setAddBikeFocused(-1); }, 150)}
                  onKeyDown={handleAddBikeKeyDown}
                  autoComplete="off"
                />
                {addBikeActive && filteredAddBikes.length > 0 && (
                  <div style={{
                    position: "absolute", left: 0, right: 0, zIndex: 300,
                    ...(dropUp ? { bottom: "calc(100% + 4px)" } : { top: "calc(100% + 4px)" }),
                    background: "white", border: "1px solid #d1d5db", borderRadius: 6,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.13)", maxHeight: 300, overflowY: "auto"
                  }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <tbody>
                        {filteredAddBikes.map((b, i) => {
                          const photo       = b.photos?.urls?.length ? b.photos.urls[b.photos.main ?? 0] : null;
                          const isDuplicate = items.some(it => String(it.bike_id) === String(b.id));
                          return (
                            <tr
                              key={b.id}
                              onMouseDown={() => addBikeItem(b)}
                              onMouseEnter={() => setAddBikeFocused(i)}
                              onMouseLeave={() => setAddBikeFocused(-1)}
                              style={{
                                cursor: isDuplicate ? "not-allowed" : "pointer",
                                borderBottom: "1px solid #f3f4f6",
                                background: isDuplicate ? "#fef9c3"
                                  : i === addBikeFocused ? "#f0fdf4"
                                  : "white",
                                opacity: isDuplicate ? 0.65 : 1,
                              }}
                            >
                              <td style={{ padding: "5px 8px", width: 38 }}>
                                {photo
                                  ? <img src={photo} alt="" style={{ width: 30, height: 30, objectFit: "cover", borderRadius: 3, display: "block" }} />
                                  : <div style={{ width: 30, height: 30, background: "#e5e7eb", borderRadius: 3 }} />
                                }
                              </td>
                              <td style={{ padding: "5px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>{b.internal_article || "—"}</td>
                              <td style={{ padding: "5px 8px" }}>{b.model}</td>
                              <td style={{ padding: "5px 8px", whiteSpace: "nowrap", color: "#6b7280" }}>{b.wheel_size ? `${b.wheel_size}"` : "—"}</td>
                              <td style={{ padding: "5px 8px", whiteSpace: "nowrap", color: "#6b7280" }}>{b.frame_size || "—"}</td>
                              <td style={{ padding: "5px 8px", whiteSpace: "nowrap", fontWeight: 500,
                                color: isDuplicate ? "#a16207" : "#059669" }}>
                                {isDuplicate ? "уже добавлен" : (b.tariff_name || "—")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Добавить оборудование + итого */}
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <button type="button" className="btn btn-secondary-green btn-primary-small"
                  onClick={() => setItems(prev => [...prev, { ...INITIAL_ITEM, item_type: "equipment" }])}>
                  + Оборудование
                </button>
                {totalPrice > 0 && (
                  <span style={{ marginLeft: "auto", fontWeight: 700, color: "#111827", fontSize: 15 }}>
                    Итого: {totalPrice} ₴
                  </span>
                )}
              </div>
            </div>

            {/* ── 3. Даты и менеджер ─────────────────────────────────────────── */}
            <div className="form-section">
              <h3>Даты и менеджер</h3>
              <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="form-group">
                  <label>Начало (план)</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    name="booked_start"
                    value={form.booked_start}
                    onChange={handleDateChange}
                  />
                </div>
                <div className="form-group">
                  <label>Конец (план)</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    name="booked_end"
                    value={form.booked_end}
                    onChange={handleDateChange}
                    style={dateError ? { borderColor: "var(--color-primary-red)" } : {}}
                  />
                  {dateError && (
                    <span style={{ color: "var(--color-primary-red)", fontSize: 12, marginTop: 4, display: "block" }}>
                      {dateError}
                    </span>
                  )}
                </div>
                <div className="form-group">
                  <label>Выдал</label>
                  <select className="form-select" name="issued_by" value={form.issued_by} onChange={handleChange}>
                    <option value="">— Не указан —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Быстрый выбор длительности */}
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: "#6b7280", marginRight: 2 }}>Быстро:</span>
                {QUICK_DURATIONS.map(({ label, minutes }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => applyQuickDuration(minutes)}
                    disabled={!form.booked_start}
                    style={{
                      padding: "3px 10px", fontSize: 12, borderRadius: 4, cursor: "pointer",
                      border: "1px solid #d1d5db", background: form.booked_start ? "#f9fafb" : "#f3f4f6",
                      color: form.booked_start ? "#374151" : "#9ca3af",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { if (form.booked_start) e.currentTarget.style.background = "#e5e7eb"; }}
                    onMouseLeave={e => { if (form.booked_start) e.currentTarget.style.background = "#f9fafb"; }}
                    title={!form.booked_start ? "Сначала введите время начала" : `Установить конец: начало + ${label}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 4. Залог ───────────────────────────────────────────────────── */}
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
                    <label>
                      {form.deposit_type === "money" ? "Сумма залога (грн)" : "Документ (серия и номер)"}
                    </label>
                    <input
                      className="form-input"
                      name="deposit_value"
                      value={form.deposit_value}
                      onChange={handleChange}
                      placeholder={form.deposit_type === "money" ? "500" : "АА 123456"}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── 5. Заметки ─────────────────────────────────────────────────── */}
            <div className="form-section">
              <h3>Заметки при выдаче</h3>
              <div className="form-group">
                <textarea
                  className="form-textarea"
                  name="notes_issue"
                  value={form.notes_issue}
                  onChange={handleChange}
                  placeholder="Особые условия, пожелания клиента..."
                  rows={2}
                />
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary-green btn-primary-small"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "Сохранение..." : "Создать договор"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RentalModal;
