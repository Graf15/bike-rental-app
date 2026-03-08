import pool from "../db.js";

// Кеш разрешений: { '/rentals': ['admin','manager'], ... }
let cache = null;

export const invalidateCache = () => { cache = null; };

const loadCache = async () => {
  const result = await pool.query(
    "SELECT route_path, allowed_roles FROM route_permissions"
  );
  cache = {};
  result.rows.forEach(({ route_path, allowed_roles }) => {
    cache[route_path] = allowed_roles;
  });
  return cache;
};

// Маппинг: API-роут → фронтенд-маршрут из route_permissions
const API_TO_FRONTEND = {
  "/api/bikes":             "/",
  "/api/rentals":           "/rentals",
  "/api/customers":         "/customers",
  "/api/tariffs":           "/tariffs",
  "/api/maintenance":       "/maintenance",
  "/api/parts":             "/parts",
  "/api/purchase-requests": "/parts-requests",
  "/api/users":             "/users",
  "/api/brands":            "/",
  "/api/currency":          "/",
  "/api/calculate":         "/rentals",
  "/api/equipment":         "/rentals",
  "/api/permissions":       "/settings",
};

// Middleware: authorizeByRoute("/api/bikes")
export const authorizeByRoute = (apiRoute) => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "Не авторизован" });

  try {
    const permissions = cache ?? await loadCache();
    const frontendRoute = API_TO_FRONTEND[apiRoute];
    const allowedRoles = frontendRoute ? permissions[frontendRoute] : null;

    // Если нет записи или пустой массив — доступ для всех авторизованных
    if (!allowedRoles || allowedRoles.length === 0) return next();

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Недостаточно прав" });
    }

    next();
  } catch (err) {
    console.error("routePermissions error:", err);
    res.status(500).json({ error: "Ошибка проверки прав" });
  }
};
