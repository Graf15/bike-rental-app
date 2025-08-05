import React, { useState, useRef, useEffect } from "react";
import "./Popover.css";

const BikeActionsMenu = ({ bike, onEdit, onCreateMaintenance, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
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

  const handleAction = (action) => {
    switch (action) {
      case "edit":
        onEdit(bike);
        break;
      case "maintenance":
        onCreateMaintenance(bike.id);
        break;
      case "delete":
        if (
          window.confirm(`Удалить велосипед ${bike.bike_number || bike.model}?`)
        ) {
          onDelete(bike.id);
        }
        break;
    }
    setIsOpen(false);
  };

  const canCreateMaintenance = ![
    "в ремонте",
    "продан",
    "украден",
    "невозврат",
  ].includes(bike.status);

  return (
    <div className="actions-menu-container">
      <button
        ref={triggerRef}
        className="actions-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Действия"
      >
        ⋯
      </button>

      {isOpen && (
        <div ref={menuRef} className="actions-menu">
          <button className="menu-item" onClick={() => handleAction("edit")}>
            ✏️ Редактировать
          </button>

          {canCreateMaintenance && (
            <button
              className="menu-item"
              onClick={() => handleAction("maintenance")}
            >
              🔧 Отправить в ремонт
            </button>
          )}

          <div className="menu-divider"></div>

          <button
            className="menu-item danger"
            onClick={() => handleAction("delete")}
          >
            🗑️ Удалить
          </button>
        </div>
      )}
    </div>
  );
};

export default BikeActionsMenu;
