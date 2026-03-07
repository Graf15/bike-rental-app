import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import TableControls from "./TableControls";
import MultiSelectPopover from "./MultiSelectPopover";
import DateRangePickerFilter from "./DateRangePickerFilter";
import { BIKE_OPTIONS } from "../constants/selectOptions";
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


  // Метки для отображения
  const statusLabels = {
    "planned": "Запланирован",
    "in_progress": "В ремонте", 
    "completed": "Завершен"
  };

  const maintenanceTypeLabels = {
    "current": "Текущий",
    "weekly": "Еженедельный",
    "longterm": "Долгосрочный"
  };

  const partsNeedLabels = {
    "not_needed": "Не нужны",
    "needed": "Требуются",
    "ordered": "Заказаны",
    "delivered": "Получены"
  };

  // Опции для выпадающих фильтров
  const selectOptions = {
    maintenance_type: ["current", "weekly", "longterm"],
    status: ["planned", "in_progress", "completed"],
    parts_need: ["not_needed", "needed", "ordered", "delivered"],
    ...BIKE_OPTIONS
  };

  // Поля для календарных фильтров
  const dateRangeOptions = [
    "scheduled_at",
    "scheduled_for", 
    "started_at",
    "completed_at",
    "tested_at",
    "parts_needed_at",
    "parts_ordered_at",
    "parts_delivered_at",
    "created_at"
  ];

  // Определение столбцов таблицы
  const columns = useMemo(() => [
    { key: "id", label: "ID" },
    { key: "internal_article", label: "Внутр. артикул" },
    { key: "model", label: "Модель" },
    { key: "brand_name", label: "Бренд" },
    { key: "model_year", label: "Год" },
    { key: "wheel_size", label: "Размер колеса" },
    { key: "frame_size", label: "Рама" },
    { key: "frame_number", label: "Номер рамы" },
    { key: "gender", label: "Пол" },
    { key: "tariff_name", label: "Тариф" },
    { key: "condition_status", label: "Состояние" },
    { key: "maintenance_type", label: "Тип ТО" },
    { key: "status", label: "Статус" },
    { key: "parts_need", label: "Запчасти" },
    { key: "scheduled_for", label: "План на" },
    { key: "started_at", label: "Начат" },
    { key: "completed_at", label: "Завершен" },
    { key: "tested_at", label: "Обкатка" },
    { key: "repair_hours", label: "Время ремонта" },
    { key: "parts_wait_hours", label: "Ожидание запчастей" },
    { key: "scheduled_user_name", label: "Кто запланировал" },
    { key: "started_user_name", label: "Кто начал" },
    { key: "completed_user_name", label: "Кто завершил" },
    { key: "tested_user_name", label: "Кто тестировал" },
    { key: "description", label: "Описание" },
    { key: "notes", label: "Заметки" },
  ], []);

  // Инициализация столбцов и их настроек
  useEffect(() => {
    // Проверяем версию настроек для миграции
    const settingsVersion = localStorage.getItem('maintenanceTableSettingsVersion');
    if (settingsVersion !== '2.0') {
      // Очищаем старые настройки при добавлении новых столбцов
      localStorage.removeItem('maintenanceTableColumnOrder');
      localStorage.removeItem('maintenanceTableVisibleColumns');
      localStorage.removeItem('maintenanceTableColumnWidths');
      localStorage.setItem('maintenanceTableSettingsVersion', '2.0');
    }
    
    const defaultWidths = {
      id: 60,
      internal_article: 120,
      model: 120,
      brand_name: 100,
      model_year: 80,
      wheel_size: 100,
      frame_size: 80,
      frame_number: 120,
      gender: 80,
      tariff_name: 120,
      condition_status: 120,
      maintenance_type: 100,
      status: 120,
      parts_need: 120,
      scheduled_for: 120,
      started_at: 120,
      completed_at: 120,
      tested_at: 120,
      repair_hours: 100,
      parts_wait_hours: 120,
      scheduled_user_name: 120,
      started_user_name: 120,
      completed_user_name: 120,
      description: 150,
      actions: 150
    };
    
    const savedWidths = localStorage.getItem('maintenanceTableColumnWidths');
    setColumnWidths(savedWidths ? JSON.parse(savedWidths) : defaultWidths);
    
    const defaultVisible = [
      "id", "internal_article", "model", "maintenance_type", "status", 
      "parts_need", "scheduled_for", "started_at", "completed_at", 
      "repair_hours", "scheduled_user_name", "description"
    ];
    
    // Используем все ключи из columns как порядок по умолчанию
    const defaultOrder = columns.map(col => col.key);
    
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
  }, [columnWidths, visibleColumns, columns]);

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

  const hasActiveFilters = Object.values(filters).some(value => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object' && value !== null) {
      // Для объектов дат (календарные фильтры)
      return value.from || value.to;
    }
    if (typeof value === 'string') {
      return value.trim() !== '';
    }
    return false;
  });

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
    
    // Проверяем, не кликнули ли мы на интерактивный элемент
    const target = e.target;
    const isInteractiveElement = target.matches('input, button, .filter-select-box, .date-range-filter') ||
                                target.closest('input, button, .filter-select-box, .date-range-filter');
    
    if (isInteractiveElement) {
      e.preventDefault();
      return;
    }
    
    draggedColumn.current = columnKey;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', columnKey);
    
    // Добавляем CSS класс для визуальной обратной связи
    setTimeout(() => {
      const thElement = e.currentTarget.closest('th') || e.currentTarget;
      thElement.classList.add('dragging');
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
      // Ищем ближайший th элемент
      const thElement = e.currentTarget.closest('th') || e.currentTarget;
      thElement.classList.add('drag-over');
    }
  };

  const handleDragLeave = (e) => {
    // Проверяем, действительно ли мы покидаем элемент
    const thElement = e.currentTarget.closest('th') || e.currentTarget;
    const rect = thElement.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      thElement.classList.remove('drag-over');
    }
  };

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault();
    const thElement = e.currentTarget.closest('th') || e.currentTarget;
    thElement.classList.remove('drag-over');
    
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
    const thElement = e.currentTarget.closest('th') || e.currentTarget;
    thElement.classList.remove('dragging');
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
      
      // Обработка диапазонов дат
      if (dateRangeOptions.includes(key) && typeof value === 'object' && value !== null) {
        // Если объект даты пустой или неполный, пропускаем фильтрацию
        if (!value.from && !value.to) return true;
        if (!event[key]) return false;
        
        const eventDate = new Date(event[key]);
        
        // Если указана только одна дата, используем ее как обе границы
        const fromDate = new Date(value.from || value.to);
        const toDate = new Date(value.to || value.from);
        toDate.setHours(23, 59, 59, 999); // Включаем весь день "до"
        
        return eventDate >= fromDate && eventDate <= toDate;
      }
      
      // Обработка для массивов (выпадающие фильтры)
      if (Array.isArray(value)) {
        return value.includes(String(event[key]));
      }
      
      // Текстовый поиск (только для строк)
      if (typeof value === 'string') {
        return String(event[key] || "")
          .toLowerCase()
          .includes(value.toLowerCase());
      }
      
      return true;
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

  const getStatusClass = (status) => {
    switch (status) {
      case "planned":
        return "status-badge status-badge-purple";
      case "in_progress":
        return "status-badge status-badge-orange";
      case "completed":
        return "status-badge status-badge-green";
      default:
        return "status-badge";
    }
  };

  const formatHours = (hours) => {
    if (!hours) return "—";
    const totalHours = Number(hours);
    const days = Math.floor(totalHours / 24);
    const remainingHours = totalHours % 24;
    
    if (days === 0) {
      return `${remainingHours.toFixed(1)}ч`;
    } else {
      return `${days}д ${remainingHours.toFixed(1)}ч`;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "—";
      
      return date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "2-digit", 
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "—";
    }
  };

  // Функция для получения переведенных опций для фильтров
  const getTranslatedOptions = (key) => {
    const options = selectOptions[key];
    if (!options) return [];
    
    switch (key) {
      case 'status':
        return options.map(option => ({
          value: option,
          label: statusLabels[option] || option
        }));
      case 'maintenance_type':
        return options.map(option => ({
          value: option,
          label: maintenanceTypeLabels[option] || option
        }));
      case 'parts_need':
        return options.map(option => ({
          value: option,
          label: partsNeedLabels[option] || option
        }));
      default:
        return options.map(option => ({
          value: option,
          label: option
        }));
    }
  };

  const getMaintenanceTypeClass = (type) => {
    switch (type) {
      case "current":
        return "maintenance-type-badge maintenance-type-current";
      case "weekly":
        return "maintenance-type-badge maintenance-type-weekly";
      case "longterm":
        return "maintenance-type-badge maintenance-type-longterm";
      default:
        return "maintenance-type-badge";
    }
  };

  const getPartsNeedClass = (partsNeed) => {
    switch (partsNeed) {
      case "not_needed":
        return "parts-need-badge parts-need-ok";
      case "needed":
        return "parts-need-badge parts-need-warning";
      case "ordered":
        return "parts-need-badge parts-need-info";
      case "delivered":
        return "parts-need-badge parts-need-success";
      default:
        return "parts-need-badge";
    }
  };


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
                  style={{}}
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
                  ) : dateRangeOptions.includes(key) ? (
                    <DateRangePickerFilter
                      value={filters[key] || null}
                      onChange={(dateRange) => updateFilter(key, dateRange)}
                    />
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
              <tr key={event.id} className={event.is_overdue ? 'row-overdue' : ''} onDoubleClick={() => onUpdate && onUpdate('edit', event.id, event)} style={{ cursor: "pointer" }}>
                {orderedColumns.filter(col => visibleColumns.includes(col.key)).map(({ key }) => {
                  if (key === 'id') {
                    return <td key={key} data-column={key}>{event.id}</td>;
                  }
                  if (key === 'internal_article') {
                    return (
                      <td key={key} data-column={key}>
                        <div className="bike-info">
                          <span className="bike-number">{event.internal_article}</span>
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
                  if (key === 'brand_name') {
                    return <td key={key} data-column={key}>{event.brand_name || '—'}</td>;
                  }
                  if (key === 'model_year') {
                    return <td key={key} data-column={key}>{event.model_year || '—'}</td>;
                  }
                  if (key === 'wheel_size') {
                    return <td key={key} data-column={key}>{event.wheel_size ? event.wheel_size + '"' : '—'}</td>;
                  }
                  if (key === 'frame_size') {
                    return <td key={key} data-column={key}>{event.frame_size || '—'}</td>;
                  }
                  if (key === 'frame_number') {
                    return <td key={key} data-column={key}>{event.frame_number || '—'}</td>;
                  }
                  if (key === 'gender') {
                    return <td key={key} data-column={key}>{event.gender || '—'}</td>;
                  }
                  if (key === 'tariff_name') {
                    return <td key={key} data-column={key}>{event.tariff_name || '—'}</td>;
                  }
                  if (key === 'condition_status') {
                    const getStatusBadgeClass = (status) => {
                      const statusColorMap = {
                        "в наличии": "green",
                        "в прокате": "blue", 
                        "в ремонте": "orange",
                        "бронь": "purple",
                        "продан": "red",
                        "украден": "red",
                        "невозврат": "red",
                        "требует ремонта": "red"
                      };
                      const color = statusColorMap[status] || "green";
                      return `status-badge status-badge-${color}`;
                    };
                    
                    return (
                      <td key={key} data-column={key}>
                        <span className={getStatusBadgeClass(event.condition_status)}>
                          {event.condition_status || '—'}
                        </span>
                      </td>
                    );
                  }
                  if (key === 'maintenance_type') {
                    return (
                      <td key={key} data-column={key}>
                        <span className={`maintenance-type-badge ${getMaintenanceTypeClass(event.maintenance_type)}`}>
                          {maintenanceTypeLabels[event.maintenance_type]}
                        </span>
                      </td>
                    );
                  }
                  if (key === 'status') {
                    return (
                      <td key={key} data-column={key}>
                        <span className={getStatusClass(event.status)}>
                          {statusLabels[event.status]}
                        </span>
                      </td>
                    );
                  }
                  if (key === 'parts_need') {
                    return (
                      <td key={key} data-column={key}>
                        <span className={`parts-need-badge ${getPartsNeedClass(event.parts_need)}`}>
                          {partsNeedLabels[event.parts_need]}
                        </span>
                      </td>
                    );
                  }
                  if (key === 'scheduled_at') {
                    return <td key={key} data-column={key}>{formatDateTime(event.scheduled_at)}</td>;
                  }
                  if (key === 'scheduled_for') {
                    return <td key={key} data-column={key}>{formatDateTime(event.scheduled_for)}</td>;
                  }
                  if (key === 'started_at') {
                    return <td key={key} data-column={key}>{formatDateTime(event.started_at)}</td>;
                  }
                  if (key === 'completed_at') {
                    return <td key={key} data-column={key}>{formatDateTime(event.completed_at)}</td>;
                  }
                  if (key === 'tested_at') {
                    return <td key={key} data-column={key}>{formatDateTime(event.tested_at)}</td>;
                  }
                  if (key === 'parts_needed_at') {
                    return <td key={key} data-column={key}>{formatDateTime(event.parts_needed_at)}</td>;
                  }
                  if (key === 'parts_ordered_at') {
                    return <td key={key} data-column={key}>{formatDateTime(event.parts_ordered_at)}</td>;
                  }
                  if (key === 'parts_delivered_at') {
                    return <td key={key} data-column={key}>{formatDateTime(event.parts_delivered_at)}</td>;
                  }
                  if (key === 'repair_hours') {
                    return <td key={key} data-column={key}>{formatHours(event.repair_hours)}</td>;
                  }
                  if (key === 'parts_wait_hours') {
                    return <td key={key} data-column={key}>{formatHours(event.parts_wait_hours)}</td>;
                  }
                  if (key === 'scheduled_user_name') {
                    return <td key={key} data-column={key}>{event.scheduled_user_name || "—"}</td>;
                  }
                  if (key === 'scheduled_for_user_name') {
                    return <td key={key} data-column={key}>{event.scheduled_for_user_name || "—"}</td>;
                  }
                  if (key === 'started_user_name') {
                    return <td key={key} data-column={key}>{event.started_user_name || "—"}</td>;
                  }
                  if (key === 'completed_user_name') {
                    return <td key={key} data-column={key}>{event.completed_user_name || "—"}</td>;
                  }
                  if (key === 'tested_user_name') {
                    return <td key={key} data-column={key}>{event.tested_user_name || "—"}</td>;
                  }
                  if (key === 'description') {
                    return (
                      <td key={key} data-column={key}>
                        {event.description ? (
                          <div className="description-cell" title={event.description}>
                            {event.description.length > 50 ? 
                              `${event.description.substring(0, 50)}...` : 
                              event.description
                            }
                          </div>
                        ) : "—"}
                      </td>
                    );
                  }
                  if (key === 'notes') {
                    return (
                      <td key={key} data-column={key}>
                        {event.notes ? (
                          <div className="notes-cell" title={event.notes}>
                            {event.notes.length > 50 ? 
                              `${event.notes.substring(0, 50)}...` : 
                              event.notes
                            }
                          </div>
                        ) : "—"}
                      </td>
                    );
                  }
                  if (key === 'created_at') {
                    return <td key={key} data-column={key}>{formatDateTime(event.created_at)}</td>;
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
            options={getTranslatedOptions(popoverInfo.key)}
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
