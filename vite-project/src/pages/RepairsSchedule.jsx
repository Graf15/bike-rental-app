import React, { useState, useEffect } from "react";
import "./RepairsSchedule.css";

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
  };

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
          schedules: isActive ? [{ bike_id: bikeId, day_of_week: dayOfWeek, is_active: true }] : []
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

  // Фильтрация и сортировка (как в BikeTable)
  const filteredBikes = bikes.filter((bike) => {
    return Object.entries(filters).every(([key, value]) => {
      if (!value || value.length === 0) return true;
      return String(bike[key] || "")
        .toLowerCase()
        .includes(value.toLowerCase());
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

  // Статистика по дням
  const weeklyStats = daysOfWeek.map(day => ({
    ...day,
    count: schedule.filter(s => s.is_active && s.day_of_week === day.value).length
  }));

  const totalScheduled = schedule.filter(s => s.is_active).length;

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;

  const columns = [
    { key: "bike_number", label: "№" },
    { key: "model", label: "Модель" },
    { key: "year", label: "Год" },
    { key: "wheel_size", label: "Размер колеса" },
    { key: "frame_size", label: "Рама" },
    { key: "gender", label: "Пол" },
    { key: "category", label: "Сегмент" },
    { key: "status", label: "Статус" },
  ];

  return (
    <div className="repairs-schedule-page">
      <div className="page-header">
        <div className="header-content">
          <h1>🔧 Планирование ремонтов</h1>
          <p className="page-description">
            Настройте шаблон еженедельного расписания ТО. Этот план будет применяться каждую неделю автоматически.
          </p>
        </div>
        
        {/* Статистика по дням */}
        <div className="weekly-stats">
          <div className="stats-header">
            <span className="total-count">Всего запланировано: {totalScheduled}</span>
          </div>
          <div className="day-stats">
            {weeklyStats.map(day => (
              <div key={day.value} className={`day-stat ${day.count > 0 ? 'has-repairs' : ''}`}>
                <span className="day-label">{day.short}</span>
                <span className="day-count">{day.count}</span>
              </div>
            ))}
          </div>
        </div>

        <button 
          className="btn-generate"
          onClick={handleGenerateWeekly}
          disabled={generating || totalScheduled === 0}
        >
          {generating ? "Создание..." : "📅 Создать ремонты на неделю"}
        </button>
      </div>

      {/* Таблица велосипедов с планированием */}
      <div className="schedule-table-container">
        <table className="schedule-table">
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
              <th>Запланированный день</th>
              <th>Действия</th>
            </tr>
            <tr className="filter-row">
              {columns.map(({ key }) => (
                <th key={key}>
                  <input
                    type="text"
                    placeholder="Фильтр"
                    value={filters[key] || ""}
                    onChange={(e) => updateFilter(key, e.target.value)}
                    className="filter-input"
                  />
                </th>
              ))}
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedBikes.map((bike) => {
              const bikeSchedule = getScheduleForBike(bike.id);
              return (
                <tr key={bike.id} className={bikeSchedule ? 'scheduled' : ''}>
                  <td className="bike-number">{bike.bike_number}</td>
                  <td>{bike.model}</td>
                  <td>{bike.year}</td>
                  <td>{bike.wheel_size}"</td>
                  <td>{bike.frame_size}</td>
                  <td>{bike.gender}</td>
                  <td>{bike.category}</td>
                  <td>
                    <span className={`status status-${bike.status.replace(' ', '-')}`}>
                      {bike.status}
                    </span>
                  </td>
                  <td className="day-assignment">
                    {bikeSchedule ? (
                      <div className="scheduled-day">
                        <span className="day-chip">
                          {daysOfWeek.find(d => d.value === bikeSchedule.day_of_week)?.label}
                        </span>
                      </div>
                    ) : (
                      <span className="not-scheduled">Не запланировано</span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      {bikeSchedule ? (
                        <button 
                          className="btn-remove"
                          onClick={() => handleDayAssignment(bike.id, null, false)}
                          title="Убрать из расписания"
                        >
                          ❌
                        </button>
                      ) : (
                        <select 
                          className="day-selector"
                          onChange={(e) => {
                            if (e.target.value) {
                              handleDayAssignment(bike.id, parseInt(e.target.value), true);
                              e.target.value = ""; // Сброс селекта
                            }
                          }}
                        >
                          <option value="">Добавить в день...</option>
                          {daysOfWeek.map(day => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RepairsSchedule;