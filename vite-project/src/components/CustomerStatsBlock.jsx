import React from "react";

const fmt = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const LastLink = ({ label, entry, color }) => {
  if (!entry?.id) return null;
  return (
    <span style={{ color: color || "#6b7280" }}>
      {label}:{" "}
      <a
        href={`/rentals?open=${entry.id}`}
        target="_blank"
        rel="noreferrer"
        style={{ color: "inherit", textDecoration: "underline", textDecorationStyle: "dotted" }}
        title={`Открыть договор #${entry.id}`}
      >
        {fmt(entry.date) || `#${entry.id}`}
      </a>
    </span>
  );
};

const CustomerStatsBlock = ({ stats }) => {
  if (!stats) return null;
  const { completed, active, booked, cancelled, no_shows, total_revenue,
          last_completed, last_cancelled, last_no_show, last_booked, top_bikes } = stats;

  const hasAny = [completed, active, booked, cancelled, no_shows].some(v => parseInt(v) > 0);
  if (!hasAny) return null;

  return (
    <div style={{ marginTop: 6, padding: "8px 14px", background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, color: "#374151", display: "flex", flexWrap: "wrap", gap: "6px 20px", alignItems: "flex-start" }}>

      {/* Счётчики */}
      {parseInt(completed) > 0 && (
        <span>Завершено: <b>{completed}</b>{parseFloat(total_revenue) > 0 && <> · {Math.round(total_revenue)} ₴</>}</span>
      )}
      {parseInt(active) > 0 && (
        <span>Активных: <b>{active}</b></span>
      )}
      {parseInt(booked) > 0 && (
        <span>Броней: <b>{booked}</b></span>
      )}
      {parseInt(cancelled) > 0 && (
        <span style={{ color: "#9ca3af" }}>Отмен: <b>{cancelled}</b></span>
      )}
      {parseInt(no_shows) > 0 && (
        <span style={{ color: "var(--color-primary-red)" }}>Неявок: <b>{no_shows}</b></span>
      )}

      {/* Последние события */}
      {(last_completed || last_cancelled || last_no_show || last_booked) && (
        <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: "4px 16px", marginTop: 2, paddingTop: 6, borderTop: "1px solid #e5e7eb", color: "#6b7280" }}>
          <LastLink label="Последний завершённый" entry={last_completed} />
          <LastLink label="Последняя отмена" entry={last_cancelled} />
          <LastLink label="Последняя неявка" entry={last_no_show} color="var(--color-primary-red)" />
          <LastLink label="Последняя бронь" entry={last_booked} />
        </div>
      )}

      {/* Топ велосипеды */}
      {top_bikes?.length > 0 && (
        <div style={{ width: "100%", color: "#6b7280", display: "flex", flexDirection: "column", gap: 2, marginTop: 2, paddingTop: 6, borderTop: "1px solid #e5e7eb" }}>
          <span style={{ fontWeight: 500, color: "#9ca3af" }}>Топ велосипеды:</span>
          {top_bikes.map((b, i) => (
            <span key={b.id}>
              {i + 1}. {[b.internal_article, b.model, b.frame_size && `р.${b.frame_size}`, b.tariff_name].filter(Boolean).join(" · ")} <b>×{b.times}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerStatsBlock;
