import { useState, useRef, useEffect, useCallback } from "react";
import TableControls from "./TableControls";
import MultiSelectPopover from "./MultiSelectPopover";
import BikeActionsMenu from "./BikeActionsMenu";
import DateRangePickerFilter from "./DateRangePickerFilter";
import { RENTAL_OPTIONS } from "../constants/selectOptions";
import "./BikeTable.css";
import "./RentalsTable.css";

const DATE_RANGE_KEYS = new Set(["booked_start", "booked_end"]);

const formatDate = (dateString) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

const STATUS_LABELS = Object.fromEntries(RENTAL_OPTIONS.status.map(o => [o.value, o.label]));
const DEPOSIT_LABELS = Object.fromEntries(RENTAL_OPTIONS.deposit_type.map(o => [o.value, o.label]));

const STATUS_COLORS = {
  booked:    "status-badge status-badge-blue",
  active:    "status-badge status-badge-green",
  completed: "status-badge",
  cancelled: "status-badge status-badge-gray",
  no_show:   "status-badge status-badge-red",
  overdue:   "status-badge status-badge-orange",
};

const ColumnResizer = ({ onMouseDown }) => (
  <div className="column-resizer" onMouseDown={onMouseDown} onClick={(e) => e.stopPropagation()} />
);

const SERVER_FILTER_KEYS = new Set([
  "id", "customer_name", "phone", "status",
  "booked_start", "booked_end", "bike_models",
  "deposit_type", "deposit_value", "total_price",
  "issued_by_name", "notes_issue",
]);

