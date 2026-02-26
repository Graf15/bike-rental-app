import React, { useState, useEffect, useRef } from "react";
import "./Modal.css";
import "./CustomerModal.css";
import { normalizePhone, PHONE_HINT } from "../constants/phoneUtils";

const INITIAL_FORM = {
  last_name: "",
  first_name: "",
  middle_name: "",
  phone: "",
  birth_date: "",
  gender: "",
  height_cm: "",
  is_veteran: false,
  status: "active",
  restriction_reason: "",
  notes: "",
};

const CustomerModal = ({ customer, onClose, onSave }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [existingCustomer, setExistingCustomer] = useState(null);
  const mouseDownOnOverlay = useRef(false);

  const isEdit = !!(customer && customer.id);

  useEffect(() => {
    if (customer) {
      setForm({
        last_name: customer.last_name || "",
        first_name: customer.first_name || "",
        middle_name: customer.middle_name || "",
        phone: customer.phone || "",
        birth_date: customer.birth_date ? customer.birth_date.split("T")[0] : "",
        gender: customer.gender || "",
        height_cm: customer.height_cm || "",
        is_veteran: customer.is_veteran || false,
        status: customer.status || "active",
        restriction_reason: customer.restriction_reason || "",
        notes: customer.notes || "",
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [customer]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setExistingCustomer(null);

    if (!form.first_name.trim()) {
      setError("Заполните обязательное поле: имя");
      return;
    }

    const phone = normalizePhone(form.phone);
    if (!phone) {
      setError(`Неверный формат телефона. ${PHONE_HINT}`);
      return;
    }

    setSaving(true);
    try {
      const url = isEdit ? `/api/customers/${customer.id}` : "/api/customers";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          phone,
          height_cm: form.height_cm ? parseInt(form.height_cm) : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 409 && data.existing) {
          setExistingCustomer(data.existing);
        }
        throw new Error(data.error || "Ошибка при сохранении");
      }

      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }} onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Редактировать клиента" : "Добавить клиента"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit} className="modal-form">
            <div className="form-section">
              <h3>Личные данные</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Фамилия</label>
                  <input className="form-input" name="last_name" value={form.last_name} onChange={handleChange} placeholder="Иванов" />
                </div>
                <div className="form-group">
                  <label className="required-label">Имя</label>
                  <input className="form-input" name="first_name" value={form.first_name} onChange={handleChange} placeholder="Иван" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Отчество</label>
                  <input className="form-input" name="middle_name" value={form.middle_name} onChange={handleChange} placeholder="Иванович" />
                </div>
                <div className="form-group">
                  <label className="required-label">Телефон</label>
                  <input className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="0XXXXXXXXX" />
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{PHONE_HINT}</div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Дата рождения</label>
                  <input className="form-input" type="date" name="birth_date" value={form.birth_date} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Пол</label>
                  <select className="form-select" name="gender" value={form.gender} onChange={handleChange}>
                    <option value="">Не указан</option>
                    <option value="мужской">Мужской</option>
                    <option value="женский">Женский</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Рост (см)</label>
                  <input
                    className="form-input"
                    type="number"
                    name="height_cm"
                    value={form.height_cm}
                    onChange={handleChange}
                    placeholder="175"
                    min="100"
                    max="250"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Статус и привилегии</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Привилегии</label>
                  <select className="form-select" name="status" value={form.status} onChange={handleChange}>
                    <option value="active">Полные (активен)</option>
                    <option value="no_booking">Запрет бронирования</option>
                    <option value="no_rental">Запрет выдачи</option>
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    name="is_veteran"
                    checked={form.is_veteran}
                    onChange={handleChange}
                    style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--color-primary-blue)" }}
                  />
                  <span style={{ fontWeight: form.is_veteran ? 600 : 400, color: form.is_veteran ? "var(--color-primary-blue)" : "#374151" }}>
                    🎖 Участник боевых действий (УБД) — скидка −20%
                  </span>
                </label>
              </div>
              {form.status !== "active" && (
                <div className="form-group">
                  <label>Причина ограничения</label>
                  <input
                    className="form-input"
                    name="restriction_reason"
                    value={form.restriction_reason}
                    onChange={handleChange}
                    placeholder="Причина блокировки..."
                  />
                </div>
              )}
            </div>

            <div className="form-section">
              <h3>Заметки</h3>
              <div className="form-group">
                <textarea
                  className="form-textarea"
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Любые заметки о клиенте..."
                  rows={3}
                />
              </div>
            </div>

            {error && (
              <div className="error-message">
                {error}
                {existingCustomer && (
                  <span style={{ marginLeft: 8, fontWeight: 500 }}>
                    — {[existingCustomer.last_name, existingCustomer.first_name].filter(Boolean).join(" ")} ({existingCustomer.phone})
                  </span>
                )}
              </div>
            )}
          </form>
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
            {saving ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;
