import { useState, useRef, useEffect, useCallback } from "react";
import BikeStatusPopover from "./BikeStatusPopover";
import BikeActionsMenu from "./BikeActionsMenu";
import TableControls from "./TableControls";
import MultiSelectPopover from "./MultiSelectPopover";
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
      'bike_number', 'model', 'model_year', 'wheel_size', 'frame_size', 
      'frame_number', 'gender', 'segment', 'last_service_date', 'notes', 'status'
    ];
  });

  // Дефолтные ширины столбцов
  const defaultColumnWidths = {
    bike_number: 60,
    model: 150,
    model_year: 80,
    wheel_size: 120,
    frame_size: 80,
    frame_number: 120,
    gender: 80,
    segment: 100,
    last_service_date: 120,
    notes: 150,
    status: 100,
    actions: 120
  };

  // Состояние для ширин столбцов с загрузкой из localStorage
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('bikeTableColumnWidths');
    return saved ? { ...defaultColumnWidths, ...JSON.parse(saved) } : defaultColumnWidths;
  });

  // Состояние для ресайза - используем ref чтобы избежать перерендеров
  const isResizing = useRef(false);
  const resizingColumn = useRef(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Реф для контейнера таблицы
  const tableContainerRef = useRef(null);

  const selectOptions = {
    wheel_size: ["20", "24", "26", "27.5", "29"],
    frame_size: [
      "д20",
      "д24",
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
      "13",
      "14",
      "15",
      "15,5",
      "16",
      "16,5",
      "17",
      "17,5",
      "18",
      "18,5",
      "19",
      "19,5",
      "20",
      "20,5",
      "21",
      "21,5",
      "22",
      "22,5",
      "23",
      "23,5",
    ],
    gender: ["женский", "мужской", "унисекс"],
    segment: ["kids", "econom", "standart", "premium", "эл.вел'", "эл.самокат"],
    status: [
      "в наличии",
      "в прокате",
      "в ремонте",
      "требует ремонта",
      "бронь",
      "продан",
      "украден",
      "невозврат",
    ],
  };

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

  // Динамическое обновление CSS для ширин столбцов
  useEffect(() => {
    const totalWidth = Object.values(columnWidths).reduce((sum, width) => sum + width, 0);
    
    // Создаём CSS правила для каждого столбца
    let css = `
      .home-page .table-container table { width: ${totalWidth}px !important; }
    `;
    
    Object.values(columnWidths).forEach((width, index) => {
      css += `
        .home-page .table-container th:nth-child(${index + 1}),
        .home-page .table-container td:nth-child(${index + 1}) {
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
  }, [columnWidths]);





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
      setFilters(prev => ({ ...prev, status: [statusFilter] }));
    } else {
      setFilters(prev => {
        const { status: _, ...rest } = prev;
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

  const hasActiveFilters = Object.values(filters).some(value => 
    Array.isArray(value) ? value.length > 0 : value
  );

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

  const handleStatusChange = async (bikeId, newStatus) => {
    try {
      const response = await fetch(`/api/bikes/${bikeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
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
      if (!value || value.length === 0) return true;
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
    { key: "bike_number", label: "№" },
    { key: "model", label: "Модель" },
    { key: "model_year", label: "Год" },
    { key: "wheel_size", label: "Размер колеса" },
    { key: "frame_size", label: "Рама" },
    { key: "frame_number", label: "Номер рамы" },
    { key: "gender", label: "Пол" },
    { key: "segment", label: "Сегмент" },
    { key: "last_service_date", label: "Последнее ТО" },
    { key: "notes", label: "Примечания" },
    { key: "status", label: "Состояние" },
  ];

  const visibleColumnsData = columns.filter(col => visibleColumns.includes(col.key));

  return (
    <>
      <TableControls
        // Фильтры
        onClearFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
        
        // Столбцы
        availableColumns={columns}
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
                style={{ width: columnWidths[key] }}
                onClick={() => handleSort(key)}
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
            <th style={{ width: columnWidths.actions }}>
              Действия
              <ColumnResizer 
                onMouseDown={(e) => handleResizeStart(e, 'actions')} 
              />
            </th>
          </tr>
          <tr>
            {visibleColumnsData.map(({ key }) => (
              <th key={key} style={{ width: columnWidths[key] }}>
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
            <th style={{ width: columnWidths.actions }}></th>
          </tr>
        </thead>
        <tbody>
          {paginatedBikes.map((bike) => (
            <tr key={bike.id}>
              {visibleColumnsData.map(({ key }) => (
                <td key={key} style={{ width: columnWidths[key] }}>
                  {key === 'last_service_date' ? formatDate(bike[key]) :
                   key === 'status' ? (
                     <BikeStatusPopover
                       bike={bike}
                       onStatusChange={handleStatusChange}
                       onCreateMaintenance={onCreateMaintenance}
                     />
                   ) : (bike[key] || "—")}
                </td>
              ))}
              <td style={{ width: columnWidths.actions }}>
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
