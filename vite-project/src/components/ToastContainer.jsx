import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { subscribeToast } from "../utils/toast";

const STYLES = {
  success: { bg: "#f0fdf4", border: "#86efac", color: "#166534", icon: "✓" },
  error:   { bg: "#fef2f2", border: "#fca5a5", color: "#991b1b", icon: "✕" },
  warn:    { bg: "#fffbeb", border: "#fcd34d", color: "#92400e", icon: "⚠" },
  info:    { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", icon: "ℹ" },
};

function ToastItem({ id, type, message, onRemove }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = STYLES[type] || STYLES.info;

  return (
    <div
      style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 14px", borderRadius: 8,
        background: s.bg, border: `1px solid ${s.border}`,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        maxWidth: 380, minWidth: 220,
        transform: visible ? "translateX(0)" : "translateX(110%)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.3s ease, opacity 0.3s ease",
        pointerEvents: "auto",
      }}
    >
      <span style={{ fontSize: 15, color: s.color, flexShrink: 0, lineHeight: 1.5, fontWeight: 700 }}>{s.icon}</span>
      <span style={{ fontSize: 13, color: s.color, lineHeight: 1.5, flex: 1 }}>{message}</span>
      <button
        onClick={onRemove}
        style={{ background: "none", border: "none", cursor: "pointer", color: s.color, opacity: 0.5, fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0, marginTop: 2 }}
      >✕</button>
    </div>
  );
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribeToast(({ id, type, message, duration }) => {
      setToasts(prev => [...prev, { id, type, message }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    });
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div style={{
      position: "fixed", top: 16, right: 16, zIndex: 99999,
      display: "flex", flexDirection: "column", gap: 8,
      pointerEvents: "none",
    }}>
      {toasts.map(t => (
        <ToastItem
          key={t.id}
          {...t}
          onRemove={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
        />
      ))}
    </div>,
    document.body
  );
}
