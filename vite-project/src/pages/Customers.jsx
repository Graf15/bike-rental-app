import React, { useEffect, useState } from "react";
import CustomersTable from "../components/CustomersTable";
import CustomerModal from "../components/CustomerModal";

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/customers");
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setCustomers(data);
    } catch (err) {
      console.error("Ошибка при загрузке клиентов:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = async (customerId) => {
    if (!window.confirm("Удалить клиента?")) return;
    try {
      const response = await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Ошибка при удалении");
      }
      fetchCustomers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const handleModalSave = () => {
    handleModalClose();
    fetchCustomers();
  };

  const activeCount = customers.filter(c => c.status === "active").length;
  const restrictedCount = customers.filter(c => c.status !== "active").length;

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
                  <span className="stat-number">{activeCount}</span>
                  <span className="stat-label">Активных</span>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="status-indicator" style={{ background: "var(--color-primary-orange)" }}></div>
                <div className="stat-info">
                  <span className="stat-number">{restrictedCount}</span>
                  <span className="stat-label">С огранич.</span>
                </div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-content">
                <div className="status-indicator" style={{ background: "var(--color-primary-blue)" }}></div>
                <div className="stat-info">
                  <span className="stat-number">{customers.length}</span>
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
        onCustomerUpdate={fetchCustomers}
        onCustomerEdit={handleEdit}
        onCustomerDelete={handleDelete}
      />

      {isModalOpen && (
        <CustomerModal
          customer={editingCustomer}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
    </div>
  );
};

export default Customers;
