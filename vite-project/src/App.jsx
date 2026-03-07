import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import ToastContainer from "./components/ToastContainer";
import OverdueAlertsManager from "./components/OverdueAlertsManager";
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
import "./App.css";

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastContainer />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <OverdueAlertsManager />
              <Layout>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/rentals" element={<Rentals />} />
                  <Route path="/tariffs" element={<Tariffs />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/maintenance" element={<Maintenance />} />
                  <Route path="/parts" element={<Parts />} />
                  <Route path="/parts-requests" element={<PartsRequests />} />
                  <Route path="/users" element={<Users />} />
                  <Route path="/repairs-schedule" element={<RepairsSchedule />} />
                  <Route path="/analytics" element={<div><h1>Аналитика и отчеты</h1><p>Страница в разработке...</p></div>} />
                  <Route path="/settings" element={<div><h1>Настройки системы</h1><p>Страница в разработке...</p></div>} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
