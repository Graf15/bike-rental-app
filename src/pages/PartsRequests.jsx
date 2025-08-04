import React, { useState, useEffect } from "react";
import "./PartsRequests.css";

const PartsRequests = () => {
  const [requests, setRequests] = useState([]);
  const [maintenanceNeeds, setMaintenanceNeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
 

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchPurchaseRequests(), fetchMaintenanceNeeds()]);
    } catch (err) {
      setError("Ошибка загрузки данных");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseRequests = async () => {
    try {
      const response = await fetch("/api/purchase-requests");
      if (!response.ok) throw new Error("Ошибка загрузки заказов");
      const data = await response.json();
      setRequests(data);
    } catch (error) {
      console.error("Ошибка загрузки заказов:", error);
    }
  };

  const fetchMaintenanceNeeds = async () => {
    try {
      const response = await fetch("/api/maintenance/parts-needs");
      if (!response.ok) throw new Error("Ошибка загрузки потребностей");
      const data = await response.json();
      setMaintenanceNeeds(data);
    } catch (error) {
      console.error("Ошибка загрузки потребностей:", error);
    }
  };

  const createPurchaseRequest = async (
    partModelId,
    quantity,
    priority,
    notes
  ) => {
    try {
      const response = await fetch("/api/purchase-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          part_model_id: partModelId,
          количество_нужно: quantity,
          приоритет: priority,
          примечания: notes,
        }),
      });

      if (!response.ok) throw new Error("Ошибка создания заказа");

      await fetchData();
      setShowCreateModal(false);
    } catch (error) {
      console.error("Ошибка создания заказа:", error);
      alert("Ошибка при создании заказа");
    }
  };

  const updateRequestStatus = async (
    requestId,
    newStatus,
    additionalData = {}
  ) => {
    try {
      const response = await fetch(`/api/purchase-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          статус_заказа: newStatus,
          ...additionalData,
        }),
      });

      if (!response.ok) throw new Error("Ошибка обновления статуса");

      await fetchData();
    } catch (error) {
      console.error("Ошибка обновления статуса:", error);
      alert("Ошибка при обновлении статуса");
    }
  };

  const handleMarkAsOrdered = (request) => {
    const orderDate = new Date().toISOString();
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() + 7); // +7 дней по умолчанию

    updateRequestStatus(request.id, "заказано", {
      дата_заказа: orderDate,
      ожидаемая_дата_поставки: expectedDate.toISOString().split("T")[0],
    });
  };

  const handleMarkAsReceived = async (request) => {
    try {
      // Обновляем статус заказа
      await updateRequestStatus(request.id, "получено");

      // Обновляем склад
      const response = await fetch(
        `/api/parts/${request.part_model_id}/stock`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            количество_на_складе:
              request.current_stock + request.количество_нужно,
          }),
        }
      );

      if (!response.ok) throw new Error("Ошибка обновления склада");

      await fetchData();
    } catch (error) {
      console.error("Ошибка при получении товара:", error);
      alert("Ошибка при получении товара");
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "критичный":
        return "#dc2626";
      case "высокий":
        return "#ea580c";
      case "обычный":
        return "#65a30d";
      case "низкий":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "новый":
        return "#3b82f6";
      case "заказано":
        return "#FFA500";
      case "получено":
        return "rgb(32, 167, 64)";
      case "отменено":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  const getUrgencyLevel = (maintenanceDate) => {
    if (!maintenanceDate) return "unknown";

    const targetDate = new Date(maintenanceDate);
    const today = new Date();
    const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "overdue";
    if (diffDays <= 3) return "urgent";
    if (diffDays <= 7) return "soon";
    if (diffDays <= 30) return "normal";
    return "future";
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message">
        <div className="error-icon">⚠️</div>
        <p>{error}</p>
        <button onClick={fetchData} className="retry-button">
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="parts-requests-page">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">Управление заказами запчастей</h1>
          <p className="page-subtitle">
            Отслеживание потребностей в запчастях и управление заказами
          </p>
        </div>
        <div className="header-stats">
          <div className="stat-card">
            <div className="stat-number">
              {requests.filter((r) => r.статус_заказа === "новый").length}
            </div>
            <div className="stat-label">Новые заказы</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {requests.filter((r) => r.статус_заказа === "заказано").length}
            </div>
            <div className="stat-label">В пути</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">
              {
                maintenanceNeeds.filter(
                  (n) => getUrgencyLevel(n.target_date) === "urgent"
                ).length
              }
            </div>
            <div className="stat-label">Срочные</div>
          </div>
        </div>
      </div>

      <div className="page-content">
        {/* Потребности в запчастях для ремонтов */}
        <div className="section">
          <div className="content-header">
            <h2>Потребности в запчастях</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              + Создать заказ
            </button>
          </div>

          {maintenanceNeeds.length > 0 ? (
            <div className="needs-table-container">
              <table className="needs-table">
                <thead>
                  <tr>
                    <th>Запчасть</th>
                    <th>Нужно</th>
                    <th>На складе</th>
                    <th>Недостаток</th>
                    <th>Ремонт</th>
                    <th>Велосипед</th>
                    <th>Срочность</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {maintenanceNeeds.map((need, index) => {
                    const urgency = getUrgencyLevel(need.target_date);
                    return (
                      <tr key={index} className={`need-row urgency-${urgency}`}>
                        <td>{need.part_name}</td>
                        <td>{need.total_needed}</td>
                        <td
                          className={
                            need.stock_quantity <= 5 ? "low-stock" : ""
                          }
                        >
                          {need.stock_quantity}
                        </td>
                        <td className="shortage">
                          {Math.max(0, need.total_needed - need.stock_quantity)}
                        </td>
                        <td>{need.maintenance_type}</td>
                        <td>
                          {need.bike_number || "—"} ({need.bike_model})
                        </td>
                        <td>
                          <span className={`urgency-badge urgency-${urgency}`}>
                            {urgency === "overdue" && "Просрочено"}
                            {urgency === "urgent" && "Срочно"}
                            {urgency === "soon" && "Скоро"}
                            {urgency === "normal" && "Обычно"}
                            {urgency === "future" && "Будущее"}
                            {urgency === "unknown" && "Не определено"}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() =>
                              createPurchaseRequest(
                                need.part_id,
                                Math.max(
                                  0,
                                  need.total_needed - need.stock_quantity
                                ),
                                urgency === "urgent" || urgency === "overdue"
                                  ? "высокий"
                                  : "обычный",
                                `Для ремонта ${need.bike_model} #${
                                  need.bike_number || need.bike_id
                                }`
                              )
                            }
                            className="btn-primary btn-small"
                            disabled={need.total_needed <= need.stock_quantity}
                          >
                            Заказать
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>Нет потребностей в запчастях для текущих ремонтов</p>
            </div>
          )}
        </div>

        {/* Активные заказы */}
        <div className="section">
          <div className="content-header">
            <h2>Активные заказы</h2>
          </div>

          {requests.length > 0 ? (
            <div className="requests-table-container">
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>Запчасть</th>
                    <th>Количество</th>
                    <th>Статус</th>
                    <th>Приоритет</th>
                    <th>Дата создания</th>
                    <th>Дата заказа</th>
                    <th>Ожидаемая поставка</th>
                    <th>Примечания</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id}>
                      <td>{request.part_name}</td>
                      <td>{request.количество_нужно}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            backgroundColor: getStatusColor(
                              request.статус_заказа
                            ),
                          }}
                        >
                          {request.статус_заказа}
                        </span>
                      </td>
                      <td>
                        <span
                          className="priority-badge"
                          style={{ color: getPriorityColor(request.приоритет) }}
                        >
                          {request.приоритет}
                        </span>
                      </td>
                      <td>
                        {new Date(request.дата_создания).toLocaleDateString()}
                      </td>
                      <td>
                        {request.дата_заказа
                          ? new Date(request.дата_заказа).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>
                        {request.ожидаемая_дата_поставки
                          ? new Date(
                              request.ожидаемая_дата_поставки
                            ).toLocaleDateString()
                          : "—"}
                      </td>
                      <td>{request.примечания || "—"}</td>
                      <td>
                        <div className="action-buttons">
                          {request.статус_заказа === "новый" && (
                            <button
                              onClick={() => handleMarkAsOrdered(request)}
                              className="btn-primary btn-small"
                            >
                              Заказано
                            </button>
                          )}
                          {request.статус_заказа === "заказано" && (
                            <button
                              onClick={() => handleMarkAsReceived(request)}
                              className="btn-primary btn-small"
                            >
                              Получено
                            </button>
                          )}
                          {(request.статус_заказа === "новый" ||
                            request.статус_заказа === "заказано") && (
                            <button
                              onClick={() =>
                                updateRequestStatus(request.id, "отменено")
                              }
                              className="btn-secondary btn-small"
                            >
                              Отменить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>Нет активных заказов запчастей</p>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно создания заказа */}
      {showCreateModal && (
        <CreateRequestModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={createPurchaseRequest}
        />
      )}
    </div>
  );
};

// Компонент модального окна для создания заказа
const CreateRequestModal = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    part_model_id: "",
    количество_нужно: 1,
    приоритет: "обычный",
    примечания: "",
  });
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchParts();
  }, []);

  const fetchParts = async () => {
    try {
      const response = await fetch("/api/parts");
      const data = await response.json();
      setParts(data);
    } catch (error) {
      console.error("Ошибка загрузки запчастей:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSubmit(
        formData.part_model_id,
        formData.количество_нужно,
        formData.приоритет,
        formData.примечания
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "количество_нужно" ? parseInt(value) || 1 : value,
    }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать заказ запчасти</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Запчасть</label>
            <select
              name="part_model_id"
              value={formData.part_model_id}
              onChange={handleInputChange}
              required
            >
              <option value="">Выберите запчасть</option>
              {parts.map((part) => (
                <option key={part.id} value={part.id}>
                  {part.название} (на складе: {part.количество_на_складе})
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Количество</label>
              <input
                type="number"
                name="количество_нужно"
                value={formData.количество_нужно}
                onChange={handleInputChange}
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label>Приоритет</label>
              <select
                name="приоритет"
                value={formData.приоритет}
                onChange={handleInputChange}
              >
                <option value="низкий">Низкий</option>
                <option value="обычный">Обычный</option>
                <option value="высокий">Высокий</option>
                <option value="критичный">Критичный</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Примечания</label>
            <textarea
              name="примечания"
              value={formData.примечания}
              onChange={handleInputChange}
              rows="3"
              placeholder="Причина заказа, поставщик и т.д."
            />
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !formData.part_model_id}
            >
              {loading ? "Создание..." : "Создать заказ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PartsRequests;
