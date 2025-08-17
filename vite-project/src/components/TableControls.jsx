import React, { useState, useRef } from "react";
import "./TableControls.css";

const TableControls = ({
  // Фильтры
  onClearFilters,
  hasActiveFilters = false,
  
  // Столбцы
  availableColumns = [],
  visibleColumns = [],
  onColumnVisibilityChange,
  
  // Пагинация
  currentPage = 1,
  totalPages = 1,
  pageSize = 50,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  
  // Опции размера страницы
  pageSizeOptions = [50, 100, 200, 500]
}) => {
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showPageSizeSelector, setShowPageSizeSelector] = useState(false);
  const columnSelectorRef = useRef(null);
  const pageSizeRef = useRef(null);

  const handleClearFilters = () => {
    if (onClearFilters) {
      onClearFilters();
    }
  };

  const toggleColumnVisibility = (columnKey) => {
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange(columnKey);
    }
  };

  const handlePageSizeChange = (newSize) => {
    if (onPageSizeChange) {
      onPageSizeChange(newSize);
    }
  };

  const handlePageSizeSelect = (newSize) => {
    handlePageSizeChange(newSize);
    setShowPageSizeSelector(false);
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages && onPageChange) {
      onPageChange(page);
    }
  };

  // Генерируем номера страниц для отображения
  const getPageNumbers = () => {
    const delta = 2; // Показываем 2 страницы до и после текущей
    const range = [];
    const rangeWithDots = [];

    for (let i = Math.max(2, currentPage - delta); 
         i <= Math.min(totalPages - 1, currentPage + delta); 
         i++) {
      range.push(i);
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, "...");
    } else {
      rangeWithDots.push(1);
    }

    rangeWithDots.push(...range);

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push("...", totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  return (
    <div className="table-controls">
      <div className="table-controls-left">
        {/* Кнопка сброса фильтров */}
        <button 
          className={`btn-secondary ${!hasActiveFilters ? 'disabled' : ''}`}
          onClick={handleClearFilters}
          disabled={!hasActiveFilters}
          title="Сбросить все фильтры"
        >
          🔄 Сбросить фильтры
        </button>

        {/* Селектор видимых столбцов */}
        <div className="column-selector" ref={columnSelectorRef}>
          <button 
            className="btn-secondary"
            onClick={() => setShowColumnSelector(!showColumnSelector)}
            title="Выбрать столбцы для отображения"
          >
            📋 Столбцы
          </button>
          
          {showColumnSelector && (
            <>
              <div 
                className="column-selector-overlay" 
                onClick={() => setShowColumnSelector(false)}
              />
              <div className="column-selector-dropdown">
                <div className="column-selector-header">
                  <h4>Видимые столбцы</h4>
                  <button 
                    className="close-btn"
                    onClick={() => setShowColumnSelector(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="column-selector-list">
                  {availableColumns.map(({ key, label }) => (
                    <label key={key} className="column-selector-item">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(key)}
                        onChange={() => toggleColumnVisibility(key)}
                      />
                      <span className="checkmark"></span>
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="table-controls-center">
        {/* Информация о записях */}
        <div className="records-info">
          {Math.min((currentPage - 1) * pageSize + 1, totalItems)}–{Math.min(currentPage * pageSize, totalItems)} из {totalItems}
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="pagination">
            <button 
              className="pagination-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              title="Предыдущая страница"
            >
              ‹
            </button>
            
            {getPageNumbers().map((page, index) => (
              <React.Fragment key={index}>
                {page === "..." ? (
                  <span className="pagination-dots">...</span>
                ) : (
                  <button
                    className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
                    onClick={() => goToPage(page)}
                  >
                    {page}
                  </button>
                )}
              </React.Fragment>
            ))}
            
            <button 
              className="pagination-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              title="Следующая страница"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className="table-controls-right">
        {/* Выбор размера страницы */}
        <div className="page-size-selector" style={{ position: 'relative' }}>
          <label>Показать:</label>
          <div 
            ref={pageSizeRef}
            className="rows-selector-button"
            onClick={() => setShowPageSizeSelector(!showPageSizeSelector)}
          >
            {pageSize}
            <span className="arrow">{showPageSizeSelector ? '▲' : '▼'}</span>
          </div>
          
          {showPageSizeSelector && (
            <>
              <div 
                className="popover-overlay" 
                onClick={() => setShowPageSizeSelector(false)} 
              />
              <div className="popover rows-selector-popover">
                {pageSizeOptions.map(size => (
                  <div
                    key={size}
                    className={`popover-option ${size === pageSize ? 'selected' : ''}`}
                    onClick={() => handlePageSizeSelect(size)}
                  >
                    {size}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableControls;