import { useEffect, useRef, useCallback } from "react";

const WS_URL = `ws://${window.location.hostname}:3001/ws`;
const RECONNECT_DELAY = 3000;

// Глобальный синглтон — один сокет на всё приложение
let globalSocket = null;
const listeners = new Set();

function getSocket() {
  if (globalSocket && globalSocket.readyState <= 1) return globalSocket; // CONNECTING или OPEN

  globalSocket = new WebSocket(WS_URL);

  globalSocket.onopen = () => {
    console.log("[ws] Подключено");
  };

  globalSocket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      for (const fn of listeners) fn(msg);
    } catch (e) {
      console.error("[ws] Ошибка парсинга:", e);
    }
  };

  globalSocket.onclose = () => {
    console.log(`[ws] Отключено, переподключение через ${RECONNECT_DELAY}ms`);
    globalSocket = null;
    setTimeout(getSocket, RECONNECT_DELAY);
  };

  globalSocket.onerror = (err) => {
    console.error("[ws] Ошибка:", err);
  };

  return globalSocket;
}

/**
 * Хук для подписки на WebSocket события.
 *
 * @param {string|string[]} types - тип(ы) события, например "incoming_call" или ["incoming_call","ocr_result"]
 * @param {function} handler - колбэк({ type, data, ts })
 *
 * @example
 * useWebSocket("incoming_call", ({ data }) => {
 *   toast.info(`Звонок: ${data.phone}`);
 * });
 */
export function useWebSocket(types, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const typesArr = Array.isArray(types) ? types : [types];

  const listener = useCallback((msg) => {
    if (typesArr.includes(msg.type)) {
      handlerRef.current(msg);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getSocket(); // инициируем соединение если ещё нет
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, [listener]);
}

// Для инициализации сокета при старте приложения (вызвать в App.jsx)
export function connectWebSocket() {
  getSocket();
}
