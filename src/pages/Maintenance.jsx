import React, { useState, useEffect } from "react";
import MaintenanceTable from "../components/MaintenanceTable";
import CreateMaintenanceModal from "../components/CreateMaintenanceModal";
import "./Maintenance.css";

const Maintenance = () => {
  const [maintenanceEvents, setMaintenanceEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchMaintenanceEvents();
  }, []);

  const fetchMaintenanceEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/maintenance");
      if (!response.ok) {
        throw new Error("Ошибка при загрузке событий обслуживания");
      }
      const data = await response.json();
      setMaintenanceEvents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMaintenance = async (maintenanceData) => {
    try {
      const response = await fetch("/api/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(maintenanceData),
      });

      if (!response.ok) {
        throw new Error("Ошибка при создании события обслуживания");
      }

      // Обновляем статус велосипеда, если нужно
      if (maintenanceData.статус_ремонта === "в ремонте") {
        await fetch(`/api/bikes/${maintenanceData.bike_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: "в ремонте" }),
        });
      }

      // Перезагружаем данные
      await fetchMaintenanceEvents();

      return response.json();
    } catch (error) {
      console.error("Ошибка создания ремонта:", error);
      throw error;
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;

  return (
    <div className="maintenance-page">
      <div className="page-header">
        <h1>Обслуживание велосипедов</h1>
        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
          + Добавить событие
        </button>
      </div>

      <MaintenanceTable
        events={maintenanceEvents}
        onUpdate={fetchMaintenanceEvents}
      />

      <CreateMaintenanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateMaintenance}
      />
    </div>
  );
};

export default Maintenance;
