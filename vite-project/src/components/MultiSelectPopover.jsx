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
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
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