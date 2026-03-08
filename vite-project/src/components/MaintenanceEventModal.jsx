import { apiFetch } from "../utils/api";
import React, { useState, useEffect, useRef } from 'react';
import MultiSelectPopover from './MultiSelectPopover';
import DateTimePickerField from './DateTimePickerField';
import './Modal.css';
import { toast } from '../utils/toast';

const MAINTENANCE_TYPE_OPTIONS = [
  { value: 'current', label: 'Текущий ремонт' },
  { value: 'weekly', label: 'Еженедельное ТО' },
  { value: 'longterm', label: 'Долгосрочный ремонт' },
];

const STATUS_OPTIONS = [
  { value: 'planned', label: 'Запланирован' },
  { value: 'in_progress', label: 'В процессе' },
  { value: 'completed', label: 'Завершен' },
];

const PARTS_NEED_OPTIONS = [
  { value: 'not_needed', label: 'Не требуются' },
  { value: 'needed', label: 'Требуются' },
  { value: 'ordered', label: 'Заказаны' },
  { value: 'delivered', label: 'Доставлены' },
];

const INITIAL_FORM = {
  bike_id: '',
  maintenance_type: 'current',
  status: 'planned',
  scheduled_for: '',
  scheduled_for_user_id: '',
  description: '',
  notes: '',
  parts_need: 'not_needed',
};