const RentalsTable = ({ rentals, onRentalUpdate, onRentalEdit, onRentalDelete, onRentalOpen, statusFilter, onServerSearch }) => {
  const [sortColumn, setSortColumn] = useState("id");
  const [sortAsc, setSortAsc] = useState(false);
  const [filters, setFilters] = useState({});
  const [popoverInfo, setPopoverInfo] = useState({ key: null, visible: false });
  const anchorRefs = useRef({});

  useEffect(() => {
    setFilters(prev => ({ ...prev, status: statusFilter && statusFilter.length > 0 ? statusFilter : undefined }));
    setCurrentPage(1);
  }, [JSON.stringify(statusFilter)]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => parseInt(localStorage.getItem("rentalsTablePageSize") || "50"));

  const defaultColumnWidths = {
    id: 60, customer_name: 180, phone: 130, status: 120,
    booked_start: 140, booked_end: 140, bikes_count: 70,
    bike_models: 200, deposit_type: 110, deposit_value: 120,
    total_price: 100, issued_by_name: 130, notes_issue: 180, actions: 90,
  };

  const defaultOrder = [
    "id", "customer_name", "phone", "status", "booked_start", "booked_end",
    "bikes_count", "bike_models", "deposit_type", "deposit_value", "total_price",
    "issued_by_name", "notes_issue",
  ];

  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem("rentalsTableColumnWidths");
    return saved ? { ...defaultColumnWidths, ...JSON.parse(saved) } : defaultColumnWidths;
  });
  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem("rentalsTableColumnOrder");
    return saved ? JSON.parse(saved) : defaultOrder;
  });
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem("rentalsTableVisibleColumns");
    return saved ? JSON.parse(saved) : defaultOrder;
  });

  const isResizing = useRef(false);
  const resizingColumn = useRef(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const draggedColumn = useRef(null);

  const saveColumnWidths = useCallback((w) => localStorage.setItem("rentalsTableColumnWidths", JSON.stringify(w)), []);

  const handleResizeStart = (e, key) => {
    e.preventDefault(); e.stopPropagation();
    isResizing.current = true; resizingColumn.current = key;
    resizeStartX.current = e.clientX; resizeStartWidth.current = columnWidths[key];
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };
  const handleResizeMove = useCallback((e) => {
    if (!isResizing.current) return;
    const newWidth = Math.max(50, resizeStartWidth.current + e.clientX - resizeStartX.current);
    setColumnWidths(prev => { const w = { ...prev, [resizingColumn.current]: newWidth }; saveColumnWidths(w); return w; });
  }, [saveColumnWidths]);
  const handleResizeEnd = useCallback(() => {
    isResizing.current = false; resizingColumn.current = null;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = ""; document.body.style.userSelect = "";
  }, [handleResizeMove]);

  useEffect(() => () => {
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResizeMove, handleResizeEnd]);

  const handleDragStart = (e, key) => { if (isResizing.current) { e.preventDefault(); return; } draggedColumn.current = key; setTimeout(() => e.target.classList.add("dragging"), 0); };
  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDragEnter = (e, key) => { e.preventDefault(); if (draggedColumn.current && draggedColumn.current !== key) e.target.classList.add("drag-over"); };
  const handleDragLeave = (e) => { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.classList.remove("drag-over"); };
  const handleDrop = (e, targetKey) => {
    e.preventDefault(); e.target.classList.remove("drag-over");
    const srcKey = draggedColumn.current;
    if (srcKey && srcKey !== targetKey) {
      const newOrder = [...columnOrder];
      newOrder.splice(newOrder.indexOf(srcKey), 1);
      newOrder.splice(newOrder.indexOf(targetKey), 0, srcKey);
      setColumnOrder(newOrder);
      localStorage.setItem("rentalsTableColumnOrder", JSON.stringify(newOrder));
    }
    draggedColumn.current = null;
    document.querySelectorAll(".rentals-table th").forEach(th => th.classList.remove("dragging", "drag-over"));
  };
  const handleDragEnd = (e) => {
    e.target.classList.remove("dragging");
    document.querySelectorAll(".rentals-table th").forEach(th => th.classList.remove("drag-over"));
    draggedColumn.current = null;
  };

  useEffect(() => {
    const ordered = getOrderedColumns();
    const totalWidth = ordered.reduce((s, c) => s + (columnWidths[c.key] || 100), 0) + (columnWidths.actions || 90);
    let css = `.rentals-page .table-container table { width: ${totalWidth}px !important; }`;
    Object.entries(columnWidths).forEach(([key, width]) => {
      css += `.rentals-page .table-container th[data-column="${key}"], .rentals-page .table-container td[data-column="${key}"] { width:${width}px!important;min-width:${width}px!important;max-width:${width}px!important; }`;
    });
    let el = document.getElementById("dynamic-rentals-table-styles");
    if (!el) { el = document.createElement("style"); el.id = "dynamic-rentals-table-styles"; document.head.appendChild(el); }
    el.textContent = css;
  }, [columnWidths, columnOrder]);

  const handleSort = (col) => { if (sortColumn === col) setSortAsc(!sortAsc); else { setSortColumn(col); setSortAsc(true); } };
  const updateFilter = (field, value) => {
    setFilters(p => {
      const next = { ...p, [field]: value };
      if (onServerSearch && SERVER_FILTER_KEYS.has(field)) onServerSearch(next);
      return next;
    });
    setCurrentPage(1);
  };
  const clearAllFilters = () => { setFilters({}); setCurrentPage(1); if (onServerSearch) onServerSearch({}); };
  const hasActiveFilters = Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : !!v);

  const toggleColumnVisibility = (key) => {
    const nv = visibleColumns.includes(key) ? visibleColumns.filter(k => k !== key) : [...visibleColumns, key];
    setVisibleColumns(nv);
    localStorage.setItem("rentalsTableVisibleColumns", JSON.stringify(nv));
  };

  const columns = [
    { key: "id",           label: "№" },
    { key: "customer_name",label: "Клиент" },
    { key: "phone",        label: "Телефон" },
    { key: "status",       label: "Статус" },
    { key: "booked_start", label: "Начало" },
    { key: "booked_end",   label: "Конец" },
    { key: "bikes_count",  label: "Велосипедов" },
    { key: "bike_models",  label: "Модели" },
    { key: "deposit_type", label: "Залог" },
    { key: "deposit_value",label: "Сумма/Документ" },
    { key: "total_price",  label: "Итого" },
    { key: "issued_by_name", label: "Выдал" },
    { key: "notes_issue",  label: "Заметки" },
  ];

  const getOrderedColumns = () => {
    const map = new Map(columns.map(c => [c.key, c]));
    const ordered = columnOrder.filter(k => map.has(k)).map(k => map.get(k));
    columns.forEach(c => { if (!columnOrder.includes(c.key)) ordered.push(c); });
    return ordered;
  };

  const filteredRentals = rentals.filter(r =>
    Object.entries(filters).every(([key, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return true;
      // Фильтр по диапазону дат
      if (DATE_RANGE_KEYS.has(key) && typeof value === "object" && !Array.isArray(value)) {
        const d = r[key] ? new Date(r[key]) : null;
        if (!d || isNaN(d)) return !value.from && !value.to;
        if (value.from && d < new Date(value.from)) return false;
        if (value.to   && d > new Date(value.to + "T23:59:59")) return false;
        return true;
      }
      const cell = key === "customer_name"
        ? `${r.last_name ? r.last_name + " " : ""}${r.first_name}`
        : r[key];
      if (Array.isArray(value)) return value.includes(r[key]);
      return String(cell || "").toLowerCase().includes(value.toLowerCase());
    })
  );

  const sortedRentals = [...filteredRentals].sort((a, b) => {
    if (!sortColumn) return 0;
    const vA = sortColumn === "customer_name" ? `${a.last_name ? a.last_name + " " : ""}${a.first_name}` : a[sortColumn];
    const vB = sortColumn === "customer_name" ? `${b.last_name ? b.last_name + " " : ""}${b.first_name}` : b[sortColumn];
    if (vA == null) return sortAsc ? 1 : -1;
    if (vB == null) return sortAsc ? -1 : 1;
    if (typeof vA === "number") return sortAsc ? vA - vB : vB - vA;
    return sortAsc ? String(vA).localeCompare(String(vB), "ru") : String(vB).localeCompare(String(vA), "ru");
  });

  const totalItems = sortedRentals.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginated = sortedRentals.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const orderedColumns = getOrderedColumns();
  const visibleColumnsData = orderedColumns.filter(c => visibleColumns.includes(c.key));
  const selectOptions = RENTAL_OPTIONS;

  const renderCell = (r, key) => {
    if (key === "customer_name") return [r.last_name, r.first_name, r.middle_name].filter(Boolean).join(" ");
    if (key === "status") return <span className={STATUS_COLORS[r.status] || "status-badge"}>{STATUS_LABELS[r.status] || r.status}</span>;
    if (key === "deposit_type") return DEPOSIT_LABELS[r.deposit_type] || r.deposit_type || "—";
    if (key === "booked_start" || key === "booked_end") return formatDate(r[key]);
    if (key === "bikes_count") return r.bikes_count || "—";
    if (key === "bike_models") {
      if (!r.bike_models) return "—";
      const lines = r.bike_models.split("\n").filter(Boolean);
      if (lines.length === 1) return lines[0];
      return <>{lines.map((l, i) => <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>{l}</div>)}</>;
    }
    if (key === "total_price") return r.total_price ? `${r.total_price} грн` : "—";
    return r[key] || "—";
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
        onPageChange={setCurrentPage}
        onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); localStorage.setItem("rentalsTablePageSize", s.toString()); }}
      />

      <div className="table-container">
        <table className="rentals-table">
          <thead>
            <tr>
              {visibleColumnsData.map(({ key, label }) => (
                <th key={key} data-column={key} draggable
                  style={{ width: columnWidths[key] }}
                  onClick={() => handleSort(key)}
                  onDragStart={(e) => handleDragStart(e, key)}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, key)}
                  onDragEnd={handleDragEnd}
                >
                  {label} <span className="sort-arrow">{sortColumn === key && (sortAsc ? "▲" : "▼")}</span>
                  <ColumnResizer onMouseDown={(e) => handleResizeStart(e, key)} />
                </th>
              ))}
              <th data-column="actions" style={{ width: columnWidths.actions }}>
                Действия <ColumnResizer onMouseDown={(e) => handleResizeStart(e, "actions")} />
              </th>
            </tr>
            <tr>
              {visibleColumnsData.map(({ key }) => (
                <th key={key} data-column={key} style={{ width: columnWidths[key] }}>
                  {DATE_RANGE_KEYS.has(key) ? (
                    <DateRangePickerFilter
                      value={filters[key] || null}
                      onChange={(v) => updateFilter(key, v)}
                    />
                  ) : selectOptions[key] ? (
                    <div ref={(el) => (anchorRefs.current[key] = el)}
                      onClick={() => setPopoverInfo({ key, visible: popoverInfo.key !== key || !popoverInfo.visible })}
                      className="filter-select-box">
                      {filters[key]?.length > 0
                        ? filters[key].map(v => STATUS_LABELS[v] || DEPOSIT_LABELS[v] || v).join(", ")
                        : "Все"}
                      <span className="arrow">▼</span>
                    </div>
                  ) : (
                    <input type="text" placeholder="Фильтр"
                      value={filters[key] || ""}
                      onChange={(e) => updateFilter(key, e.target.value)} />
                  )}
                </th>
              ))}
              <th data-column="actions" style={{ width: columnWidths.actions }}></th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(r => (
              <tr key={r.id}
                className={`rental-row rental-row--${r.status}`}
                onDoubleClick={() => onRentalOpen && onRentalOpen(r)}
              >
                {visibleColumnsData.map(({ key }) => (
                  <td key={key} data-column={key} style={{ width: columnWidths[key] }}>
                    {renderCell(r, key)}
                  </td>
                ))}
                <td data-column="actions" style={{ width: columnWidths.actions }}>
                  <BikeActionsMenu
                    bike={{ ...r, model: `Договор #${r.id}` }}
                    onEdit={() => onRentalEdit && onRentalEdit(r)}
                    onCopy={null}
                    onDelete={() => onRentalDelete && onRentalDelete(r.id)}
                  />
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr><td colSpan={visibleColumnsData.length + 1} style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                Договоры не найдены
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {popoverInfo.visible && popoverInfo.key && Array.isArray(selectOptions[popoverInfo.key]) && (
        <MultiSelectPopover
          options={selectOptions[popoverInfo.key]}
          selected={filters[popoverInfo.key] || []}
          onChange={(v) => updateFilter(popoverInfo.key, v)}
          visible={popoverInfo.visible}
          anchorRef={{ current: anchorRefs.current[popoverInfo.key] }}
          onClose={() => setPopoverInfo({ key: null, visible: false })}
        />
      )}
    </>
  );
};

export default RentalsTable;
