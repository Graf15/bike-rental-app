import { apiFetch } from "../utils/api";
import React, { useEffect, useState } from "react";
import TariffsTable from "../components/TariffsTable";
import TariffModal from "../components/TariffModal";
import ConfirmModal from "../components/ConfirmModal";
import { useConfirm } from "../utils/useConfirm";

const Tariffs = () => {
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState(null);
  const [confirmProps, showConfirm] = useConfirm();

  const fetchTariffs = async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/api/tariffs");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setTariffs(data);
    } catch (err) {
      console.error("Ошибка при загрузке тарифов:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTariffs();
  }, []);

  const handleEdit = (tariff) => {
    setEditingTariff(tariff);
    setIsModalOpen(true);
  };

  const handleDelete = (tariffId) => {
    showConfirm({
      title: "Удалить тариф?",
      message: "Тариф будет удалён. Велосипеды с этим тарифом могут потерять привязку.",
      confirmLabel: "Удалить",
      danger: true,
      onConfirm: async () => {
        try {
          const response = await apiFetch(`/api/tariffs/${tariffId}`, { method: "DELETE" });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Ошибка при удалении");
          }
          fetchTariffs();
        } catch (err) {
          alert(err.message);
        }
      },
    });
  };

  const handleToggleActive = async (tariff) => {
    try {
      const response = await apiFetch(`/api/tariffs/${tariff.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tariff, is_active: !tariff.is_active }),
      });
      if (!response.ok) throw new Error("Ошибка при обновлении");
      fetchTariffs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingTariff(null);
  };

  const handleModalSave = () => {
    handleModalClose();
    fetchTariffs();
  };

  const activeCount = tariffs.filter(t => t.is_active).length;

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;

  return (
    <div className="page-container tariffs-page">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">Тарифы</h1>
          <p className="page-subtitle">Управление тарифами аренды велосипедов и оборудования</p>
        </div>
        <div className="header-right">
          <div className="header-stats">
            <div className="stat-card">
              <div className="stat-content">
                <div className="status-indicator" style={{ background: "var(--color-primary-green)" }}></div>
                <div className="stat-info">
                  <span className="stat-number">{activeCount}</span>
                  <span className="stat-label">Активных</span>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="status-indicator" style={{ background: "#9ca3af" }}></div>
                <div className="stat-info">
                  <span className="stat-number">{tariffs.length}</span>
                  <span className="stat-label">Всего</span>
                </div>
              </div>
            </div>
          </div>
          <div className="header-right-bottom">
            <button
              className="btn btn-primary-green add-bike-btn"
              onClick={() => { setEditingTariff(null); setIsModalOpen(true); }}
            >
              + Добавить тариф
            </button>
          </div>
        </div>
      </div>

      <TariffsTable
        tariffs={tariffs}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onToggleActive={handleToggleActive}
      />

      {isModalOpen && (
        <TariffModal
          tariff={editingTariff}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
      {confirmProps && <ConfirmModal {...confirmProps} />}
    </div>
  );
};

export default Tariffs;
