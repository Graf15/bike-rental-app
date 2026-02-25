import React, { useEffect, useState } from "react";
import RentalsTable from "../components/RentalsTable";
import ActiveRentalModal from "../components/ActiveRentalModal";
import BookingModal from "../components/BookingModal";
import RentalViewModal from "../components/RentalViewModal";

const Rentals = () => {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isActiveModalOpen, setIsActiveModalOpen]   = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [viewingRental, setViewingRental]           = useState(null);

  const fetchRentals = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/rentals");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setRentals(data);
    } catch (err) {
      console.error("Ошибка при загрузке договоров:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRentals();
  }, []);

  const handleDelete = async (rentalId) => {
    if (!window.confirm("Удалить договор? Удаление возможно только для статуса «Забронирован».")) return;
    try {
      const response = await fetch(`/api/rentals/${rentalId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Ошибка при удалении");
      }
      fetchRentals();
    } catch (err) {
      alert(err.message);
    }
  };

  // После создания — открываем карточку договора для немедленной активации
  const handleCreateSave = (createdContract) => {
    setIsCreateModalOpen(false);
    fetchRentals();
    if (createdContract?.id) {
      setViewingRental(createdContract);
    }
  };

  const handleOpenRental = (rental) => setViewingRental(rental);

  const activeCount  = rentals.filter(r => r.status === "active").length;
  const bookedCount  = rentals.filter(r => r.status === "booked").length;
  const overdueCount = rentals.filter(r => r.status === "overdue" || r.status === "no_show").length;

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;

  return (
    <div className="page-container rentals-page">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">Управление прокатом</h1>
          <p className="page-subtitle">Договоры аренды велосипедов и оборудования</p>
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
                <div className="status-indicator" style={{ background: "var(--color-primary-blue)" }}></div>
                <div className="stat-info">
                  <span className="stat-number">{bookedCount}</span>
                  <span className="stat-label">Забронировано</span>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="status-indicator" style={{ background: "var(--color-primary-red)" }}></div>
                <div className="stat-info">
                  <span className="stat-number">{overdueCount}</span>
                  <span className="stat-label">Просрочено</span>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="status-indicator" style={{ background: "#9ca3af" }}></div>
                <div className="stat-info">
                  <span className="stat-number">{rentals.length}</span>
                  <span className="stat-label">Всего</span>
                </div>
              </div>
            </div>
          </div>
          <div className="header-right-bottom" style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary-green add-bike-btn"
              onClick={() => setIsActiveModalOpen(true)}
            >
              🚲 Выдать сейчас
            </button>
            <button
              className="btn add-bike-btn"
              style={{ background: "var(--color-primary-blue, #3b82f6)", color: "white", border: "none" }}
              onClick={() => setIsBookingModalOpen(true)}
            >
              📅 Создать бронь
            </button>
          </div>
        </div>
      </div>

      <RentalsTable
        rentals={rentals}
        onRentalUpdate={fetchRentals}
        onRentalEdit={handleOpenRental}
        onRentalDelete={handleDelete}
        onRentalOpen={handleOpenRental}
      />

      {isActiveModalOpen && (
        <ActiveRentalModal
          onClose={() => setIsActiveModalOpen(false)}
          onSave={handleCreateSave}
        />
      )}

      {isBookingModalOpen && (
        <BookingModal
          onClose={() => setIsBookingModalOpen(false)}
          onSave={handleCreateSave}
        />
      )}

      {viewingRental && (
        <RentalViewModal
          rental={viewingRental}
          onClose={() => setViewingRental(null)}
          onUpdate={fetchRentals}
        />
      )}
    </div>
  );
};

export default Rentals;
