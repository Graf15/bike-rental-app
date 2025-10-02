import React, { useState, useEffect } from 'react';
import './Modal.css';

const MaintenanceEventModal = ({
  isOpen,
  onClose,
  onSubmit,
  mode = 'create',
  eventData = null,
  selectedBikeId = null
}) => {
  const [formData, setFormData] = useState({
    bike_id: selectedBikeId || '',
    maintenance_type: 'current',
    status: 'planned',
    scheduled_for: '',
    scheduled_for_user_id: '',
    description: '',
    notes: '',
    parts_need: 'not_needed'
  });

  const [selectedBike, setSelectedBike] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Состояние для поиска велосипедов
  const [showBikeSearch, setShowBikeSearch] = useState(!selectedBikeId && mode === 'create');
  const [bikeSearchQuery, setBikeSearchQuery] = useState('');
  const [bikeSearchResults, setBikeSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Загружаем данные при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      fetchUsers();

      if (mode === 'edit' && eventData) {
        // Заполняем форму данными для редактирования
        setFormData({
          bike_id: eventData.bike_id || '',
          maintenance_type: eventData.maintenance_type || 'current',
          status: eventData.status || 'planned',
          scheduled_for: eventData.scheduled_for ?
            new Date(eventData.scheduled_for).toISOString().slice(0, 16) : '',
          scheduled_for_user_id: eventData.scheduled_for_user_id || '',
          description: eventData.description || '',
          notes: eventData.notes || '',
          parts_need: eventData.parts_need || 'not_needed'
        });

        // Устанавливаем выбранный велосипед
        if (eventData.bike_id) {
          fetchBikeById(eventData.bike_id);
        }
        setShowBikeSearch(false);
      } else if (selectedBikeId) {
        // Если передан ID велосипеда, загружаем его данные
        fetchBikeById(selectedBikeId);
        setShowBikeSearch(false);
      }
    }
  }, [isOpen, mode, eventData, selectedBikeId]);

  // Загрузка пользователей
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  // Загрузка велосипеда по ID
  const fetchBikeById = async (bikeId) => {
    try {
      const response = await fetch(`/api/bikes/${bikeId}`);
      if (response.ok) {
        const bike = await response.json();
        setSelectedBike(bike);
        setFormData(prev => ({ ...prev, bike_id: bike.id }));
      }
    } catch (error) {
      console.error('Ошибка загрузки велосипеда:', error);
    }
  };

  // Поиск велосипедов
  const searchBikes = async (query) => {
    if (!query.trim() || query.trim().length < 2) {
      setBikeSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await fetch('/api/bikes');
      if (response.ok) {
        const bikes = await response.json();
        const filtered = bikes.filter(bike =>
          bike.internal_article?.toLowerCase().includes(query.toLowerCase()) ||
          bike.model?.toLowerCase().includes(query.toLowerCase())
        );
        setBikeSearchResults(filtered.slice(0, 50)); // Показываем максимум 50 результатов для прокрутки
      }
    } catch (error) {
      console.error('Ошибка поиска велосипедов:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Дебаунс для поиска
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchBikes(bikeSearchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [bikeSearchQuery]);

  // Выбор велосипеда из результатов поиска
  const selectBike = (bike) => {
    setSelectedBike(bike);
    setFormData(prev => ({ ...prev, bike_id: bike.id }));
    setShowBikeSearch(false);
    setBikeSearchQuery('');
    setBikeSearchResults([]);
  };

  // Очистка выбранного велосипеда
  const clearSelectedBike = () => {
    setSelectedBike(null);
    setFormData(prev => ({ ...prev, bike_id: '' }));
    setShowBikeSearch(true);
  };

  // Обработка изменений формы
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Сброс формы
  const resetForm = () => {
    setFormData({
      bike_id: selectedBikeId || '',
      maintenance_type: 'current',
      status: 'planned',
      scheduled_for: '',
      scheduled_for_user_id: '',
      description: '',
      notes: '',
      parts_need: 'not_needed'
    });
    setSelectedBike(null);
    setShowBikeSearch(!selectedBikeId && mode === 'create');
    setBikeSearchQuery('');
    setBikeSearchResults([]);
    setError('');
  };

  // Закрытие модального окна
  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.bike_id) {
      setError('Пожалуйста, выберите велосипед');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onSubmit(formData);
      handleClose();
    } catch (error) {
      setError(error.message || 'Произошла ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>
            {mode === 'edit' ? 'Редактировать событие обслуживания' : 'Создать событие обслуживания'}
          </h2>
          <button className="modal-close" onClick={handleClose}>
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <form className="modal-form" onSubmit={handleSubmit}>
            {/* Секция выбора велосипеда */}
            <div className="form-section">
              <h3>Велосипед</h3>

              {showBikeSearch ? (
                <div className="bike-search">
                  <div className="form-group">
                    <label>Поиск велосипеда по артикулу или модели:</label>
                    <input
                      type="text"
                      value={bikeSearchQuery}
                      onChange={(e) => setBikeSearchQuery(e.target.value)}
                      placeholder="Введите минимум 2 символа для поиска..."
                      className="form-input"
                    />
                  </div>

                  {searchLoading && (
                    <div className="search-loading">Поиск...</div>
                  )}

                  {bikeSearchQuery.length >= 2 && !searchLoading && bikeSearchResults.length === 0 && (
                    <div className="search-no-results">
                      Велосипеды не найдены. Попробуйте изменить поисковый запрос.
                    </div>
                  )}

                  {bikeSearchResults.length > 0 && (
                    <div className="search-results-header">
                      Найдено: {bikeSearchResults.length} велосипедов
                      {bikeSearchResults.length === 50 && <span> (показаны первые 50)</span>}
                    </div>
                  )}

                  {bikeSearchResults.length > 0 && (
                    <div className="bike-search-results">
                      <table className="search-results-table">
                        <thead>
                          <tr>
                            <th>Внутренний артикул</th>
                            <th>Модель</th>
                            <th>Рама</th>
                            <th>Год</th>
                            <th>Размер колес</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {bikeSearchResults.map((bike) => (
                            <tr
                              key={bike.id}
                              onClick={() => selectBike(bike)}
                              className="bike-search-row"
                              title="Нажмите для выбора велосипеда"
                            >
                              <td>{bike.internal_article || '—'}</td>
                              <td>{bike.model || '—'}</td>
                              <td>{bike.frame_size || '—'}</td>
                              <td>{bike.model_year || '—'}</td>
                              <td>{bike.wheel_size || '—'}</td>
                              <td className="select-indicator">→</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : selectedBike ? (
                <div className="selected-bike">
                  <button
                    type="button"
                    onClick={clearSelectedBike}
                    className="btn btn-circular-icon"
                    title="Выбрать другой велосипед"
                  >
                    ↻
                  </button>
                  <div className="selected-bike-info">
                    <h4>{selectedBike.model}</h4>
                    <div className="bike-details">
                      <span><strong>Артикул:</strong> {selectedBike.internal_article || '—'}</span>
                      <span><strong>Рама:</strong> {selectedBike.frame_size || '—'}</span>
                      <span><strong>Год:</strong> {selectedBike.model_year || '—'}</span>
                      <span><strong>Колеса:</strong> {selectedBike.wheel_size || '—'}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Секция данных события */}
            <div className="form-section">
              <h3>Детали события</h3>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="maintenance_type">Тип обслуживания *</label>
                  <select
                    id="maintenance_type"
                    name="maintenance_type"
                    value={formData.maintenance_type}
                    onChange={handleInputChange}
                    className="form-select"
                    required
                  >
                    <option value="current">Текущий ремонт</option>
                    <option value="weekly">Еженедельное ТО</option>
                    <option value="longterm">Долгосрочный ремонт</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="status">Статус *</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="form-select"
                    required
                  >
                    <option value="planned">Запланирован</option>
                    <option value="in_progress">В процессе</option>
                    <option value="completed">Завершен</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="scheduled_for">Запланировано на</label>
                  <input
                    type="datetime-local"
                    id="scheduled_for"
                    name="scheduled_for"
                    value={formData.scheduled_for}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="scheduled_for_user_id">Ответственный</label>
                  <select
                    id="scheduled_for_user_id"
                    name="scheduled_for_user_id"
                    value={formData.scheduled_for_user_id}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="">Выберите пользователя</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="parts_need">Необходимость в запчастях</label>
                  <select
                    id="parts_need"
                    name="parts_need"
                    value={formData.parts_need}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="not_needed">Не требуются</option>
                    <option value="needed">Требуются</option>
                    <option value="ordered">Заказаны</option>
                    <option value="delivered">Доставлены</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="description">Описание работ</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="form-textarea"
                  rows="3"
                  placeholder="Описание работ, которые необходимо выполнить..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">Примечания</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="form-textarea"
                  rows="3"
                  placeholder="Дополнительные примечания..."
                />
              </div>
            </div>

            {/* Кнопки управления */}
            <div className="modal-footer">
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary"
                disabled={loading}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || !formData.bike_id}
              >
                {loading ? 'Сохранение...' : (mode === 'edit' ? 'Сохранить изменения' : 'Создать событие')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceEventModal;