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
  const [activatingBooking, setActivatingBooking]   = useState(null);
  const [editingBooking, setEditingBooking]         = useState(null);
  const [statusFilter, setStatusFilter]             = useState([]);

  const handleStatClick = (statuses) => {
    setStatusFilter(prev =>
      JSON.stringify(prev) === JSON.stringify(statuses) ? [] : statuses
    );
  };

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
    setIsActiveModalOpen(false);
    setIsBookingModalOpen(false);
    fetchRentals();
    if (createdContract?.id) {
      setViewingRental(createdContract);
    }
  };

  const handleOpenRental = (rental) => {
    if (rental.status === "booked") setEditingBooking(rental);
    else setViewingRental(rental);
  };

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
            {[
              { statuses: ["active"],              color: "var(--color-primary-green)", count: activeCount,    label: "Активных" },
              { statuses: ["booked"],              color: "var(--color-primary-blue)",  count: bookedCount,    label: "Забронировано" },
              { statuses: ["overdue", "no_show"],  color: "var(--color-primary-red)",   count: overdueCount,   label: "Просрочено" },
              { statuses: [],                      color: "#9ca3af",                     count: rentals.length, label: "Всего" },
            ].map(({ statuses, color, count, label }) => {
              const isActive = statuses.length > 0 && JSON.stringify(statusFilter) === JSON.stringify(statuses);
              return (
                <div
                  key={label}
                  className="stat-card"
                  onClick={() => statuses.length > 0 && handleStatClick(statuses)}
                  style={{ cursor: statuses.length > 0 ? "pointer" : "default", outline: isActive ? `2px solid ${color}` : "none", borderRadius: 8 }}
                  title={statuses.length > 0 ? (isActive ? "Сбросить фильтр" : `Фильтр: ${label}`) : undefined}
                >
                  <div className="stat-content">
                    <div className="status-indicator" style={{ background: color }}></div>
                    <div className="stat-info">
                      <span className="stat-number">{count}</span>
                      <span className="stat-label">{label}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="header-right-bottom" style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-primary-green add-bike-btn"
              onClick={() => setIsActiveModalOpen(true)}
            >
              Выдать сейчас
            </button>
            <button
              className="btn btn-secondary-green add-bike-btn"
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
        statusFilter={statusFilter}
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

      {editingBooking && (
        <BookingModal
          editingRental={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSave={() => { setEditingBooking(null); fetchRentals(); }}
          onProceedToIssue={(saved) => {
            setEditingBooking(null);
            setActivatingBooking(saved);
          }}
        />
      )}

      {activatingBooking && (
        <ActiveRentalModal
          bookingId={activatingBooking.id}
          onClose={() => setActivatingBooking(null)}
          onSave={() => { setActivatingBooking(null); fetchRentals(); }}
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
