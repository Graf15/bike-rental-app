// Обёртка над fetch — автоматически передаёт cookie сессии
export const apiFetch = (url, options = {}) =>
  fetch(url, { ...options, credentials: "include" });
