import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Users from "./pages/Users";
import Parts from "./pages/Parts";
import Maintenance from "./pages/Maintenance";
import PartsRequests from "./pages/PartsRequests";
import RepairsSchedule from "./pages/RepairsSchedule";
import "./App.css";

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          {/* Будущие страницы */}
          <Route
            path="/rentals"
            element={
              <div>
                <h1>Управление арендой</h1>
                <p>Страница в разработке...ntc</p>
              </div>
            }
          />
          <Route
            path="/customers"
            element={
              <div>
                <h1>База клиентов</h1>
                <p>Страница в разработке...</p>
              </div>
            }
          />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/parts" element={<Parts />} />
          <Route path="/parts-requests" element={<PartsRequests />} />
          <Route path="/users" element={<Users />} />
          <Route
            path="/analytics"
            element={
              <div>
                <h1>Аналитика и отчеты</h1>
                <p>Страница в разработке...</p>
              </div>
            }
          />
          <Route
            path="/settings"
            element={
              <div>
                <h1>Настройки системы</h1>
                <p>Страница в разработке...</p>
              </div>
            }
          />
          <Route path="/repairs-schedule" element={<RepairsSchedule />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
