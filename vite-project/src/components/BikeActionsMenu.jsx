import React, { useState, useRef, useEffect } from "react";
import "./Popover.css";

const BikeActionsMenu = ({ bike, onEdit, onCopy, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
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

  // Вычисляем позицию меню
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 120; // примерная высота меню
      const menuWidth = 160;

      let top = rect.bottom + 4;
      let left = rect.right - menuWidth; // позиционируем справа от кнопки

      // Проверяем, не выходит ли меню за пределы экрана
      if (left < 10) {
        left = rect.left;
      }

      if (top + menuHeight > window.innerHeight) {
        top = rect.top - menuHeight - 4;
      }

      setPosition({ top, left });
    }
  }, [isOpen]);

  const handleAction = (action) => {
    switch (action) {
      case "edit":
        onEdit(bike);
        break;
      case "copy":
        onCopy(bike);
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
        <div
          ref={menuRef}
          className="actions-menu"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}>
          <button className="menu-item" onClick={() => handleAction("edit")}>
            ✏️ Редактировать
          </button>

          <button className="menu-item" onClick={() => handleAction("copy")}>
            📋 Копировать
          </button>

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
