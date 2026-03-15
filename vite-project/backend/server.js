import http from "http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { initWebSocket } from "./ws.js";
import { processOverdueBookings } from "./jobs/processOverdue.js";
import bikesRoutes from "./routes/bikes.js";
import usersRouter from "./routes/users.js";
import maintenanceRouter from "./routes/maintenance.js";
import partsRouter from "./routes/parts.js";
import purchaseRequestsRouter from "./routes/purchase-requests.js";
import brandsRouter from "./routes/brands.js";
import currencyRouter from "./routes/currency.js";
import customersRouter from "./routes/customers.js";
import rentalsRouter from "./routes/rentals.js";
import tariffsRouter from "./routes/tariffs.js";
import calculateRouter from "./routes/calculate.js";
import equipmentRouter from "./routes/equipment.js";
import authRouter from "./routes/auth.js";
import permissionsRouter from "./routes/permissions.js";
import callsRouter from "./routes/calls.js";
import { authenticate, cleanExpiredSessions } from "./middleware/auth.js";
import { authorizeByRoute } from "./middleware/routePermissions.js";

const app = express();
const PORT = 3001;

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser());

const ts = () => new Date().toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", hour12: false });

app.use((req, res, next) => {
  console.log(`[${ts()}] ${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => {
  res.send("Backend работает. Используйте /api/bikes");
});

app.use("/api/auth", authRouter);

// Вебхуки от MacroDroid — своя auth через API-ключ (до authenticate)
app.use("/api/calls", callsRouter);

// Все роуты ниже требуют авторизации
app.use("/api", authenticate);

app.use("/api/bikes",             authorizeByRoute("/api/bikes"),             bikesRoutes);
app.use("/api/users",             authorizeByRoute("/api/users"),             usersRouter);
app.use("/api/maintenance",       authorizeByRoute("/api/maintenance"),       maintenanceRouter);
app.use("/api/parts",             authorizeByRoute("/api/parts"),             partsRouter);
app.use("/api/purchase-requests", authorizeByRoute("/api/purchase-requests"), purchaseRequestsRouter);
app.use("/api/brands",            authorizeByRoute("/api/brands"),            brandsRouter);
app.use("/api/currency",          authorizeByRoute("/api/currency"),          currencyRouter);
app.use("/api/customers",         authorizeByRoute("/api/customers"),         customersRouter);
app.use("/api/rentals",           authorizeByRoute("/api/rentals"),           rentalsRouter);
app.use("/api/tariffs",           authorizeByRoute("/api/tariffs"),           tariffsRouter);
app.use("/api/calculate",         authorizeByRoute("/api/calculate"),         calculateRouter);
app.use("/api/equipment",         authorizeByRoute("/api/equipment"),         equipmentRouter);
app.use("/api/permissions",       permissionsRouter);

const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);

  // Фоновая обработка просроченных броней каждую минуту
  processOverdueBookings();
  setInterval(processOverdueBookings, 60 * 1000);
  console.log("[overdue] Фоновый job запущен (каждую минуту)");

  // Очистка устаревших сессий раз в сутки в 03:00 по Киеву
  const scheduleSessionCleanup = () => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Kyiv" }));
    const next3am = new Date(now);
    next3am.setHours(3, 0, 0, 0);
    if (next3am <= now) next3am.setDate(next3am.getDate() + 1);
    const msUntil = next3am - now;
    setTimeout(() => {
      cleanExpiredSessions();
      setInterval(cleanExpiredSessions, 24 * 60 * 60 * 1000);
    }, msUntil);
    console.log(`[sessions] Очистка запланирована на 03:00 (через ${Math.round(msUntil/60000)} мин)`);
  };
  scheduleSessionCleanup();
});
