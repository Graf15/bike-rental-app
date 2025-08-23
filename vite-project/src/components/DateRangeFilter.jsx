import React, { useState, useRef, useEffect } from 'react';
import './DateRangeFilter.css';

const DateRangeFilter = ({ value, onChange, anchorRef }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [tempDateFrom, setTempDateFrom] = useState(value?.from || '');
  const [tempDateTo, setTempDateTo] = useState(value?.to || '');
  const popoverRef = useRef(null);
  const internalAnchorRef = useRef(null);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target) &&
        internalAnchorRef.current && 
        !internalAnchorRef.current.contains(event.target)
      ) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleApply = () => {
    const newValue = {};
    if (tempDateFrom) newValue.from = tempDateFrom;
    if (tempDateTo) newValue.to = tempDateTo;
    
    // Если оба поля пустые, передаем null для сброса фильтра
    onChange(Object.keys(newValue).length > 0 ? newValue : null);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempDateFrom('');
    setTempDateTo('');
    onChange(null);
    setIsOpen(false);
  };

  const handleClose = () => {
    // Восстанавливаем значения при отмене
    setTempDateFrom(value?.from || '');
    setTempDateTo(value?.to || '');
    setIsOpen(false);
  };

  const formatDisplayValue = () => {
    if (!value || Object.keys(value).length === 0) return 'Все даты';
    
    const parts = [];
    if (value.from) parts.push(new Date(value.from).toLocaleDateString('ru-RU'));
    if (value.to) parts.push(new Date(value.to).toLocaleDateString('ru-RU'));
    
    return parts.join(' — ');
  };

  // Позиционирование поповера
  const getPopoverPosition = () => {
    if (!internalAnchorRef.current) return {};
    
    const rect = internalAnchorRef.current.getBoundingClientRect();
    const popoverHeight = 200; // Примерная высота поповера
    const viewportHeight = window.innerHeight;
    
    let top = rect.bottom + window.scrollY;
    let left = rect.left + window.scrollX;
    
    // Проверяем, помещается ли поповер снизу
    if (rect.bottom + popoverHeight > viewportHeight) {
      top = rect.top + window.scrollY - popoverHeight;
    }
    
    return {
      position: 'fixed',
      top: rect.bottom,
      left: rect.left,
      zIndex: 1201,
      minWidth: rect.width
    };
  };

  return (
    <>
      <div
        ref={(el) => {
          internalAnchorRef.current = el;
          if (anchorRef) anchorRef(el);
        }}
        onClick={() => setIsOpen(!isOpen)}
        className="filter-select-box date-range-filter"
      >
        <span>{formatDisplayValue()}</span>
        <span className="arrow">📅</span>
      </div>

      {isOpen && (
        <>
          <div className="popover-overlay" />
          <div
            ref={popoverRef}
            className="date-range-popover"
            style={getPopoverPosition()}
          >
            <div className="date-range-content">
              <div className="date-input-group">
                <label>С даты:</label>
                <input
                  type="date"
                  value={tempDateFrom}
                  onChange={(e) => setTempDateFrom(e.target.value)}
                  max={tempDateTo || undefined}
                />
              </div>
              
              <div className="date-input-group">
                <label>До даты:</label>
                <input
                  type="date"
                  value={tempDateTo}
                  onChange={(e) => setTempDateTo(e.target.value)}
                  min={tempDateFrom || undefined}
                />
              </div>
              
              <div className="date-range-actions">
                <button 
                  type="button" 
                  className="btn-clear"
                  onClick={handleClear}
                >
                  Очистить
                </button>
                <button 
                  type="button" 
                  className="btn-apply"
                  onClick={handleApply}
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default DateRangeFilter;