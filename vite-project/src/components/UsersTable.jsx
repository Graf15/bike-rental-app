import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "../utils/api";
import { toast } from "../utils/toast";
import ConfirmModal from "./ConfirmModal";
import { useConfirm } from "../utils/useConfirm";
import TableControls from "./TableControls";
import MultiSelectPopover from "./MultiSelectPopover";
import "./BikeTable.css";

const ROLE_LABELS = {
  admin:    "Администратор",
  manager:  "Менеджер",
  mechanic: "Механик",
  employee: "Сотрудник",
};

const ROLE_BADGE = {
  admin:    "status-badge status-badge-purple",
  manager:  "status-badge status-badge-blue",
  mechanic: "status-badge status-badge-orange",
  employee: "status-badge",
};

const POPOVER_OPTIONS = {
  role: [
    { value: "admin",    label: "Администратор" },
    { value: "manager",  label: "Менеджер" },
    { value: "mechanic", label: "Механик" },
    { value: "employee", label: "Сотрудник" },
  ],
  is_active: [
    { value: "true",  label: "Активен" },
    { value: "false", label: "Деактивирован" },
  ],
};

const formatDate = (s) => {
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("ru-RU", { year: "numeric", month: "2-digit", day: "2-digit" });
  } catch { return "—"; }
};

const ColumnResizer = ({ onMouseDown }) => (
  <div className="column-resizer" onMouseDown={onMouseDown} onClick={e => e.stopPropagation()} />
);

const ALL_COLUMNS = [
  { key: "id",         label: "ID" },
  { key: "name",       label: "Имя" },
  { key: "email",      label: "Email" },
  { key: "phone",      label: "Телефон" },
  { key: "role",       label: "Роль" },
  { key: "is_active",  label: "Статус" },
  { key: "created_at", label: "Добавлен" },
];

const DEFAULT_VISIBLE = ["id", "name", "email", "phone", "role", "is_active", "created_at"];

const DEFAULT_WIDTHS = {
  id: 60, name: 180, email: 220, phone: 150, role: 150, is_active: 140, created_at: 120, actions: 160,
};

const LS = {
  widths:   "usersTableColumnWidths",
  order:    "usersTableColumnOrder",
  visible:  "usersTableVisibleColumns",
  pageSize: "usersTablePageSize",
};

