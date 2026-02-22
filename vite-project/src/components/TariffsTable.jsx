import { useState, useRef, useEffect, useCallback } from "react";
import BikeActionsMenu from "./BikeActionsMenu";
import TableControls from "./TableControls";
import MultiSelectPopover from "./MultiSelectPopover";
import { TARIFF_OPTIONS } from "../constants/selectOptions";
import "./BikeTable.css";
import "./TariffsTable.css";

const ColumnResizer = ({ onMouseDown }) => (
  <div
    className="column-resizer"
    onMouseDown={onMouseDown}
    onClick={(e) => e.stopPropagation()}
  />
);

const TariffsTable = ({ tariffs, onEdit, onDelete, onToggleActive }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filters, setFilters] = useState({});
  const [popoverInfo, setPopoverInfo] = useState({ key: null, visible: false });
  const anchorRefs = useRef({});

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem("tariffsTablePageSize");
    return saved ? parseInt(saved, 10) : 50;
  });
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem("tariffsTableVisibleColumns");
    return saved
      ? JSON.parse(saved)
      : ["id", "name", "description", "price_first_hour", "price_next_hour", "price_day", "price_24h", "price_week", "is_active"];
  });

  const defaultColumnWidths = {
    id: 60,
    name: 180,
    description: 220,
    price_first_hour: 110,
    price_next_hour: 110,
    price_day: 100,
    price_24h: 100,
    price_week: 100,
    is_active: 100,
    actions: 100,
  };

  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem("tariffsTableColumnWidths");
    return saved ? { ...defaultColumnWidths, ...JSON.parse(saved) } : defaultColumnWidths;
  });

  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem("tariffsTableColumnOrder");
    return saved
      ? JSON.parse(saved)
      : ["id", "name", "description", "price_first_hour", "price_next_hour", "price_day", "price_24h", "price_week", "is_active"];
  });

  const isResizing = useRef(false);
  const resizingColumn = useRef(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const draggedColumn = useRef(null);
  const dragOverColumn = useRef(null);
  const tableContainerRef = useRef(null);

  const saveColumnWidths = useCallback((widths) => {
    localStorage.setItem("tariffsTableColumnWidths", JSON.stringify(widths));
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
    e.dataTransfer.setData("text/html", columnKey);
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
      localStorage.setItem("tariffsTableColumnOrder", JSON.stringify(newOrder));
    }
    draggedColumn.current = null;
    dragOverColumn.current = null;
    document.querySelectorAll(".tariffs-table th").forEach((th) => th.classList.remove("dragging", "drag-over"));
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove("dragging");
    document.querySelectorAll(".tariffs-table th").forEach((th) => th.classList.remove("drag-over"));
    draggedColumn.current = null;
    dragOverColumn.current = null;
  };

  useEffect(() => {
    const orderedCols = getOrderedColumns();
    const totalWidth =
      orderedCols.reduce((sum, col) => sum + (columnWidths[col.key] || 100), 0) +
      (columnWidths.actions || 100);

    let css = `.tariffs-page .table-container table { width: ${totalWidth}px !important; }`;
    Object.entries(columnWidths).forEach(([key, width]) => {
      css += `
        .tariffs-page .table-container th[data-column="${key}"],
        .tariffs-page .table-container td[data-column="${key}"] {
          width: ${width}px !important;
          min-width: ${width}px !important;
          max-width: ${width}px !important;
        }`;
    });

    let styleEl = document.getElementById("dynamic-tariffs-table-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "dynamic-tariffs-table-styles";
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

  const toggleColumnVisibility = (key) => {
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter((k) => k !== key)
      : [...visibleColumns, key];
    setVisibleColumns(next);
    localStorage.setItem("tariffsTableVisibleColumns", JSON.stringify(next));
  };

  const handlePageChange = (page) => setCurrentPage(page);
  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1);
    localStorage.setItem("tariffsTablePageSize", size.toString());
  };

  const fmt = (val) => (val != null ? `${val} ₴` : "—");

  const columns = [
    { key: "id",               label: "ID"           },
    { key: "name",             label: "Название"      },
    { key: "description",      label: "Описание"      },
    { key: "price_first_hour", label: "Первый час"    },
    { key: "price_next_hour",  label: "Доп. час"      },
    { key: "price_day",        label: "День"          },
    { key: "price_24h",        label: "Сутки (24ч)"   },
    { key: "price_week",       label: "Неделя"        },
    { key: "is_active",        label: "Статус"        },
  ];

  const getOrderedColumns = () => {
    const map = new Map(columns.map((c) => [c.key, c]));
    const ordered = columnOrder.filter((k) => map.has(k)).map((k) => map.get(k));
    columns.forEach((c) => { if (!columnOrder.includes(c.key)) ordered.push(c); });
    return ordered;
  };

  const orderedColumns = getOrderedColumns();
  const visibleColumnsData = orderedColumns.filter((c) => visibleColumns.includes(c.key));

  const filteredTariffs = tariffs.filter((t) =>
    Object.entries(filters).every(([key, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return true;
      if (Array.isArray(value)) {
        // is_active — булево, сравниваем напрямую
        if (key === "is_active") return value.some((v) => v === t[key]);
        return value.includes(String(t[key]));
      }
      return String(t[key] ?? "").toLowerCase().includes(value.toLowerCase());
    })
  );

  const sortedTariffs = [...filteredTariffs].sort((a, b) => {
    if (!sortColumn) return 0;
    const va = a[sortColumn], vb = b[sortColumn];
    if (va == null) return sortAsc ? 1 : -1;
    if (vb == null) return sortAsc ? -1 : 1;
    if (typeof va === "number") return sortAsc ? va - vb : vb - va;
    return sortAsc ? String(va).localeCompare(String(vb), "ru") : String(vb).localeCompare(String(va), "ru");
  });

  const totalItems = sortedTariffs.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedTariffs = sortedTariffs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const renderCell = (tariff, key) => {
    switch (key) {
      case "price_first_hour": return fmt(tariff.price_first_hour);
      case "price_next_hour":  return fmt(tariff.price_next_hour);
      case "price_day":        return fmt(tariff.price_day);
      case "price_24h":        return fmt(tariff.price_24h);
      case "price_week":       return fmt(tariff.price_week);
      case "is_active":
        return (
          <span
            className={`status-badge ${tariff.is_active ? "status-badge-green" : ""}`}
            style={{ cursor: "pointer" }}
            title="Нажмите для переключения"
            onClick={(e) => { e.stopPropagation(); onToggleActive(tariff); }}
          >
            {tariff.is_active ? "Активен" : "Отключён"}
          </span>
        );
      default: return tariff[key] ?? "—";
    }
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
        <table className="tariffs-table">
          <thead>
            {/* Строка заголовков */}
            <tr>
              {visibleColumnsData.map(({ key, label }) => (
                <th
                  key={key}
                  data-column={key}
                  draggable
                  style={{ width: columnWidths[key], cursor: !isResizing.current ? "move" : "default" }}
                  onClick={() => handleSort(key)}
                  onDragStart={(e) => handleDragStart(e, key)}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragEnter={(e) => handleDragEnter(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, key)}
                  onDragEnd={handleDragEnd}
                >
                  {label}{" "}
                  <span className="sort-arrow">
                    {sortColumn === key && (sortAsc ? "▲" : "▼")}
                  </span>
                  <ColumnResizer onMouseDown={(e) => handleResizeStart(e, key)} />
                </th>
              ))}
              <th data-column="actions" style={{ width: columnWidths.actions }}>
                Действия
                <ColumnResizer onMouseDown={(e) => handleResizeStart(e, "actions")} />
              </th>
            </tr>
            {/* Строка фильтров */}
            <tr>
              {visibleColumnsData.map(({ key }) => (
                <th key={key} data-column={key} style={{ width: columnWidths[key] }}>
                  {TARIFF_OPTIONS[key] ? (
                    <div
                      ref={(el) => (anchorRefs.current[key] = el)}
                      onClick={() =>
                        setPopoverInfo({ key, visible: popoverInfo.key !== key || !popoverInfo.visible })
                      }
                      className="filter-select-box"
                    >
                      {filters[key]?.length > 0
                        ? filters[key].map((v) => {
                            const opt = TARIFF_OPTIONS[key].find((o) => (o.value ?? o) === v);
                            return opt?.label ?? String(v);
                          }).join(", ")
                        : "Все"}
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
              <th data-column="actions" style={{ width: columnWidths.actions }} />
            </tr>
          </thead>
          <tbody>
            {paginatedTariffs.map((tariff) => (
              <tr key={tariff.id} onDoubleClick={() => onEdit(tariff)}>
                {visibleColumnsData.map(({ key }) => (
                  <td key={key} data-column={key} style={{ width: columnWidths[key] }}>
                    {renderCell(tariff, key)}
                  </td>
                ))}
                <td data-column="actions" style={{ width: columnWidths.actions }} onClick={(e) => e.stopPropagation()}>
                  <BikeActionsMenu
                    bike={{ ...tariff, model: tariff.name }}
                    onEdit={() => onEdit(tariff)}
                    onCopy={null}
                    onDelete={() => onDelete(tariff.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {popoverInfo.visible && popoverInfo.key && TARIFF_OPTIONS[popoverInfo.key] && (
        <MultiSelectPopover
          options={TARIFF_OPTIONS[popoverInfo.key]}
          selected={filters[popoverInfo.key] || []}
          onChange={(sel) => updateFilter(popoverInfo.key, sel)}
          visible={popoverInfo.visible}
          anchorRef={{ current: anchorRefs.current[popoverInfo.key] }}
          onClose={() => setPopoverInfo({ key: null, visible: false })}
        />
      )}
    </>
  );
};

export default TariffsTable;
