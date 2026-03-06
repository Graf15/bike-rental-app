import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "./ConfirmModal";
import { useConfirm } from "../utils/useConfirm";
import { toast } from "../utils/toast";

// Стадии по минутам просрочки
const getStage = (minutes) => {
  if (minutes >= 60)  return 3;
  if (minutes >= 30)  return 2;
  return 1;
};

const stageLabel = (stage) => {
  if (stage === 1) return "опаздывает на 15+ мин";
  if (stage === 2) return "опаздывает на 30+ мин";
  return "опаздывает уже час!";
};

const formatTime = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const customerName = (alert) =>
  [alert.last_name, alert.first_name].filter(Boolean).join(" ") || alert.phone;

// Ключ в localStorage: contractId → последняя показанная стадия
const STORAGE_KEY = "overdueAlertStages";

const getShownStages = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
};
const setShownStage = (contractId, stage) => {
  const map = getShownStages();
  map[contractId] = stage;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};
const clearShownStage = (contractId) => {
  const map = getShownStages();
  delete map[contractId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

export default function OverdueAlertsManager() {
  const [pendingAlert, setPendingAlert] = useState(null); // текущий диалог
  const queueRef = useRef([]);                            // очередь диалогов
  const [confirmProps, showConfirm] = useConfirm();
  const [hoveredBtn, setHoveredBtn] = useState(null);
  const navigate = useNavigate();

  const showNextInQueue = () => {
    if (queueRef.current.length === 0) return;
    const next = queueRef.current.shift();
    setPendingAlert(next);
  };

  const handleAction = async (alert, action) => {
    setPendingAlert(null);
    if (action === "wait") {
      // Менеджер решил ждать — не показываем эту стадию снова
      setShownStage(alert.id, getStage(alert.minutes_overdue));
      setTimeout(showNextInQueue, 300);
      return;
    }

    const status = action === "no_show" ? "no_show" : "cancelled";
    try {
      const res = await fetch(`/api/rentals/${alert.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Ошибка запроса");
      clearShownStage(alert.id);
      window.dispatchEvent(new CustomEvent("rentals-changed"));
      if (action === "no_show") {
        toast.warn(`Бронь #${alert.id} (${customerName(alert)}): зафиксирована неявка`);
      } else {
        toast.success(`Бронь #${alert.id} (${customerName(alert)}): отменена без штрафа`);
      }
    } catch {
      toast.error("Не удалось обновить бронь");
    }
    setTimeout(showNextInQueue, 300);
  };

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/rentals/overdue-alerts");
        if (!res.ok) return;
        const alerts = await res.json();
        const shownStages = getShownStages();

        const toShow = alerts.filter(alert => {
          const stage = getStage(parseFloat(alert.minutes_overdue));
          const lastShown = shownStages[alert.id] || 0;
          return stage > lastShown;
        });

        // Добавляем в очередь новые алерты (без дублей)
        const existingIds = new Set(queueRef.current.map(a => a.id));
        toShow.forEach(alert => {
          if (!existingIds.has(alert.id)) {
            queueRef.current.push(alert);
          }
        });

        // Запускаем показ если нет активного диалога
        if (!pendingAlert && queueRef.current.length > 0) {
          showNextInQueue();
        }
      } catch { /* сеть недоступна */ }
    };

    poll(); // сразу при маунте
    const interval = setInterval(poll, 60 * 1000); // каждую минуту
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pendingAlert) return confirmProps ? <ConfirmModal {...confirmProps} /> : null;

  const stage = getStage(parseFloat(pendingAlert.minutes_overdue));
  const bikes = pendingAlert.bikes?.map(b => b.internal_article).filter(Boolean).join(", ") || "—";
  const isUrgent = stage === 3;
  const accentColor = isUrgent ? "var(--color-primary-red)" : "var(--color-primary-orange)";

  const btnBase = {
    padding: "9px 16px", borderRadius: 7, cursor: "pointer",
    fontSize: 14, textAlign: "left", transition: "background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s",
  };

  return (
    <>
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          background: "white", borderRadius: 12, padding: "28px 32px", maxWidth: 460, width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          borderTop: `4px solid ${accentColor}`,
        }}>
          <div style={{ fontSize: 22, marginBottom: 6 }}>{isUrgent ? "🔴" : "⏰"}</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            {customerName(pendingAlert)} — {stageLabel(stage)}
          </div>
          <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 4, lineHeight: 1.6 }}>
            Бронь #{pendingAlert.id} · начало в {formatTime(pendingAlert.booked_start)}<br />
            {pendingAlert.phone && <span>📞 {pendingAlert.phone}<br /></span>}
            Велосипеды: {bikes}
          </div>
          <button
            onClick={() => { setPendingAlert(null); navigate(`/rentals?open=${pendingAlert.id}`); }}
            style={{ background: "none", border: "none", padding: 0, color: "var(--color-primary-green)", fontSize: 13, cursor: "pointer", marginBottom: 16, textDecoration: "underline" }}
          >
            Открыть договор →
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => handleAction(pendingAlert, "wait")}
              onMouseEnter={() => setHoveredBtn("wait")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                ...btnBase, border: "1px solid #d1d5db",
                background: hoveredBtn === "wait" ? "#f9fafb" : "white",
                color: "#374151",
                boxShadow: hoveredBtn === "wait" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              }}
            >
              ⏳ Ожидаем, клиент предупредил
            </button>
            <button
              onClick={() => handleAction(pendingAlert, "cancel")}
              onMouseEnter={() => setHoveredBtn("cancel")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                ...btnBase, border: `1px solid var(--color-primary-orange)`,
                background: hoveredBtn === "cancel" ? "var(--color-primary-orange-light-background)" : "white",
                color: "var(--color-primary-orange-hover)",
                fontWeight: hoveredBtn === "cancel" ? 600 : 400,
              }}
            >
              Отменить бронь (без штрафа)
            </button>
            <button
              onClick={() => handleAction(pendingAlert, "no_show")}
              onMouseEnter={() => setHoveredBtn("no_show")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                ...btnBase, border: "none", fontWeight: 600,
                background: hoveredBtn === "no_show" ? "#c0392b" : "var(--color-primary-red)",
                color: "white",
                boxShadow: hoveredBtn === "no_show" ? "0 2px 8px rgba(192,57,43,0.35)" : "none",
              }}
            >
              Не явился — зафиксировать неявку (+штраф)
            </button>
          </div>

          {queueRef.current.length > 0 && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
              Ещё {queueRef.current.length} уведомл.
            </div>
          )}
        </div>
      </div>
      {confirmProps && <ConfirmModal {...confirmProps} />}
    </>
  );
}
