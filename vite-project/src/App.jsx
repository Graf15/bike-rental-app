import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { PermissionsProvider } from "./context/PermissionsContext";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Layout from "./components/Layout";
import ToastContainer from "./components/ToastContainer";
import OverdueAlertsManager from "./components/OverdueAlertsManager";
import { ROUTES } from "./constants/routes";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Users from "./pages/Users";
import Parts from "./pages/Parts";
import Maintenance from "./pages/Maintenance";
import PartsRequests from "./pages/PartsRequests";
import RepairsSchedule from "./pages/RepairsSchedule";
import Customers from "./pages/Customers";
import Rentals from "./pages/Rentals";
import Tariffs from "./pages/Tariffs";
import Settings from "./pages/Settings";
import { connectWebSocket } from "./hooks/useWebSocket";
import "./App.css";

connectWebSocket();

const PAGE_COMPONENTS = {
  "/":                 <Home />,
  "/rentals":          <Rentals />,
  "/customers":        <Customers />,
  "/tariffs":          <Tariffs />,
  "/maintenance":      <Maintenance />,
  "/repairs-schedule": <RepairsSchedule />,
  "/parts":            <Parts />,
  "/parts-requests":   <PartsRequests />,
  "/users":            <Users />,
  "/analytics":        <div style={{ padding: 32 }}><h1>Аналитика и отчеты</h1><p>Страница в разработке...</p></div>,
  "/settings":         <Settings />,
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <PermissionsProvider>
          <ToastContainer />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <OverdueAlertsManager />
                <Layout>
                  <Routes>
                    {ROUTES.map(({ path }) => (
                      <Route
                        key={path}
                        path={path}
                        element={
                          <RoleRoute path={path}>
                            {PAGE_COMPONENTS[path]}
                          </RoleRoute>
                        }
                      />
                    ))}
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </PermissionsProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
