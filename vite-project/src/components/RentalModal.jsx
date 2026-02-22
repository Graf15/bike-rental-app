import React, { useState, useEffect, useRef } from "react";
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

const TARIFF_TYPES = [
  { value: "hourly", label: "Почасово" },
  { value: "day",    label: "День (до закрытия)" },
  { value: "24h",    label: "Сутки (24ч)" },
  { value: "week",   label: "Неделя" },
];

const DEPOSIT_TYPES = [
  { value: "none",     label: "Без залога" },
  { value: "money",    label: "Денежный залог" },
  { value: "document", label: "Документ" },
];

const RentalModal = ({ onClose, onSave }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [items, setItems] = useState([{ ...INITIAL_ITEM }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [bikes, setBikes] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [equipment, setEquipment] = useState([]);

  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

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
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setForm(prev => ({ ...prev, customer_id: "" }));
    setCustomerSearch("");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const calcPrice = (tariffId, tariffType, tariffsList) => {
    const tariff = tariffsList.find(t => String(t.id) === String(tariffId));
    if (!tariff) return "";
    const map = {
      hourly: tariff.price_first_hour,
      day:    tariff.price_day,
      "24h":  tariff.price_24h,
      week:   tariff.price_week,
    };
    return map[tariffType] ?? "";
  };

  const handleItemChange = (index, field, value) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "tariff_id") {
        next[index].price = calcPrice(value, next[index].tariff_type, tariffs);
      }
      if (field === "tariff_type") {
        next[index].price = calcPrice(next[index].tariff_id, value, tariffs);
      }
      return next;
    });
  };

  const addItem = (type) => setItems(prev => [...prev, { ...INITIAL_ITEM, item_type: type }]);
  const removeItem = (index) => setItems(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    setError(null);
    if (!form.customer_id) { setError("Выберите клиента"); return; }
    if (items.length === 0) { setError("Добавьте хотя бы одну позицию"); return; }
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
          bike_id: i.bike_id ? parseInt(i.bike_id) : null,
          equipment_model_id: i.equipment_model_id ? parseInt(i.equipment_model_id) : null,
          tariff_id: i.tariff_id ? parseInt(i.tariff_id) : null,
          price: i.price !== "" ? parseFloat(i.price) : null,
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

  const availableBikes = bikes.filter(b => b.condition_status === "в наличии");

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 920 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать договор проката</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-form">

            {/* Клиент */}
            <div className="form-section">
              <h3>Клиент</h3>
              <div ref={dropdownRef} style={{ position: "relative" }}>
                <div className="form-group">
                  <label className="required-label">Поиск клиента</label>
                  <input
                    className="form-input"
                    value={customerSearch}
                    onChange={e => {
                      setCustomerSearch(e.target.value);
                      setSelectedCustomer(null);
                      setForm(p => ({ ...p, customer_id: "" }));
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
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
                    {filteredCustomers.map(c => (
                      <div
                        key={c.id}
                        onMouseDown={() => handleCustomerSelect(c)}
                        style={{
                          padding: "10px 14px", cursor: "pointer",
                          borderBottom: "1px solid #f3f4f6",
                          display: "flex", alignItems: "center", gap: 10
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                        onMouseLeave={e => e.currentTarget.style.background = "white"}
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

              {selectedCustomer && (
                <div style={{
                  marginTop: 10, padding: "10px 14px",
                  background: "#f0fdf4", border: "1px solid #10b981",
                  borderRadius: 6, display: "flex", alignItems: "center", gap: 12
                }}>
                  <span style={{ fontWeight: 500, color: "#065f46" }}>
                    {selectedCustomer.last_name} {selectedCustomer.first_name} {selectedCustomer.middle_name || ""}
                  </span>
                  <span style={{ color: "#047857" }}>{selectedCustomer.phone}</span>
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
                  <button
                    type="button"
                    onClick={clearCustomer}
                    style={{
                      marginLeft: "auto", background: "none", border: "none",
                      cursor: "pointer", color: "#6b7280", fontSize: 16, padding: "2px 6px"
                    }}
                    title="Очистить выбор"
                  >✕</button>
                </div>
              )}
            </div>

            {/* Даты и менеджер */}
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
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Конец (план)</label>
                  <input
                    className="form-input"
                    type="datetime-local"
                    name="booked_end"
                    value={form.booked_end}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-group">
                  <label>Выдал</label>
                  <select className="form-select" name="issued_by" value={form.issued_by} onChange={handleChange}>
                    <option value="">— Не указан —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Позиции */}
            <div className="form-section">
              <h3>Позиции договора</h3>
              {items.length === 0 && (
                <div style={{ color: "#6b7280", textAlign: "center", padding: "16px 0", fontSize: 14 }}>
                  Добавьте хотя бы одну позицию
                </div>
              )}
              {items.map((item, index) => (
                <div key={index} style={{
                  display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-end",
                  padding: "12px", background: "#f9fafb", borderRadius: 6,
                  border: "1px solid #e5e7eb"
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 30, height: 30, borderRadius: 4, flexShrink: 0, marginBottom: 2,
                    background: item.item_type === "bike" ? "var(--color-primary-green-light-background)" : "#dbeafe",
                    fontSize: 15
                  }}>
                    {item.item_type === "bike" ? "🚲" : "⛑️"}
                  </div>

                  {item.item_type === "bike" ? (
                    <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                      <label style={{ fontSize: 12 }}>Велосипед</label>
                      <select
                        className="form-select"
                        value={item.bike_id}
                        onChange={e => handleItemChange(index, "bike_id", e.target.value)}
                      >
                        <option value="">Выберите велосипед...</option>
                        {availableBikes.map(b => (
                          <option key={b.id} value={b.id}>
                            #{b.id} {b.model}{b.internal_article ? ` (${b.internal_article})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                      <label style={{ fontSize: 12 }}>Оборудование</label>
                      <select
                        className="form-select"
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

                  <div className="form-group" style={{ flex: 1.5, marginBottom: 0 }}>
                    <label style={{ fontSize: 12 }}>Тариф</label>
                    <select
                      className="form-select"
                      value={item.tariff_id}
                      onChange={e => handleItemChange(index, "tariff_id", e.target.value)}
                    >
                      <option value="">— Без тарифа —</option>
                      {tariffs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                    <label style={{ fontSize: 12 }}>Тип</label>
                    <select
                      className="form-select"
                      value={item.tariff_type}
                      onChange={e => handleItemChange(index, "tariff_type", e.target.value)}
                    >
                      {TARIFF_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ width: 90, marginBottom: 0, flexShrink: 0 }}>
                    <label style={{ fontSize: 12 }}>Цена (грн)</label>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      value={item.price}
                      onChange={e => handleItemChange(index, "price", e.target.value)}
                      placeholder="0"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    style={{
                      marginBottom: 2, padding: "7px 10px", background: "none",
                      border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer",
                      color: "#ef4444", flexShrink: 0
                    }}
                    title="Удалить позицию"
                  >✕</button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={() => addItem("bike")}>
                  + Велосипед
                </button>
                <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={() => addItem("equipment")}>
                  + Оборудование
                </button>
              </div>
            </div>

            {/* Залог */}
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

            {/* Заметки */}
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
