import React, { useState, useEffect } from "react";
import "./Modal.css";
import "./TariffModal.css";

const INITIAL_FORM = {
  name: "",
  description: "",
  price_first_hour: "",
  price_next_hour: "",
  price_day: "",
  price_24h: "",
  price_week: "",
  is_active: true,
};

const TariffModal = ({ tariff, onClose, onSave }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isEdit = !!(tariff && tariff.id);

  useEffect(() => {
    if (tariff) {
      setForm({
        name:             tariff.name             || "",
        description:      tariff.description      || "",
        price_first_hour: tariff.price_first_hour ?? "",
        price_next_hour:  tariff.price_next_hour  ?? "",
        price_day:        tariff.price_day        ?? "",
        price_24h:        tariff.price_24h        ?? "",
        price_week:       tariff.price_week       ?? "",
        is_active:        tariff.is_active        ?? true,
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [tariff]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const toNum = (val) => val !== "" ? parseFloat(val) : null;

  const handleSubmit = async () => {
    setError(null);
    if (!form.name.trim()) { setError("Введите название тарифа"); return; }

    setSaving(true);
    try {
      const url    = isEdit ? `/api/tariffs/${tariff.id}` : "/api/tariffs";
      const method = isEdit ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          price_first_hour: toNum(form.price_first_hour),
          price_next_hour:  toNum(form.price_next_hour),
          price_day:        toNum(form.price_day),
          price_24h:        toNum(form.price_24h),
          price_week:       toNum(form.price_week),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Редактировать тариф" : "Добавить тариф"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-form">

            <div className="form-section">
              <h3>Основное</h3>
              <div className="form-group">
                <label className="required-label">Название</label>
                <input
                  className="form-input"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Обычный велосипед"
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
            </div>

            <div className="form-section">
              <h3>Цены (грн)</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Первый час</label>
                  <input className="form-input" type="number" min="0" name="price_first_hour" value={form.price_first_hour} onChange={handleChange} placeholder="100" />
                </div>
                <div className="form-group">
                  <label>Каждый доп. час</label>
                  <input className="form-input" type="number" min="0" name="price_next_hour" value={form.price_next_hour} onChange={handleChange} placeholder="60" />
                </div>
              </div>
              <div className="form-row" style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label>День (до закрытия)</label>
                  <input className="form-input" type="number" min="0" name="price_day" value={form.price_day} onChange={handleChange} placeholder="400" />
                </div>
                <div className="form-group">
                  <label>Сутки (24ч)</label>
                  <input className="form-input" type="number" min="0" name="price_24h" value={form.price_24h} onChange={handleChange} placeholder="600" />
                </div>
              </div>
              <div className="form-row" style={{ marginTop: 12 }}>
                <div className="form-group">
                  <label>Неделя</label>
                  <input className="form-input" type="number" min="0" name="price_week" value={form.price_week} onChange={handleChange} placeholder="2500" />
                </div>
                <div className="form-group" style={{ justifyContent: "flex-end" }}>
                  <label className="checkbox-label" style={{ marginTop: "auto", paddingBottom: 8 }}>
                    <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} />
                    Тариф активен
                  </label>
                </div>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
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
