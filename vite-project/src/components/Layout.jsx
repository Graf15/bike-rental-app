import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ChangePasswordModal from "./ChangePasswordModal";
import "./Layout.css";


const Layout = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const location   = useLocation();
  const navigate   = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const menuItems = [
    { path: "/",                icon: "🚴", label: "Велосипеды" },
    { path: "/rentals",         icon: "📋", label: "Аренда" },
    { path: "/customers",       icon: "👥", label: "Клиенты" },
    { path: "/tariffs",         icon: "💰", label: "Тарифы" },
    { path: "/maintenance",     icon: "🔧", label: "Обслуживание" },
    { path: "/repairs-schedule",icon: "📅", label: "Планирование ремонтов" },
    { path: "/parts",           icon: "🔧", label: "Запчасти" },
    { path: "/parts-requests",  icon: "🛒", label: "Закупка запчастей" },
    { path: "/users",           icon: "👤", label: "Сотрудники" },
    { path: "/analytics",       icon: "📊", label: "Аналитика" },
    { path: "/settings",        icon: "⚙️", label: "Настройки" },
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
                <span className="nav-label">{item.label}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div style={{ padding: isCollapsed ? "12px 0" : "12px 16px" }}>
              {!isCollapsed && (
                <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  👤 {user.name}
                </div>
              )}
              {!isCollapsed && (
                <button
                  onClick={() => setShowChangePwd(true)}
                  style={{
                    width: "100%", padding: "6px 10px", borderRadius: 6, marginBottom: 4,
                    border: "1px solid #374151", background: "transparent",
                    color: "#9ca3af", fontSize: 12, cursor: "pointer", textAlign: "left",
                  }}
                >
                  🔑 Сменить пароль
                </button>
              )}
              <button
                onClick={handleLogout}
                style={{
                  width: "100%", padding: "7px 10px", borderRadius: 6,
                  border: "1px solid #374151", background: "transparent",
                  color: "#9ca3af", fontSize: 12, cursor: "pointer",
                  textAlign: isCollapsed ? "center" : "left",
                }}
              >
                {isCollapsed ? "↩" : "↩ Выйти"}
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className={`main-content ${isCollapsed ? "expanded" : ""}`}>
        <div className="content-wrapper">{children}</div>
      </main>

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </div>
  );
};

export default Layout;
