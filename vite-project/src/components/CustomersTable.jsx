import { useState, useRef, useEffect, useCallback } from "react";
import BikeActionsMenu from "./BikeActionsMenu";
import TableControls from "./TableControls";
import MultiSelectPopover from "./MultiSelectPopover";
import { CUSTOMER_OPTIONS } from "../constants/selectOptions";
import "./BikeTable.css";
import "./CustomersTable.css";

const formatDate = (dateString) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    return "—";
  }
};

const STATUS_LABELS = {
  active: "Активен",
  no_booking: "Запрет брони",
  no_rental: "Запрет выдачи",
};

const STATUS_COLORS = {
  active: "status-badge status-badge-green",
  no_booking: "status-badge status-badge-orange",
  no_rental: "status-badge status-badge-red",
};

const ColumnResizer = ({ onMouseDown }) => (
  <div
    className="column-resizer"
    onMouseDown={onMouseDown}
    onClick={(e) => e.stopPropagation()}
  />
);

const CustomersTable = ({ customers, onCustomerUpdate, onCustomerEdit, onCustomerDelete }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filters, setFilters] = useState({});
  const [popoverInfo, setPopoverInfo] = useState({ key: null, visible: false });
  const anchorRefs = useRef({});

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem("customersTablePageSize");
    return saved ? parseInt(saved, 10) : 50;
  });

  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem("customersTableVisibleColumns");
    return saved
      ? JSON.parse(saved)
      : ["id", "last_name", "first_name", "middle_name", "phone", "birth_date", "gender", "height_cm", "status", "no_show_count_actual", "restriction_reason", "created_at", "notes"];
  });

  const defaultColumnWidths = {
    id: 60,
    last_name: 130,
    first_name: 110,
    middle_name: 130,
    phone: 140,
    birth_date: 120,
    gender: 90,
    height_cm: 70,
    status: 140,
    no_show_count_actual: 90,
    restriction_reason: 180,
    created_at: 130,
    notes: 200,
    actions: 90,
  };

  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem("customersTableColumnWidths");
    return saved ? { ...defaultColumnWidths, ...JSON.parse(saved) } : defaultColumnWidths;
  });

  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem("customersTableColumnOrder");
    return saved
      ? JSON.parse(saved)
      : ["id", "last_name", "first_name", "middle_name", "phone", "birth_date", "gender", "height_cm", "status", "no_show_count_actual", "restriction_reason", "created_at", "notes"];
  });

  const isResizing = useRef(false);
  const resizingColumn = useRef(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const draggedColumn = useRef(null);
  const dragOverColumn = useRef(null);
  const tableContainerRef = useRef(null);

  const saveColumnWidths = useCallback((widths) => {
    localStorage.setItem("customersTableColumnWidths", JSON.stringify(widths));
  }, []);

  const handleResizeStart = (e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizingColumn.current = columnKey;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[columnKey];
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleResizeMove = useCallback((e) => {
    if (!isResizing.current || !resizingColumn.current) return;
    const deltaX = e.clientX - resizeStartX.current;
    const newWidth = Math.max(50, resizeStartWidth.current + deltaX);
    setColumnWidths((prev) => {
      const newWidths = { ...prev, [resizingColumn.current]: newWidth };
      saveColumnWidths(newWidths);
      return newWidths;
    });
  }, [saveColumnWidths]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;
    resizingColumn.current = null;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [handleResizeMove]);

  const handleDragStart = (e, columnKey) => {
    if (isResizing.current) { e.preventDefault(); return; }
    draggedColumn.current = columnKey;
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => e.target.classList.add("dragging"), 0);
  };

  const handleDragOver = (e, columnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    dragOverColumn.current = columnKey;
  };

  const handleDragEnter = (e, columnKey) => {
    e.preventDefault();
    if (draggedColumn.current && draggedColumn.current !== columnKey) {
      e.target.classList.add("drag-over");
    }
  };

  const handleDragLeave = (e) => {
    const rect = e.target.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      e.target.classList.remove("drag-over");
    }
  };

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault();
    e.target.classList.remove("drag-over");
    const sourceColumnKey = draggedColumn.current;
    if (sourceColumnKey && sourceColumnKey !== targetColumnKey) {
      const newOrder = [...columnOrder];
      const sourceIndex = newOrder.indexOf(sourceColumnKey);
      const targetIndex = newOrder.indexOf(targetColumnKey);
      newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, sourceColumnKey);
      setColumnOrder(newOrder);
      localStorage.setItem("customersTableColumnOrder", JSON.stringify(newOrder));
    }
    draggedColumn.current = null;
    dragOverColumn.current = null;
    document.querySelectorAll(".customers-table th").forEach((th) => th.classList.remove("dragging", "drag-over"));
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove("dragging");
    document.querySelectorAll(".customers-table th").forEach((th) => th.classList.remove("drag-over"));
    draggedColumn.current = null;
    dragOverColumn.current = null;
  };

  useEffect(() => {
    const orderedColumns = getOrderedColumns();
    const totalWidth = orderedColumns.reduce((sum, col) => sum + (columnWidths[col.key] || 100), 0) + (columnWidths.actions || 90);
    let css = `.customers-page .table-container table { width: ${totalWidth}px !important; }`;
    Object.entries(columnWidths).forEach(([key, width]) => {
      css += `
        .customers-page .table-container th[data-column="${key}"],
        .customers-page .table-container td[data-column="${key}"] {
          width: ${width}px !important;
          min-width: ${width}px !important;
          max-width: ${width}px !important;
        }`;
    });
    let styleEl = document.getElementById("dynamic-customers-table-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "dynamic-customers-table-styles";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  }, [columnWidths, columnOrder]);

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [handleResizeMove, handleResizeEnd]);

  const handleSort = (column) => {
    if (sortColumn === column) setSortAsc(!sortAsc);
    else { setSortColumn(column); setSortAsc(true); }
  };

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const clearAllFilters = () => { setFilters({}); setCurrentPage(1); };

  const hasActiveFilters = Object.entries(filters).some(([, value]) => {
    if (!value) return false;
    return Array.isArray(value) ? value.length > 0 : !!value;
  });

  const toggleColumnVisibility = (columnKey) => {
    const newVisible = visibleColumns.includes(columnKey)
      ? visibleColumns.filter((k) => k !== columnKey)
      : [...visibleColumns, columnKey];
    setVisibleColumns(newVisible);
    localStorage.setItem("customersTableVisibleColumns", JSON.stringify(newVisible));
  };

  const handlePageChange = (page) => setCurrentPage(page);
  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1);
    localStorage.setItem("customersTablePageSize", newSize.toString());
  };

  const filteredCustomers = customers.filter((c) =>
    Object.entries(filters).every(([key, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return true;
      if (Array.isArray(value)) return value.includes(c[key]);
      return String(c[key] || "").toLowerCase().includes(value.toLowerCase());
    })
  );

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    if (!sortColumn) return 0;
    const valA = a[sortColumn];
    const valB = b[sortColumn];
    if (valA == null) return sortAsc ? 1 : -1;
    if (valB == null) return sortAsc ? -1 : 1;
    if (typeof valA === "number") return sortAsc ? valA - valB : valB - valA;
    return sortAsc
      ? String(valA).localeCompare(String(valB), "ru")
      : String(valB).localeCompare(String(valA), "ru");
  });

  const totalItems = sortedCustomers.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedCustomers = sortedCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const columns = [
    { key: "id", label: "ID" },
    { key: "last_name", label: "Фамилия" },
    { key: "first_name", label: "Имя" },
    { key: "middle_name", label: "Отчество" },
    { key: "phone", label: "Телефон" },
    { key: "birth_date", label: "Дата рождения" },
    { key: "gender", label: "Пол" },
    { key: "height_cm", label: "Рост" },
    { key: "status", label: "Статус" },
    { key: "no_show_count_actual", label: "Неявки" },
    { key: "restriction_reason", label: "Причина ограничения" },
    { key: "created_at", label: "Регистрация" },
    { key: "notes", label: "Заметки" },
  ];

  const getOrderedColumns = () => {
    if (columnOrder.length === 0) return columns;
    const columnMap = new Map(columns.map((col) => [col.key, col]));
    const ordered = columnOrder.filter((k) => columnMap.has(k)).map((k) => columnMap.get(k));
    columns.forEach((col) => { if (!columnOrder.includes(col.key)) ordered.push(col); });
    return ordered;
  };

  const orderedColumns = getOrderedColumns();
  const visibleColumnsData = orderedColumns.filter((col) => visibleColumns.includes(col.key));
  const selectOptions = CUSTOMER_OPTIONS;

  const renderCell = (customer, key) => {
    if (key === "birth_date" || key === "created_at") return formatDate(customer[key]);
    if (key === "status") {
      return (
        <span className={STATUS_COLORS[customer[key]] || "status-badge"}>
          {STATUS_LABELS[customer[key]] || customer[key]}
        </span>
      );
    }
    if (key === "no_show_count_actual") {
      const count = parseInt(customer[key]) || 0;
      return count > 0 ? <span className={`no-show-badge ${count >= 2 ? "danger" : "warning"}`}>{count}</span> : "—";
    }
    if (key === "height_cm") return customer[key] ? `${customer[key]} см` : "—";
    return customer[key] || "—";
  };

  return (
    <>
      <TableControls
        onClearFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        availableColumns={orderedColumns}
        visibleColumns={visibleColumns}
        onColumnVisibilityChange={toggleColumnVisibility}
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <div ref={tableContainerRef} className="table-container">
        <table className="customers-table">
          <thead>
            <tr>
              {visibleColumnsData.map(({ key, label }) => (
                <th
                  key={key}
                  data-column={key}
                  draggable
                  style={{ width: columnWidths[key] }}
                  onClick={() => handleSort(key)}
                  onDragStart={(e) => handleDragStart(e, key)}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragEnter={(e) => handleDragEnter(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, key)}
                  onDragEnd={handleDragEnd}
                >
                  {label}{" "}
                  <span className="sort-arrow">{sortColumn === key && (sortAsc ? "▲" : "▼")}</span>
                  <ColumnResizer onMouseDown={(e) => handleResizeStart(e, key)} />
                </th>
              ))}
              <th data-column="actions" style={{ width: columnWidths.actions }}>
                Действия
                <ColumnResizer onMouseDown={(e) => handleResizeStart(e, "actions")} />
              </th>
            </tr>
            <tr>
              {visibleColumnsData.map(({ key }) => (
                <th key={key} data-column={key} style={{ width: columnWidths[key] }}>
                  {selectOptions[key] ? (
                    <div
                      ref={(el) => (anchorRefs.current[key] = el)}
                      onClick={() => setPopoverInfo({ key, visible: popoverInfo.key !== key || !popoverInfo.visible })}
                      className="filter-select-box"
                    >
                      {filters[key]?.length > 0 ? filters[key].map(v => STATUS_LABELS[v] || v).join(", ") : "Все"}
                      <span className="arrow">▼</span>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Фильтр"
                      value={filters[key] || ""}
                      onChange={(e) => updateFilter(key, e.target.value)}
                    />
                  )}
                </th>
              ))}
              <th data-column="actions" style={{ width: columnWidths.actions }}></th>
            </tr>
          </thead>
          <tbody>
            {paginatedCustomers.map((customer) => (
              <tr key={customer.id} className={customer.status !== "active" ? "row-restricted" : ""} onDoubleClick={() => onCustomerEdit && onCustomerEdit(customer)} style={{ cursor: "pointer" }}>
                {visibleColumnsData.map(({ key }) => (
                  <td key={key} data-column={key} style={{ width: columnWidths[key] }}>
                    {renderCell(customer, key)}
                  </td>
                ))}
                <td data-column="actions" style={{ width: columnWidths.actions }}>
                  <BikeActionsMenu
                    bike={{ ...customer, model: `${customer.last_name} ${customer.first_name}` }}
                    onEdit={() => onCustomerEdit && onCustomerEdit(customer)}
                    onCopy={() => onCustomerEdit && onCustomerEdit({ ...customer, id: null })}
                    onDelete={() => onCustomerDelete && onCustomerDelete(customer.id)}
                  />
                </td>
              </tr>
            ))}
            {paginatedCustomers.length === 0 && (
              <tr>
                <td colSpan={visibleColumnsData.length + 1} style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                  Клиенты не найдены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {popoverInfo.visible && popoverInfo.key && Array.isArray(selectOptions[popoverInfo.key]) && (
        <MultiSelectPopover
          options={selectOptions[popoverInfo.key]}
          selected={filters[popoverInfo.key] || []}
          onChange={(newSelection) => updateFilter(popoverInfo.key, newSelection)}
          visible={popoverInfo.visible}
          anchorRef={{ current: anchorRefs.current[popoverInfo.key] }}
          onClose={() => setPopoverInfo({ key: null, visible: false })}
          labelMap={STATUS_LABELS}
        />
      )}
    </>
  );
};

export default CustomersTable;
