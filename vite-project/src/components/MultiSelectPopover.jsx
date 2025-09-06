import { useState, useRef, useEffect } from "react";
import "./Popover.css";

const MultiSelectPopover = ({
  options,
  selected,
  onChange,
  visible,
  anchorRef,
  onClose,
}) => {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [isPositioned, setIsPositioned] = useState(false);

  useEffect(() => {
    if (visible && anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popoverHeight = 250; // примерная высота поповера
      const popoverWidth = Math.max(rect.width, 200); // минимум 200px или ширина anchor
      
      let top = rect.bottom + 4;
      let left = rect.left;
      
      // Проверяем, не выходит ли поповер за правый край экрана
      if (left + popoverWidth > window.innerWidth) {
        left = window.innerWidth - popoverWidth - 10;
      }
      
      // Проверяем, не выходит ли поповер за нижний край экрана
      if (top + popoverHeight > window.innerHeight) {
        top = rect.top - popoverHeight - 4; // показываем сверху
      }
      
      // Проверяем, не выходит ли поповер за верхний край экрана
      if (top < 0) {
        top = rect.bottom + 4; // возвращаем вниз, но с прокруткой
      }
      
      setPosition({
        top,
        left,
        width: popoverWidth,
      });
      setIsPositioned(true);
    } else {
      setIsPositioned(false);
    }
  }, [anchorRef, visible]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [visible, onClose, anchorRef]);

  if (!visible || !isPositioned || !Array.isArray(options) || options.length === 0) return null;

  const toggleOption = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <>
      {isPositioned && <div className="popover-overlay" onClick={onClose} />}
      <div
        className="popover positioned"
        ref={popoverRef}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          minWidth: `${position.width}px`,
        }}
      >
        {options.map((option) => {
          const optionValue = typeof option === 'object' ? option.value : option;
          const optionLabel = typeof option === 'object' ? option.label : option;
          
          return (
            <div
              key={optionValue}
              className={`popover-option ${
                selected.includes(optionValue) ? "selected" : ""
              }`}
              onClick={() => toggleOption(optionValue)}
            >
              {optionLabel} {selected.includes(optionValue) && "✓"}
            </div>
          );
        })}
      </div>
    </>
  );
};

export default MultiSelectPopover;