const MaintenanceEventModal = ({
  isOpen,
  onClose,
  onSubmit,
  mode = 'create',
  eventData = null,
  selectedBikeId = null
}) => {
  const [formData, setFormData] = useState({ ...INITIAL_FORM, bike_id: selectedBikeId || '' });
  const [selectedBike, setSelectedBike] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorSection, setErrorSection] = useState(null);
  const [openField, setOpenField] = useState(null);

  const [showBikeSearch, setShowBikeSearch] = useState(!selectedBikeId && mode === 'create');
  const [bikeSearchQuery, setBikeSearchQuery] = useState('');
  const [bikeSearchResults, setBikeSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const mouseDownOnOverlay = useRef(false);
  const maintenanceTypeRef = useRef(null);
  const statusRef = useRef(null);
  const userRef = useRef(null);
  const partsNeedRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();

      if (mode === 'edit' && eventData) {
        setFormData({
          bike_id: eventData.bike_id || '',
          maintenance_type: eventData.maintenance_type || 'current',
          status: eventData.status || 'planned',
          scheduled_for: eventData.scheduled_for || '',
          scheduled_for_user_id: eventData.scheduled_for_user_id || '',
          description: eventData.description || '',
          notes: eventData.notes || '',
          parts_need: eventData.parts_need || 'not_needed',
        });
        if (eventData.bike_id) fetchBikeById(eventData.bike_id);
        setShowBikeSearch(false);
      } else if (selectedBikeId) {
        fetchBikeById(selectedBikeId);
        setShowBikeSearch(false);
      }
    }
  }, [isOpen, mode, eventData, selectedBikeId]);

  useEffect(() => {
    if (errorSection === 'bike' && formData.bike_id) setErrorSection(null);
  }, [formData.bike_id, errorSection]);

  useEffect(() => {
    const timeoutId = setTimeout(() => { searchBikes(bikeSearchQuery); }, 300);
    return () => clearTimeout(timeoutId);
  }, [bikeSearchQuery]);

  const fetchUsers = async () => {
    try {
      const response = await apiFetch('/api/users');
      if (response.ok) setUsers(await response.json());
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  const fetchBikeById = async (bikeId) => {
    try {
      const response = await apiFetch(`/api/bikes/${bikeId}`);
      if (response.ok) {
        const bike = await response.json();
        setSelectedBike(bike);
        setFormData(prev => ({ ...prev, bike_id: bike.id }));
      }
    } catch (error) {
      console.error('Ошибка загрузки велосипеда:', error);
    }
  };

  const searchBikes = async (query) => {
    if (!query.trim() || query.trim().length < 2) { setBikeSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const response = await apiFetch('/api/bikes');
      if (response.ok) {
        const bikes = await response.json();
        const filtered = bikes.filter(bike =>
          bike.internal_article?.toLowerCase().includes(query.toLowerCase()) ||
          bike.model?.toLowerCase().includes(query.toLowerCase())
        );
        setBikeSearchResults(filtered.slice(0, 50));
      }
    } catch (error) {
      console.error('Ошибка поиска велосипедов:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectBike = (bike) => {
    setSelectedBike(bike);
    setFormData(prev => ({ ...prev, bike_id: bike.id }));
    setShowBikeSearch(false);
    setBikeSearchQuery('');
    setBikeSearchResults([]);
  };

  const clearSelectedBike = () => {
    setSelectedBike(null);
    setFormData(prev => ({ ...prev, bike_id: '' }));
    setShowBikeSearch(true);
  };

  const resetForm = () => {
    setFormData({ ...INITIAL_FORM, bike_id: selectedBikeId || '' });
    setSelectedBike(null);
    setShowBikeSearch(!selectedBikeId && mode === 'create');
    setBikeSearchQuery('');
    setBikeSearchResults([]);
    setOpenField(null);
    setErrorSection(null);
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.bike_id) {
      setErrorSection('bike');
      toast.error('Пожалуйста, выберите велосипед');
      return;
    }
    setLoading(true);
    setErrorSection(null);
    try {
      await onSubmit(formData);
      handleClose();
    } catch (error) {
      toast.error(error.message || 'Произошла ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const userOptions = [
    { value: '', label: '— Не указан —' },
    ...users.map(u => ({ value: String(u.id), label: u.name })),
  ];

  return (
    <>
      <div
        className="modal-overlay"
        onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
        onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) handleClose(); }}
      >
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{mode === 'edit' ? 'Редактировать событие обслуживания' : 'Создать событие обслуживания'}</h2>
            <button className="modal-close" onClick={handleClose}>✕</button>
          </div>

          <div className="modal-body">
            <form className="modal-form" onSubmit={handleSubmit}>

              {/* Велосипед */}
              <div className={`form-section${errorSection === 'bike' ? ' form-section--error' : ''}`}>
                <h3>Велосипед</h3>

                {showBikeSearch ? (
                  <div className="bike-search">
                    <div className="form-group">
                      <label>Поиск по артикулу или модели:</label>
                      <input
                        type="text"
                        value={bikeSearchQuery}
                        onChange={(e) => setBikeSearchQuery(e.target.value)}
                        placeholder="Введите минимум 2 символа..."
                        className="form-input"
                      />
                    </div>

                    {searchLoading && <div className="search-loading">Поиск...</div>}

                    {bikeSearchQuery.length >= 2 && !searchLoading && bikeSearchResults.length === 0 && (
                      <div className="search-no-results">Велосипеды не найдены. Попробуйте изменить запрос.</div>
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
                              <th>Артикул</th>
                              <th>Модель</th>
                              <th>Рама</th>
                              <th>Год</th>
                              <th>Колеса</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {bikeSearchResults.map((bike) => (
                              <tr
                                key={bike.id}
                                onClick={() => selectBike(bike)}
                                className="bike-search-row"
                                title="Нажмите для выбора"
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

              {/* Детали события */}
              <div className="form-section">
                <h3>Детали события</h3>

                <div className="form-grid">
                  <div className="form-group">
                    <label className="required-label">Тип обслуживания</label>
                    <button
                      type="button"
                      className="filter-select-box"
                      style={{ width: '100%' }}
                      ref={maintenanceTypeRef}
                      onClick={() => setOpenField(openField === 'maintenance_type' ? null : 'maintenance_type')}
                    >
                      {MAINTENANCE_TYPE_OPTIONS.find(o => o.value === formData.maintenance_type)?.label || '— Выберите —'}
                      <span className="arrow">▼</span>
                    </button>
                  </div>

                  <div className="form-group">
                    <label className="required-label">Статус</label>
                    <button
                      type="button"
                      className="filter-select-box"
                      style={{ width: '100%' }}
                      ref={statusRef}
                      onClick={() => setOpenField(openField === 'status' ? null : 'status')}
                    >
                      {STATUS_OPTIONS.find(o => o.value === formData.status)?.label || '— Выберите —'}
                      <span className="arrow">▼</span>
                    </button>
                  </div>

                  <div className="form-group">
                    <label>Запланировано на</label>
                    <DateTimePickerField
                      value={formData.scheduled_for}
                      onChange={(val) => setFormData(prev => ({ ...prev, scheduled_for: val || '' }))}
                      placeholder="Выберите дату и время"
                      minDate={null}
                    />
                  </div>

                  <div className="form-group">
                    <label>Ответственный</label>
                    <button
                      type="button"
                      className="filter-select-box"
                      style={{ width: '100%' }}
                      ref={userRef}
                      onClick={() => setOpenField(openField === 'user' ? null : 'user')}
                    >
                      {userOptions.find(o => o.value === String(formData.scheduled_for_user_id || ''))?.label || '— Не указан —'}
                      <span className="arrow">▼</span>
                    </button>
                  </div>

                  <div className="form-group">
                    <label>Запчасти</label>
                    <button
                      type="button"
                      className="filter-select-box"
                      style={{ width: '100%' }}
                      ref={partsNeedRef}
                      onClick={() => setOpenField(openField === 'parts_need' ? null : 'parts_need')}
                    >
                      {PARTS_NEED_OPTIONS.find(o => o.value === formData.parts_need)?.label || '— Выберите —'}
                      <span className="arrow">▼</span>
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Описание работ</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="form-input"
                    rows="3"
                    placeholder="Описание работ, которые необходимо выполнить..."
                  />
                </div>

                <div className="form-group">
                  <label>Примечания</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="form-input"
                    rows="3"
                    placeholder="Дополнительные примечания..."
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary-green" onClick={handleClose} disabled={loading}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary-green" disabled={loading || !formData.bike_id}>
                  {loading ? 'Сохранение...' : mode === 'edit' ? 'Сохранить изменения' : 'Создать событие'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <MultiSelectPopover
        options={MAINTENANCE_TYPE_OPTIONS}
        selected={[formData.maintenance_type]}
        onChange={([v]) => { setFormData(prev => ({ ...prev, maintenance_type: v })); setOpenField(null); }}
        visible={openField === 'maintenance_type'}
        anchorRef={maintenanceTypeRef}
        onClose={() => setOpenField(null)}
        singleSelect
      />
      <MultiSelectPopover
        options={STATUS_OPTIONS}
        selected={[formData.status]}
        onChange={([v]) => { setFormData(prev => ({ ...prev, status: v })); setOpenField(null); }}
        visible={openField === 'status'}
        anchorRef={statusRef}
        onClose={() => setOpenField(null)}
        singleSelect
      />
      <MultiSelectPopover
        options={userOptions}
        selected={[String(formData.scheduled_for_user_id || '')]}
        onChange={([v]) => { setFormData(prev => ({ ...prev, scheduled_for_user_id: v })); setOpenField(null); }}
        visible={openField === 'user'}
        anchorRef={userRef}
        onClose={() => setOpenField(null)}
        singleSelect
      />
      <MultiSelectPopover
        options={PARTS_NEED_OPTIONS}
        selected={[formData.parts_need]}
        onChange={([v]) => { setFormData(prev => ({ ...prev, parts_need: v })); setOpenField(null); }}
        visible={openField === 'parts_need'}
        anchorRef={partsNeedRef}
        onClose={() => setOpenField(null)}
        singleSelect
      />
    </>
  );
};

export default MaintenanceEventModal;
