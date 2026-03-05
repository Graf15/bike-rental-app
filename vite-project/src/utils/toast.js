let listeners = new Set();
let idCounter = 0;

const emit = (type, message, duration = 4000) => {
  const id = ++idCounter;
  listeners.forEach(fn => fn({ id, type, message, duration }));
};

export const toast = {
  success: (msg, dur) => emit("success", msg, dur),
  error:   (msg, dur) => emit("error",   msg, dur),
  warn:    (msg, dur) => emit("warn",    msg, dur),
  info:    (msg, dur) => emit("info",    msg, dur),
};

export const subscribeToast = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
