import React, { useState, useEffect } from "react";
import "./WeeklyScheduleManager.css";

const WeeklyScheduleManager = ({ onClose, onSave }) => {
  const [schedules, setSchedules] = useState([]);
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const daysOfWeek = [
    { value: 1, label: "Понедельник" },
    { value: 2, label: "Вторник" },
    { value: 3, label: "Среда" },
    { value: 4, label: "Четверг" },
    { value: 5, label: "Пятница" },
    { value: 6, label: "Суббота" },
    { value: 7, label: "Воскресенье" },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      // Load bikes and existing schedules
      const [bikesResponse, schedulesResponse] = await Promise.all([
        fetch("/api/bikes"),
        fetch("/api/maintenance/weekly-schedule"),
      ]);

      if (!bikesResponse.ok || !schedulesResponse.ok) {
        throw new Error("Ошибка загрузки данных");
      }

      const bikesData = await bikesResponse.json();
      const schedulesData = await schedulesResponse.json();

      setBikes(bikesData);
      setSchedules(schedulesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleChange = (bikeId, field, value) => {
    setSchedules(prev => {
      const existing = prev.find(s => s.bike_id === bikeId);
      if (existing) {
        return prev.map(s => 
          s.bike_id === bikeId 
            ? { ...s, [field]: value }
            : s
        );
      } else {
        return [...prev, {
          bike_id: bikeId,
          day_of_week: field === 'day_of_week' ? value : 1,
          is_active: field === 'is_active' ? value : true,
        }];
      }
    });
  };

  const getScheduleForBike = (bikeId) => {
    return schedules.find(s => s.bike_id === bikeId) || {
      day_of_week: 1,
      is_active: false,
    };
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const activeSchedules = schedules.filter(s => s.is_active);
      
      const response = await fetch("/api/maintenance/weekly-schedule", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ schedules: activeSchedules }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка сохранения");
      }

      onSave && onSave();
      onClose && onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateWeekly = async () => {
    if (!confirm("Создать еженедельные ремонты на следующую неделю?")) {
      return;
    }

    setSaving(true);
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
      alert(`${result.message}`);
      
      onSave && onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="weekly-schedule-modal">
          <div className="loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  const activeCount = schedules.filter(s => s.is_active).length;
  const scheduledByDay = daysOfWeek.map(day => ({
    ...day,
    count: schedules.filter(s => s.is_active && s.day_of_week === day.value).length
  }));

  return (
    <div className="modal-overlay">
      <div className="weekly-schedule-modal">
        <div className="modal-header">
          <h2>Управление еженедельным расписанием ТО</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="schedule-summary">
          <div className="summary-stats">
            <span className="stat">
              Активных расписаний: {activeCount}
            </span>
            {scheduledByDay.map(day => day.count > 0 && (
              <span key={day.value} className="stat day-stat">
                {day.label}: {day.count}
              </span>
            ))}
          </div>
          
          <button 
            className="btn-generate"
            onClick={handleGenerateWeekly}
            disabled={saving || activeCount === 0}
          >
            Создать ремонты на неделю
          </button>
        </div>

        <div className="modal-content">
          <div className="bikes-schedule-list">
            {bikes.map(bike => {
              const schedule = getScheduleForBike(bike.id);
              return (
                <div key={bike.id} className="bike-schedule-item">
                  <div className="bike-info">
                    <span className="bike-number">#{bike.bike_number}</span>
                    <span className="bike-model">{bike.model}</span>
                    <span className={`bike-status status-${bike.status.replace(' ', '-')}`}>
                      {bike.status}
                    </span>
                  </div>
                  
                  <div className="schedule-controls">
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={schedule.is_active}
                        onChange={(e) => handleScheduleChange(bike.id, 'is_active', e.target.checked)}
                      />
                      <span className="slider"></span>
                      <span className="toggle-label">Включить в расписание</span>
                    </label>
                    
                    {schedule.is_active && (
                      <div className="day-selector">
                        <label>День недели:</label>
                        <select
                          value={schedule.day_of_week}
                          onChange={(e) => handleScheduleChange(bike.id, 'day_of_week', parseInt(e.target.value))}
                        >
                          {daysOfWeek.map(day => (
                            <option key={day.value} value={day.value}>
                              {day.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {schedule.last_scheduled && (
                    <div className="schedule-info">
                      <small>
                        Последнее ТО: {new Date(schedule.last_scheduled).toLocaleDateString('ru-RU')}
                      </small>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="btn-cancel" 
            onClick={onClose}
            disabled={saving}
          >
            Отмена
          </button>
          <button 
            className="btn-save" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeeklyScheduleManager;