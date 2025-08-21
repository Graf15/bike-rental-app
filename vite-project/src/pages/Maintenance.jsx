import React, { useState, useEffect } from "react";
import MaintenanceTable from "../components/MaintenanceTable";
import CreateMaintenanceModal from "../components/CreateMaintenanceModal";
import WeeklyScheduleManager from "../components/WeeklyScheduleManager";
import "./Maintenance.css";

const Maintenance = () => {
  const [maintenanceEvents, setMaintenanceEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [statusChangeModal, setStatusChangeModal] = useState({ open: false, eventId: null, currentStatus: null });

  useEffect(() => {
    fetchMaintenanceEvents();
  }, []);

  const fetchMaintenanceEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/maintenance");
      if (!response.ok) {
        throw new Error("Ошибка при загрузке событий обслуживания");
      }
      const data = await response.json();
      setMaintenanceEvents(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMaintenance = async (maintenanceData) => {
    try {
      const response = await fetch("/api/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(maintenanceData),
      });

      if (!response.ok) {
        throw new Error("Ошибка при создании события обслуживания");
      }

      // Перезагружаем данные
      await fetchMaintenanceEvents();
      return response.json();
    } catch (error) {
      console.error("Ошибка создания ремонта:", error);
      throw error;
    }
  };

  const handleMaintenanceAction = async (action, eventId, eventData) => {
    try {
      switch (action) {
        case 'status':
          setStatusChangeModal({ 
            open: true, 
            eventId, 
            currentStatus: eventData.status,
            eventData 
          });
          break;
          
        case 'edit':
          // TODO: Implement edit modal
          alert('Редактирование будет реализовано в следующей версии');
          break;
          
        case 'delete':
          if (confirm(`Удалить ремонт #${eventId}?`)) {
            const response = await fetch(`/api/maintenance/${eventId}`, {
              method: 'DELETE',
            });
            
            if (!response.ok) {
              throw new Error('Ошибка при удалении события');
            }
            
            await fetchMaintenanceEvents();
          }
          break;
          
        default:
          console.log('Unknown action:', action);
      }
    } catch (error) {
      console.error('Ошибка выполнения действия:', error);
      alert('Ошибка: ' + error.message);
    }
  };

  const handleStatusChange = async (newStatus, notes = '') => {
    try {
      const response = await fetch(`/api/maintenance/${statusChangeModal.eventId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus, notes }),
      });
      
      if (!response.ok) {
        throw new Error('Ошибка при изменении статуса');
      }
      
      setStatusChangeModal({ open: false, eventId: null, currentStatus: null });
      await fetchMaintenanceEvents();
    } catch (error) {
      console.error('Ошибка изменения статуса:', error);
      alert('Ошибка: ' + error.message);
    }
  };

  if (loading) return <div className="loading">Загрузка...</div>;
  if (error) return <div className="error">Ошибка: {error}</div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Обслуживание велосипедов</h1>
        <div className="page-actions">
          <button 
            className="btn btn-secondary-green" 
            onClick={() => setIsScheduleModalOpen(true)}
          >
            📅 Еженедельное расписание
          </button>
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            + Добавить событие
          </button>
        </div>
      </div>

      <MaintenanceTable
        events={maintenanceEvents}
        onUpdate={handleMaintenanceAction}
      />

      <CreateMaintenanceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateMaintenance}
      />
      
      {isScheduleModalOpen && (
        <WeeklyScheduleManager
          onClose={() => setIsScheduleModalOpen(false)}
          onSave={() => {
            setIsScheduleModalOpen(false);
            fetchMaintenanceEvents(); // Refresh to show any new weekly repairs
          }}
        />
      )}
      
      {statusChangeModal.open && (
        <StatusChangeModal
          isOpen={statusChangeModal.open}
          currentStatus={statusChangeModal.currentStatus}
          eventData={statusChangeModal.eventData}
          onClose={() => setStatusChangeModal({ open: false, eventId: null, currentStatus: null })}
          onSubmit={handleStatusChange}
        />
      )}
    </div>
  );
};

// Quick Status Change Modal Component
const StatusChangeModal = ({ isOpen, currentStatus, eventData, onClose, onSubmit }) => {
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [notes, setNotes] = useState('');
  
  const statusOptions = ["запланирован", "в ремонте", "ожидает деталей", "ремонт выполнен"];
  
  if (!isOpen) return null;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(newStatus, notes);
  };
  
  return (
    <div className="modal-overlay">
      <div className="status-change-modal">
        <div className="modal-header">
          <h3>Изменить статус ремонта</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-content">
            <div className="event-info">
              <p><strong>Велосипед:</strong> #{eventData?.bike_number} ({eventData?.model})</p>
              <p><strong>Текущий статус:</strong> {currentStatus}</p>
            </div>
            
            <div className="form-group">
              <label>Новый статус:</label>
              <select 
                value={newStatus} 
                onChange={(e) => setNewStatus(e.target.value)}
                required
              >
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Комментарий (необязательно):</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Добавьте комментарий к изменению статуса..."
              />
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn-save">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Maintenance;
