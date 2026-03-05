import React from "react";
import "./Modal.css";

const ConfirmModal = ({ title, message, confirmLabel = "Подтвердить", cancelLabel = "Отмена", danger = false, onConfirm, onCancel }) => (
  <div className="modal-overlay" style={{ zIndex: 1500 }} onMouseDown={e => e.target === e.currentTarget && onCancel()}>
    <div onClick={e => e.stopPropagation()}
      style={{ background: "white", borderRadius: 12, padding: "28px 28px 24px", maxWidth: 420, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
      {title && (
        <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: message ? 8 : 20 }}>
          {title}
        </div>
      )}
      {message && (
        <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, lineHeight: 1.5 }}>
          {message}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
        <button type="button" className="btn btn-primary-small" onClick={onCancel}
          style={{ background: "white", color: "#6b7280", border: "1px solid #d1d5db" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#374151"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#6b7280"; }}>
          {cancelLabel}
        </button>
        <button type="button"
          className={danger ? "btn btn-primary-small" : "btn btn-primary-green btn-primary-small"}
          style={danger ? { background: "var(--color-primary-red)", color: "white", border: "none" } : {}}
          onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmModal;
