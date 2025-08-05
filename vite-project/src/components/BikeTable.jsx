import React, { useState, useRef, useEffect } from "react";
import BikeStatusPopover from "./BikeStatusPopover";
import BikeActionsMenu from "./BikeActionsMenu";
import "./BikeTable.css";

const MultiSelectPopover = ({
  options,
  selected,
  onChange,
  visible,
  anchorRef,
  onClose,
}) => {
  const popoverRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (visible && anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [anchorRef, visible]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target) &&
        anchorRef?.current &&
        !anchorRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [visible, onClose, anchorRef]);

  if (!visible || !Array.isArray(options) || options.length === 0) return null;

  const toggleOption = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  return (
    <>
      <div className="popover-overlay" onClick={onClose} />
      <div
        className="popover positioned"
        ref={popoverRef}
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          minWidth: `${position.width}px`,
        }}
      >
        {options.map((option) => (
          <div
            key={option}
            className={`popover-option ${
              selected.includes(option) ? "selected" : ""
            }`}
            onClick={() => toggleOption(option)}
          >
            {option} {selected.includes(option) && "✓"}
          </div>
        ))}
      </div>
    </>
  );
};

const BikeTable = ({
  bikes,
  onBikeUpdate,
  onCreateMaintenance,
  onBikeEdit,
  onBikeDelete,
}) => {
  const [sortColumn, setSortColumn] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filters, setFilters] = useState({});
  const [popoverInfo, setPopoverInfo] = useState({ key: null, visible: false });
  const anchorRefs = useRef({});

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

  return (
    <div style={{ position: "relative" }}>
      <table>
        <thead>
          <tr>
            {columns.map(({ key, label }) => (
              <th key={key} onClick={() => handleSort(key)}>
                {label}{" "}
                <span className="sort-arrow">
                  {sortColumn === key && (sortAsc ? "▲" : "▼")}
                </span>
              </th>
            ))}
            <th>Действия</th>
          </tr>
          <tr>
            {columns.map(({ key }) => (
              <th key={key}>
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
                    style={{ width: "90%" }}
                  />
                )}
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortedBikes.map((bike) => (
            <tr key={bike.id}>
              <td>{bike.bike_number || "—"}</td>
              <td>{bike.model}</td>
              <td>{bike.model_year || "—"}</td>
              <td>{bike.wheel_size || "—"}</td>
              <td>{bike.frame_size || "—"}</td>
              <td>{bike.frame_number || "—"}</td>
              <td>{bike.gender || "—"}</td>
              <td>{bike.segment || "—"}</td>
              <td>{bike.last_service_date || "—"}</td>
              <td>{bike.notes || "—"}</td>
              <td>
                <BikeStatusPopover
                  bike={bike}
                  onStatusChange={handleStatusChange}
                  onCreateMaintenance={onCreateMaintenance}
                />
              </td>
              <td>
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
    </div>
  );
};

export default BikeTable;
