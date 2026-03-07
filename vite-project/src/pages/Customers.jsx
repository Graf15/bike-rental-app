import { apiFetch } from "../utils/api";
import React, { useEffect, useRef, useState } from "react";
import CustomersTable from "../components/CustomersTable";
import CustomerModal from "../components/CustomerModal";
import ConfirmModal from "../components/ConfirmModal";
import { useConfirm } from "../utils/useConfirm";

const LIMIT = 100;

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [counts, setCounts]       = useState({ active: 0, restricted: 0, total: 0 });
  const [page, setPage]           = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true); // только первый раз
  const [fetching, setFetching]             = useState(false);
  const [error, setError]         = useState(null);
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [confirmProps, showConfirm] = useConfirm();
  const [serverFilters, setServerFilters] = useState({});
  const debounceRef = useRef(null);

  const buildParams = (currentPage, filters) => {
    const params = new URLSearchParams({ page: currentPage, limit: LIMIT });
    const textCols = ["last_name", "first_name", "middle_name", "phone", "restriction_reason", "notes", "id", "height_cm", "birth_date", "created_at"];
    for (const col of textCols) {
      if (filters[col]) params.set(col, filters[col]);
    }
    if (filters.status?.length > 0)     params.set("status",     filters.status.join(","));
    if (filters.gender?.length > 0)     params.set("gender",     filters.gender.join(","));
    if (filters.is_veteran?.length === 1) params.set("is_veteran", filters.is_veteran[0] === "да" ? "true" : "false");
    return params;
  };

  const fetchCustomers = async (currentPage = page, filters = serverFilters) => {
    setFetching(true);
    try {
      const params = buildParams(currentPage, filters);
      const response = await apiFetch(`/api/customers?${params}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setCustomers(data.rows);
      setCounts(data.counts);
      setTotalRows(data.total);
    } catch (err) {
      console.error("Ошибка при загрузке клиентов:", err);
      setError(err.message);
    } finally {
      setInitialLoading(false);
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchCustomers(page, serverFilters);
  }, [page, serverFilters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleServerSearch = (filters) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setServerFilters(filters);
    }, 300);
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = (customerId) => {
    showConfirm({
      title: "Удалить клиента?",
      message: "Клиент будет удалён из базы данных.",
      confirmLabel: "Удалить",
      danger: true,
      onConfirm: async () => {
        try {
          const response = await apiFetch(`/api/customers/${customerId}`, { method: "DELETE" });
          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Ошибка при удалении");
          }
          fetchCustomers(page);
        } catch (err) {
          alert(err.message);
        }
      },
    });
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const handleModalSave = () => {
    handleModalClose();
    fetchCustomers(page);
  };

  const totalPages = Math.ceil(totalRows / LIMIT);

  if (initialLoading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;

  return (
    <div className="page-container customers-page">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">База клиентов</h1>
          <p className="page-subtitle">Управление клиентами и историей аренды</p>
        </div>
        <div className="header-right">
          <div className="header-stats">
            <div className="stat-card">
              <div className="stat-content">
                <div className="status-indicator" style={{ background: "var(--color-primary-green)" }}></div>
                <div className="stat-info">
                  <span className="stat-number">{counts.active}</span>
                  <span className="stat-label">Активных</span>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="status-indicator" style={{ background: "var(--color-primary-orange)" }}></div>
                <div className="stat-info">
                  <span className="stat-number">{counts.restricted}</span>
                  <span className="stat-label">С огранич.</span>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="status-indicator" style={{ background: "var(--color-primary-blue)" }}></div>
                <div className="stat-info">
                  <span className="stat-number">{counts.total}</span>
                  <span className="stat-label">Всего</span>
                </div>
              </div>
            </div>
          </div>
          <div className="header-right-bottom">
            <button
              className="btn btn-primary-green add-bike-btn"
              onClick={() => { setEditingCustomer(null); setIsModalOpen(true); }}
            >
              + Добавить клиента
            </button>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "6px 0", fontSize: 13, color: "#9ca3af", visibility: fetching ? "visible" : "hidden" }}>
        Поиск...
      </div>
      <CustomersTable
        customers={customers}
        onCustomerUpdate={() => fetchCustomers(page)}
        onCustomerEdit={handleEdit}
        onCustomerDelete={handleDelete}
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

      {isModalOpen && (
        <CustomerModal
          customer={editingCustomer}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
      {confirmProps && <ConfirmModal {...confirmProps} />}
    </div>
  );
};

export default Customers;
