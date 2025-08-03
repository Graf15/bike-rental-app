import React, { useState, useRef, useEffect } from "react";
import "./Popover.css";

const BikeStatusPopover = ({ bike, onStatusChange, onCreateMaintenance }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);

  const statuses = [
    { value: "в наличии", label: "В наличии", color: "green" },
    { value: "в прокате", label: "В прокате", color: "blue" },
    { value: "в ремонте", label: "В ремонте", color: "yellow" },
    { value: "бронь", label: "Бронь", color: "purple" },
    { value: "продан", label: "Продан", color: "red" },
    { value: "украден", label: "Украден", color: "red" },
    { value: "невозврат", label: "Невозврат", color: "red" },
  ];

  const currentStatus = statuses.find((s) => s.value === bike.status);

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
        className={`status-badge status-${bike.status.replace(
          /\s+/g,
          "-"
        )} status-clickable`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {currentStatus?.label || bike.status}
        <span className="status-arrow">▼</span>
      </button>

      {isOpen && (
        <div ref={popoverRef} className="status-popover">
          <div className="popover-header">
            <span>Изменить статус</span>
          </div>
          <div className="status-options">
            {statuses.map((status) => (
              <button
                key={status.value}
                className={`status-option ${
                  status.value === bike.status ? "current" : ""
                }`}
                onClick={() => handleStatusClick(status.value)}
              >
                <span
                  className={`status-indicator status-${status.color}`}
                ></span>
                {status.label}
                {status.value === bike.status && (
                  <span className="current-mark">✓</span>
                )}
              </button>
            ))}
          </div>

          {bike.status !== "в ремонте" && (
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
