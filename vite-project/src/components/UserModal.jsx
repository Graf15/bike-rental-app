import React, { useState, useEffect, useRef } from "react";
import { apiFetch } from "../utils/api";
import { toast } from "../utils/toast";
import PasswordInput from "./PasswordInput";
import MultiSelectPopover from "./MultiSelectPopover";
import CheckboxField from "./CheckboxField";
import "./Modal.css";

const ROLE_OPTIONS = [
  { value: "admin",    label: "Администратор" },
  { value: "manager",  label: "Менеджер" },
  { value: "mechanic", label: "Механик" },
  { value: "employee", label: "Сотрудник" },
];

const INITIAL_FORM = { name: "", email: "", phone: "", role: "manager", password: "", is_active: true };

const UserModal = ({ user, onClose, onSave }) => {
  const isEdit = !!user;
  const [form, setForm]               = useState(INITIAL_FORM);
  const [resetPwd, setResetPwd]       = useState("");
  const [showReset, setShowReset]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [errorSection, setErrorSection] = useState(null);
  const [rolePopover, setRolePopover] = useState(false);
  const roleAnchorRef = useRef(null);
  const mouseDownOnOverlay = useRef(false);

  useEffect(() => {
    if (user) {
      setForm({
        name:      user.name      || "",
        email:     user.email     || "",
        phone:     user.phone     || "",
        role:      user.role      || "manager",
        password:  "",
        is_active: user.is_active ?? true,
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  useEffect(() => {
    if (errorSection === "info" && form.name.trim() && form.email.trim()) setErrorSection(null);
  }, [form.name, form.email, errorSection]);

  const handleSubmit = async () => {
    setErrorSection(null);
    if (!form.name.trim() || !form.email.trim()) {
      setErrorSection("info");
      toast.error("Заполните имя и email");
      return;
    }
    if (!isEdit && form.password.length < 6) {
      setErrorSection("password");
      toast.error("Пароль должен быть не менее 6 символов");
      return;
    }
    setSaving(true);
    try {
      const url    = isEdit ? `/api/users/${user.id}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Ошибка"); return; }
      toast.success(isEdit ? `Сотрудник ${form.name} обновлён` : `Сотрудник ${data.name} добавлен`);
      onSave();
    } catch { toast.error("Ошибка сервера"); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    if (resetPwd.length < 6) { toast.error("Пароль должен быть не менее 6 символов"); return; }
    setSaving(true);
    try {
      const res = await apiFetch(`/api/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPwd }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Ошибка"); return; }
      toast.success("Пароль сброшен, сессии завершены");
      setResetPwd("");
      setShowReset(false);
    } catch { toast.error("Ошибка сервера"); }
    finally { setSaving(false); }
  };

  return (
    <>
    <div className="modal-overlay"
      onMouseDown={e => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={e => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? "Редактировать сотрудника" : "Добавить сотрудника"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-form">

            {/* Основная информация */}
            <div className={`form-section${errorSection === "info" ? " form-section--error" : ""}`}>
              <h3>Основная информация</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="required-label">Имя</label>
                  <input className="form-input" name="name" value={form.name} onChange={handleChange} placeholder="Иванов Иван" />
                </div>
                <div className="form-group">
                  <label>Телефон</label>
                  <input className="form-input" name="phone" value={form.phone} onChange={handleChange} placeholder="+380XXXXXXXXX" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="required-label">Email</label>
                  <input className="form-input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="ivan@bikerental.ru" />
                </div>
                <div className="form-group">
                  <label>Роль</label>
                  <button
                    type="button"
                    ref={roleAnchorRef}
                    className="filter-select-box"
                    style={{ width: "100%" }}
                    onClick={() => setRolePopover(v => !v)}
                  >
                    {ROLE_OPTIONS.find(o => o.value === form.role)?.label || "Менеджер"}
                    <span className="arrow">▼</span>
                  </button>
                </div>
              </div>
              {isEdit && (
                <div className="form-group">
                  <CheckboxField
                    checked={form.is_active}
                    onChange={v => setForm(p => ({ ...p, is_active: v }))}
                    label="Аккаунт активен"
                  />
                </div>
              )}
            </div>

            {/* Пароль при создании */}
            {!isEdit && (
              <div className={`form-section${errorSection === "password" ? " form-section--error" : ""}`}>
                <h3>Пароль</h3>
                <div className="form-group">
                  <label className="required-label">Пароль (мин. 6 символов)</label>
                  <PasswordInput name="password" value={form.password}
                    onChange={e => { handleChange(e); if (errorSection === "password") setErrorSection(null); }}
                    placeholder="••••••" />
                </div>
              </div>
            )}

            {/* Сброс пароля при редактировании */}
            {isEdit && (
              <div className="form-section">
                <h3>Сброс пароля</h3>
                {!showReset ? (
                  <button type="button" className="btn btn-secondary-green btn-primary-small"
                    onClick={() => setShowReset(true)}>
                    Задать новый пароль
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                      <label>Новый пароль (мин. 6 символов)</label>
                      <PasswordInput value={resetPwd}
                        onChange={e => setResetPwd(e.target.value)} placeholder="••••••" />
                    </div>
                    <button type="button" className="btn btn-primary-orange btn-primary-small"
                      onClick={handleResetPassword} disabled={saving}>
                      Сохранить
                    </button>
                    <button type="button" className="btn btn-primary-small"
                      style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" }}
                      onClick={() => { setShowReset(false); setResetPwd(""); }}>
                      Отмена
                    </button>
                  </div>
                )}
                <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                  При сбросе пароля все активные сессии сотрудника будут завершены.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ justifyContent: "flex-end" }}>
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

      {rolePopover && (
        <MultiSelectPopover
          options={ROLE_OPTIONS}
          selected={[form.role]}
          onChange={vals => { setForm(p => ({ ...p, role: vals[0] ?? "manager" })); setRolePopover(false); }}
          visible={true}
          anchorRef={roleAnchorRef}
          onClose={() => setRolePopover(false)}
          singleSelect
        />
      )}
    </>
  );
};

export default UserModal;
