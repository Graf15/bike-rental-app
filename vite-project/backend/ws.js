import { WebSocketServer } from "ws";

let wss = null;

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket, req) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    console.log(`[ws] Клиент подключился (${ip}), всего: ${wss.clients.size}`);

    socket.on("close", () => {
      console.log(`[ws] Клиент отключился, всего: ${wss.clients.size}`);
    });

    socket.on("error", (err) => {
      console.error("[ws] Ошибка сокета:", err.message);
    });
  });

  console.log("[ws] WebSocket сервер запущен на /ws");
}

// Отправить событие всем подключённым клиентам
export function broadcast(type, data = {}) {
  if (!wss) return;
  const message = JSON.stringify({ type, data, ts: Date.now() });
  let sent = 0;
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
      sent++;
    }
  }
  console.log(`[ws] broadcast "${type}" → ${sent} клиент(ов)`);
}
