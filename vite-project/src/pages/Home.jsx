import React, { useEffect, useState } from "react";
import BikeTable from "../components/BikeTable";
import BikeModal from "../components/BikeModal";
import "./Home.css";

const Home = () => {
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const [isAddBikeModalOpen, setIsAddBikeModalOpen] = useState(false);
  const [isEditBikeModalOpen, setIsEditBikeModalOpen] = useState(false);
  const [editingBike, setEditingBike] = useState(null);

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


  const handleBikeEdit = (bike) => {
    setEditingBike(bike);
    setIsEditBikeModalOpen(true);
  };

  const handleBikeCopy = (bike) => {
    // Создаем копию данных велосипеда с префиксом (КОПИЯ)
    const copiedBike = {
      ...bike,
      model: `(КОПИЯ) ${bike.model}`,
      internal_article: '', // Очищаем артикул чтобы избежать дублирования
      frame_number: '', // Очищаем номер рамы чтобы избежать дублирования
    };
    setEditingBike(copiedBike);
    setIsAddBikeModalOpen(true); // Открываем в режиме создания
  };

  const handleOpenAddBikeModal = () => {
    setIsAddBikeModalOpen(true);
  };

  const handleCloseAddBikeModal = () => {
    setIsAddBikeModalOpen(false);
    setEditingBike(null); // Очищаем данные при закрытии
  };

  const handleCloseEditBikeModal = () => {
    setIsEditBikeModalOpen(false);
    setEditingBike(null);
  };

  const handleCreateBike = async (bikeData) => {
    try {
      const response = await fetch("/api/bikes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bikeData),
      });

      if (!response.ok) {
        throw new Error("Ошибка при создании велосипеда");
      }

      // Обновляем список велосипедов
      await fetchBikes();

      return response.json();
    } catch (error) {
      console.error("Ошибка создания велосипеда:", error);
      throw error;
    }
  };

  const handleUpdateBike = async (bikeData) => {
    try {
      const response = await fetch(`/api/bikes/${editingBike.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bikeData),
      });

      if (!response.ok) {
        throw new Error("Ошибка при обновлении велосипеда");
      }

      // Обновляем список велосипедов
      await fetchBikes();

      return response.json();
    } catch (error) {
      console.error("Ошибка обновления велосипеда:", error);
      throw error;
    }
  };

  const handleBikeDelete = async (bikeId) => {
    try {
      const response = await fetch(`/api/bikes/${bikeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Ошибка при удалении велосипеда");
      }

      // Обновляем список велосипедов
      await fetchBikes();
    } catch (error) {
      console.error("Ошибка удаления велосипеда:", error);
      alert("Ошибка: " + error.message);
    }
  };

  // Функция для получения статистики статусов с цветами
  const getStatusStats = () => {
    const statusMap = {
      "в наличии": { color: "green", label: "в наличии" },
      "в прокате": { color: "blue", label: "в прокате" }, 
      "в ремонте": { color: "orange", label: "в ремонте" },
      "бронь": { color: "purple", label: "бронь" },
      "продан": { color: "red", label: "продан" },
      "украден": { color: "red", label: "украден" },
      "невозврат": { color: "red", label: "невозврат" },
      "требует ремонта": { color: "red", label: "требует ремонта" }
    };

    const statusCounts = {};
    
    bikes.forEach(bike => {
      if (statusCounts[bike.condition_status]) {
        statusCounts[bike.condition_status]++;
      } else {
        statusCounts[bike.condition_status] = 1;
      }
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      color: statusMap[status]?.color || "gray",
      label: statusMap[status]?.label || status
    }));
  };

  // Функция для обработки клика по карточке статуса
  const handleStatusClick = (status) => {
    if (statusFilter === status) {
      // Если уже выбран этот статус, убираем фильтр
      setStatusFilter(null);
    } else {
      // Устанавливаем новый фильтр
      setStatusFilter(status);
    }
  };

  if (loading) {
    return (
      <div className="page-container home-page">
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
      <div className="page-container home-page">
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
    <div className="page-container home-page">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">Управление велосипедами</h1>
          <p className="page-subtitle">
            Управляйте парком велосипедов, отслеживайте статус и планируйте
            обслуживание
          </p>
        </div>
        <div className="header-right">
          <div className="header-stats">
            {getStatusStats().map(({ status, count, color, label }) => (
              <div 
                key={status} 
                className={`stat-card ${statusFilter === status ? 'active' : ''}`}
                onClick={() => handleStatusClick(status)}
              >
                <div className="stat-content">
                  <span 
                    className="status-indicator"
                    style={{ backgroundColor: `var(--color-primary-${color})` }}
                  ></span>
                  <div className="stat-info">
                    <div className="stat-number">{count}</div>
                    <div className="stat-label">{label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="header-right-bottom">
            <button 
              className="btn btn-primary-green add-bike-btn"
              onClick={handleOpenAddBikeModal}
            >
              + Добавить велосипед
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        <BikeTable
          bikes={bikes}
          onBikeUpdate={fetchBikes}
          onBikeEdit={handleBikeEdit}
          onBikeCopy={handleBikeCopy}
          onBikeDelete={handleBikeDelete}
          statusFilter={statusFilter}
        />
      </div>


      <BikeModal
        isOpen={isAddBikeModalOpen}
        onClose={handleCloseAddBikeModal}
        onSubmit={handleCreateBike}
        mode="create"
        bikeData={editingBike} // Передаем данные для копирования
      />

      <BikeModal
        isOpen={isEditBikeModalOpen}
        onClose={handleCloseEditBikeModal}
        onSubmit={handleUpdateBike}
        mode="edit"
        bikeData={editingBike}
      />
    </div>
  );
};

export default Home;
