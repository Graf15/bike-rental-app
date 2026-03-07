import React, { useState, useRef } from "react";
import { apiFetch } from "../utils/api";
import { toast } from "../utils/toast";
import PasswordInput from "./PasswordInput";
import "./Modal.css";

const ChangePasswordModal = ({ onClose }) => {
  const [form, setForm]   = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [saving, setSaving] = useState(false);
  const [errorSection, setErrorSection] = useState(null);
  const mouseDownOnOverlay = useRef(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errorSection) setErrorSection(null);
  };

  const handleSubmit = async () => {
    setErrorSection(null);
    if (!form.current_password) {
      setErrorSection("current");
      toast.error("Введите текущий пароль");
      return;
    }
    if (form.new_password.length < 6) {
      setErrorSection("new");
      toast.error("Новый пароль должен быть не менее 6 символов");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      setErrorSection("new");
      toast.error("Пароли не совпадают");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: form.current_password, new_password: form.new_password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) setErrorSection("current");
        else setErrorSection("new");
        toast.error(data.error || "Ошибка");
        return;
      }
      toast.success("Пароль успешно изменён");
      onClose();
    } catch { toast.error("Ошибка сервера"); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay"
      onMouseDown={e => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={e => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Смена пароля</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-form">

            <div className={`form-section${errorSection === "current" ? " form-section--error" : ""}`}>
              <div className="form-group">
                <label className="required-label">Текущий пароль</label>
                <PasswordInput name="current_password"
                  value={form.current_password} onChange={handleChange} placeholder="••••••" />
              </div>
            </div>

            <div className={`form-section${errorSection === "new" ? " form-section--error" : ""}`}>
              <div className="form-group">
                <label className="required-label">Новый пароль (мин. 6 символов)</label>
                <PasswordInput name="new_password"
                  value={form.new_password} onChange={handleChange} placeholder="••••••" />
              </div>
              <div className="form-group">
                <label className="required-label">Повторите новый пароль</label>
                <PasswordInput name="confirm_password"
                  value={form.confirm_password} onChange={handleChange} placeholder="••••••" />
              </div>
            </div>

          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary-green btn-primary-small"
            onClick={handleSubmit} disabled={saving}>
            {saving ? "Сохранение..." : "Сменить пароль"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
