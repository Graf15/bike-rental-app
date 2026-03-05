import { forwardRef, useImperativeHandle, useRef, useEffect } from "react";
import {
  DatePicker,
  DateInput,
  DateSegment,
  Button,
  Popover,
  Dialog,
  Calendar,
  CalendarGrid,
  CalendarGridHeader,
  CalendarGridBody,
  CalendarHeaderCell,
  CalendarCell,
  Heading,
  Group,
} from "react-aria-components";
import { parseDateTime, parseDate, CalendarDate } from "@internationalized/date";
import "./DateTimePickerField.css";

// ─── Конвертация ISO ↔ CalendarDateTime / CalendarDate ───────────────────
const toCalDT = (isoStr) => {
  if (!isoStr) return null;
  try { return parseDateTime(isoStr); } catch { return null; }
};

const toCalDate = (isoStr) => {
  if (!isoStr) return null;
  try { return parseDate(isoStr.slice(0, 10)); } catch { return null; }
};

const fromCalDT = (calDT) => {
  if (!calDT) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const padY = (y) => String(y).padStart(4, "0");
  return `${padY(calDT.year)}-${pad(calDT.month)}-${pad(calDT.day)}T${pad(calDT.hour)}:${pad(calDT.minute)}`;
};

const fromCalDate = (calDate) => {
  if (!calDate) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const padY = (y) => String(y).padStart(4, "0");
  return `${padY(calDate.year)}-${pad(calDate.month)}-${pad(calDate.day)}`;
};

const getNowCalDT = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return parseDateTime(
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

// ─── Слоты времени с шагом 30 минут (рабочие часы 8:00–22:00) ───────────
const TIME_SLOTS = [];
for (let h = 8; h <= 22; h++) {
  TIME_SLOTS.push({ hour: h, minute: 0,  label: `${String(h).padStart(2,"0")}:00` });
  if (h < 22)
    TIME_SLOTS.push({ hour: h, minute: 30, label: `${String(h).padStart(2,"0")}:30` });
}

// ─── Боковая панель времени ───────────────────────────────────────────────
const TimePanel = ({ calValue, onChange }) => {
  const listRef   = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current && listRef.current) {
      const itemH   = activeRef.current.offsetHeight;
      const listH   = listRef.current.offsetHeight;
      const itemTop = activeRef.current.offsetTop;
      listRef.current.scrollTop = itemTop - listH / 2 + itemH / 2;
    }
  }, []);

  const selectedH = calValue?.hour   ?? -1;
  const selectedM = calValue?.minute ?? -1;

  const handleClick = (hour, minute) => {
    const base = calValue ?? getNowCalDT();
    onChange(fromCalDT(base.set({ hour, minute })));
  };

  return (
    <div className="dt-time-panel" ref={listRef}>
      {TIME_SLOTS.map(({ hour, minute, label }) => {
        const isSelected = hour === selectedH && minute === selectedM;
        return (
          <button
            key={label}
            type="button"
            ref={isSelected ? activeRef : null}
            className={`dt-time-slot${isSelected ? " dt-time-slot--active" : ""}`}
            onClick={() => handleClick(hour, minute)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
};

// ─── Компонент ────────────────────────────────────────────────────────────
// granularity="minute" (по умолчанию) — дата + время + панель слотов
// granularity="day"                   — только дата, без времени
const DateTimePickerField = forwardRef(({ value, onChange, minDate, granularity = "minute" }, ref) => {
  const groupRef = useRef(null);
  const isDateOnly = granularity === "day";

  useImperativeHandle(ref, () => ({
    focus: () => groupRef.current?.querySelector("[data-type]")?.focus(),
  }));

  const calValue    = isDateOnly ? toCalDate(value)  : toCalDT(value);
  const minCalValue = isDateOnly
    ? (minDate ? toCalDate(minDate) : new CalendarDate(1, 1, 1))
    : ((minDate && toCalDT(minDate)) || getNowCalDT());

  const handleChange = (v) => {
    onChange(v ? (isDateOnly ? fromCalDate(v) : fromCalDT(v)) : "");
  };

  return (
    <DatePicker
      value={calValue}
      onChange={handleChange}
      minValue={minCalValue}
      granularity={granularity}
      {...(!isDateOnly && { hourCycle: 24 })}
      shouldCloseOnSelect={isDateOnly}
      aria-label="Выбор даты"
    >
      <Group ref={groupRef} className="form-input dt-field-group">
        <DateInput>
          {(segment) => <DateSegment segment={segment} />}
        </DateInput>
        <Button className="dt-cal-btn" aria-label="Открыть календарь">▾</Button>
      </Group>

      <Popover>
        <Dialog>
          <div className="dt-popover-inner">
            <Calendar>
              <header>
                <Button slot="previous">‹</Button>
                <Heading />
                <Button slot="next">›</Button>
              </header>
              <CalendarGrid>
                <CalendarGridHeader>
                  {(day) => <CalendarHeaderCell>{day}</CalendarHeaderCell>}
                </CalendarGridHeader>
                <CalendarGridBody>
                  {(date) => <CalendarCell date={date} />}
                </CalendarGridBody>
              </CalendarGrid>
            </Calendar>

            {!isDateOnly && <TimePanel calValue={calValue} onChange={onChange} />}
          </div>
        </Dialog>
      </Popover>
    </DatePicker>
  );
});

DateTimePickerField.displayName = "DateTimePickerField";
export default DateTimePickerField;
