import React, { useState, useEffect } from 'react';
import { BIKE_OPTIONS } from '../constants/selectOptions';
import AddBrandModal from './AddBrandModal';
import './Modal.css';

const CreateBikeModal = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    model: '',
    internal_article: '',
    brand_id: '',
    purchase_price_usd: '',
    purchase_price_uah: '',
    supplier_exchange_rate: '', // Курс поставщика
    purchase_date: new Date().toISOString().split('T')[0], // Текущая дата по умолчанию
    model_year: '',
    wheel_size: '',
    frame_size: '',
    frame_number: '',
    gender: '',
    price_segment: '',
    supplier_article: '',
    supplier_website_link: '',
    condition_status: 'в наличии',
    notes: '',
    photos: { urls: [], main: 0 }, // Фотографии
    has_documents: false,
    document_details: {
      invoice_date: '',
      invoice_price_uah: '',
      documents: []
    }
  });

  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAddBrandModalOpen, setIsAddBrandModalOpen] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [lastChangedCurrency, setLastChangedCurrency] = useState(null);
  const [isConverting, setIsConverting] = useState(false);

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

  const handleChange = async (e) => {
    const { name, value } = e.target;
    
    // Обновляем данные формы
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Автоматический пересчет валют
    if (name === 'purchase_price_usd' || name === 'purchase_price_uah' || name === 'supplier_exchange_rate') {
      if (name !== 'supplier_exchange_rate') {
        setLastChangedCurrency(name);
      }
      
      // Если цена пустая или равна 0, очищаем другое поле
      if ((name === 'purchase_price_usd' || name === 'purchase_price_uah') && 
          (!value || value === '' || value === '0' || Number(value) === 0)) {
        if (name === 'purchase_price_usd') {
          setFormData(prev => ({
            ...prev,
            purchase_price_uah: ''
          }));
        } else if (name === 'purchase_price_uah') {
          setFormData(prev => ({
            ...prev,
            purchase_price_usd: ''
          }));
        }
      }
      // Если курс поставщика очищается, пересчитываем с курсом ПриватБанка
      else if (name === 'supplier_exchange_rate' && (!value || value.toString().trim() === '')) {
        // Сбрасываем старый курс и принудительно получаем курс ПриватБанка
        setExchangeRate(null);
        await handleCurrencyConversion(name, value);
      }
      // Если поле содержит валидное число больше 0, делаем пересчет
      else {
        await handleCurrencyConversion(name, value);
      }
    }
    
    // Если изменилась дата покупки, пересчитываем валюты
    if (name === 'purchase_date' && value && lastChangedCurrency) {
      const sourceField = lastChangedCurrency;
      const sourceValue = formData[sourceField];
      
      if (sourceValue && sourceValue > 0) {
        if (sourceField === 'purchase_price_usd') {
          const convertedUah = await convertCurrency(sourceValue, 'USD', value);
          if (convertedUah) {
            setFormData(prev => ({
              ...prev,
              purchase_price_uah: convertedUah
            }));
          }
        } else if (sourceField === 'purchase_price_uah') {
          const convertedUsd = await convertCurrency(sourceValue, 'UAH', value);
          if (convertedUsd) {
            setFormData(prev => ({
              ...prev,
              purchase_price_usd: convertedUsd
            }));
          }
        }
      }
    }
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
        purchase_date: formData.purchase_date || null,
        exchange_rate_data: exchangeRate // Передаем данные о курсе валют для сохранения
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
        supplier_exchange_rate: '',
        purchase_date: new Date().toISOString().split('T')[0], // Текущая дата по умолчанию
        model_year: '',
        wheel_size: '',
        frame_size: '',
        frame_number: '',
        gender: '',
        price_segment: '',
        supplier_article: '',
        supplier_website_link: '',
        condition_status: 'в наличии',
        notes: '',
        photos: { urls: [], main: 0 }, // Сбрасываем фотографии
        has_documents: false,
        document_details: {
          invoice_date: '',
          invoice_price_uah: '',
          documents: []
        }
      });
      setExchangeRate(null);
      setLastChangedCurrency(null);
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

  const handleBrandAdded = (newBrand) => {
    // Добавляем новый бренд в список
    setBrands(prev => [...prev, newBrand]);
    // Автоматически выбираем новый бренд
    setFormData(prev => ({
      ...prev,
      brand_id: newBrand.id.toString()
    }));
  };

  // Функции для работы с фотографиями
  const addPhotoUrl = () => {
    setFormData(prev => ({
      ...prev,
      photos: {
        ...prev.photos,
        urls: [...prev.photos.urls, '']
      }
    }));
  };

  const updatePhotoUrl = (index, url) => {
    setFormData(prev => ({
      ...prev,
      photos: {
        ...prev.photos,
        urls: prev.photos.urls.map((existingUrl, i) => i === index ? url : existingUrl)
      }
    }));
  };

  const removePhotoUrl = (index) => {
    setFormData(prev => {
      const newUrls = prev.photos.urls.filter((_, i) => i !== index);
      return {
        ...prev,
        photos: {
          urls: newUrls,
          main: prev.photos.main >= newUrls.length ? 0 : prev.photos.main
        }
      };
    });
  };

  const setMainPhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: {
        ...prev.photos,
        main: index
      }
    }));
  };

  // Функции для работы с документами
  const toggleDocuments = (checked) => {
    setFormData(prev => ({
      ...prev,
      has_documents: checked,
      document_details: checked ? prev.document_details : {
        invoice_date: '',
        invoice_price_uah: '',
        documents: []
      }
    }));
  };

  const updateDocumentDetails = (field, value) => {
    setFormData(prev => ({
      ...prev,
      document_details: {
        ...prev.document_details,
        [field]: value
      }
    }));
  };

  const addDocument = () => {
    setFormData(prev => ({
      ...prev,
      document_details: {
        ...prev.document_details,
        documents: [...prev.document_details.documents, {
          type: 'invoice',
          url: '',
          description: ''
        }]
      }
    }));
  };

  const updateDocument = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      document_details: {
        ...prev.document_details,
        documents: prev.document_details.documents.map((doc, i) => 
          i === index ? { ...doc, [field]: value } : doc
        )
      }
    }));
  };

  const removeDocument = (index) => {
    setFormData(prev => ({
      ...prev,
      document_details: {
        ...prev.document_details,
        documents: prev.document_details.documents.filter((_, i) => i !== index)
      }
    }));
  };

  // Функция для получения курса валют
  const getExchangeRate = async (date) => {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const response = await fetch(`/api/currency/rate?date=${targetDate}`);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      throw new Error('Failed to get exchange rate');
    } catch (error) {
      console.error('Error getting exchange rate:', error);
      return null;
    }
  };

  // Функция для обработки конвертации валют
  const handleCurrencyConversion = async (changedField, changedValue) => {
    // Определяем какой курс использовать: поставщика или ПриватБанка
    let exchangeRateToUse;
    
    // Проверяем курс поставщика по текущему значению поля, а не по formData
    const currentSupplierRate = changedField === 'supplier_exchange_rate' ? changedValue : formData.supplier_exchange_rate;
    
    // Строгая проверка: поле должно быть не пустым и содержать валидное число > 0
    if (currentSupplierRate && currentSupplierRate.toString().trim() !== '' && !isNaN(currentSupplierRate) && Number(currentSupplierRate) > 0) {
      // Используем курс поставщика
      exchangeRateToUse = {
        usd_to_uah: Number(currentSupplierRate),
        source: 'supplier',
        date: formData.purchase_date || new Date().toISOString().split('T')[0]
      };
    } else {
      // Получаем курс ПриватБанка
      const targetDate = formData.purchase_date || new Date().toISOString().split('T')[0];
      exchangeRateToUse = await getExchangeRate(targetDate);
      if (!exchangeRateToUse) return;
    }

    setExchangeRate(exchangeRateToUse);
    
    // Выполняем конвертацию
    if (changedField === 'purchase_price_usd' && changedValue && Number(changedValue) > 0 && lastChangedCurrency !== 'purchase_price_uah') {
      const convertedUah = (Number(changedValue) * exchangeRateToUse.usd_to_uah).toFixed(2);
      setFormData(prev => ({
        ...prev,
        purchase_price_uah: convertedUah
      }));
    } else if (changedField === 'purchase_price_uah' && changedValue && Number(changedValue) > 0 && lastChangedCurrency !== 'purchase_price_usd') {
      const convertedUsd = (Number(changedValue) / exchangeRateToUse.usd_to_uah).toFixed(2);
      setFormData(prev => ({
        ...prev,
        purchase_price_usd: convertedUsd
      }));
    } else if (changedField === 'supplier_exchange_rate') {
      // Если курс поставщика изменился
      if (changedValue && Number(changedValue) > 0) {
        // Пересчитываем на основе последнего измененного поля цены
        if (lastChangedCurrency === 'purchase_price_usd' && formData.purchase_price_usd && Number(formData.purchase_price_usd) > 0) {
          const convertedUah = (Number(formData.purchase_price_usd) * Number(changedValue)).toFixed(2);
          setFormData(prev => ({
            ...prev,
            purchase_price_uah: convertedUah
          }));
        } else if (lastChangedCurrency === 'purchase_price_uah' && formData.purchase_price_uah && Number(formData.purchase_price_uah) > 0) {
          const convertedUsd = (Number(formData.purchase_price_uah) / Number(changedValue)).toFixed(2);
          setFormData(prev => ({
            ...prev,
            purchase_price_usd: convertedUsd
          }));
        }
      } else {
        // Курс поставщика очищен - пересчитываем с курсом ПриватБанка
        if (lastChangedCurrency === 'purchase_price_usd' && formData.purchase_price_usd && Number(formData.purchase_price_usd) > 0) {
          const convertedUah = (Number(formData.purchase_price_usd) * exchangeRateToUse.usd_to_uah).toFixed(2);
          setFormData(prev => ({
            ...prev,
            purchase_price_uah: convertedUah
          }));
        } else if (lastChangedCurrency === 'purchase_price_uah' && formData.purchase_price_uah && Number(formData.purchase_price_uah) > 0) {
          const convertedUsd = (Number(formData.purchase_price_uah) / exchangeRateToUse.usd_to_uah).toFixed(2);
          setFormData(prev => ({
            ...prev,
            purchase_price_usd: convertedUsd
          }));
        }
      }
    }
  };

  // Функция для пересчета валют (оставляем для совместимости)
  const convertCurrency = async (amount, fromCurrency, targetDate) => {
    if (!amount || isNaN(amount) || amount <= 0) return '';
    
    setIsConverting(true);
    try {
      const rateData = await getExchangeRate(targetDate);
      if (!rateData) return '';

      setExchangeRate(rateData);
      
      let result;
      if (fromCurrency === 'USD') {
        result = amount * rateData.usd_to_uah;
      } else if (fromCurrency === 'UAH') {
        result = amount / rateData.usd_to_uah;
      }
      
      return result ? result.toFixed(2) : '';
    } catch (error) {
      console.error('Error converting currency:', error);
      return '';
    } finally {
      setIsConverting(false);
    }
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

        <div className="modal-body">
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
                <div className="input-with-button">
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
                  <button
                    type="button"
                    className="btn-add-option"
                    onClick={() => setIsAddBrandModalOpen(true)}
                    title="Добавить новый бренд"
                  >
                    +
                  </button>
                </div>
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
                      {size}
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
                <label>Курс поставщика</label>
                <input
                  type="number"
                  name="supplier_exchange_rate"
                  value={formData.supplier_exchange_rate}
                  onChange={handleChange}
                  step="0.0001"
                  min="0"
                  placeholder={exchangeRate ? exchangeRate.usd_to_uah : "41.50"}
                />
                <div className="exchange-rate-info">
                  {exchangeRate && (
                    <>
                      {exchangeRate.source === 'supplier' ? 
                        `Используется: ${exchangeRate.usd_to_uah} UAH (поставщик)` :
                        `ПриватБанк: ${exchangeRate.usd_to_uah} UAH`
                      }
                      {isConverting && <span className="converting-indicator"> ⏳</span>}
                    </>
                  )}
                </div>
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

            {/* Блок документов */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.has_documents}
                  onChange={(e) => toggleDocuments(e.target.checked)}
                />
                Есть документы (накладные, чеки)
              </label>
            </div>

            {formData.has_documents && (
              <div className="documents-section">
                <div className="form-row">
                  <div className="form-group">
                    <label>Дата накладной</label>
                    <input
                      type="date"
                      value={formData.document_details.invoice_date}
                      onChange={(e) => updateDocumentDetails('invoice_date', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Цена по накладной (UAH)</label>
                    <input
                      type="number"
                      value={formData.document_details.invoice_price_uah}
                      onChange={(e) => updateDocumentDetails('invoice_price_uah', e.target.value)}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="documents-list">
                  <h4>Документы</h4>
                  {formData.document_details.documents.map((doc, index) => (
                    <div key={index} className="document-input-group">
                      <div className="form-row">
                        <div className="form-group">
                          <label>Тип документа</label>
                          <select
                            value={doc.type}
                            onChange={(e) => updateDocument(index, 'type', e.target.value)}
                          >
                            <option value="invoice">Накладная</option>
                            <option value="receipt">Чек</option>
                            <option value="contract">Договор</option>
                            <option value="other">Другое</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Описание</label>
                          <input
                            type="text"
                            value={doc.description}
                            onChange={(e) => updateDocument(index, 'description', e.target.value)}
                            placeholder="Описание документа"
                          />
                        </div>
                      </div>
                      <div className="input-with-button">
                        <input
                          type="url"
                          value={doc.url}
                          onChange={(e) => updateDocument(index, 'url', e.target.value)}
                          placeholder="https://example.com/document.jpg"
                        />
                        <button
                          type="button"
                          className="btn-remove-option"
                          onClick={() => removeDocument(index)}
                          title="Удалить документ"
                        >
                          ✕
                        </button>
                      </div>
                      {doc.url && (
                        <div className="document-preview">
                          <img
                            src={doc.url}
                            alt={`Документ ${index + 1}`}
                            onError={(e) => e.target.style.display = 'none'}
                            onLoad={(e) => e.target.style.display = 'block'}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    className="btn btn-secondary-green"
                    onClick={addDocument}
                  >
                    + Добавить документ
                  </button>
                </div>
              </div>
            )}
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

          <div className="form-section">
            <h3>Фотографии</h3>
            <div className="photos-section">
              {formData.photos.urls.map((url, index) => (
                <div key={index} className="photo-input-group">
                  <div className="input-with-button">
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => updatePhotoUrl(index, e.target.value)}
                      placeholder="https://example.com/photo.jpg"
                    />
                    <button
                      type="button"
                      className="btn-remove-option"
                      onClick={() => removePhotoUrl(index)}
                      title="Удалить фото"
                    >
                      ✕
                    </button>
                  </div>
                  {url && (
                    <div className="photo-preview">
                      <img
                        src={url}
                        alt={`Фото ${index + 1}`}
                        onError={(e) => e.target.style.display = 'none'}
                        onLoad={(e) => e.target.style.display = 'block'}
                      />
                      <div className="photo-controls">
                        <label>
                          <input
                            type="radio"
                            name="main_photo"
                            checked={formData.photos.main === index}
                            onChange={() => setMainPhoto(index)}
                          />
                          Основное фото
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <button
                type="button"
                className="btn btn-secondary-green"
                onClick={addPhotoUrl}
              >
                + Добавить фото
              </button>
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
      
      {/* Модальное окно для добавления нового бренда */}
      <AddBrandModal
        isOpen={isAddBrandModalOpen}
        onClose={() => setIsAddBrandModalOpen(false)}
        onBrandAdded={handleBrandAdded}
      />
    </div>
  );
};

export default CreateBikeModal;