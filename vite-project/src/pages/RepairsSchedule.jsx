import React, { useState, useEffect, useRef, useCallback } from "react";
import TableControls from "../components/TableControls";
import MultiSelectPopover from "../components/MultiSelectPopover";
import { BIKE_OPTIONS, SCHEDULE_OPTIONS } from "../constants/selectOptions";
import "./RepairsSchedule.css";
import "../components/BikeTable.css";

const RepairsSchedule = () => {
  const [bikes, setBikes] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generating, setGenerating] = useState(false);
  
  // Состояния для фильтрации (как в BikeTable)
  const [filters, setFilters] = useState({});
  const [sortColumn, setSortColumn] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  
  // Состояния для пагинации
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Состояния для ресайза столбцов
  const [columnWidths, setColumnWidths] = useState({});
  const [visibleColumns, setVisibleColumns] = useState({});
  
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
  
  // Состояния для поповеров фильтров (как в BikeTable)
  const [popoverInfo, setPopoverInfo] = useState({ key: null, visible: false });
  const [tempScheduleSelection, setTempScheduleSelection] = useState([]);
  const anchorRefs = useRef({});

  // Опции для выпадающих фильтров
  const selectOptions = {
    ...BIKE_OPTIONS,
    ...SCHEDULE_OPTIONS
  };

  const daysOfWeek = [
    { value: 1, label: "Понедельник", short: "Пн" },
    { value: 2, label: "Вторник", short: "Вт" },
    { value: 3, label: "Среда", short: "Ср" },
    { value: 4, label: "Четверг", short: "Чт" },
    { value: 5, label: "Пятница", short: "Пт" },
    { value: 6, label: "Суббота", short: "Сб" },
    { value: 7, label: "Воскресенье", short: "Вс" },
  ];

  useEffect(() => {
    fetchData();
    
    // Проверяем версию настроек для миграции
    const settingsVersion = localStorage.getItem('repairsScheduleSettingsVersion');
    if (settingsVersion !== '2.0') {
      // Очищаем старые настройки при добавлении новых столбцов
      localStorage.removeItem('repairsScheduleColumnOrder');
      localStorage.removeItem('repairsScheduleVisibleColumns');
      localStorage.removeItem('repairsScheduleColumnWidths');
      localStorage.setItem('repairsScheduleSettingsVersion', '2.0');
    }
    
    // Инициализация ширин столбцов
    const defaultWidths = {
      id: 60,
      internal_article: 120,
      model: 200,
      brand_name: 100,
      model_year: 80,
      wheel_size: 100,
      frame_size: 80,
      frame_number: 120,
      gender: 80,
      tariff_name: 120,
      condition_status: 120,
      scheduled_day: 150,
      notes: 200
    };
    
    const savedWidths = localStorage.getItem('repairsScheduleColumnWidths');
    setColumnWidths(savedWidths ? JSON.parse(savedWidths) : defaultWidths);
    
    // Инициализация видимости столбцов
    const defaultVisible = [
      "id",
      "internal_article",
      "model", 
      "model_year",
      "wheel_size",
      "frame_size",
      "gender",
      "tariff_name",
      "condition_status",
      "scheduled_day"
    ];

    const defaultOrder = [
      "id",
      "internal_article",
      "model",
      "brand_name",
      "model_year",
      "wheel_size",
      "frame_size",
      "frame_number",
      "gender",
      "tariff_name",
      "condition_status",
      "scheduled_day",
      "notes"
    ];
    
    const savedVisible = localStorage.getItem('repairsScheduleVisibleColumns');
    setVisibleColumns(savedVisible ? JSON.parse(savedVisible) : defaultVisible);
    
    const savedOrder = localStorage.getItem('repairsScheduleColumnOrder');
    const parsedOrder = savedOrder ? JSON.parse(savedOrder) : defaultOrder;
    
    // Проверяем, что все столбцы из defaultOrder присутствуют в savedOrder
    const allColumns = [
      "id", "internal_article", "model", "brand_name", "model_year", 
      "wheel_size", "frame_size", "frame_number", "gender", "tariff_name",
      "condition_status", "scheduled_day", "notes"
    ];
    
    // Если в savedOrder отсутствуют новые столбцы, добавляем их
    const missingColumns = allColumns.filter(col => !parsedOrder.includes(col));
    const updatedOrder = [...parsedOrder, ...missingColumns];
    
    setColumnOrder(updatedOrder);
    if (missingColumns.length > 0) {
      localStorage.setItem('repairsScheduleColumnOrder', JSON.stringify(updatedOrder));
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bikesResponse, scheduleResponse] = await Promise.all([
        fetch("/api/bikes"),
        fetch("/api/maintenance/weekly-schedule"),
      ]);

      if (!bikesResponse.ok || !scheduleResponse.ok) {
        throw new Error("Ошибка загрузки данных");
      }

      const bikesData = await bikesResponse.json();
      const scheduleData = await scheduleResponse.json();

      setBikes(bikesData);
      setSchedule(scheduleData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
    setCurrentPage(1);
  };
  
  // Функции для ресайза столбцов (из BikeTable)
  const saveColumnWidths = useCallback((widths) => {
    localStorage.setItem('repairsScheduleColumnWidths', JSON.stringify(widths));
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
      localStorage.setItem('repairsScheduleColumnOrder', JSON.stringify(newOrder));
    }
    
    draggedColumn.current = null;
    dragOverColumn.current = null;
    
    // Очищаем все CSS классы
    document.querySelectorAll('.repairs-schedule-page th').forEach(th => {
      th.classList.remove('dragging', 'drag-over');
    });
  };

  const handleDragEnd = (e) => {
    // Очищаем CSS классы
    e.target.classList.remove('dragging');
    document.querySelectorAll('.repairs-schedule-page th').forEach(th => {
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

  const getScheduleForBike = (bikeId) => {
    return schedule.filter(s => s.bike_id === bikeId && s.is_active);
  };

  const handleDayAssignment = async (bikeId, selectedDays) => {
    try {
      const response = await fetch("/api/maintenance/weekly-schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bike_id: bikeId,
          days_of_week: selectedDays || []
        }),
      });

      if (!response.ok) {
        throw new Error("Ошибка обновления расписания");
      }

      await fetchData(); // Перезагружаем данные
    } catch (err) {
      alert("Ошибка: " + err.message);
    }
  };

  const handleGenerateWeekly = async () => {
    if (!confirm("Создать еженедельные ремонты на следующую неделю?")) {
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/maintenance/generate-weekly", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка генерации");
      }

      const result = await response.json();
      
      // Формируем детальное сообщение
      let detailMessage = result.message;
      
      if (result.skipped && result.skipped.length > 0) {
        detailMessage += "\n\n📋 ПРОПУЩЕННЫЕ ВЕЛОСИПЕДЫ:";
        result.skipped.forEach(bike => {
          detailMessage += `\n• ${bike.internal_article} (${bike.model}) - ${bike.reason}`;
          if (bike.existing_event) {
            detailMessage += ` (${bike.existing_event.description})`;
          }
        });
      }
      
      if (result.errors && result.errors.length > 0) {
        detailMessage += "\n\n❌ ОШИБКИ:";
        result.errors.forEach(error => {
          detailMessage += `\n• ${error.internal_article} (${error.model}) - ${error.error}`;
        });
      }
      
      if (result.events && result.events.length > 0) {
        detailMessage += "\n\n✅ СОЗДАННЫЕ СОБЫТИЯ:";
        result.events.forEach(event => {
          const eventDate = new Date(event.scheduled_for).toLocaleDateString('ru-RU');
          detailMessage += `\n• ${event.bike_article} (${event.bike_model}) - ${eventDate}`;
        });
      }
      
      alert(detailMessage);
    } catch (err) {
      alert("Ошибка: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Функции для управления таблицей
  const clearAllFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const handleDayStatClick = (dayLabel) => {
    // Устанавливаем фильтр для столбца scheduled_day
    updateFilter('scheduled_day', [dayLabel]);
  };

  const toggleColumnVisibility = (columnKey) => {
    const newVisibleColumns = visibleColumns.includes(columnKey)
      ? visibleColumns.filter(key => key !== columnKey)
      : [...visibleColumns, columnKey];
    
    setVisibleColumns(newVisibleColumns);
    localStorage.setItem('repairsScheduleVisibleColumns', JSON.stringify(newVisibleColumns));
  };

  // Фильтрация и сортировка (улучшенная версия как в BikeTable)
  const filteredBikes = bikes.filter((bike) => {
    const bikeSchedules = getScheduleForBike(bike.id);
    
    return Object.entries(filters).every(([key, value]) => {
      if (!value || value.length === 0) return true;
      
      // Специальная обработка для scheduled_day
      if (key === 'scheduled_day') {
        if (bikeSchedules.length === 0) {
          return value.includes('Не запланировано');
        }
        
        // Проверяем есть ли пересечение между запланированными днями и фильтром
        const scheduledDayLabels = bikeSchedules.map(s => 
          daysOfWeek.find(d => d.value === s.day_of_week)?.label
        ).filter(Boolean);
        
        return Array.isArray(value) 
          ? value.some(filterDay => scheduledDayLabels.includes(filterDay))
          : scheduledDayLabels.includes(value);
      }
      
      // Обработка для всех select фильтров (массив)
      if (Array.isArray(value)) {
        return value.includes(bike[key]);
      }
      
      // Текстовый поиск для остальных полей
      if (typeof value === 'string') {
        return String(bike[key] || "")
          .toLowerCase()
          .includes(value.toLowerCase());
      }
      
      return true;
    });
  });

  const sortedBikes = [...filteredBikes].sort((a, b) => {
    if (!sortColumn) return 0;
    
    let valA, valB;
    
    // Специальная обработка для scheduled_day
    if (sortColumn === 'scheduled_day') {
      const schedulesA = getScheduleForBike(a.id);
      const schedulesB = getScheduleForBike(b.id);
      
      // Для сортировки используем минимальный день недели, если есть расписания
      valA = schedulesA.length > 0 
        ? Math.min(...schedulesA.map(s => s.day_of_week))
        : 999; // Незапланированные в конец
      valB = schedulesB.length > 0 
        ? Math.min(...schedulesB.map(s => s.day_of_week))
        : 999; // Незапланированные в конец
    } else {
      valA = a[sortColumn];
      valB = b[sortColumn];
    }

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
  const totalPages = Math.ceil(sortedBikes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedBikes = sortedBikes.slice(startIndex, startIndex + itemsPerPage);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Статистика по дням
  const weeklyStats = daysOfWeek.map(day => ({
    ...day,
    count: schedule.filter(s => s.is_active && s.day_of_week === day.value).length
  }));

  // Добавляем статистику для "Не запланировано"
  const unscheduledCount = bikes.length - schedule.filter(s => s.is_active).length;
  const totalScheduled = schedule.filter(s => s.is_active).length;

  // Динамическое обновление CSS для ширин столбцов
  useEffect(() => {
    if (Object.keys(columnWidths).length === 0 || visibleColumns.length === 0) return;
    
    const columns = [
      { key: "id", label: "ID", filterable: true },
      { key: "internal_article", label: "Внутр. артикул", filterable: true },
      { key: "model", label: "Модель", filterable: true },
      { key: "brand_name", label: "Бренд", filterable: true },
      { key: "model_year", label: "Год", filterable: true },
      { key: "wheel_size", label: "Размер колеса", filterable: true, filterType: "select" },
      { key: "frame_size", label: "Рама", filterable: true, filterType: "select" },
      { key: "frame_number", label: "Номер рамы", filterable: true },
      { key: "gender", label: "Пол", filterable: true, filterType: "select" },
      { key: "tariff_name", label: "Тариф", filterable: true, filterType: "select" },
      { key: "condition_status", label: "Состояние", filterable: true, filterType: "select" },
      { key: "scheduled_day", label: "Запланированный день", filterable: true, filterType: "select" },
      { key: "notes", label: "Примечания", filterable: true },
      { key: "actions", label: "Действия", filterable: false },
    ];
    
    const visibleColumnsData = columns.filter(col => visibleColumns.includes(col.key));
    const totalWidth = visibleColumnsData.reduce((sum, col) => sum + (columnWidths[col.key] || 100), 0);
    
    let css = `
      .repairs-schedule-page .table-container table { width: ${totalWidth}px !important; }
    `;
    
    // Создаем CSS правила для каждого столбца по data-column атрибуту
    Object.entries(columnWidths).forEach(([columnKey, width]) => {
      css += `
        .repairs-schedule-page .table-container th[data-column="${columnKey}"],
        .repairs-schedule-page .table-container td[data-column="${columnKey}"] {
          width: ${width}px !important;
          min-width: ${width}px !important;
          max-width: ${width}px !important;
        }
      `;
    });
    
    const existingStyle = document.getElementById('repairs-schedule-column-widths');
    if (existingStyle) {
      existingStyle.textContent = css;
    } else {
      const style = document.createElement('style');
      style.id = 'repairs-schedule-column-widths';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }, [columnWidths, visibleColumns]);

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;

  const columns = [
    { key: "id", label: "ID", filterable: true },
    { key: "internal_article", label: "Внутр. артикул", filterable: true },
    { key: "model", label: "Модель", filterable: true },
    { key: "brand_name", label: "Бренд", filterable: true },
    { key: "model_year", label: "Год", filterable: true },
    { key: "wheel_size", label: "Размер колеса", filterable: true, filterType: "select" },
    { key: "frame_size", label: "Рама", filterable: true, filterType: "select" },
    { key: "frame_number", label: "Номер рамы", filterable: true },
    { key: "gender", label: "Пол", filterable: true, filterType: "select" },
    { key: "tariff_name", label: "Тариф", filterable: true, filterType: "select" },
    { key: "condition_status", label: "Состояние", filterable: true, filterType: "select" },
    { key: "scheduled_day", label: "Запланированный день", filterable: true, filterType: "select" },
    { key: "notes", label: "Примечания", filterable: true },
  ];

  // Получаем упорядоченные столбцы согласно columnOrder
  const getOrderedColumns = () => {
    if (columnOrder.length === 0) return columns;
    
    const columnMap = new Map(columns.map(col => [col.key, col]));
    const orderedColumns = [];
    
    // Добавляем столбцы в порядке columnOrder (только те, что существуют)
    columnOrder.forEach(key => {
      if (columnMap.has(key)) {
        orderedColumns.push(columnMap.get(key));
        columnMap.delete(key); // Убираем из карты, чтобы избежать дубликатов
      }
    });
    
    // Добавляем оставшиеся столбцы (новые, которых нет в columnOrder)
    columnMap.forEach(col => {
      orderedColumns.push(col);
    });
    
    return orderedColumns;
  };

  const orderedColumns = getOrderedColumns();



  // Проверка активных фильтров для TableControls
  const hasActiveFilters = Object.values(filters).some(value => 
    Array.isArray(value) ? value.length > 0 : value && value.trim() !== ''
  );

  return (
    <div className="page-container repairs-schedule-page">
      <div className="page-header">
        <div className="header-content">
          <h1 className="page-title">🔧 Планирование ремонтов</h1>
          <p className="page-subtitle">
            Настройте шаблон еженедельного расписания ТО. Этот план будет применяться каждую неделю автоматически.
          </p>
        </div>
        
        <div className="header-right">
          {/* Статистика по дням */}
          <div className="weekly-stats">
            <div className="stats-header">
              <span className="total-count">Всего запланировано: {totalScheduled}</span>
            </div>
            <div className="day-stats">
              {weeklyStats.map(day => (
                <div 
                  key={day.value} 
                  className={`day-stat ${day.count > 0 ? 'has-repairs' : ''} ${
                    filters.scheduled_day?.includes(day.label) ? 'active-filter' : ''
                  }`}
                  onClick={() => handleDayStatClick(day.label)}
                  style={{ cursor: 'pointer' }}
                  title={`Фильтровать по ${day.label}`}
                >
                  <span className="day-label">{day.short}</span>
                  <span className="day-count">{day.count}</span>
                </div>
              ))}
              {/* Добавляем "Не запланировано" */}
              <div 
                className={`day-stat ${unscheduledCount > 0 ? 'has-repairs' : ''} ${
                  filters.scheduled_day?.includes('Не запланировано') ? 'active-filter' : ''
                }`}
                onClick={() => handleDayStatClick('Не запланировано')}
                style={{ cursor: 'pointer' }}
                title="Фильтровать незапланированные"
              >
                <span className="day-label">Нет</span>
                <span className="day-count">{unscheduledCount}</span>
              </div>
            </div>
          </div>

          <button 
            className="btn btn-primary-green"
            onClick={handleGenerateWeekly}
            disabled={generating || totalScheduled === 0}
          >
            {generating ? "Создание..." : "📅 Создать ремонты на неделю"}
          </button>
        </div>
      </div>

      {/* Контролы таблицы */}
      <TableControls
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
        availableColumns={columns}
        visibleColumns={visibleColumns}
        onColumnVisibilityChange={toggleColumnVisibility}
        totalItems={sortedBikes.length}
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handleItemsPerPageChange}
      />

      {/* Таблица велосипедов с планированием */}
      <div className="table-container">
        <table className="schedule-table">
          <thead>
            <tr>
              {orderedColumns.filter(col => visibleColumns.includes(col.key)).map(({ key, label }) => (
                <th 
                  key={key}
                  data-column={key}
                  draggable={true}
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
            </tr>
            <tr className="filter-row">
              {orderedColumns.filter(col => visibleColumns.includes(col.key)).map(({ key, filterable, filterType }) => (
                <th key={key} data-column={key}>
                  {filterable && (
                    <>
                      {filterType === 'select' ? (
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
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedBikes.map((bike) => {
              const bikeSchedule = getScheduleForBike(bike.id);
              return (
                <tr key={bike.id}>
                  {orderedColumns.filter(col => visibleColumns.includes(col.key)).map(({ key }) => {
                    const bikeSchedule = getScheduleForBike(bike.id);
                    
                    if (key === 'id') {
                      return <td key={key} data-column={key}>{bike.id}</td>;
                    }
                    if (key === 'internal_article') {
                      return <td key={key} data-column={key}>{bike.internal_article}</td>;
                    }
                    if (key === 'model') {
                      return <td key={key} data-column={key}>{bike.model}</td>;
                    }
                    if (key === 'brand_name') {
                      return <td key={key} data-column={key}>{bike.brand_name}</td>;
                    }
                    if (key === 'model_year') {
                      return <td key={key} data-column={key}>{bike.model_year}</td>;
                    }
                    if (key === 'wheel_size') {
                      return <td key={key} data-column={key}>{bike.wheel_size}"</td>;
                    }
                    if (key === 'frame_size') {
                      return <td key={key} data-column={key}>{bike.frame_size}</td>;
                    }
                    if (key === 'frame_number') {
                      return <td key={key} data-column={key}>{bike.frame_number || '—'}</td>;
                    }
                    if (key === 'gender') {
                      return <td key={key} data-column={key}>{bike.gender}</td>;
                    }
                    if (key === 'tariff_name') {
                      return <td key={key} data-column={key}>{bike.tariff_name || '—'}</td>;
                    }
                    if (key === 'condition_status') {
                      // Маппинг статусов на цвета
                      const getStatusBadgeClass = (status) => {
                        const statusColorMap = {
                          "в наличии": "green",
                          "в прокате": "blue", 
                          "в ремонте": "orange",
                          "бронь": "purple",
                          "продан": "red",
                          "украден": "red",
                          "невозврат": "red"
                        };
                        const color = statusColorMap[status] || "green";
                        return `status-badge status-badge-${color}`;
                      };
                      
                      return (
                        <td key={key} data-column={key}>
                          <span className={getStatusBadgeClass(bike.condition_status)}>
                            {bike.condition_status}
                          </span>
                        </td>
                      );
                    }
                    if (key === 'notes') {
                      return (
                        <td key={key} data-column={key}>
                          {bike.notes && bike.notes.length > 30 
                            ? bike.notes.substring(0, 30) + '...' 
                            : bike.notes || '—'}
                        </td>
                      );
                    }
                    if (key === 'scheduled_day') {
                      const popoverKey = `schedule_${bike.id}`;
                      const bikeSchedules = getScheduleForBike(bike.id);
                      const scheduledDays = bikeSchedules.map(s => 
                        daysOfWeek.find(d => d.value === s.day_of_week)?.label
                      ).filter(Boolean);
                      
                      return (
                        <td key={key} data-column={key}>
                          <div
                            ref={(el) => (anchorRefs.current[popoverKey] = el)}
                            onClick={() => {
                              const isOpening = popoverInfo.key !== popoverKey || !popoverInfo.visible;
                              if (isOpening) {
                                // Инициализируем временный выбор текущим состоянием
                                const bikeSchedules = getScheduleForBike(bike.id);
                                if (bikeSchedules.length === 0) {
                                  setTempScheduleSelection(["Не запланировано"]);
                                } else {
                                  const currentDays = bikeSchedules.map(s => 
                                    daysOfWeek.find(d => d.value === s.day_of_week)?.label
                                  ).filter(Boolean);
                                  setTempScheduleSelection(currentDays);
                                }
                              }
                              
                              setPopoverInfo({
                                key: popoverKey,
                                visible: isOpening,
                                bikeId: bike.id
                              });
                            }}
                            className={`status-badge ${scheduledDays.length > 0 ? 'status-badge-green' : 'status-badge-orange'} clickable`}
                            style={{ cursor: 'pointer' }}
                          >
                            {scheduledDays.length > 0 ? 
                              scheduledDays.join(", ") : 
                              "Не запланировано"
                            }
                            <span className="arrow">▼</span>
                          </div>
                        </td>
                      );
                    }
                    return <td key={key} data-column={key}></td>;
                  })}
                </tr>
              );
            })}
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

      {/* Поповер для выбора дня недели для расписания */}
      {popoverInfo.visible &&
        popoverInfo.key &&
        popoverInfo.key.startsWith('schedule_') && (
          <MultiSelectPopover
            options={["Не запланировано", ...daysOfWeek.map(d => d.label)]}
            selected={tempScheduleSelection}
            onChange={(newSelection) => {
              const daysOnly = newSelection.filter(item => item !== "Не запланировано");
              const hasNotScheduled = newSelection.includes("Не запланировано");
              const hadNotScheduled = tempScheduleSelection.includes("Не запланировано");
              
              // Проверяем, кликнул ли пользователь на "Не запланировано"
              if (hasNotScheduled && !hadNotScheduled) {
                // Пользователь выбрал "Не запланировано" - очищаем все дни
                setTempScheduleSelection(["Не запланировано"]);
              } else if (daysOnly.length > 0) {
                // Если выбраны дни недели, "Не запланировано" автоматически убирается
                setTempScheduleSelection(daysOnly);
              } else if (hasNotScheduled) {
                // Если остается только "Не запланировано"
                setTempScheduleSelection(["Не запланировано"]);
              } else {
                // Если ничего не выбрано
                setTempScheduleSelection([]);
              }
            }}
            visible={popoverInfo.visible}
            anchorRef={{ current: anchorRefs.current[popoverInfo.key] }}
            onClose={() => {
              // Применяем изменения при закрытии поповера
              if (tempScheduleSelection.includes("Не запланировано") || tempScheduleSelection.length === 0) {
                handleDayAssignment(popoverInfo.bikeId, []);
              } else {
                const selectedDayValues = tempScheduleSelection
                  .map(label => daysOfWeek.find(d => d.label === label)?.value)
                  .filter(Boolean);
                handleDayAssignment(popoverInfo.bikeId, selectedDayValues);
              }
              
              setPopoverInfo({ key: null, visible: false });
              setTempScheduleSelection([]);
            }}
          />
        )}
    </div>
  );
};

export default RepairsSchedule;