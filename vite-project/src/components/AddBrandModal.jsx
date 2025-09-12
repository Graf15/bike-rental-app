import React, { useState } from 'react';
import './Modal.css';

const AddBrandModal = ({ isOpen, onClose, onBrandAdded }) => {
  const [formData, setFormData] = useState({
    name: '',
    country: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Название бренда обязательно');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/brands', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          country: formData.country.trim() || null,
          description: formData.description.trim() || null
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка при создании бренда');
      }

      const newBrand = await response.json();
      
      // Очищаем форму
      setFormData({
        name: '',
        country: '',
        description: ''
      });
      
      // Вызываем callback с новым брендом
      onBrandAdded(newBrand);
      onClose();
      
    } catch (error) {
      setError(error.message || 'Ошибка при создании бренда');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setFormData({
      name: '',
      country: '',
      description: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Добавить новый бренд</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="brand-name">Название бренда *</label>
            <input
              id="brand-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Например: Trek, Giant, Specialized"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="brand-country">Страна</label>
            <input
              id="brand-country"
              type="text"
              name="country"
              value={formData.country}
              onChange={handleChange}
              placeholder="Например: США, Германия, Тайвань"
            />
          </div>

          <div className="form-group">
            <label htmlFor="brand-description">Описание</label>
            <textarea
              id="brand-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Краткое описание бренда (необязательно)"
              rows={3}
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn-primary-green" disabled={loading}>
              {loading ? 'Создание...' : 'Создать бренд'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBrandModal;