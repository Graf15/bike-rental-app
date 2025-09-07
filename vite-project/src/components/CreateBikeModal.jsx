import React, { useState, useEffect } from 'react';
import { BIKE_OPTIONS } from '../constants/selectOptions';
import './Modal.css';

const CreateBikeModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    model: '',
    internal_article: '',
    brand_id: '',
    purchase_price_usd: '',
    purchase_price_uah: '',
    purchase_date: '',
    model_year: '',
    wheel_size: '',
    frame_size: '',
    frame_number: '',
    gender: '',
    price_segment: '',
    supplier_article: '',
    supplier_website_link: '',
    condition_status: 'в наличии',
    notes: ''
  });

  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Опции для выпадающих списков
  const selectOptions = BIKE_OPTIONS;

  // Загружаем список брендов при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      fetchBrands();
    }
  }, [isOpen]);

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands');
      if (response.ok) {
        const data = await response.json();
        setBrands(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки брендов:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Подготавливаем данные для отправки
      const submitData = {
        ...formData,
        brand_id: formData.brand_id || null,
        purchase_price_usd: formData.purchase_price_usd ? Number(formData.purchase_price_usd) : null,
        purchase_price_uah: formData.purchase_price_uah ? Number(formData.purchase_price_uah) : null,
        model_year: formData.model_year ? Number(formData.model_year) : null,
        purchase_date: formData.purchase_date || null
      };

      await onSubmit(submitData);
      onClose();
      
      // Очищаем форму
      setFormData({
        model: '',
        internal_article: '',
        brand_id: '',
        purchase_price_usd: '',
        purchase_price_uah: '',
        purchase_date: '',
        model_year: '',
        wheel_size: '',
        frame_size: '',
        frame_number: '',
        gender: '',
        price_segment: '',
        supplier_article: '',
        supplier_website_link: '',
        condition_status: 'в наличии',
        notes: ''
      });
    } catch (error) {
      setError(error.message || 'Ошибка при создании велосипеда');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Добавить новый велосипед</h2>
          <button className="modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-section">
            <h3>Основная информация</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Модель *</label>
                <input
                  type="text"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  required
                  placeholder="Например: Trek X-Caliber 8"
                />
              </div>
              <div className="form-group">
                <label>Внутренний артикул</label>
                <input
                  type="text"
                  name="internal_article"
                  value={formData.internal_article}
                  onChange={handleChange}
                  placeholder="Например: TRK-XC8-2023-001"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Бренд</label>
                <select
                  name="brand_id"
                  value={formData.brand_id}
                  onChange={handleChange}
                >
                  <option value="">Выберите бренд</option>
                  {brands.map(brand => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Статус</label>
                <select
                  name="condition_status"
                  value={formData.condition_status}
                  onChange={handleChange}
                >
                  {selectOptions.condition_status.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Характеристики</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Размер колес</label>
                <select
                  name="wheel_size"
                  value={formData.wheel_size}
                  onChange={handleChange}
                >
                  <option value="">Выберите размер</option>
                  {selectOptions.wheel_size.map(size => (
                    <option key={size} value={size}>
                      {size}"
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Размер рамы</label>
                <select
                  name="frame_size"
                  value={formData.frame_size}
                  onChange={handleChange}
                >
                  <option value="">Выберите размер</option>
                  {selectOptions.frame_size.map(size => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Пол</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="">Выберите</option>
                  {selectOptions.gender.map(gender => (
                    <option key={gender} value={gender}>
                      {gender}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Ценовой сегмент</label>
                <select
                  name="price_segment"
                  value={formData.price_segment}
                  onChange={handleChange}
                >
                  <option value="">Выберите сегмент</option>
                  {selectOptions.price_segment.map(segment => (
                    <option key={segment} value={segment}>
                      {segment}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Номер рамы</label>
              <input
                type="text"
                name="frame_number"
                value={formData.frame_number}
                onChange={handleChange}
                placeholder="Серийный номер рамы"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Финансовая информация</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Цена в USD</label>
                <input
                  type="number"
                  name="purchase_price_usd"
                  value={formData.purchase_price_usd}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
              <div className="form-group">
                <label>Цена в UAH</label>
                <input
                  type="number"
                  name="purchase_price_uah"
                  value={formData.purchase_price_uah}
                  onChange={handleChange}
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Дата покупки</label>
                <input
                  type="date"
                  name="purchase_date"
                  value={formData.purchase_date}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>Год модели</label>
                <input
                  type="number"
                  name="model_year"
                  value={formData.model_year}
                  onChange={handleChange}
                  min="2000"
                  max="2030"
                  placeholder="2024"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Дополнительная информация</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Артикул поставщика</label>
                <input
                  type="text"
                  name="supplier_article"
                  value={formData.supplier_article}
                  onChange={handleChange}
                  placeholder="Артикул у поставщика"
                />
              </div>
              <div className="form-group">
                <label>Ссылка на сайт поставщика</label>
                <input
                  type="url"
                  name="supplier_website_link"
                  value={formData.supplier_website_link}
                  onChange={handleChange}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Заметки</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Дополнительные заметки о велосипеде..."
              />
            </div>
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary-green"
              onClick={handleClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button 
              type="submit" 
              className="btn btn-primary-green"
              disabled={loading}
            >
              {loading ? 'Создание...' : 'Создать велосипед'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBikeModal;