import { useState, useRef, useEffect } from "react";
import DateTimePickerField from "./DateTimePickerField";

const formatDisplay = (value) => {
  if (!value || (!value.from && !value.to)) return "Все даты";
  const fmt = (s) => new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (value.from && value.to) return `${fmt(value.from)} — ${fmt(value.to)}`;
  if (value.from) return `с ${fmt(value.from)}`;
  return `до ${fmt(value.to)}`;
};

const DateRangePickerFilter = ({ value, onChange }) => {
  const [isOpen, setIsOpen]       = useState(false);
  const [tempFrom, setTempFrom]   = useState(value?.from || "");
  const [tempTo, setTempTo]       = useState(value?.to   || "");
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  // Sync internal state when value changes externally (e.g. clear filters)
  useEffect(() => {
    setTempFrom(value?.from || "");
    setTempTo(value?.to || "");
  }, [value?.from, value?.to]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e) => {
      if (
        popoverRef.current  && !popoverRef.current.contains(e.target) &&
        triggerRef.current  && !triggerRef.current.contains(e.target)
      ) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const getPosition = () => {
    if (!triggerRef.current) return {};
    const r   = triggerRef.current.getBoundingClientRect();
    const W   = 240;
    const popH = 260;

    // Вертикально: открываем вниз, если не влезает — вверх
    const top = r.bottom + popH > window.innerHeight ? r.top - popH - 4 : r.bottom + 4;

    // Горизонтально: выравниваем по левому краю триггера, но если не влезает справа — по правому
    const left = r.left + W > window.innerWidth ? r.right - W : r.left;

    return { position: "fixed", top, left, zIndex: 1300, width: W };
  };

  const handleApply = () => {
    const next = {};
    if (tempFrom) next.from = tempFrom;
    if (tempTo)   next.to   = tempTo;
    onChange(Object.keys(next).length ? next : null);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempFrom("");
    setTempTo("");
    onChange(null);
    setIsOpen(false);
  };

  const isActive = value && (value.from || value.to);

  return (
    <>
      <div
        ref={triggerRef}
        className="filter-select-box date-range-filter"
        onClick={() => setIsOpen(o => !o)}
        style={isActive ? { borderColor: "var(--color-primary-green)", color: "var(--color-primary-green)" } : {}}
      >
        <span style={{ fontSize: 13 }}>{formatDisplay(value)}</span>
        <span className="arrow">📅</span>
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          className="popover positioned"
          style={{ ...getPosition(), padding: 16 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>С даты</div>
              <DateTimePickerField
                value={tempFrom}
                onChange={setTempFrom}
                granularity="day"
                minDate={null}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>По дату</div>
              <DateTimePickerField
                value={tempTo}
                onChange={setTempTo}
                granularity="day"
                minDate={null}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-secondary-green btn-primary-small"
                onClick={handleClear}
              >
                Очистить
              </button>
              <button
                type="button"
                className="btn btn-primary-green btn-primary-small"
                onClick={handleApply}
              >
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DateRangePickerFilter;
