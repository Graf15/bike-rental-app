import { apiFetch } from "../utils/api";
import React, { useState, useEffect, useRef } from "react";
import DateTimePickerField from "./DateTimePickerField";
import MultiSelectPopover from "./MultiSelectPopover";
import "./Modal.css";
import "./CustomerModal.css";
import { normalizePhone, PHONE_HINT } from "../constants/phoneUtils";
import { toast } from "../utils/toast";

const GENDER_OPTIONS = [
  { value: "",        label: "Не указан" },
  { value: "мужской", label: "Мужской" },
  { value: "женский", label: "Женский" },
];

const STATUS_OPTIONS = [
  { value: "active",     label: "Полные права (активен)" },
  { value: "no_booking", label: "Запрет бронирования" },
  { value: "no_rental",  label: "Запрет выдачи" },
];

const POPOVER_OPTS = { gender: GENDER_OPTIONS, status: STATUS_OPTIONS };

const INITIAL_FORM = {
  last_name: "", first_name: "", middle_name: "", phone: "",
  birth_date: "", gender: "", height_cm: "", is_veteran: false,
  status: "active", restriction_reason: "", notes: "",
};

const CustomerModal = ({ customer, onClose, onSave }) => {
  const [form, setForm]               = useState(INITIAL_FORM);
  const [saving, setSaving]           = useState(false);
  const [errorSection, setErrorSection] = useState(null);
  const [openField, setOpenField]     = useState(null);
  const anchorRefs = useRef({});
  const mouseDownOnOverlay = useRef(false);

  const isEdit = !!(customer?.id);

  useEffect(() => {
    if (errorSection === "personal" && form.first_name.trim() && form.phone) setErrorSection(null);
  }, [form.first_name, form.phone, errorSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (customer) {
      setForm({
        last_name:          customer.last_name          || "",
        first_name:         customer.first_name         || "",
        middle_name:        customer.middle_name        || "",
        phone:              customer.phone              || "",
        birth_date:         customer.birth_date ? customer.birth_date.split("T")[0] : "",
        gender:             customer.gender             || "",
        height_cm:          customer.height_cm          || "",
        is_veteran:         customer.is_veteran         || false,
        status:             customer.status             || "active",
        restriction_reason: customer.restriction_reason || "",
        notes:              customer.notes              || "",
      });
    } else {
      setForm(INITIAL_FORM);
    }
  }, [customer]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handlePopoverChange = (field, vals) => {
    setForm(prev => ({ ...prev, [field]: vals[0] ?? "" }));
    setOpenField(null);
  };

  const handleSubmit = async () => {
    setErrorSection(null);

    if (!form.first_name.trim()) {
      setErrorSection("personal");
      toast.error("Заполните обязательное поле: имя");
      return;
    }

    const phone = normalizePhone(form.phone);
    if (!phone) {
      setErrorSection("personal");
      toast.error(`Неверный формат телефона. ${PHONE_HINT}`);
      return;
    }

    setSaving(true);
    try {
      const url    = isEdit ? `/api/customers/${customer.id}` : "/api/customers";
      const method = isEdit ? "PUT" : "POST";

      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, phone, height_cm: form.height_cm ? parseInt(form.height_cm) : null }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.existing) {
          const name = [data.existing.last_name, data.existing.first_name].filter(Boolean).join(" ");
          toast.error(`${data.error || "Дубликат"} — ${name} (${data.existing.phone})`);
        } else {
          toast.error(data.error || "Ошибка при сохранении");
        }
        return;
      }

      const fullName = [form.last_name, form.first_name].filter(Boolean).join(" ") || form.first_name;
      toast.success(isEdit ? `Клиент ${fullName} обновлён` : `Клиент ${fullName} добавлен`);
      onSave();
    } catch { toast.error("Ошибка сервера"); }
    finally { setSaving(false); }
  };

  // Helper — триггер дропдауна (фирменный паттерн: button.filter-select-box)
  const DropdownTrigger = ({ field, opts }) => {
    const label = opts.find(o => o.value === form[field])?.label || opts[0]?.label || "—";
    return (
      <button
        type="button"
        ref={el => anchorRefs.current[field] = el}
        className="filter-select-box"
        style={{ width: "100%" }}
        onClick={() => setOpenField(f => f === field ? null : field)}
      >
        {label}<span className="arrow">▼</span>
      </button>
    );
  };

  return (
    <>
      <div className="modal-overlay"
        onMouseDown={e => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
        onMouseUp={e => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{isEdit ? "Редактировать клиента" : "Добавить клиента"}</h2>
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>

          <div className="modal-body">
            <div className="modal-form">

              <div className={`form-section${errorSection === "personal" ? " form-section--error" : ""}`}>
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
                    <DateTimePickerField
                      value={form.birth_date}
                      onChange={v => setForm(p => ({ ...p, birth_date: v }))}
                      granularity="day"
                      minDate={null}
                    />
                  </div>
                  <div className="form-group">
                    <label>Пол</label>
                    <DropdownTrigger field="gender" opts={GENDER_OPTIONS} />
                  </div>
                  <div className="form-group">
                    <label>Рост (см)</label>
                    <input className="form-input" type="number" name="height_cm" value={form.height_cm}
                      onChange={handleChange} placeholder="175" min="100" max="250" />
                  </div>
                </div>
              </div>

              <div className="form-section">
                <h3>Статус и привилегии</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Привилегии</label>
                    <DropdownTrigger field="status" opts={STATUS_OPTIONS} />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                    <input type="checkbox" name="is_veteran" checked={form.is_veteran} onChange={handleChange}
                      style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--color-primary-blue)" }} />
                    <span style={{ fontWeight: form.is_veteran ? 600 : 400, color: form.is_veteran ? "var(--color-primary-blue)" : "#374151" }}>
                      🎖 Участник боевых действий (УБД) — скидка −20%
                    </span>
                  </label>
                </div>
                {form.status !== "active" && (
                  <div className="form-group" style={{ marginTop: 8 }}>
                    <label>Причина ограничения</label>
                    <input className="form-input" name="restriction_reason" value={form.restriction_reason}
                      onChange={handleChange} placeholder="Причина блокировки..." />
                  </div>
                )}
              </div>

              <div className="form-section">
                <h3>Заметки</h3>
                <div className="form-group">
                  <textarea className="form-textarea" name="notes" value={form.notes}
                    onChange={handleChange} placeholder="Любые заметки о клиенте..." rows={3} />
                </div>
              </div>

            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={onClose}>
              Отмена
            </button>
            <button type="button" className="btn btn-primary-green btn-primary-small"
              onClick={handleSubmit} disabled={saving}>
              {saving ? "Сохранение..." : isEdit ? "Сохранить" : "Добавить"}
            </button>
          </div>
        </div>
      </div>

      {openField && POPOVER_OPTS[openField] && (
        <MultiSelectPopover
          options={POPOVER_OPTS[openField]}
          selected={[form[openField]]}
          onChange={vals => handlePopoverChange(openField, vals)}
          visible={true}
          anchorRef={{ current: anchorRefs.current[openField] }}
          onClose={() => setOpenField(null)}
          singleSelect
        />
      )}
    </>
  );
};

export default CustomerModal;
