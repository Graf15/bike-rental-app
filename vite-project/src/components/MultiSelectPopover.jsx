import { useState, useRef, useEffect } from "react";
import "./Popover.css";

const MultiSelectPopover = ({
  options,
  selected,
  onChange,
  visible,
  anchorRef,
  onClose,
  singleSelect = false,
}) => {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [isPositioned, setIsPositioned] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const optionRefs = useRef([]);

  useEffect(() => {
    if (visible && anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popoverHeight = 250;
      const popoverWidth = Math.max(rect.width, 200);

      let top = rect.bottom + 4;
      let left = rect.left;

      if (left + popoverWidth > window.innerWidth) {
        left = window.innerWidth - popoverWidth - 10;
      }
      if (top + popoverHeight > window.innerHeight) {
        top = rect.top - popoverHeight - 4;
      }
      if (top < 0) {
        top = rect.bottom + 4;
      }

      setPosition({ top, left, width: popoverWidth });
      setIsPositioned(true);
      setFocusedIdx(-1);
    } else {
      setIsPositioned(false);
    }
  }, [anchorRef, visible]);

  // Фокус на поповер при открытии для перехвата клавиш
  useEffect(() => {
    if (isPositioned && popoverRef.current) {
      popoverRef.current.focus();
    }
  }, [isPositioned]);

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

  // Скролл к сфокусированному элементу
  useEffect(() => {
    if (focusedIdx >= 0 && optionRefs.current[focusedIdx]) {
      optionRefs.current[focusedIdx].scrollIntoView({ block: "nearest" });
    }
  }, [focusedIdx]);

  if (!visible || !isPositioned || !Array.isArray(options) || options.length === 0) return null;

  const toggleOption = (value) => {
    if (singleSelect) {
      onChange([value]);
      onClose();
      return;
    }
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx(i => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusedIdx >= 0) {
        const opt = options[focusedIdx];
        toggleOption(typeof opt === "object" ? opt.value : opt);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <>
      {isPositioned && <div className="popover-overlay" onClick={onClose} />}
      <div
        className="popover positioned"
        ref={popoverRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          minWidth: `${position.width}px`,
          outline: "none",
        }}
      >
        {options.map((option, idx) => {
          const optionValue = typeof option === "object" ? option.value : option;
          const optionLabel = typeof option === "object" ? option.label : option;

          return (
            <div
              key={optionValue}
              ref={el => optionRefs.current[idx] = el}
              className={`popover-option${selected.includes(optionValue) ? " selected" : ""}${focusedIdx === idx ? " focused" : ""}`}
              onClick={() => toggleOption(optionValue)}
              onMouseEnter={() => setFocusedIdx(idx)}
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
