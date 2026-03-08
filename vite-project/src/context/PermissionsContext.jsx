import React, { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../utils/api";
import { ROUTES } from "../constants/routes";

const PermissionsContext = createContext(null);

// Дефолтные разрешения из routes.js (используются до загрузки из БД)
const DEFAULT_PERMISSIONS = Object.fromEntries(
  ROUTES.map(r => [r.path, r.roles ?? null])
);

export const PermissionsProvider = ({ children }) => {
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = async () => {
    try {
      const res = await apiFetch("/api/permissions");
      if (res.ok) {
        const data = await res.json();
        setPermissions({ ...DEFAULT_PERMISSIONS, ...data });
      }
    } catch {
      // при ошибке остаём на дефолтных
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPermissions(); }, []);

  const canAccess = (path, userRole) => {
    const roles = permissions[path];
    return !roles || roles.length === 0 || roles.includes(userRole);
  };

  const reload = () => fetchPermissions();

  return (
    <PermissionsContext.Provider value={{ permissions, canAccess, loading, reload }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionsContext);
