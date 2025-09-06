import express from "express";
import cors from "cors";
import bikesRoutes from "./routes/bikes.js";
import usersRouter from "./routes/users.js";
import maintenanceRouter from "./routes/maintenance.js";
import partsRouter from "./routes/parts.js";
import purchaseRequestsRouter from "./routes/purchase-requests.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Middleware для логирования всех запросов
app.use((req, res, next) => {
  console.log(`=== ALL REQUESTS ===`);
  console.log(`${req.method} ${req.url}`);
  console.log(`Path: ${req.path}`);
  next();
});

app.get("/", (req, res) => {
  res.send("Backend работает. Используйте /api/bikes");
});

app.use("/api/bikes", bikesRoutes);
app.use("/api/users", usersRouter);
app.use("/api/maintenance", maintenanceRouter);
app.use("/api/parts", partsRouter);
app.use("/api/purchase-requests", purchaseRequestsRouter);

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});
