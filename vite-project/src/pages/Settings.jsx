import React, { useState, useEffect } from "react";
import { apiFetch } from "../utils/api";
import { ROUTES } from "../constants/routes";
import { usePermissions } from "../context/PermissionsContext";
import { toast } from "../utils/toast";
import "./Settings.css";

const ROLES = [
  { value: "admin",    label: "Администратор" },
  { value: "manager",  label: "Менеджер" },
  { value: "mechanic", label: "Механик" },
  { value: "employee", label: "Сотрудник" },
];

const Settings = () => {
  const { permissions, reload } = usePermissions();
  const [matrix, setMatrix] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const initial = {};
    ROUTES.forEach(({ path }) => {
      initial[path] = new Set(permissions[path] ?? []);
    });
    setMatrix(initial);
    setDirty(false);
  }, [permissions]);

  const toggle = (path, role) => {
    if (matrix[path]?.has(role) && matrix[path].size === 1) {
      toast.warn("Должна быть хотя бы одна роль с доступом");
      return;
    }
    setMatrix(prev => {
      const next = { ...prev, [path]: new Set(prev[path]) };
      if (next[path].has(role)) {
        next[path].delete(role);
      } else {
        next[path].add(role);
      }
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {};
      Object.entries(matrix).forEach(([path, roles]) => {
        body[path] = Array.from(roles);
      });
      const res = await apiFetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Ошибка сохранения");
      await reload();
      setDirty(false);
      toast.success("Права доступа сохранены");
    } catch (err) {
      toast.error(err.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const initial = {};
    ROUTES.forEach(({ path }) => {
      initial[path] = new Set(permissions[path] ?? []);
    });
    setMatrix(initial);
    setDirty(false);
  };

  return (
    <div className="page-container settings-page">
      <div className="page-header">
        <h1 className="page-title">Настройки доступа</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {dirty && (
            <button className="btn btn-secondary-green" onClick={handleReset} disabled={saving}>
              Сбросить
            </button>
          )}
          <button className="btn btn-primary-green" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <p className="settings-hint">
          Отметьте роли, у которых есть доступ к каждой странице. Изменения применяются после сохранения.
        </p>

        <div className="perm-grid">
          {/* Заголовок */}
          <div className="perm-row perm-row-header">
            <div className="perm-col-page">Страница</div>
            {ROLES.map(r => (
              <div key={r.value} className="perm-col-role">{r.label}</div>
            ))}
          </div>

          {/* Строки данных */}
          {ROUTES.map(({ path, label, Icon }) => (
            <div key={path} className="perm-row perm-row-data">
              <div className="perm-col-page">
                <span className="page-icon"><Icon size={16} /></span>
                <span className="page-label">{label}</span>
                <span className="page-path">{path}</span>
              </div>
              {ROLES.map(r => {
                const checked = matrix[path]?.has(r.value) ?? false;
                return (
                  <div key={r.value} className="perm-col-role">
                    <label className="perm-checkbox">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(path, r.value)}
                      />
                      <span className={`perm-checkmark${checked ? " checked" : ""}`} />
                    </label>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Settings;
