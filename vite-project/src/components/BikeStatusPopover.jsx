import React, { useState, useRef, useEffect } from "react";
import "./Popover.css";

const BikeStatusPopover = ({ bike, onStatusChange, onCreateMaintenance }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  const statuses = [
    { value: "в наличии", label: "в наличии", color: "green" },
    { value: "в прокате", label: "в прокате", color: "blue" },
    { value: "в ремонте", label: "в ремонте", color: "orange" },
    { value: "бронь", label: "бронь", color: "purple" },
    { value: "продан", label: "продан", color: "red" },
    { value: "украден", label: "украден", color: "red" },
    { value: "невозврат", label: "невозврат", color: "red" },
  ];

  const currentStatus = statuses.find((s) => s.value === bike.condition_status);

  const getStatusBadgeClass = (status) => {
    const statusObj = statuses.find(s => s.value === status);
    if (!statusObj) return "status-badge";
    return `status-badge status-badge-${statusObj.color}`;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverHeight = 300; // примерная высота поповера
      const popoverWidth = 200;
      
      let top = rect.bottom + 4;
      let left = rect.left;
      
      // Проверяем, не выходит ли поповер за пределы экрана
      if (left + popoverWidth > window.innerWidth) {
        left = window.innerWidth - popoverWidth - 10;
      }
      
      if (top + popoverHeight > window.innerHeight) {
        top = rect.top - popoverHeight - 4;
      }
      
      setPosition({ top, left });
    }
  }, [isOpen]);

  const handleStatusClick = (newStatus) => {
    if (newStatus === "в ремонте") {
      // Открываем модальное окно создания ремонта
      onCreateMaintenance(bike.id);
    } else {
      // Просто меняем статус
      onStatusChange(bike.id, newStatus);
    }
    setIsOpen(false);
  };

  return (
    <div className="status-popover-container">
      <button
        ref={triggerRef}
        className={`${getStatusBadgeClass(bike.condition_status)} clickable`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {currentStatus?.label || bike.condition_status}
        <span className="status-arrow">▼</span>
      </button>

      {isOpen && (
        <div 
          ref={popoverRef} 
          className="status-popover"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
        >
          <div className="popover-header">
            <span>Изменить статус</span>
          </div>
          <div className="status-options">
            {statuses.map((status) => (
              <button
                key={status.value}
                className={`status-option ${
                  status.value === bike.condition_status ? "current" : ""
                }`}
                onClick={() => handleStatusClick(status.value)}
              >
                <span
                  className={`status-indicator status-${status.color}`}
                ></span>
                {status.label}
                {status.value === bike.condition_status && (
                  <span className="current-mark">✓</span>
                )}
              </button>
            ))}
          </div>

          {bike.condition_status !== "в ремонте" && (
            <>
              <div className="popover-divider"></div>
              <div className="popover-actions">
                <button
                  className="action-button maintenance-action"
                  onClick={() => {
                    onCreateMaintenance(bike.id);
                    setIsOpen(false);
                  }}
                >
                  🔧 Отправить в ремонт
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default BikeStatusPopover;
