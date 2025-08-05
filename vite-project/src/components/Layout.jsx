import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Layout.css";


const Layout = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const menuItems = [
    {
      path: "/",
      icon: "🚴",
      label: "Велосипеды",
      description: "Управление парком",
    },
    {
      path: "/rentals",
      icon: "📋",
      label: "Аренда",
      description: "Активные прокаты",
    },
    {
      path: "/customers",
      icon: "👥",
      label: "Клиенты",
      description: "База клиентов",
    },
    {
      path: "/maintenance",
      icon: "🔧",
      label: "Обслуживание",
      description: "Техническое обслуживание",
    },
    {
      path: "/repairs-schedule",
      icon: "📅",
      label: "Планирование ремонтов",
      description: "Еженедельное расписание ТО",
    },
    {
      path: "/parts",
      icon: "🔧",
      label: "Запчасти",
      description: "Склад запчастей",
    },
    {
      path: "/parts-requests",
      icon: "🛒",
      label: "Закупкак запчастей",
      description: "Закупкак запчастей",
    },
    {
      path: "/users",
      icon: "👥",
      label: "Менеджеры",
      description: "Менеджеры",
    },
    {
      path: "/analytics",
      icon: "📊",
      label: "Аналитика",
      description: "Отчеты и статистика",
    },
    {
      path: "/settings",
      icon: "⚙️",
      label: "Настройки",
      description: "Конфигурация системы",
    },
  ];

  return (
    <div className="layout">
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <button
            className="collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {isCollapsed ? "→" : "←"}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${
                location.pathname === item.path ? "active" : ""
              }`}
              title={isCollapsed ? item.label : ""}
            >
              <span className="nav-icon">{item.icon}</span>
              {!isCollapsed && (
                <div className="nav-content">
                  <span className="nav-label">{item.label}</span>
                  <span className="nav-description">{item.description}</span>
                </div>
              )}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className={`user-info ${isCollapsed ? "collapsed" : ""}`}>
            <div className="user-avatar">👤</div>
            {!isCollapsed && (
              <div className="user-details">
                <span className="user-name">Администратор</span>
                <span className="user-role">Система управления</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      <main className={`main-content ${isCollapsed ? "expanded" : ""}`}>
        <div className="content-wrapper">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
