import React, { useState, useRef } from "react";

const UsersTable = ({ users, onUpdate }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filters, setFilters] = useState({});

  const roleOptions = ["админ", "менеджер", "механик"];

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

  const filteredUsers = users.filter((user) => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value || value.length === 0) return true;
      return String(user[key] || "")
        .toLowerCase()
        .includes(value.toLowerCase());
    });
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (!sortColumn) return 0;
    const valA = a[sortColumn];
    const valB = b[sortColumn];

    if (valA === null || valA === undefined) return sortAsc ? 1 : -1;
    if (valB === null || valB === undefined) return sortAsc ? -1 : 1;

    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("ru-RU");
  };

  const columns = [
    { key: "id", label: "ID" },
    { key: "username", label: "Логин" },
    { key: "full_name", label: "ФИО" },
    { key: "role", label: "Роль" },
    { key: "created_at", label: "Дата создания" },
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
          {sortedUsers.map((user) => (
            <tr key={user.id}>
              <td>{user.id}</td>
              <td>{user.username}</td>
              <td>{user.full_name}</td>
              <td>{user.role}</td>
              <td>{formatDate(user.created_at)}</td>
              <td>
                <div className="action-buttons">
                  <button className="btn-edit" disabled>
                    Редактировать
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

export default UsersTable;
