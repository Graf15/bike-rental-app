import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const DatePickerPortal = ({ children }) => createPortal(children, document.body);

const parseLocalStr = (str) => {
  if (!str) return null;
  const [datePart, timePart] = str.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) return null;
  return new Date(year, month - 1, day, hours, minutes);
};

const toLocalStr = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const filterTime = (time) => new Date(time).getTime() >= new Date().getTime();

const DateTimePickerField = forwardRef(({ value, onChange, placeholder = "дд.мм.рррр чч:хх", minDate }, ref) => {
  const pickerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => pickerRef.current?.setFocus(),
  }));

  const dateValue = parseLocalStr(value);
  const minDateObj = minDate ? parseLocalStr(minDate) || new Date() : null;

  const handleChange = (date) => {
    if (!date) { onChange(""); return; }
    onChange(toLocalStr(date));
  };

  return (
    <DatePicker
      ref={pickerRef}
      selected={dateValue}
      onChange={handleChange}
      showTimeSelect
      timeIntervals={30}
      timeFormat="HH:mm"
      dateFormat="dd.MM.yyyy HH:mm"
      placeholderText={placeholder}
      minDate={minDateObj}
      filterTime={filterTime}
      className="form-input"
      wrapperClassName="date-picker-wrapper"
      popperPlacement="bottom-start"
      popperContainer={DatePickerPortal}
    />
  );
});

DateTimePickerField.displayName = "DateTimePickerField";

export default DateTimePickerField;
