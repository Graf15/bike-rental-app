import React, { useState } from "react";

const MaintenanceTable = ({ events, onUpdate }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filters, setFilters] = useState({});

  const statusOptions = [" запланировано", "в ремонте", "ремонт выполнен"];
  const typeOptions = ["текущий", "еженедельный", "долгосрочный"];

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
      case " запланировано":
        return "status-planned";
      case "в ремонте":
        return "status-progress";
      case "ремонт выполнен":
        return "status-completed";
      default:
        return "";
    }
  };

  const columns = [
    { key: "id", label: "ID" },
    { key: "bike_number", label: "№ велосипеда" },
    { key: "model", label: "Модель" },
    { key: "тип_ремонта", label: "Тип ремонта" },
    { key: "статус_ремонта", label: "Статус" },
    { key: "ремонт_запланирован_на", label: "Запланировано на" },
    { key: "дата_начала", label: "Дата начала" },
    { key: "дата_завершения", label: "Дата завершения" },
    { key: "трудочасы", label: "Трудочасы" },
    { key: "manager_name", label: "Менеджер" },
    { key: "примечания", label: "Примечания" },
  ];

  return (
    <div style={{ position: "relative" }}>
      <table>
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
                <input
                  type="text"
                  placeholder="Фильтр"
                  value={filters[key] || ""}
                  onChange={(e) => updateFilter(key, e.target.value)}
                  style={{ width: "90%" }}
                />
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortedEvents.map((event) => (
            <tr key={event.id}>
              <td>{event.id}</td>
              <td>{event.bike_number}</td>
              <td>{event.model}</td>
              <td>{event.тип_ремонта}</td>
              <td>
                <span
                  className={`status ${getStatusClass(event.статус_ремонта)}`}
                >
                  {event.статус_ремонта}
                </span>
              </td>
              <td>{formatDate(event.ремонт_запланирован_на)}</td>
              <td>{formatDate(event.дата_начала)}</td>
              <td>{formatDate(event.дата_завершения)}</td>
              <td>{event.трудочасы}</td>
              <td>{event.manager_name}</td>
              <td>{event.примечания}</td>
              <td>
                <div className="action-buttons">
                  <button className="btn-edit" disabled>
                    Изменить статус
                  </button>
                  <button className="btn-delete" disabled>
                    Удалить
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