const UsersTable = ({ users, onEdit, onUpdate }) => {
  const [sortColumn, setSortColumn]   = useState("name");
  const [sortAsc, setSortAsc]         = useState(true);
  const [filters, setFilters]         = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [popoverInfo, setPopoverInfo] = useState({ key: null, visible: false });
  const anchorRefs = useRef({});
  const [confirmProps, showConfirm]   = useConfirm();

  const [pageSize, setPageSize] = useState(() => {
    const s = localStorage.getItem(LS.pageSize);
    return s ? parseInt(s, 10) : 50;
  });
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const s = localStorage.getItem(LS.visible);
    return s ? JSON.parse(s) : DEFAULT_VISIBLE;
  });
  const [columnWidths, setColumnWidths] = useState(() => {
    const s = localStorage.getItem(LS.widths);
    return s ? { ...DEFAULT_WIDTHS, ...JSON.parse(s) } : DEFAULT_WIDTHS;
  });
  const [columnOrder, setColumnOrder] = useState(() => {
    const s = localStorage.getItem(LS.order);
    return s ? JSON.parse(s) : DEFAULT_VISIBLE;
  });

  // Resize refs
  const isResizing       = useRef(false);
  const resizingColumn   = useRef(null);
  const resizeStartX     = useRef(0);
  const resizeStartWidth = useRef(0);

  // Drag refs
  const draggedColumn  = useRef(null);
  const dragOverColumn = useRef(null);

  // --- Resize ---
  const saveWidths = useCallback((w) => localStorage.setItem(LS.widths, JSON.stringify(w)), []);

  const handleResizeStart = (e, key) => {
    e.preventDefault(); e.stopPropagation();
    isResizing.current = true;
    resizingColumn.current = key;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[key];
    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleResizeMove = useCallback((e) => {
    if (!isResizing.current) return;
    const newW = Math.max(50, resizeStartWidth.current + (e.clientX - resizeStartX.current));
    setColumnWidths(prev => {
      const next = { ...prev, [resizingColumn.current]: newW };
      saveWidths(next);
      return next;
    });
  }, [saveWidths]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizing.current) return;
    isResizing.current = false;
    resizingColumn.current = null;
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, [handleResizeMove]);

  useEffect(() => () => {
    document.removeEventListener("mousemove", handleResizeMove);
    document.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResizeMove, handleResizeEnd]);

  // --- Drag & drop ---
  const handleDragStart = (e, key) => {
    if (isResizing.current) { e.preventDefault(); return; }
    draggedColumn.current = key;
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => e.target.classList.add("dragging"), 0);
  };
  const handleDragOver  = (e, key) => { e.preventDefault(); dragOverColumn.current = key; };
  const handleDragEnter = (e, key) => {
    e.preventDefault();
    if (draggedColumn.current && draggedColumn.current !== key) e.target.classList.add("drag-over");
  };
  const handleDragLeave = (e) => {
    const r = e.target.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
      e.target.classList.remove("drag-over");
  };
  const handleDrop = (e, target) => {
    e.preventDefault();
    e.target.classList.remove("drag-over");
    const source = draggedColumn.current;
    if (source && source !== target) {
      const next = [...columnOrder];
      next.splice(next.indexOf(source), 1);
      next.splice(next.indexOf(target), 0, source);
      setColumnOrder(next);
      localStorage.setItem(LS.order, JSON.stringify(next));
    }
    draggedColumn.current = null;
    document.querySelectorAll(".users-table th").forEach(th => th.classList.remove("dragging", "drag-over"));
  };
  const handleDragEnd = (e) => {
    e.target.classList.remove("dragging");
    document.querySelectorAll(".users-table th").forEach(th => th.classList.remove("dragging", "drag-over"));
    draggedColumn.current = null;
  };

  // --- Dynamic CSS ---
  useEffect(() => {
    const ordered = getOrderedColumns();
    const totalW  = ordered.reduce((s, c) => s + (columnWidths[c.key] || 100), 0) + (columnWidths.actions || 160);
    let css = `.users-page .table-container table { width: ${totalW}px !important; }`;
    Object.entries(columnWidths).forEach(([k, w]) => {
      css += `
        .users-page .table-container th[data-column="${k}"],
        .users-page .table-container td[data-column="${k}"] {
          width: ${w}px !important; min-width: ${w}px !important; max-width: ${w}px !important;
        }`;
    });
    let el = document.getElementById("dynamic-users-table-styles");
    if (!el) { el = document.createElement("style"); el.id = "dynamic-users-table-styles"; document.head.appendChild(el); }
    el.textContent = css;
  }, [columnWidths, columnOrder]);

  // --- Sort & filter ---
  const handleSort = (col) => {
    if (sortColumn === col) setSortAsc(a => !a);
    else { setSortColumn(col); setSortAsc(true); }
    setCurrentPage(1);
  };

  const updateFilter = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const clearAllFilters = () => { setFilters({}); setCurrentPage(1); };

  const hasActiveFilters = Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : v !== ""));

  const filtered = users.filter(u => {
    return Object.entries(filters).every(([key, val]) => {
      if (!val || (Array.isArray(val) && val.length === 0)) return true;
      if (key === "role"      && Array.isArray(val)) return val.includes(u.role);
      if (key === "is_active" && Array.isArray(val)) return val.includes(String(u.is_active));
      return String(u[key] ?? "").toLowerCase().includes(String(val).toLowerCase());
    });
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortColumn) return 0;
    const va = a[sortColumn] ?? "";
    const vb = b[sortColumn] ?? "";
    return sortAsc
      ? String(va).localeCompare(String(vb), "ru")
      : String(vb).localeCompare(String(va), "ru");
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(currentPage, totalPages);
  const paginated  = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  // --- Columns ---
  const getOrderedColumns = () => {
    const order = columnOrder.filter(k => visibleColumns.includes(k));
    return ALL_COLUMNS.filter(c => order.includes(c.key)).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  };

  const toggleColumnVisibility = (key) => {
    const next = visibleColumns.includes(key) ? visibleColumns.filter(k => k !== key) : [...visibleColumns, key];
    setVisibleColumns(next);
    localStorage.setItem(LS.visible, JSON.stringify(next));
  };

  const handlePageSizeChange = (size) => {
    setPageSize(size);
    localStorage.setItem(LS.pageSize, String(size));
    setCurrentPage(1);
  };

  // --- Delete ---
  const handleDelete = (user) => {
    showConfirm({
      title: "Удалить сотрудника",
      message: `Удалить «${user.name}» (${user.email})? Все сессии будут завершены.`,
      confirmLabel: "Удалить",
      danger: true,
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/users/${user.id}`, { method: "DELETE" });
          if (!res.ok) { const d = await res.json(); toast.error(d.error || "Ошибка"); return; }
          toast.success(`Сотрудник «${user.name}» удалён`);
          onUpdate();
        } catch { toast.error("Ошибка сервера"); }
      },
    });
  };

  // --- Popover filter trigger ---
  const getFilterLabel = (key) => {
    const val = filters[key];
    if (!val || !val.length) return "Все";
    const opts = POPOVER_OPTIONS[key];
    return val.map(v => opts?.find(o => o.value === v)?.label ?? v).join(", ");
  };

  const orderedColumns = getOrderedColumns();

  const renderFilter = (key) => {
    if (POPOVER_OPTIONS[key]) {
      return (
        <div
          ref={el => anchorRefs.current[key] = el}
          className="filter-select-box"
          onClick={() => setPopoverInfo(p => ({ key, visible: p.key !== key || !p.visible }))}
        >
          <span>{getFilterLabel(key)}</span>
          <span className="arrow">▼</span>
        </div>
      );
    }
    return (
      <input
        type="text"
        placeholder="Фильтр"
        value={filters[key] || ""}
        onChange={e => updateFilter(key, e.target.value)}
      />
    );
  };

  const renderCell = (user, key) => {
    switch (key) {
      case "role":
        return <span className={ROLE_BADGE[user.role] || "status-badge"}>{ROLE_LABELS[user.role] || user.role}</span>;
      case "is_active":
        return <span className={user.is_active ? "status-badge status-badge-green" : "status-badge status-badge-red"}>
          {user.is_active ? "Активен" : "Деактивирован"}
        </span>;
      case "created_at":
        return formatDate(user.created_at);
      default:
        return user[key] ?? "—";
    }
  };

  return (
    <>
      <TableControls
        onClearFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        availableColumns={ALL_COLUMNS}
        visibleColumns={visibleColumns}
        onColumnVisibilityChange={toggleColumnVisibility}
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={sorted.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
      />

      <div className="table-container">
        <table className="users-table" style={{ tableLayout: "fixed" }}>
          <thead>
            <tr>
              {orderedColumns.map(col => (
                <th
                  key={col.key}
                  data-column={col.key}
                  draggable
                  onClick={() => handleSort(col.key)}
                  onDragStart={e => handleDragStart(e, col.key)}
                  onDragOver={e => handleDragOver(e, col.key)}
                  onDragEnter={e => handleDragEnter(e, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, col.key)}
                  onDragEnd={handleDragEnd}
                >
                  {col.label}{" "}
                  <span className="sort-arrow">{sortColumn === col.key && (sortAsc ? "▲" : "▼")}</span>
                  <ColumnResizer onMouseDown={e => handleResizeStart(e, col.key)} />
                </th>
              ))}
              <th data-column="actions">
                Действия
                <ColumnResizer onMouseDown={e => handleResizeStart(e, "actions")} />
              </th>
            </tr>
            <tr>
              {orderedColumns.map(col => (
                <th key={col.key} data-column={col.key}>{renderFilter(col.key)}</th>
              ))}
              <th data-column="actions" />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={orderedColumns.length + 1} style={{ textAlign: "center", color: "#6b7280", padding: 32 }}>
                  Нет сотрудников
                </td>
              </tr>
            )}
            {paginated.map(user => (
              <tr key={user.id} onDoubleClick={() => onEdit(user)} style={{ cursor: "pointer" }}>
                {orderedColumns.map(col => (
                  <td key={col.key} data-column={col.key}>{renderCell(user, col.key)}</td>
                ))}
                <td data-column="actions">
                  <div className="action-buttons">
                    <button className="btn btn-secondary-green btn-primary-small" onClick={() => onEdit(user)}>
                      Изменить
                    </button>
                    <button
                      className="btn btn-primary-small"
                      style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
                      onClick={() => handleDelete(user)}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {popoverInfo.visible && popoverInfo.key && POPOVER_OPTIONS[popoverInfo.key] && (
        <MultiSelectPopover
          options={POPOVER_OPTIONS[popoverInfo.key]}
          selected={filters[popoverInfo.key] || []}
          onChange={v => updateFilter(popoverInfo.key, v)}
          visible={popoverInfo.visible}
          anchorRef={{ current: anchorRefs.current[popoverInfo.key] }}
          onClose={() => setPopoverInfo({ key: null, visible: false })}
        />
      )}

      {confirmProps && <ConfirmModal {...confirmProps} />}
    </>
  );
};

export default UsersTable;
