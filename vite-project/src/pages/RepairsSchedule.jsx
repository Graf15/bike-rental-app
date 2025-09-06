import React, { useState, useEffect, useRef, useCallback } from "react";
import TableControls from "../components/TableControls";
import MultiSelectPopover from "../components/MultiSelectPopover";
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
  const anchorRefs = useRef({});

  // Опции для выпадающих фильтров
  const selectOptions = {
    wheel_size: ["12", "16", "20", "24", "26", "27.5", "29"],
    frame_size: ["д20", "д24", "XS", "S", "M", "L", "XL", "XXL", "13", "14", "15", "15,5", "16", "16,5", "17", "17,5", "18", "18,5", "19", "19,5", "20", "20,5", "21", "21,5", "22", "22,5", "23", "23,5"],
    gender: ["женский", "мужской", "унисекс"],
    price_segment: ["kids", "econom", "standart", "premium", "эл.вел'", "эл.самокат"],
    condition_status: ["в наличии", "в прокате", "в ремонте", "бронь", "продан", "украден", "невозврат"],
    scheduled_day: ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье", "Не запланировано"]
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
    
    // Инициализация ширин столбцов
    const defaultWidths = {
      id: 60,
      internal_article: 120,
      model: 200,
      model_year: 80,
      wheel_size: 100,
      frame_size: 80,
      gender: 80,
      price_segment: 120,
      condition_status: 120,
      scheduled_day: 150
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
      "price_segment",
      "condition_status",
      "scheduled_day"
    ];
    
    const defaultOrder = [
      "id",
      "internal_article",
      "model", 
      "model_year",
      "wheel_size",
      "frame_size",
      "gender",
      "price_segment",
      "condition_status",
      "scheduled_day"
    ];
    
    const savedVisible = localStorage.getItem('repairsScheduleVisibleColumns');
    setVisibleColumns(savedVisible ? JSON.parse(savedVisible) : defaultVisible);
    
    const savedOrder = localStorage.getItem('repairsScheduleColumnOrder');
    setColumnOrder(savedOrder ? JSON.parse(savedOrder) : defaultOrder);
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
    return schedule.find(s => s.bike_id === bikeId && s.is_active) || null;
  };

  const handleDayAssignment = async (bikeId, dayOfWeek, isActive) => {
    try {
      const response = await fetch("/api/maintenance/weekly-schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          schedules: [{ bike_id: bikeId, day_of_week: dayOfWeek, is_active: isActive }]
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
      alert(result.message);
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
    const bikeSchedule = getScheduleForBike(bike.id);
    
    return Object.entries(filters).every(([key, value]) => {
      if (!value || value.length === 0) return true;
      
      // Специальная обработка для scheduled_day
      if (key === 'scheduled_day') {
        if (!bikeSchedule) {
          return value.includes('Не запланировано');
        }
        const dayLabel = daysOfWeek.find(d => d.value === bikeSchedule.day_of_week)?.label;
        return Array.isArray(value) ? value.includes(dayLabel) : dayLabel === value;
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
      const scheduleA = getScheduleForBike(a.id);
      const scheduleB = getScheduleForBike(b.id);
      valA = scheduleA ? scheduleA.day_of_week : 999;
      valB = scheduleB ? scheduleB.day_of_week : 999;
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
      { key: "model_year", label: "Год", filterable: true },
      { key: "wheel_size", label: "Размер колеса", filterable: true, filterType: "select" },
      { key: "frame_size", label: "Рама", filterable: true, filterType: "select" },
      { key: "gender", label: "Пол", filterable: true, filterType: "select" },
      { key: "price_segment", label: "Сегмент", filterable: true, filterType: "select" },
      { key: "condition_status", label: "Состояние", filterable: true, filterType: "select" },
      { key: "scheduled_day", label: "Запланированный день", filterable: true, filterType: "select" },
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
    { key: "model_year", label: "Год", filterable: true },
    { key: "wheel_size", label: "Размер колеса", filterable: true, filterType: "select" },
    { key: "frame_size", label: "Рама", filterable: true, filterType: "select" },
    { key: "gender", label: "Пол", filterable: true, filterType: "select" },
    { key: "price_segment", label: "Сегмент", filterable: true, filterType: "select" },
    { key: "condition_status", label: "Состояние", filterable: true, filterType: "select" },
    { key: "scheduled_day", label: "Запланированный день", filterable: true, filterType: "select" },
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
                  style={{ cursor: !isResizing.current ? 'move' : 'default' }}
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
                <tr key={bike.id} className={bikeSchedule ? 'scheduled' : ''}>
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
                    if (key === 'model_year') {
                      return <td key={key} data-column={key}>{bike.model_year}</td>;
                    }
                    if (key === 'wheel_size') {
                      return <td key={key} data-column={key}>{bike.wheel_size}"</td>;
                    }
                    if (key === 'frame_size') {
                      return <td key={key} data-column={key}>{bike.frame_size}</td>;
                    }
                    if (key === 'gender') {
                      return <td key={key} data-column={key}>{bike.gender}</td>;
                    }
                    if (key === 'price_segment') {
                      return <td key={key} data-column={key}>{bike.price_segment}</td>;
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
                    if (key === 'scheduled_day') {
                      const popoverKey = `schedule_${bike.id}`;
                      return (
                        <td key={key} data-column={key}>
                          <div
                            ref={(el) => (anchorRefs.current[popoverKey] = el)}
                            onClick={() =>
                              setPopoverInfo({
                                key: popoverKey,
                                visible: popoverInfo.key !== popoverKey || !popoverInfo.visible,
                                bikeId: bike.id
                              })
                            }
                            className="filter-select-box"
                            style={{ cursor: 'pointer' }}
                          >
                            {bikeSchedule ? 
                              daysOfWeek.find(d => d.value === bikeSchedule.day_of_week)?.label : 
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
            selected={[]}  // Для single-select оставляем пустой массив
            onChange={(newSelection) => {
              if (newSelection.includes("Не запланировано")) {
                // Убираем из расписания
                handleDayAssignment(popoverInfo.bikeId, null, false);
              } else if (newSelection.length > 0) {
                // Назначаем на выбранный день
                const selectedDay = daysOfWeek.find(d => d.label === newSelection[newSelection.length - 1]);
                if (selectedDay) {
                  handleDayAssignment(popoverInfo.bikeId, selectedDay.value, true);
                }
              }
              setPopoverInfo({ key: null, visible: false });
            }}
            visible={popoverInfo.visible}
            anchorRef={{ current: anchorRefs.current[popoverInfo.key] }}
            onClose={() => setPopoverInfo({ key: null, visible: false })}
          />
        )}
    </div>
  );
};

export default RepairsSchedule;