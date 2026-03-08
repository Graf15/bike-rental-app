import { apiFetch } from "../utils/api";
import React, { useState, useEffect, useRef } from "react";
import CheckboxField from "./CheckboxField";
import "./Modal.css";
import "./TariffModal.css";
import { toast } from "../utils/toast";

const PRICE_FIELDS = [
  "price_first_hour", "price_next_hour", "price_day", "price_24h",
  "price_first_hour_wd", "price_next_hour_wd", "price_day_wd", "price_24h_wd",
  "price_first_hour_we", "price_next_hour_we", "price_day_we", "price_24h_we",
  "price_week", "price_2weeks", "price_month",
];

const INITIAL_FORM = {
  name: "",
  description: "",
  is_active: true,
  has_weekend_pricing: false,
  // Единые цены
  price_first_hour: "", price_next_hour: "", price_day: "", price_24h: "",
  // Будни
  price_first_hour_wd: "", price_next_hour_wd: "", price_day_wd: "", price_24h_wd: "",
  // Выходные
  price_first_hour_we: "", price_next_hour_we: "", price_day_we: "", price_24h_we: "",
  // Длинные периоды
  price_week: "", price_2weeks: "", price_month: "",
};

const PriceInput = ({ label, name, value, onChange, placeholder }) => (
  <div className="form-group">
    <label>{label}</label>
    <input
      className="form-input"
      type="number"
      min="0"
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  </div>
);

const TariffModal = ({ tariff, onClose, onSave }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [errorSection, setErrorSection] = useState(null);
  const mouseDownOnOverlay = useRef(false);

  const isEdit = !!(tariff && tariff.id);

  useEffect(() => {
    if (tariff) {
      const f = { ...INITIAL_FORM };
      Object.keys(f).forEach(key => {
        if (key in tariff) f[key] = tariff[key] ?? (INITIAL_FORM[key]);
      });
      // Числовые поля — пустая строка если null
      PRICE_FIELDS.forEach(k => { f[k] = tariff[k] != null ? String(tariff[k]) : ""; });
      setForm(f);
    } else {
      setForm(INITIAL_FORM);
    }
  }, [tariff]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const toNum = (val) => (val !== "" && val != null ? parseFloat(val) : null);

  const handleSubmit = async () => {
    setErrorSection(null);
    if (!form.name.trim()) { setErrorSection("name"); toast.error("Введите название тарифа"); return; }

    const body = { ...form };
    PRICE_FIELDS.forEach(k => { body[k] = toNum(form[k]); });

    // Если has_weekend_pricing — очищаем единые поля и наоборот
    if (form.has_weekend_pricing) {
      body.price_first_hour = null;
      body.price_next_hour  = null;
      body.price_day        = null;
      body.price_24h        = null;
    } else {
      body.price_first_hour_wd = null; body.price_next_hour_wd = null;
      body.price_day_wd        = null; body.price_24h_wd        = null;
      body.price_first_hour_we = null; body.price_next_hour_we = null;
      body.price_day_we        = null; body.price_24h_we        = null;
    }

    setSaving(true);
    try {
      const url    = isEdit ? `/api/tariffs/${tariff.id}` : "/api/tariffs";
      const method = isEdit ? "PUT" : "POST";
      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Ошибка при сохранении");
      }
      onSave();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Редактировать тариф" : "Добавить тариф"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-form">

            {/* Основное */}
            <div className={`form-section${errorSection === "name" ? " form-section--error" : ""}`}>
              <h3>Основное</h3>
              <div className="form-group">
                <label className="required-label">Название</label>
                <input
                  className="form-input"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Эконом / Стандарт / Самокат..."
                />
              </div>
              <div className="form-group" style={{ marginTop: 12 }}>
                <label>Описание</label>
                <textarea
                  className="form-textarea"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Краткое описание тарифа..."
                  rows={2}
                />
              </div>
              <div style={{ marginTop: 12, display: "flex", gap: 24, alignItems: "center" }}>
                <CheckboxField
                  label="Разные цены в будни и выходные"
                  checked={form.has_weekend_pricing}
                  onChange={v => setForm(prev => ({ ...prev, has_weekend_pricing: v }))}
                />
                <CheckboxField
                  label="Тариф активен"
                  checked={form.is_active}
                  onChange={v => setForm(prev => ({ ...prev, is_active: v }))}
                />
              </div>
            </div>

            {/* Почасовые и дневные цены */}
            {!form.has_weekend_pricing ? (
              <div className="form-section">
                <h3>Цены (грн)</h3>
                <div className="form-row">
                  <PriceInput label="Первый час"      name="price_first_hour" value={form.price_first_hour} onChange={handleChange} placeholder="100" />
                  <PriceInput label="Каждый доп. час" name="price_next_hour"  value={form.price_next_hour}  onChange={handleChange} placeholder="50"  />
                </div>
                <div className="form-row" style={{ marginTop: 12 }}>
                  <PriceInput label="День (до закрытия)" name="price_day"  value={form.price_day}  onChange={handleChange} placeholder="300" />
                  <PriceInput label="Сутки (24ч)"        name="price_24h"  value={form.price_24h}  onChange={handleChange} placeholder="350" />
                </div>
              </div>
            ) : (
              <>
                <div className="form-section">
                  <h3>Цены будние дни (грн)</h3>
                  <div className="form-row">
                    <PriceInput label="Первый час"      name="price_first_hour_wd" value={form.price_first_hour_wd} onChange={handleChange} placeholder="110" />
                    <PriceInput label="Каждый доп. час" name="price_next_hour_wd"  value={form.price_next_hour_wd}  onChange={handleChange} placeholder="60"  />
                  </div>
                  <div className="form-row" style={{ marginTop: 12 }}>
                    <PriceInput label="День (до закрытия)" name="price_day_wd"  value={form.price_day_wd}  onChange={handleChange} placeholder="350" />
                    <PriceInput label="Сутки (24ч)"        name="price_24h_wd"  value={form.price_24h_wd}  onChange={handleChange} placeholder="400" />
                  </div>
                </div>
                <div className="form-section">
                  <h3>Цены выходные дни (сб 11:00 – вс 19:30) (грн)</h3>
                  <div className="form-row">
                    <PriceInput label="Первый час"      name="price_first_hour_we" value={form.price_first_hour_we} onChange={handleChange} placeholder="130" />
                    <PriceInput label="Каждый доп. час" name="price_next_hour_we"  value={form.price_next_hour_we}  onChange={handleChange} placeholder="70"  />
                  </div>
                  <div className="form-row" style={{ marginTop: 12 }}>
                    <PriceInput label="День (до закрытия)" name="price_day_we"  value={form.price_day_we}  onChange={handleChange} placeholder="400" />
                    <PriceInput label="Сутки (24ч)"        name="price_24h_we"  value={form.price_24h_we}  onChange={handleChange} placeholder="450" />
                  </div>
                </div>
              </>
            )}

            {/* Длинные периоды */}
            <div className="form-section">
              <h3>Длинные периоды (грн, одинаково для всех дней)</h3>
              <div className="form-row">
                <PriceInput label="Неделя (7 дн)"    name="price_week"   value={form.price_week}   onChange={handleChange} placeholder="750"  />
                <PriceInput label="2 недели (14 дн)"  name="price_2weeks" value={form.price_2weeks} onChange={handleChange} placeholder="1300" />
                <PriceInput label="Месяц (30 дн)"    name="price_month"  value={form.price_month}  onChange={handleChange} placeholder="2400" />
              </div>
            </div>

          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary-green btn-primary-small" onClick={handleSubmit} disabled={saving}>
            {saving ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TariffModal;
