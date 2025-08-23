import React, { useState, useRef, useEffect, useCallback } from "react";
import TableControls from "./TableControls";
import MultiSelectPopover from "./MultiSelectPopover";
import "./MaintenanceTable.css";
import "./BikeTable.css";

const MaintenanceTable = ({ events, onUpdate }) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filters, setFilters] = useState({});
  
  // Состояния для пагинации
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Состояния для ресайза столбцов
  const [columnWidths, setColumnWidths] = useState({});
  const [visibleColumns, setVisibleColumns] = useState([]);
  
  // Состояние для порядка столбцов
  const [columnOrder, setColumnOrder] = useState([]);
  
  // Refs для ресайза
  const isResizing = useRef(false);
  const resizingColumn = useRef(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  
  // Refs для drag & drop
  const draggedColumn = useRef(null);
  const dragOverColumn = useRef(null);
  
  // Состояния для поповеров фильтров
  const [popoverInfo, setPopoverInfo] = useState({ key: null, visible: false });
  const anchorRefs = useRef({});

  const statusOptions = ["запланирован", "в ремонте", "ожидает деталей", "ремонт выполнен"];
  const repairTypeOptions = ["current", "weekly", "longterm"];
  const priorityLabels = {
    1: "Критический", 
    2: "Высокий", 
    3: "Средний", 
    4: "Низкий", 
    5: "Очень низкий"
  };

  // Опции для выпадающих фильтров
  const selectOptions = {
    repair_type: ["current", "weekly", "longterm"],
    priority: ["1", "2", "3", "4", "5"],
    status: ["запланирован", "в ремонте", "ожидает деталей", "ремонт выполнен"]
  };

  // Инициализация столбцов и их настроек
  useEffect(() => {
    const defaultWidths = {
      id: 60,
      bike_number: 100,
      model: 120,
      repair_type: 100,
      priority: 100,
      status: 120,
      scheduled_date: 120,
      estimated_duration: 100,
      actual_duration: 100,
      estimated_cost: 110,
      actual_cost: 110,
      manager_name: 120,
      actions: 150
    };
    
    const savedWidths = localStorage.getItem('maintenanceTableColumnWidths');
    setColumnWidths(savedWidths ? JSON.parse(savedWidths) : defaultWidths);
    
    const defaultVisible = [
      "id", "bike_number", "model", "repair_type", "priority", 
      "status", "scheduled_date", "estimated_duration", 
      "actual_duration", "estimated_cost", "actual_cost", "manager_name"
    ];
    
    const defaultOrder = [
      "id", "bike_number", "model", "repair_type", "priority", 
      "status", "scheduled_date", "estimated_duration", 
      "actual_duration", "estimated_cost", "actual_cost", "manager_name"
    ];
    
    const savedVisible = localStorage.getItem('maintenanceTableVisibleColumns');
    setVisibleColumns(savedVisible ? JSON.parse(savedVisible) : defaultVisible);
    
    const savedOrder = localStorage.getItem('maintenanceTableColumnOrder');
    setColumnOrder(savedOrder ? JSON.parse(savedOrder) : defaultOrder);
  }, []);

  // Динамическое обновление CSS для ширин столбцов
  useEffect(() => {
    if (Object.keys(columnWidths).length === 0 || visibleColumns.length === 0) return;
    
    const visibleColumnsData = columns.filter(col => visibleColumns.includes(col.key));
    const totalWidth = visibleColumnsData.reduce((sum, col) => sum + (columnWidths[col.key] || 100), 0) + (columnWidths.actions || 150);
    
    let css = `
      .maintenance-table { width: ${totalWidth}px !important; }
    `;
    
    // Создаем CSS правила для каждого столбца по data-column атрибуту
    Object.entries(columnWidths).forEach(([columnKey, width]) => {
      css += `
        .maintenance-table th[data-column="${columnKey}"],
        .maintenance-table td[data-column="${columnKey}"] {
          width: ${width}px !important;
          min-width: ${width}px !important;
          max-width: ${width}px !important;
        }
      `;
    });
    
    const existingStyle = document.getElementById('maintenance-table-column-widths');
    if (existingStyle) {
      existingStyle.textContent = css;
    } else {
      const style = document.createElement('style');
      style.id = 'maintenance-table-column-widths';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }, [columnWidths, visibleColumns]);

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
    setCurrentPage(1);
  };

  // Функции для управления таблицей
  const clearAllFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    Array.isArray(value) ? value.length > 0 : value && value.trim() !== ''
  );

  const toggleColumnVisibility = (columnKey) => {
    const newVisibleColumns = visibleColumns.includes(columnKey)
      ? visibleColumns.filter(key => key !== columnKey)
      : [...visibleColumns, columnKey];
    
    setVisibleColumns(newVisibleColumns);
    localStorage.setItem('maintenanceTableVisibleColumns', JSON.stringify(newVisibleColumns));
  };

  // Функции для ресайза столбцов
  const saveColumnWidths = useCallback((widths) => {
    localStorage.setItem('maintenanceTableColumnWidths', JSON.stringify(widths));
  }, []);

  const handleResizeStart = (e, columnKey) => {
    e.preventDefault();
    isResizing.current = true;
    resizingColumn.current = columnKey;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[columnKey] || 100;
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResizeMove = useCallback((e) => {
    if (!isResizing.current || !resizingColumn.current) return;
    
    const deltaX = e.clientX - resizeStartX.current;
    const newWidth = Math.max(50, resizeStartWidth.current + deltaX);
    
    setColumnWidths(prevWidths => {
      const newWidths = { ...prevWidths, [resizingColumn.current]: newWidth };
      saveColumnWidths(newWidths);
      return newWidths;
    });
  }, [saveColumnWidths]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizing.current) return;
    
    isResizing.current = false;
    resizingColumn.current = null;
    
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleResizeMove]);

  // Функции для drag & drop столбцов
  const handleDragStart = (e, columnKey) => {
    if (isResizing.current) {
      e.preventDefault();
      return;
    }
    draggedColumn.current = columnKey;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', columnKey);
    
    // Добавляем CSS класс для визуальной обратной связи
    setTimeout(() => {
      e.target.classList.add('dragging');
    }, 0);
  };

  const handleDragOver = (e, columnKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverColumn.current = columnKey;
  };

  const handleDragEnter = (e, columnKey) => {
    e.preventDefault();
    if (draggedColumn.current && draggedColumn.current !== columnKey) {
      e.target.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e) => {
    // Проверяем, действительно ли мы покидаем элемент
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      e.target.classList.remove('drag-over');
    }
  };

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault();
    e.target.classList.remove('drag-over');
    
    const sourceColumnKey = draggedColumn.current;
    if (sourceColumnKey && sourceColumnKey !== targetColumnKey) {
      const newOrder = [...columnOrder];
      const sourceIndex = newOrder.indexOf(sourceColumnKey);
      const targetIndex = newOrder.indexOf(targetColumnKey);
      
      // Перемещаем столбец
      newOrder.splice(sourceIndex, 1);
      newOrder.splice(targetIndex, 0, sourceColumnKey);
      
      setColumnOrder(newOrder);
      localStorage.setItem('maintenanceTableColumnOrder', JSON.stringify(newOrder));
    }
    
    draggedColumn.current = null;
    dragOverColumn.current = null;
    
    // Очищаем все CSS классы
    document.querySelectorAll('.maintenance-table th').forEach(th => {
      th.classList.remove('dragging', 'drag-over');
    });
  };

  const handleDragEnd = (e) => {
    // Очищаем CSS классы
    e.target.classList.remove('dragging');
    document.querySelectorAll('.maintenance-table th').forEach(th => {
      th.classList.remove('drag-over');
    });
    
    draggedColumn.current = null;
    dragOverColumn.current = null;
  };

  // Очистка event listeners при unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [handleResizeMove, handleResizeEnd]);

  // Функции для пагинации
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const filteredEvents = events.filter((event) => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value || value.length === 0) return true;
      
      // Обработка для массивов (выпадающие фильтры)
      if (Array.isArray(value)) {
        return value.includes(String(event[key]));
      }
      
      // Текстовый поиск
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

  // Пагинация
  const totalPages = Math.ceil(sortedEvents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedEvents = sortedEvents.slice(startIndex, startIndex + itemsPerPage);

  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("ru-RU");
  };

  const getStatusClass = (status) => {
    switch (status) {
      case "запланирован":
        return "status-badge status-badge-blue";
      case "в ремонте":
        return "status-badge status-badge-orange";
      case "ожидает деталей":
        return "status-badge status-badge-purple";
      case "ремонт выполнен":
        return "status-badge status-badge-green";
      default:
        return "status-badge";
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
    { key: "status", label: "Статус" },
    { key: "scheduled_date", label: "Запланировано" },
    { key: "estimated_duration", label: "План. время" },
    { key: "actual_duration", label: "Факт. время" },
    { key: "estimated_cost", label: "План. стоимость" },
    { key: "actual_cost", label: "Факт. стоимость" },
    { key: "manager_name", label: "Менеджер" },
  ];

  // Получаем упорядоченные столбцы согласно columnOrder
  const getOrderedColumns = () => {
    if (columnOrder.length === 0) return columns;
    
    const orderedColumns = [];
    const columnMap = new Map(columns.map(col => [col.key, col]));
    
    // Добавляем столбцы в порядке columnOrder
    columnOrder.forEach(key => {
      if (columnMap.has(key)) {
        orderedColumns.push(columnMap.get(key));
      }
    });
    
    // Добавляем любые новые столбцы, которых нет в columnOrder
    columns.forEach(col => {
      if (!columnOrder.includes(col.key)) {
        orderedColumns.push(col);
      }
    });
    
    return orderedColumns;
  };

  const orderedColumns = getOrderedColumns();

  return (
    <>
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
            В работе: {sortedEvents.filter(e => e.status === 'в ремонте').length}
          </span>
        </div>
      </div>

      <TableControls
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
        availableColumns={orderedColumns}
        visibleColumns={visibleColumns}
        onColumnVisibilityChange={toggleColumnVisibility}
        totalItems={sortedEvents.length}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />

      <div className="table-container">
        <table className="maintenance-table">
          <thead>
            <tr>
              {orderedColumns.filter(col => visibleColumns.includes(col.key)).map(({ key, label }) => (
                <th 
                  key={key}
                  data-column={key}
                  draggable
                  onClick={() => handleSort(key)}
                  onDragStart={(e) => handleDragStart(e, key)}
                  onDragOver={(e) => handleDragOver(e, key)}
                  onDragEnter={(e) => handleDragEnter(e, key)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, key)}
                  onDragEnd={handleDragEnd}
                  style={{ cursor: isResizing.current ? 'col-resize' : 'move' }}
                >
                  {label}{" "}
                  <span className="sort-arrow">
                    {sortColumn === key && (sortAsc ? "▲" : "▼")}
                  </span>
                  <div
                    className="column-resizer"
                    onMouseDown={(e) => handleResizeStart(e, key)}
                  />
                </th>
              ))}
              <th data-column="actions" onClick={() => handleSort('actions')}>
                Действия
                <div
                  className="column-resizer"
                  onMouseDown={(e) => handleResizeStart(e, 'actions')}
                />
              </th>
            </tr>
            <tr className="filter-row">
              {orderedColumns.filter(col => visibleColumns.includes(col.key)).map(({ key }) => (
                <th key={key} data-column={key}>
                  {selectOptions[key] ? (
                    <div
                      ref={(el) => (anchorRefs.current[key] = el)}
                      onClick={() =>
                        setPopoverInfo({
                          key,
                          visible:
                            popoverInfo.key !== key || !popoverInfo.visible,
                        })
                      }
                      className="filter-select-box"
                    >
                      {filters[key]?.length > 0 ? filters[key].join(", ") : "Все"}
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
            <th data-column="actions"></th>
          </tr>
          </thead>
          <tbody>
            {paginatedEvents.map((event) => (
              <tr key={event.id} className={event.is_overdue ? 'row-overdue' : ''}>
                {orderedColumns.filter(col => visibleColumns.includes(col.key)).map(({ key }) => {
                  if (key === 'id') {
                    return <td key={key} data-column={key}>{event.id}</td>;
                  }
                  if (key === 'bike_number') {
                    return (
                      <td key={key} data-column={key}>
                        <div className="bike-info">
                          <span className="bike-number">{event.bike_number}</span>
                          {event.is_overdue && (
                            <span className="overdue-badge" title="Просроченный ремонт">
                              ⚠️
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  }
                  if (key === 'model') {
                    return <td key={key} data-column={key}>{event.model}</td>;
                  }
                  if (key === 'repair_type') {
                    return (
                      <td key={key} data-column={key}>
                        <span className={`repair-type-badge repair-type-${event.repair_type}`}>
                          {getRepairTypeLabel(event.repair_type)}
                        </span>
                      </td>
                    );
                  }
                  if (key === 'priority') {
                    return (
                      <td key={key} data-column={key}>
                        <div className="priority-cell">
                          <span className={`priority-badge ${getPriorityClass(event.priority)}`}>
                            {event.priority}
                          </span>
                          <span className="priority-label">
                            {priorityLabels[event.priority]}
                          </span>
                        </div>
                      </td>
                    );
                  }
                  if (key === 'status') {
                    return (
                      <td key={key} data-column={key}>
                        <span className={getStatusClass(event.status)}>
                          {event.status}
                        </span>
                      </td>
                    );
                  }
                  if (key === 'scheduled_date') {
                    return (
                      <td key={key} data-column={key}>
                        <div className="date-cell">
                          {formatDate(event.scheduled_date)}
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
                    );
                  }
                  if (key === 'estimated_duration') {
                    return <td key={key} data-column={key}>{formatDuration(event.estimated_duration)}</td>;
                  }
                  if (key === 'actual_duration') {
                    return (
                      <td key={key} data-column={key}>
                        <span className={event.actual_duration > event.estimated_duration ? 'duration-exceeded' : ''}>
                          {formatDuration(event.actual_duration)}
                        </span>
                      </td>
                    );
                  }
                  if (key === 'estimated_cost') {
                    return <td key={key} data-column={key}>{formatCurrency(event.estimated_cost)}</td>;
                  }
                  if (key === 'actual_cost') {
                    return (
                      <td key={key} data-column={key}>
                        <span className={Number(event.actual_cost) > Number(event.estimated_cost) ? 'cost-exceeded' : ''}>
                          {formatCurrency(event.actual_cost)}
                        </span>
                      </td>
                    );
                  }
                  if (key === 'manager_name') {
                    return <td key={key} data-column={key}>{event.manager_name}</td>;
                  }
                  return <td key={key} data-column={key}>{event[key] || "—"}</td>;
                })}
              <td data-column="actions">
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

      {/* Поповеры для фильтров */}
      {popoverInfo.visible &&
        popoverInfo.key &&
        Array.isArray(selectOptions[popoverInfo.key]) && (
          <MultiSelectPopover
            options={selectOptions[popoverInfo.key]}
            selected={filters[popoverInfo.key] || []}
            onChange={(newSelection) =>
              updateFilter(popoverInfo.key, newSelection)
            }
            visible={popoverInfo.visible}
            anchorRef={{ current: anchorRefs.current[popoverInfo.key] }}
            onClose={() => setPopoverInfo({ key: null, visible: false })}
          />
        )}
    </>
  );
};

export default MaintenanceTable;
