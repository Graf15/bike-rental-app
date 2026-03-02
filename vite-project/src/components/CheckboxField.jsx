/**
 * CheckboxField — стилизованный чекбокс «таблетка».
 *
 * Props:
 *   checked   {boolean}
 *   onChange  {(checked: boolean) => void}
 *   label     {string | ReactNode}
 *   id        {string}          — опционально, для htmlFor / атрибута id
 *   disabled  {boolean}
 *   className {string}          — доп. класс на обёртку
 */
const CheckboxField = ({ checked, onChange, label, id, disabled = false, className = "" }) => {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!disabled) onChange(!checked);
    }
  };

  return (
    <label className={`checkbox-field-label${className ? " " + className : ""}`}>
      <input
        type="checkbox"
        id={id}
        className="checkbox-field-input"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        onKeyDown={handleKeyDown}
      />
      {label}
    </label>
  );
};

export default CheckboxField;
