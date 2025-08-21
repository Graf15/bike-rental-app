import React, { useState } from "react";

const PartsTable = ({ parts, onUpdate }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filters, setFilters] = useState({});

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

  const filteredParts = parts.filter((part) => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value || value.length === 0) return true;
      return String(part[key] || "")
        .toLowerCase()
        .includes(value.toLowerCase());
    });
  });

  const sortedParts = [...filteredParts].sort((a, b) => {
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

  const columns = [
    { key: "id", label: "ID" },
    { key: "название", label: "Название" },
    { key: "описание", label: "Описание" },
    { key: "количество_на_складе", label: "На складе" },
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
                />
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortedParts.map((part) => (
            <tr key={part.id}>
              <td>{part.id}</td>
              <td>{part.название}</td>
              <td>{part.описание}</td>
              <td>
                <span
                  className={part.количество_на_складе < 5 ? "low-stock" : ""}
                >
                  {part.количество_на_складе}
                </span>
              </td>
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

export default PartsTable;
