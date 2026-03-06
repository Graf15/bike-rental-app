import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import RentalsTable from "../components/RentalsTable";
import ActiveRentalModal from "../components/ActiveRentalModal";
import BookingModal from "../components/BookingModal";
import RentalViewModal from "../components/RentalViewModal";
import ConfirmModal from "../components/ConfirmModal";
import { useConfirm } from "../utils/useConfirm";

const LIMIT = 100;

const Rentals = () => {
  const [rentals, setRentals] = useState([]);
  const [counts, setCounts]   = useState({ active: 0, booked: 0, overdue: 0, total: 0 });
  const [page, setPage]       = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [isActiveModalOpen, setIsActiveModalOpen]   = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [viewingRental, setViewingRental]           = useState(null);
  const [activatingBooking, setActivatingBooking]   = useState(null);
  const [editingBooking, setEditingBooking]         = useState(null);
  const [statusFilter, setStatusFilter] = useState([]);
  const [serverFilters, setServerFilters] = useState({});
  const [confirmProps, showConfirm] = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const debounceRef = useRef(null);

  const buildParams = (currentPage, statFilter, colFilters) => {
    const params = new URLSearchParams({ page: currentPage, limit: LIMIT });
    // Статус из шапки (stat card) имеет приоритет над колоночным фильтром
    const statusVal = colFilters.status?.length > 0 ? colFilters.status : statFilter;
    if (statusVal?.length > 0) params.set("status", statusVal.join(","));

    const textCols = ["id", "customer_name", "phone", "booked_start", "booked_end",
                      "bike_models", "deposit_value", "total_price", "issued_by_name", "notes_issue"];
    for (const col of textCols) {
      if (colFilters[col]) params.set(col, colFilters[col]);
    }
    if (colFilters.deposit_type?.length > 0) params.set("deposit_type", colFilters.deposit_type.join(","));
    return params;
  };

  const fetchRentals = async (currentPage = page, statFilter = statusFilter, colFilters = serverFilters) => {
    setFetching(true);
    try {
      const params = buildParams(currentPage, statFilter, colFilters);
      const response = await fetch(`/api/rentals?${params}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setRentals(data.rows);
      setCounts(data.counts);
      setTotalRows(data.total);
    } catch (err) {
      console.error("Ошибка при загрузке договоров:", err);
      setError(err.message);
    } finally {
      setInitialLoading(false);
      setFetching(false);
    }
  };

  const handleServerSearch = (filters) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setServerFilters(filters);
    }, 300);
  };

  const handleStatClick = (statuses) => {
    setPage(1);
    setServerFilters({});
    setStatusFilter(prev =>
      JSON.stringify(prev) === JSON.stringify(statuses) ? [] : statuses
    );
  };

  useEffect(() => {
    fetchRentals(page, statusFilter, serverFilters);
  }, [page, statusFilter, serverFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => fetchRentals(page, statusFilter, serverFilters);
    window.addEventListener("rentals-changed", handler);
    return () => window.removeEventListener("rentals-changed", handler);
  }, [page, statusFilter, serverFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Открыть договор по ?open=ID из ссылки (например из OverdueAlertsManager)
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    fetch(`/api/rentals/${openId}`)
      .then(r => r.ok ? r.json() : null)
      .then(rental => { if (rental) setViewingRental(rental); })
      .catch(() => {});
    setSearchParams({}, { replace: true });
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = (rentalId) => {
    showConfirm({
      title: "Удалить договор?",
      message: "Удаление возможно только для статуса «Забронирован».",
      confirmLabel: "Удалить",
      danger: true,
      onConfirm: async () => {
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
      },
    });
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

  const totalPages = Math.ceil(totalRows / LIMIT);

  if (initialLoading) return <div className="loading">Загрузка...</div>;
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
              { statuses: ["active"],              color: "var(--color-primary-green)", count: counts.active,  label: "Активных" },
              { statuses: ["booked"],              color: "var(--color-primary-blue)",  count: counts.booked,  label: "Забронировано" },
              { statuses: ["overdue"],              color: "var(--color-primary-orange)", count: counts.overdue, label: "Опаздывают" },
              { statuses: [],                      color: "#9ca3af",                     count: counts.total,   label: "Всего" },
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

      <div style={{ textAlign: "center", padding: "6px 0", fontSize: 13, color: "#9ca3af", visibility: fetching ? "visible" : "hidden" }}>
        Поиск...
      </div>
      <RentalsTable
        rentals={rentals}
        onRentalUpdate={fetchRentals}
        onRentalEdit={handleOpenRental}
        onRentalDelete={handleDelete}
        onRentalOpen={handleOpenRental}
        statusFilter={statusFilter}
        onServerSearch={handleServerSearch}
      />

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, padding: "16px 0", fontSize: 14, color: "#6b7280" }}>
          <button
            className="btn btn-secondary-green"
            style={{ padding: "4px 14px", fontSize: 13 }}
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            ← Назад
          </button>
          <span>Страница {page} из {totalPages}</span>
          <button
            className="btn btn-secondary-green"
            style={{ padding: "4px 14px", fontSize: 13 }}
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Вперёд →
          </button>
        </div>
      )}

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
          onClose={() => { setActivatingBooking(null); fetchRentals(); }}
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
      {confirmProps && <ConfirmModal {...confirmProps} />}
    </div>
  );
};

export default Rentals;
