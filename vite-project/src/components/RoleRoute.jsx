import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionsContext";

const RoleRoute = ({ path, children }) => {
  const { user } = useAuth();
  const { canAccess } = usePermissions();

  if (canAccess(path, user?.role)) return children;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: "60vh", color: "#6b7280", gap: 8
    }}>
      <div style={{ fontSize: 64, fontWeight: 700, color: "#d1d5db" }}>403</div>
      <div style={{ fontSize: 16 }}>Нет доступа к этой странице</div>
      <div style={{ fontSize: 13 }}>Обратитесь к администратору</div>
    </div>
  );
};

export default RoleRoute;
