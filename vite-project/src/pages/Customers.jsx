import React, { useEffect, useState } from "react";
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
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [isModalOpen, setIsModalOpen]       = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [confirmProps, showConfirm] = useConfirm();

  const fetchCustomers = async (currentPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, limit: LIMIT });
      const response = await fetch(`/api/customers?${params}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setCustomers(data.rows);
      setCounts(data.counts);
      setTotalRows(data.total);
    } catch (err) {
      console.error("Ошибка при загрузке клиентов:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

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
          const response = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
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

  if (loading) return <div className="loading">Загрузка...</div>;
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

      <CustomersTable
        customers={customers}
        onCustomerUpdate={() => fetchCustomers(page)}
        onCustomerEdit={handleEdit}
        onCustomerDelete={handleDelete}
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
