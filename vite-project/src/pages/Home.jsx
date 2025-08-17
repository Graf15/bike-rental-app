import React, { useEffect, useState } from "react";
import BikeTable from "../components/BikeTable";
import CreateMaintenanceModal from "../components/CreateMaintenanceModal";
import "./Home.css";

const Home = () => {
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [selectedBikeId, setSelectedBikeId] = useState(null);

  // Загрузка данных о велосипедах при монтировании компонента
  const fetchBikes = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/bikes");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setBikes(data);
    } catch (err) {
      console.error("Ошибка при загрузке:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBikes();
  }, []);

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

      // Обновляем список велосипедов, чтобы отразить изменения статуса
      await fetchBikes();

      return response.json();
    } catch (error) {
      console.error("Ошибка создания ремонта:", error);
      throw error;
    }
  };

  const handleOpenMaintenanceModal = (bikeId = null) => {
    setSelectedBikeId(bikeId);
    setIsMaintenanceModalOpen(true);
  };

  const handleCloseMaintenanceModal = () => {
    setIsMaintenanceModalOpen(false);
    setSelectedBikeId(null);
  };

  const handleBikeEdit = (bike) => {
    // Пока что просто показываем alert, позже можно реализовать модальное окно редактирования
    alert(
      `Редактирование велосипеда ${
        bike.bike_number || bike.model
      } пока не реализовано`
    );
  };

  if (loading) {
    return (
      <div className="home-page">
        <div className="page-header">
          <h1 className="page-title">Управление велосипедами</h1>
          <p className="page-subtitle">Загрузка данных...</p>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="home-page">
        <div className="page-header">
          <h1 className="page-title">Управление велосипедами</h1>
          <p className="page-subtitle">Произошла ошибка при загрузке данных</p>
        </div>
        <div className="error-message">
          <div className="error-icon">⚠️</div>
          <p>Ошибка: {error}</p>
          <button className="retry-button" onClick={fetchBikes}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">Управление велосипедами</h1>
          <p className="page-subtitle">
            Управляйте парком велосипедов, отслеживайте статус и планируйте
            обслуживание
          </p>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <div className="stat-number">{bikes.length}</div>
            <div className="stat-label">Всего велосипедов</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {bikes.filter((bike) => bike.status === "в наличии").length}
            </div>
            <div className="stat-label">В наличии</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {bikes.filter((bike) => bike.status === "в прокате").length}
            </div>
            <div className="stat-label">В прокате</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {bikes.filter((bike) => bike.status === "в ремонте").length}
            </div>
            <div className="stat-label">В ремонте</div>
          </div>
        </div>
      </div>

      <div className="page-content">
        <BikeTable
          bikes={bikes}
          onBikeUpdate={fetchBikes}
          onCreateMaintenance={handleOpenMaintenanceModal}
          onBikeEdit={handleBikeEdit}
        />
      </div>

      <CreateMaintenanceModal
        isOpen={isMaintenanceModalOpen}
        onClose={handleCloseMaintenanceModal}
        onSubmit={handleCreateMaintenance}
        selectedBikeId={selectedBikeId}
      />
    </div>
  );
};

export default Home;
