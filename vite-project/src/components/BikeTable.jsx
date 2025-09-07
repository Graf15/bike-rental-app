import { useState, useRef, useEffect, useCallback } from "react";
import BikeStatusPopover from "./BikeStatusPopover";
import BikeActionsMenu from "./BikeActionsMenu";
import TableControls from "./TableControls";
import MultiSelectPopover from "./MultiSelectPopover";
import DateRangeFilter from "./DateRangeFilter";
import { BIKE_OPTIONS } from "../constants/selectOptions";
import "./BikeTable.css";

// Функция для форматирования даты
const formatDate = (dateString) => {
  if (!dateString) return "—";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
  } catch (error) {
    return error;
  }
};


// Компонент для ресайза столбцов
const ColumnResizer = ({ onMouseDown }) => {
  return (
    <div 
      className="column-resizer"
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

const BikeTable = ({
  bikes,
  onBikeUpdate,
  onCreateMaintenance,
  onBikeEdit,
  onBikeDelete,
  statusFilter,
}) => {
  // Состояния для сортировки и фильтрации
  const [sortColumn, setSortColumn] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filters, setFilters] = useState({});
  const [popoverInfo, setPopoverInfo] = useState({ key: null, visible: false });
  const anchorRefs = useRef({});

  // Состояния для пагинации и отображения
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('bikeTablePageSize');
    return saved ? parseInt(saved, 10) : 50;
  });
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('bikeTableVisibleColumns');
    return saved ? JSON.parse(saved) : [
      'id', 'model', 'internal_article', 'brand_name', 'model_year', 'wheel_size', 
      'frame_size', 'frame_number', 'gender', 'price_segment', 'last_maintenance_date', 'condition_status', 'notes'
    ];
  });

  // Дефолтные ширины столбцов
  const defaultColumnWidths = {
    id: 60,
    model: 200,
    internal_article: 120,
    brand_name: 100,
    model_year: 80,
    wheel_size: 100,
    frame_size: 80,
    frame_number: 120,
    gender: 80,
    price_segment: 120,
    last_maintenance_date: 140,
    condition_status: 120,
    notes: 150,
    actions: 120
  };

  // Состояние для ширин столбцов с загрузкой из localStorage
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('bikeTableColumnWidths');
    return saved ? { ...defaultColumnWidths, ...JSON.parse(saved) } : defaultColumnWidths;
  });

  // Состояние для порядка столбцов
  const [columnOrder, setColumnOrder] = useState(() => {
    const saved = localStorage.getItem('bikeTableColumnOrder');
    return saved ? JSON.parse(saved) : [
      'id', 'model', 'internal_article', 'brand_name', 'model_year', 'wheel_size', 
      'frame_size', 'frame_number', 'gender', 'price_segment', 'last_maintenance_date', 'condition_status', 'notes'
    ];
  });

  // Состояние для ресайза - используем ref чтобы избежать перерендеров
  const isResizing = useRef(false);
  const resizingColumn = useRef(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Refs для drag & drop
  const draggedColumn = useRef(null);
  const dragOverColumn = useRef(null);

  // Реф для контейнера таблицы
  const tableContainerRef = useRef(null);

  const selectOptions = BIKE_OPTIONS;

  // Функции для ресайза столбцов
  const saveColumnWidths = useCallback((widths) => {
    localStorage.setItem('bikeTableColumnWidths', JSON.stringify(widths));
  }, []);

  const handleResizeStart = (e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    
    isResizing.current = true;
    resizingColumn.current = columnKey;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = columnWidths[columnKey];
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleResizeMove = useCallback((e) => {
    if (!isResizing.current || !resizingColumn.current) return;
    
    const deltaX = e.clientX - resizeStartX.current;
    const newWidth = Math.max(50, resizeStartWidth.current + deltaX); // минимум 50px
    
    // Изменяем только выбранный столбец
    setColumnWidths(prevWidths => {
      const newWidths = { ...prevWidths, [resizingColumn.current]: newWidth };
      // Сохраняем сразу новые ширины
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
      localStorage.setItem('bikeTableColumnOrder', JSON.stringify(newOrder));
    }
    
    draggedColumn.current = null;
    dragOverColumn.current = null;
    
    // Очищаем все CSS классы
    document.querySelectorAll('.bike-table th').forEach(th => {
      th.classList.remove('dragging', 'drag-over');
    });
  };

  const handleDragEnd = (e) => {
    // Очищаем CSS классы
    e.target.classList.remove('dragging');
    document.querySelectorAll('.bike-table th').forEach(th => {
      th.classList.remove('drag-over');
    });
    
    draggedColumn.current = null;
    dragOverColumn.current = null;
  };

  // Динамическое обновление CSS для ширин столбцов
  useEffect(() => {
    const orderedColumns = getOrderedColumns();
    const totalWidth = orderedColumns.reduce((sum, col) => sum + (columnWidths[col.key] || 100), 0) + (columnWidths.actions || 120);
    
    // Создаём CSS правила для каждого столбца по его ключу
    let css = `
      .home-page .table-container table { width: ${totalWidth}px !important; }
    `;
    
    // Создаем CSS правила для каждого столбца по data-column атрибуту
    Object.entries(columnWidths).forEach(([columnKey, width]) => {
      css += `
        .home-page .table-container th[data-column="${columnKey}"],
        .home-page .table-container td[data-column="${columnKey}"] {
          width: ${width}px !important;
          min-width: ${width}px !important;
          max-width: ${width}px !important;
        }
      `;
    });
    
    // Обновляем или создаём style элемент
    let styleElement = document.getElementById('dynamic-table-styles');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'dynamic-table-styles';
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = css;
  }, [columnWidths, columnOrder]);





  // Очистка event listeners при размонтировании
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [handleResizeMove, handleResizeEnd]);

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
    setCurrentPage(1); // Сбрасываем на первую страницу при фильтрации
  };

  // Применение фильтра статуса извне (от кликов по карточкам в header)
  useEffect(() => {
    if (statusFilter) {
      setFilters(prev => ({ ...prev, condition_status: [statusFilter] }));
    } else {
      setFilters(prev => {
        const { condition_status: _, ...rest } = prev;
        return rest;
      });
    }
    setCurrentPage(1);
  }, [statusFilter]);

  // Функции для управления таблицей
  const clearAllFilters = () => {
    setFilters({});
    setCurrentPage(1);
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (!value) return false;
    
    // Специальная обработка для диапазона дат
    if (key === 'last_maintenance_date' && typeof value === 'object' && !Array.isArray(value)) {
      return value.from || value.to;
    }
    
    return Array.isArray(value) ? value.length > 0 : value;
  });

  const toggleColumnVisibility = (columnKey) => {
    const newVisibleColumns = visibleColumns.includes(columnKey)
      ? visibleColumns.filter(key => key !== columnKey)
      : [...visibleColumns, columnKey];
    
    setVisibleColumns(newVisibleColumns);
    localStorage.setItem('bikeTableVisibleColumns', JSON.stringify(newVisibleColumns));
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1); // Сбрасываем на первую страницу
    localStorage.setItem('bikeTablePageSize', newSize.toString());
  };

  const handleStatusChange = async (bikeId, newStatus, field = 'condition_status') => {
    try {
      const response = await fetch(`/api/bikes/${bikeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [field]: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Ошибка при обновлении статуса");
      }

      // Вызываем callback для обновления данных в родительском компоненте
      if (onBikeUpdate) {
        onBikeUpdate();
      }
    } catch (error) {
      console.error("Ошибка обновления статуса:", error);
      alert("Ошибка при изменении статуса велосипеда");
    }
  };

  const handleBikeEdit = (bike) => {
    if (onBikeEdit) {
      onBikeEdit(bike);
    } else {
      alert("Функция редактирования пока не реализована");
    }
  };

  const handleBikeDelete = async (bikeId) => {
    try {
      const response = await fetch(`/api/bikes/${bikeId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Ошибка при удалении велосипеда");
      }

      if (onBikeDelete) {
        onBikeDelete(bikeId);
      } else if (onBikeUpdate) {
        onBikeUpdate();
      }
    } catch (error) {
      console.error("Ошибка удаления велосипеда:", error);
      alert("Ошибка при удалении велосипеда");
    }
  };

  const filteredBikes = bikes.filter((bike) => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) return true;
      
      // Специальная обработка для диапазона дат last_maintenance_date
      if (key === 'last_maintenance_date' && typeof value === 'object' && !Array.isArray(value)) {
        const bikeDate = bike[key] ? new Date(bike[key]) : null;
        if (!bikeDate || isNaN(bikeDate.getTime())) {
          // Если даты нет у велосипеда, показываем только если не указан фильтр
          return !value.from && !value.to;
        }
        
        const fromDate = value.from ? new Date(value.from) : null;
        const toDate = value.to ? new Date(value.to) : null;
        
        if (fromDate && bikeDate < fromDate) return false;
        if (toDate && bikeDate > toDate) return false;
        
        return true;
      }
      
      if (Array.isArray(value)) {
        return value.includes(bike[key]);
      } else {
        return String(bike[key] || "")
          .toLowerCase()
          .includes(value.toLowerCase());
      }
    });
  });

  const sortedBikes = [...filteredBikes].sort((a, b) => {
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
  const totalItems = sortedBikes.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedBikes = sortedBikes.slice(startIndex, endIndex);


  const columns = [
    { key: "id", label: "ID" },
    { key: "model", label: "Модель" },
    { key: "internal_article", label: "Внутр. артикул" },
    { key: "brand_name", label: "Бренд" },
    { key: "model_year", label: "Год" },
    { key: "wheel_size", label: "Размер колеса" },
    { key: "frame_size", label: "Рама" },
    { key: "frame_number", label: "Номер рамы" },
    { key: "gender", label: "Пол" },
    { key: "price_segment", label: "Сегмент" },
    { key: "last_maintenance_date", label: "Последнее ТО" },
    { key: "condition_status", label: "Состояние" },
    { key: "notes", label: "Примечания" },
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

  const visibleColumnsData = orderedColumns.filter(col => visibleColumns.includes(col.key));

  return (
    <>
      <TableControls
        // Фильтры
        onClearFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        
        // Столбцы
        availableColumns={orderedColumns}
        visibleColumns={visibleColumns}
        onColumnVisibilityChange={toggleColumnVisibility}
        
        // Пагинация
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalItems}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />

      <div 
        ref={tableContainerRef}
        className="table-container"
      >
        <table>
        <thead>
          <tr>
            {visibleColumnsData.map(({ key, label }) => (
              <th 
                key={key} 
                data-column={key}
                draggable
                style={{ width: columnWidths[key], cursor: !isResizing.current ? 'move' : 'default' }}
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
                <ColumnResizer 
                  onMouseDown={(e) => handleResizeStart(e, key)} 
                />
              </th>
            ))}
            <th data-column="actions" style={{ width: columnWidths.actions }}>
              Действия
              <ColumnResizer 
                onMouseDown={(e) => handleResizeStart(e, 'actions')} 
              />
            </th>
          </tr>
          <tr>
            {visibleColumnsData.map(({ key }) => (
              <th key={key} data-column={key} style={{ width: columnWidths[key] }}>
                {key === 'last_maintenance_date' ? (
                  <DateRangeFilter
                    value={filters[key]}
                    onChange={(value) => updateFilter(key, value)}
                    anchorRef={(el) => (anchorRefs.current[key] = el)}
                  />
                ) : selectOptions[key] ? (
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
            <th data-column="actions" style={{ width: columnWidths.actions }}></th>
          </tr>
        </thead>
        <tbody>
          {paginatedBikes.map((bike) => (
            <tr key={bike.id}>
              {visibleColumnsData.map(({ key }) => (
                <td key={key} data-column={key} style={{ width: columnWidths[key] }}>
                  {key === 'last_maintenance_date' ? formatDate(bike[key]) :
                   key === 'condition_status' ? (
                     <BikeStatusPopover
                       bike={bike}
                       onStatusChange={(bikeId, newStatus) => handleStatusChange(bikeId, newStatus, 'condition_status')}
                       onCreateMaintenance={onCreateMaintenance}
                     />
                   ) : (bike[key] || "—")}
                </td>
              ))}
              <td data-column="actions" style={{ width: columnWidths.actions }}>
                <BikeActionsMenu
                  bike={bike}
                  onEdit={handleBikeEdit}
                  onCreateMaintenance={onCreateMaintenance}
                  onDelete={handleBikeDelete}
                />
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
      
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

export default BikeTable;
