import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useWebSocket } from "../hooks/useWebSocket";
import {
  PhoneIncoming, PhoneCall, PhoneMissed, PhoneOff,
  X, User, AlertTriangle, Medal, Cake, FileText,
} from "lucide-react";
import "./CallNotification.css";

const LABELS = {
  incoming: "Входящий звонок",
  active:   "Разговор",
  ended:    "Звонок завершён",
  missed:   "Пропущенный",
  outgoing: "Исходящий звонок",
};
const ICONS = {
  incoming: PhoneIncoming,
  active:   PhoneCall,
  ended:    PhoneOff,
  missed:   PhoneMissed,
};

function formatPhone(phone) {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("38"))
    return `+38 (${d.slice(2,5)}) ${d.slice(5,8)}-${d.slice(8,10)}-${d.slice(10)}`;
  if (d.length === 10)
    return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,8)}-${d.slice(8)}`;
  return phone;
}

function formatDuration(sec) {
  if (!sec) return null;
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m} хв ${s} с` : `${s} с`;
}

function isBirthday(birthDate) {
  if (!birthDate) return false;
  const bd = new Date(birthDate);
  const now = new Date();
  const diff = (now - new Date(now.getFullYear(), bd.getMonth(), bd.getDate())) / 86400000;
  return diff >= 0 && diff < 7;
}

const STATUS_LABELS = {
  active:     "Активен",
  no_booking: "Без броні",
  no_rental:  "Без прокату",
};

export default function CallNotification() {
  const [call, setCall]       = useState(null);
  const [visible, setVisible] = useState(false);
  const dismissTimer          = useRef(null);
  const navigate              = useNavigate();

  const show = (data) => {
    clearTimeout(dismissTimer.current);
    setCall(data);
    setVisible(true);
  };

  const dismiss = () => {
    clearTimeout(dismissTimer.current);
    setVisible(false);
  };

  useWebSocket("call_incoming", ({ data }) => show(data));
  useWebSocket("call_active",   ({ data }) => show(data));
  useWebSocket("call_missed",   ({ data }) => show(data));
  useWebSocket("call_ended",    ({ data }) => {
    // При завершении просто скрываем — инфа больше не нужна
    clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setVisible(false), 4000);
    setCall(data);
  });

  useEffect(() => () => clearTimeout(dismissTimer.current), []);

  if (!visible || !call) return null;

  const Icon       = ICONS[call.event] || PhoneIncoming;
  const customer   = call.customer;
  const contract   = customer?.active_contract;
  const stats      = customer?.stats;
  const birthday   = customer && isBirthday(customer.birth_date);
  const isFinished = call.event === "ended";

  const contractStatusLabel = {
    active:  "Активный прокат",
    booked:  "Есть бронь",
    overdue: "Просрочен!",
  };

  return (
    <div className={`call-notif call-notif--${call.event}`}>
      {/* Шапка */}
      <div className="call-notif-header">
        <div className="call-notif-icon">
          <Icon size={16} />
        </div>
        <span className="call-notif-title">{LABELS[call.event] || call.event}</span>
        {isFinished && call.duration_sec && (
          <span className="call-notif-duration">{formatDuration(call.duration_sec)}</span>
        )}
        <button className="call-notif-close" onClick={dismiss}><X size={13} /></button>
      </div>

      {/* Номер */}
      <div className="call-notif-phone">{formatPhone(call.phone)}</div>

      {/* Карточка клиента */}
      {customer ? (
        <>
          {/* Имя + статус */}
          <div className="call-notif-name-row">
            <User size={13} />
            <span className="call-notif-name">{customer.name}</span>
            {customer.status !== "active" && (
              <span className={`call-notif-badge call-notif-badge--${customer.status}`}>
                {STATUS_LABELS[customer.status] || customer.status}
              </span>
            )}
          </div>

          {/* Алерты */}
          <div className="call-notif-alerts">
            {customer.is_veteran && (
              <span className="call-notif-alert call-notif-alert--blue">
                <Medal size={11} /> УБД
              </span>
            )}
            {birthday && (
              <span className="call-notif-alert call-notif-alert--pink">
                <Cake size={11} /> Іменинник
              </span>
            )}
            {customer.no_show_count > 0 && (
              <span className="call-notif-alert call-notif-alert--orange">
                <AlertTriangle size={11} /> Неявки: {customer.no_show_count}
              </span>
            )}
          </div>

          {/* Статистика */}
          {stats && (
            <div className="call-notif-stats">
              <span>Прокатів: <b>{stats.completed_count}</b></span>
              {stats.active_count > 0 && <span className="call-notif-stat--active">Активних: <b>{stats.active_count}</b></span>}
              {stats.booked_count > 0 && <span>Бронювань: <b>{stats.booked_count}</b></span>}
            </div>
          )}

          {/* Активний договір */}
          {contract && (
            <div className={`call-notif-contract call-notif-contract--${contract.status}`}>
              <FileText size={12} />
              <span>{contractStatusLabel[contract.status] || contract.status}</span>
              <span className="call-notif-contract-id">№{contract.id}</span>
              {contract.items_count > 0 && <span>· {contract.items_count} од.</span>}
              <button
                className="call-notif-contract-link"
                onClick={() => { navigate(`/rentals?contract=${contract.id}`); dismiss(); }}
              >
                Відкрити →
              </button>
            </div>
          )}

          {/* Замечания */}
          {customer.restriction_reason && (
            <div className="call-notif-restriction">
              <AlertTriangle size={11} /> {customer.restriction_reason}
            </div>
          )}

          {/* Действия */}
          {!isFinished && (
            <div className="call-notif-actions">
              <button
                className="call-notif-btn call-notif-btn--primary"
                onClick={() => { navigate(`/rentals?booking=${customer.id}`); dismiss(); }}
              >
                Забронювати
              </button>
              <button
                className="call-notif-btn call-notif-btn--ghost"
                onClick={() => { navigate(`/customers?highlight=${customer.id}`); dismiss(); }}
              >
                Картка
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="call-notif-unknown">Клієнта не знайдено в базі</div>
          {!isFinished && (
            <div className="call-notif-actions">
              <button
                className="call-notif-btn call-notif-btn--primary"
                onClick={() => { navigate(`/customers?newPhone=${encodeURIComponent(call.phone)}`); dismiss(); }}
              >
                Додати клієнта
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
