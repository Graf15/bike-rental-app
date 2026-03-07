import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
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
import { authenticate, cleanExpiredSessions } from "./middleware/auth.js";

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

// Все роуты ниже требуют авторизации
app.use("/api", authenticate);

app.use("/api/bikes", bikesRoutes);
app.use("/api/users", usersRouter);
app.use("/api/maintenance", maintenanceRouter);
app.use("/api/parts", partsRouter);
app.use("/api/purchase-requests", purchaseRequestsRouter);
app.use("/api/brands", brandsRouter);
app.use("/api/currency", currencyRouter);
app.use("/api/customers", customersRouter);
app.use("/api/rentals", rentalsRouter);
app.use("/api/tariffs", tariffsRouter);
app.use("/api/calculate", calculateRouter);
app.use("/api/equipment", equipmentRouter);

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);

  // Фоновая обработка просроченных броней каждую минуту
  processOverdueBookings();
  setInterval(processOverdueBookings, 60 * 1000);
  console.log("[overdue] Фоновый job запущен (каждую минуту)");

  // Очистка устаревших сессий раз в час
  cleanExpiredSessions();
  setInterval(cleanExpiredSessions, 60 * 60 * 1000);
  console.log("[sessions] Очистка устаревших сессий запущена (каждый час)");
});
