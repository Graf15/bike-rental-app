import React, { useState } from "react";
import "./MaintenanceTable.css";

const MaintenanceTable = ({ events, onUpdate }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filters, setFilters] = useState({});

  const statusOptions = ["запланирован", "в ремонте", "ожидает деталей", "ремонт выполнен"];
  const repairTypeOptions = ["current", "weekly", "longterm"];
  const priorityLabels = {
    1: "Критический", 
    2: "Высокий", 
    3: "Средний", 
    4: "Низкий", 
    5: "Очень низкий"
  };

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(true);
    }
  };

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const filteredEvents = events.filter((event) => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value || value.length === 0) return true;
      return String(event[key] || "")
        .toLowerCase()
        .includes(value.toLowerCase());
    });
  });

  const sortedEvents = [...filteredEvents].sort((a, b) => {
    if (!sortColumn) return 0;
    const valA = a[sortColumn];
    const valB = b[sortColumn];

    if (valA === null || valA === undefined) return sortAsc ? 1 : -1;
    if (valB === null || valB === undefined) return sortAsc ? -1 : 1;

    if (typeof valA === "number") {
      return sortAsc ? valA - valB : valB - valA;
    }

    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("ru-RU");
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "запланирован":
        return "status-planned";
      case "в ремонте":
        return "status-progress";
      case "ожидает деталей":
        return "status-waiting";
      case "ремонт выполнен":
        return "status-completed";
      default:
        return "";
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 1: return "priority-critical";
      case 2: return "priority-high";
      case 3: return "priority-medium";
      case 4: return "priority-low";
      case 5: return "priority-very-low";
      default: return "priority-medium";
    }
  };

  const getRepairTypeLabel = (type) => {
    switch (type) {
      case "current": return "Текущий";
      case "weekly": return "Еженедельный";
      case "longterm": return "Долгосрочный";
      default: return type;
    }
  };

  const formatCurrency = (amount) => {
    return amount ? `${Number(amount).toFixed(2)} ₽` : "0.00 ₽";
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;
  };

  const columns = [
    { key: "id", label: "ID" },
    { key: "bike_number", label: "№ велосипеда" },
    { key: "model", label: "Модель" },
    { key: "repair_type", label: "Категория" },
    { key: "priority", label: "Приоритет" },
    { key: "статус_ремонта", label: "Статус" },
    { key: "ремонт_запланирован_на", label: "Запланировано" },
    { key: "estimated_duration", label: "План. время" },
    { key: "actual_duration", label: "Факт. время" },
    { key: "estimated_cost", label: "План. стоимость" },
    { key: "actual_cost", label: "Факт. стоимость" },
    { key: "manager_name", label: "Менеджер" },
  ];

  return (
    <div style={{ position: "relative" }}>
      <div className="table-summary">
        <div className="summary-stats">
          <span className="stat">
            Всего: {sortedEvents.length}
          </span>
          <span className="stat critical">
            Критических: {sortedEvents.filter(e => e.priority === 1).length}
          </span>
          <span className="stat overdue">
            Просроченных: {sortedEvents.filter(e => e.is_overdue).length}
          </span>
          <span className="stat in-progress">
            В работе: {sortedEvents.filter(e => e.статус_ремонта === 'в ремонте').length}
          </span>
        </div>
      </div>
      <table className="maintenance-table">
        <thead>
          <tr>
            {columns.map(({ key, label }) => (
              <th key={key} onClick={() => handleSort(key)}>
                {label}{" "}
                <span className="sort-arrow">
                  {sortColumn === key && (sortAsc ? "▲" : "▼")}
                </span>
              </th>
            ))}
            <th>Действия</th>
          </tr>
          <tr>
            {columns.map(({ key }) => (
              <th key={key}>
                {key === "repair_type" ? (
                  <select
                    value={filters[key] || ""}
                    onChange={(e) => updateFilter(key, e.target.value)}
                    style={{ width: "90%" }}
                  >
                    <option value="">Все типы</option>
                    {repairTypeOptions.map(type => (
                      <option key={type} value={type}>{getRepairTypeLabel(type)}</option>
                    ))}
                  </select>
                ) : key === "статус_ремонта" ? (
                  <select
                    value={filters[key] || ""}
                    onChange={(e) => updateFilter(key, e.target.value)}
                    style={{ width: "90%" }}
                  >
                    <option value="">Все статусы</option>
                    {statusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                ) : key === "priority" ? (
                  <select
                    value={filters[key] || ""}
                    onChange={(e) => updateFilter(key, e.target.value)}
                    style={{ width: "90%" }}
                  >
                    <option value="">Все приоритеты</option>
                    {Object.entries(priorityLabels).map(([priority, label]) => (
                      <option key={priority} value={priority}>{priority} - {label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Фильтр"
                    value={filters[key] || ""}
                    onChange={(e) => updateFilter(key, e.target.value)}
                    style={{ width: "90%" }}
                  />
                )}
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortedEvents.map((event) => (
            <tr key={event.id} className={event.is_overdue ? 'row-overdue' : ''}>
              <td>{event.id}</td>
              <td>
                <div className="bike-info">
                  <span className="bike-number">{event.bike_number}</span>
                  {event.is_overdue && (
                    <span className="overdue-badge" title="Просроченный ремонт">
                      ⚠️
                    </span>
                  )}
                </div>
              </td>
              <td>{event.model}</td>
              <td>
                <span className={`repair-type-badge repair-type-${event.repair_type}`}>
                  {getRepairTypeLabel(event.repair_type)}
                </span>
              </td>
              <td>
                <div className="priority-cell">
                  <span className={`priority-badge ${getPriorityClass(event.priority)}`}>
                    {event.priority}
                  </span>
                  <span className="priority-label">
                    {priorityLabels[event.priority]}
                  </span>
                </div>
              </td>
              <td>
                <span
                  className={`status ${getStatusClass(event.статус_ремонта)}`}
                >
                  {event.статус_ремонта}
                </span>
              </td>
              <td>
                <div className="date-cell">
                  {formatDate(event.ремонт_запланирован_на)}
                  {event.days_until_planned !== null && (
                    <div className={`days-info ${
                      event.days_until_planned < 0 ? 'overdue' : 
                      event.days_until_planned <= 1 ? 'urgent' : ''
                    }`}>
                      {event.days_until_planned < 0 
                        ? `${Math.abs(event.days_until_planned)} дн. назад`
                        : event.days_until_planned === 0 
                        ? 'Сегодня'
                        : `через ${event.days_until_planned} дн.`
                      }
                    </div>
                  )}
                </div>
              </td>
              <td>{formatDuration(event.estimated_duration)}</td>
              <td>
                <span className={event.actual_duration > event.estimated_duration ? 'duration-exceeded' : ''}>
                  {formatDuration(event.actual_duration)}
                </span>
              </td>
              <td>{formatCurrency(event.estimated_cost)}</td>
              <td>
                <span className={Number(event.actual_cost) > Number(event.estimated_cost) ? 'cost-exceeded' : ''}>
                  {formatCurrency(event.actual_cost)}
                </span>
              </td>
              <td>{event.manager_name}</td>
              <td>
                <div className="action-buttons">
                  <button 
                    className="btn-status" 
                    onClick={() => onUpdate && onUpdate('status', event.id, event)}
                    title="Изменить статус"
                  >
                    📝
                  </button>
                  <button 
                    className="btn-edit" 
                    onClick={() => onUpdate && onUpdate('edit', event.id, event)}
                    title="Редактировать"
                  >
                    ✏️
                  </button>
                  <button 
                    className="btn-delete" 
                    onClick={() => onUpdate && onUpdate('delete', event.id, event)}
                    title="Удалить"
                  >
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default MaintenanceTable;
