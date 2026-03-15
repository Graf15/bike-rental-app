import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ChangePasswordModal from "./ChangePasswordModal";
import { ROUTES } from "../constants/routes";
import { usePermissions } from "../context/PermissionsContext";
import { ChevronLeft, ChevronRight, User, KeyRound, LogOut } from "lucide-react";
import CallNotification from "./CallNotification";
import "./Layout.css";

const ICON_SIZE = 20;

const Layout = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { canAccess } = usePermissions();

  const menuItems = ROUTES.filter(route => canAccess(route.path, user?.role));

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="layout">
      <CallNotification />
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <button
            className="collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
          >
            {isCollapsed
              ? <ChevronRight size={16} />
              : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map(({ path, Icon, label }) => (
            <Link
              key={path}
              to={path}
              className={`nav-item ${location.pathname === path ? "active" : ""}`}
              title={isCollapsed ? label : ""}
            >
              <span className="nav-icon"><Icon size={ICON_SIZE} /></span>
              {!isCollapsed && <span className="nav-label">{label}</span>}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div style={{ padding: isCollapsed ? "12px 0" : "12px 16px" }}>
              {!isCollapsed && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#9ca3af", marginBottom: 4, overflow: "hidden" }}>
                  <User size={13} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</span>
                </div>
              )}
              {!isCollapsed && (
                <button
                  onClick={() => setShowChangePwd(true)}
                  style={{
                    width: "100%", padding: "6px 10px", borderRadius: 6, marginBottom: 4,
                    border: "1px solid #374151", background: "transparent",
                    color: "#9ca3af", fontSize: 12, cursor: "pointer",
                    textAlign: "left", display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <KeyRound size={13} /> Сменить пароль
                </button>
              )}
              <button
                onClick={handleLogout}
                title={isCollapsed ? "Выйти" : ""}
                style={{
                  width: "100%", padding: "7px 10px", borderRadius: 6,
                  border: "1px solid #374151", background: "transparent",
                  color: "#9ca3af", fontSize: 12, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  justifyContent: isCollapsed ? "center" : "flex-start",
                }}
              >
                <LogOut size={13} />
                {!isCollapsed && "Выйти"}
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
