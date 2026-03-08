import { apiFetch } from "../utils/api";
import React, { useState, useEffect, useRef } from 'react';
import { BIKE_OPTIONS } from '../constants/selectOptions';
import MultiSelectPopover from './MultiSelectPopover';
import DateTimePickerField from './DateTimePickerField';
import CheckboxField from './CheckboxField';
import AddBrandModal from './AddBrandModal';
import './Modal.css';
import { toast } from '../utils/toast';

const INITIAL_FORM = {
  model: '',
  internal_article: '',
  brand_id: '',
  purchase_price_usd: '',
  purchase_price_uah: '',
  supplier_exchange_rate: '',
  purchase_date: new Date().toISOString().split('T')[0],
  model_year: '',
  wheel_size: '',
  frame_size: '',
  frame_number: '',
  gender: '',
  tariff_id: '',
  supplier_article: '',
  supplier_website_link: '',
  condition_status: 'в наличии',
  notes: '',
  photos: { urls: [], main: 0 },
  has_documents: false,
  document_details: { invoice_date: '', invoice_price_uah: '', documents: [] },
};

const BikeModal = ({ isOpen, onClose, onSubmit, mode = 'create', bikeData = null }) => {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [brands, setBrands] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [lastChangedCurrency, setLastChangedCurrency] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isAddBrandModalOpen, setIsAddBrandModalOpen] = useState(false);
  const [openField, setOpenField] = useState(null);

  const anchorRefs = useRef({});
  const mouseDownOnOverlay = useRef(false);

  const selectOptions = BIKE_OPTIONS;

  useEffect(() => {
    if (isOpen) {
      fetchBrands();
      fetchTariffs();
    }
  }, [isOpen]);

  useEffect(() => {
    if ((mode === 'edit' || (mode === 'create' && bikeData)) && bikeData && isOpen) {
      setFormData({
        model: bikeData.model || '',
        internal_article: bikeData.internal_article || '',
        brand_id: bikeData.brand_id?.toString() || '',
        purchase_price_usd: bikeData.purchase_price_usd || '',
        purchase_price_uah: bikeData.purchase_price_uah || '',
        supplier_exchange_rate: '',
        purchase_date: bikeData.purchase_date
          ? new Date(bikeData.purchase_date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        model_year: bikeData.model_year || '',
        wheel_size: bikeData.wheel_size || '',
        frame_size: bikeData.frame_size || '',
        frame_number: bikeData.frame_number || '',
        gender: bikeData.gender || '',
        tariff_id: bikeData.tariff_id?.toString() || '',
        supplier_article: bikeData.supplier_article || '',
        supplier_website_link: bikeData.supplier_website_link || '',
        condition_status: bikeData.condition_status || 'в наличии',
        notes: bikeData.notes || '',
        photos: bikeData.photos || { urls: [], main: 0 },
        has_documents: bikeData.has_documents || false,
        document_details: bikeData.document_details ? {
          ...bikeData.document_details,
          invoice_date: bikeData.document_details.invoice_date
            ? new Date(bikeData.document_details.invoice_date).toISOString().split('T')[0]
            : '',
          documents: bikeData.document_details.documents || [],
        } : { invoice_date: '', invoice_price_uah: '', documents: [] },
      });
    }
  }, [mode, bikeData, isOpen]);

  const fetchBrands = async () => {
    try {
      const response = await apiFetch('/api/brands');
      if (response.ok) setBrands(await response.json());
    } catch (e) { console.error('Ошибка загрузки брендов:', e); }
  };

  const fetchTariffs = async () => {
    try {
      const response = await apiFetch('/api/tariffs');
      if (response.ok) {
        const data = await response.json();
        setTariffs(data.filter(t => t.is_active));
      }
    } catch (e) { console.error('Ошибка загрузки тарифов:', e); }
  };

  const handleChange = async (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'purchase_price_usd' || name === 'purchase_price_uah' || name === 'supplier_exchange_rate') {
      if (name !== 'supplier_exchange_rate') setLastChangedCurrency(name);

      if ((name === 'purchase_price_usd' || name === 'purchase_price_uah') &&
          (!value || value === '' || value === '0' || Number(value) === 0)) {
        setFormData(prev => ({
          ...prev,
          [name === 'purchase_price_usd' ? 'purchase_price_uah' : 'purchase_price_usd']: '',
        }));
      } else if (name === 'supplier_exchange_rate' && (!value || value.toString().trim() === '')) {
        setExchangeRate(null);
        await handleCurrencyConversion(name, value);
      } else {
        await handleCurrencyConversion(name, value);
      }
    }

    if (name === 'purchase_date' && value && lastChangedCurrency) {
      const sourceField = lastChangedCurrency;
      const sourceValue = formData[sourceField];
      if (sourceValue && sourceValue > 0) {
        if (sourceField === 'purchase_price_usd') {
          const convertedUah = await convertCurrency(sourceValue, 'USD', value);
          if (convertedUah) setFormData(prev => ({ ...prev, purchase_price_uah: convertedUah }));
        } else if (sourceField === 'purchase_price_uah') {
          const convertedUsd = await convertCurrency(sourceValue, 'UAH', value);
          if (convertedUsd) setFormData(prev => ({ ...prev, purchase_price_usd: convertedUsd }));
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const submitData = {
        ...formData,
        brand_id: formData.brand_id || null,
        purchase_price_usd: formData.purchase_price_usd ? Number(formData.purchase_price_usd) : null,
        purchase_price_uah: formData.purchase_price_uah ? Number(formData.purchase_price_uah) : null,
        model_year: formData.model_year ? Number(formData.model_year) : null,
        purchase_date: formData.purchase_date || null,
        exchange_rate_data: exchangeRate,
      };
      await onSubmit(submitData);
      onClose();
      setFormData(INITIAL_FORM);
      setExchangeRate(null);
      setLastChangedCurrency(null);
    } catch (error) {
      const msg = error.message || (mode === 'edit' ? 'Ошибка при обновлении велосипеда' : 'Ошибка при создании велосипеда');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => onClose();

  const handleBrandAdded = (newBrand) => {
    setBrands(prev => [...prev, newBrand]);
    setFormData(prev => ({ ...prev, brand_id: newBrand.id.toString() }));
  };

  // ─── Фотографии ──────────────────────────────────────────────────────────
  const addPhotoUrl = () => setFormData(prev => ({
    ...prev,
    photos: { ...(prev.photos || { urls: [], main: 0 }), urls: [...(prev.photos?.urls || []), ''] },
  }));

  const updatePhotoUrl = (index, url) => setFormData(prev => ({
    ...prev,
    photos: { ...(prev.photos || { urls: [], main: 0 }), urls: (prev.photos?.urls || []).map((u, i) => i === index ? url : u) },
  }));

  const removePhotoUrl = (index) => setFormData(prev => {
    const newUrls = (prev.photos?.urls || []).filter((_, i) => i !== index);
    const currentMain = prev.photos?.main || 0;
    return { ...prev, photos: { urls: newUrls, main: currentMain >= newUrls.length ? 0 : currentMain } };
  });

  const setMainPhoto = (index) => setFormData(prev => ({
    ...prev, photos: { ...(prev.photos || { urls: [], main: 0 }), main: index },
  }));

  // ─── Документы ───────────────────────────────────────────────────────────
  const toggleDocuments = (checked) => setFormData(prev => ({
    ...prev,
    has_documents: checked,
    document_details: checked ? prev.document_details : { invoice_date: '', invoice_price_uah: '', documents: [] },
  }));

  const updateDocumentDetails = (field, value) => setFormData(prev => ({
    ...prev, document_details: { ...prev.document_details, [field]: value },
  }));

  const addDocument = () => setFormData(prev => ({
    ...prev,
    document_details: {
      ...prev.document_details,
      documents: [...(prev.document_details?.documents || []), { type: 'invoice', url: '', description: '' }],
    },
  }));

  const updateDocument = (index, field, value) => setFormData(prev => ({
    ...prev,
    document_details: {
      ...prev.document_details,
      documents: (prev.document_details?.documents || []).map((doc, i) => i === index ? { ...doc, [field]: value } : doc),
    },
  }));

  const removeDocument = (index) => setFormData(prev => ({
    ...prev,
    document_details: {
      ...prev.document_details,
      documents: (prev.document_details?.documents || []).filter((_, i) => i !== index),
    },
  }));

  // ─── Валюты ───────────────────────────────────────────────────────────────
  const getExchangeRate = async (date) => {
    try {
      const response = await apiFetch(`/api/currency/rate?date=${date || new Date().toISOString().split('T')[0]}`);
      if (response.ok) return await response.json();
      throw new Error('Failed to get exchange rate');
    } catch (e) { console.error('Error getting exchange rate:', e); return null; }
  };

  const handleCurrencyConversion = async (changedField, changedValue) => {
    const currentSupplierRate = changedField === 'supplier_exchange_rate' ? changedValue : formData.supplier_exchange_rate;
    let exchangeRateToUse;

    if (currentSupplierRate && currentSupplierRate.toString().trim() !== '' && !isNaN(currentSupplierRate) && Number(currentSupplierRate) > 0) {
      exchangeRateToUse = { usd_to_uah: Number(currentSupplierRate), source: 'supplier', date: formData.purchase_date || new Date().toISOString().split('T')[0] };
    } else {
      exchangeRateToUse = await getExchangeRate(formData.purchase_date);
      if (!exchangeRateToUse) return;
    }

    setExchangeRate(exchangeRateToUse);

    if (changedField === 'purchase_price_usd' && changedValue && Number(changedValue) > 0 && lastChangedCurrency !== 'purchase_price_uah') {
      setFormData(prev => ({ ...prev, purchase_price_uah: (Number(changedValue) * exchangeRateToUse.usd_to_uah).toFixed(2) }));
    } else if (changedField === 'purchase_price_uah' && changedValue && Number(changedValue) > 0 && lastChangedCurrency !== 'purchase_price_usd') {
      setFormData(prev => ({ ...prev, purchase_price_usd: (Number(changedValue) / exchangeRateToUse.usd_to_uah).toFixed(2) }));
    } else if (changedField === 'supplier_exchange_rate') {
      if (changedValue && Number(changedValue) > 0) {
        if (lastChangedCurrency === 'purchase_price_usd' && formData.purchase_price_usd && Number(formData.purchase_price_usd) > 0)
          setFormData(prev => ({ ...prev, purchase_price_uah: (Number(formData.purchase_price_usd) * Number(changedValue)).toFixed(2) }));
        else if (lastChangedCurrency === 'purchase_price_uah' && formData.purchase_price_uah && Number(formData.purchase_price_uah) > 0)
          setFormData(prev => ({ ...prev, purchase_price_usd: (Number(formData.purchase_price_uah) / Number(changedValue)).toFixed(2) }));
      } else {
        if (lastChangedCurrency === 'purchase_price_usd' && formData.purchase_price_usd && Number(formData.purchase_price_usd) > 0)
          setFormData(prev => ({ ...prev, purchase_price_uah: (Number(formData.purchase_price_usd) * exchangeRateToUse.usd_to_uah).toFixed(2) }));
        else if (lastChangedCurrency === 'purchase_price_uah' && formData.purchase_price_uah && Number(formData.purchase_price_uah) > 0)
          setFormData(prev => ({ ...prev, purchase_price_usd: (Number(formData.purchase_price_uah) / exchangeRateToUse.usd_to_uah).toFixed(2) }));
      }
    }
  };

  const convertCurrency = async (amount, fromCurrency, targetDate) => {
    if (!amount || isNaN(amount) || amount <= 0) return '';
    setIsConverting(true);
    try {
      const rateData = await getExchangeRate(targetDate);
      if (!rateData) return '';
      setExchangeRate(rateData);
      const result = fromCurrency === 'USD' ? amount * rateData.usd_to_uah : amount / rateData.usd_to_uah;
      return result ? result.toFixed(2) : '';
    } catch (e) { console.error('Error converting currency:', e); return ''; }
    finally { setIsConverting(false); }
  };

  if (!isOpen) return null;

  // ─── Хелперы для поповеров ────────────────────────────────────────────────
  const triggerBtn = (field, label) => (
    <button
      type="button"
      className="filter-select-box"
      style={{ width: "100%" }}
      ref={el => { anchorRefs.current[field] = el; }}
      onClick={() => setOpenField(openField === field ? null : field)}
    >
      {label}
      <span className="arrow">▼</span>
    </button>
  );

  const brandLabel = brands.find(b => String(b.id) === formData.brand_id)?.name || "Выберите бренд";
  const tariffLabel = tariffs.find(t => String(t.id) === formData.tariff_id)?.name || "Выберите тариф";

  return (
    <>
      <div
        className="modal-overlay"
        onMouseDown={e => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
        onMouseUp={e => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) handleClose(); }}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h2>{mode === 'edit' ? 'Редактировать велосипед' : 'Добавить велосипед'}</h2>
            <button className="modal-close" onClick={handleClose}>✕</button>
          </div>

          <div className="modal-body">
            <form onSubmit={handleSubmit} className="modal-form">

              {/* ── Основная информация ── */}
              <div className="form-section">
                <h3>Основная информация</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label className="required-label">Модель</label>
                    <input
                      type="text"
                      name="model"
                      className="form-input"
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
                      className="form-input"
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
                      {triggerBtn("brand_id", brandLabel)}
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
                    {triggerBtn("condition_status", formData.condition_status || "Выберите статус")}
                  </div>
                </div>
              </div>

              {/* ── Характеристики ── */}
              <div className="form-section">
                <h3>Характеристики</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Размер колес</label>
                    {triggerBtn("wheel_size", formData.wheel_size || "Выберите размер")}
                  </div>
                  <div className="form-group">
                    <label>Размер рамы</label>
                    {triggerBtn("frame_size", formData.frame_size || "Выберите размер")}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Пол</label>
                    {triggerBtn("gender", formData.gender || "Выберите")}
                  </div>
                  <div className="form-group">
                    <label>Тариф</label>
                    {triggerBtn("tariff_id", tariffLabel)}
                  </div>
                </div>

                <div className="form-group">
                  <label>Номер рамы</label>
                  <input
                    type="text"
                    name="frame_number"
                    className="form-input"
                    value={formData.frame_number}
                    onChange={handleChange}
                    placeholder="Серийный номер рамы"
                  />
                </div>
              </div>

              {/* ── Финансовая информация ── */}
              <div className="form-section">
                <h3>Финансовая информация</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Цена в USD</label>
                    <input
                      type="number"
                      name="purchase_price_usd"
                      className="form-input"
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
                      className="form-input"
                      value={formData.supplier_exchange_rate}
                      onChange={handleChange}
                      step="0.0001"
                      min="0"
                      placeholder={exchangeRate ? exchangeRate.usd_to_uah : "41.50"}
                    />
                    <div className="exchange-rate-info">
                      {exchangeRate && (
                        <>
                          {exchangeRate.source === 'supplier'
                            ? `Используется: ${exchangeRate.usd_to_uah} UAH (поставщик)`
                            : `ПриватБанк: ${exchangeRate.usd_to_uah} UAH`}
                          {isConverting && <span className="converting-indicator"> ...</span>}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Цена в UAH</label>
                    <input
                      type="number"
                      name="purchase_price_uah"
                      className="form-input"
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
                    <DateTimePickerField
                      granularity="day"
                      minDate={null}
                      value={formData.purchase_date}
                      onChange={val => handleChange({ target: { name: "purchase_date", value: val } })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Год модели</label>
                    <input
                      type="number"
                      name="model_year"
                      className="form-input"
                      value={formData.model_year}
                      onChange={handleChange}
                      min="2000"
                      max="2030"
                      placeholder="2024"
                    />
                  </div>
                </div>

                <label style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    className="checkbox-field-input"
                    checked={formData.has_documents}
                    onChange={e => toggleDocuments(e.target.checked)}
                  />
                  Есть документы (накладные, чеки)
                </label>

                {formData.has_documents && (
                  <div className="documents-section">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Дата накладной</label>
                        <DateTimePickerField
                          granularity="day"
                          minDate={null}
                          value={formData.document_details?.invoice_date || ''}
                          onChange={val => updateDocumentDetails('invoice_date', val)}
                        />
                      </div>
                      <div className="form-group">
                        <label>Цена по накладной (UAH)</label>
                        <input
                          type="number"
                          className="form-input"
                          value={formData.document_details?.invoice_price_uah || ''}
                          onChange={e => updateDocumentDetails('invoice_price_uah', e.target.value)}
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="documents-list">
                      <h4>Документы</h4>
                      {(formData.document_details?.documents || []).map((doc, index) => (
                        <div key={index} className="document-input-group">
                          <div className="form-row">
                            <div className="form-group">
                              <label>Тип документа</label>
                              <select
                                className="form-select"
                                value={doc.type}
                                onChange={e => updateDocument(index, 'type', e.target.value)}
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
                                className="form-input"
                                value={doc.description}
                                onChange={e => updateDocument(index, 'description', e.target.value)}
                                placeholder="Описание документа"
                              />
                            </div>
                          </div>
                          <div className="input-with-button">
                            <input
                              type="url"
                              className="form-input"
                              value={doc.url}
                              onChange={e => updateDocument(index, 'url', e.target.value)}
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
                                onError={e => e.target.style.display = 'none'}
                                onLoad={e => e.target.style.display = 'block'}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      <button type="button" className="btn btn-secondary-green" onClick={addDocument}>
                        + Добавить документ
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Дополнительная информация ── */}
              <div className="form-section">
                <h3>Дополнительная информация</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Артикул поставщика</label>
                    <input
                      type="text"
                      name="supplier_article"
                      className="form-input"
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
                      className="form-input"
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
                    className="form-input"
                    value={formData.notes}
                    onChange={handleChange}
                    rows="3"
                    placeholder="Дополнительные заметки о велосипеде..."
                  />
                </div>
              </div>

              {/* ── Фотографии ── */}
              <div className="form-section">
                <h3>Фотографии</h3>
                <div className="photos-section">
                  {(formData.photos?.urls || []).map((url, index) => (
                    <div key={index} className="photo-input-group">
                      <div className="input-with-button">
                        <input
                          type="url"
                          className="form-input"
                          value={url}
                          onChange={e => updatePhotoUrl(index, e.target.value)}
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
                            onError={e => e.target.style.display = 'none'}
                            onLoad={e => e.target.style.display = 'block'}
                          />
                          <div className="photo-controls">
                            <label>
                              <input
                                type="radio"
                                name="main_photo"
                                checked={(formData.photos?.main || 0) === index}
                                onChange={() => setMainPhoto(index)}
                              />
                              Основное фото
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary-green" onClick={addPhotoUrl}>
                    + Добавить фото
                  </button>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary-green" onClick={handleClose} disabled={loading}>
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary-green" disabled={loading}>
                  {loading
                    ? (mode === 'edit' ? 'Сохранение...' : 'Создание...')
                    : (mode === 'edit' ? 'Сохранить изменения' : 'Создать велосипед')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ── Поповеры ── */}
      {openField === "brand_id" && (
        <MultiSelectPopover
          options={brands.map(b => ({ value: String(b.id), label: b.name }))}
          selected={formData.brand_id ? [formData.brand_id] : []}
          onChange={([val]) => setFormData(prev => ({ ...prev, brand_id: val ?? "" }))}
          onClose={() => setOpenField(null)}
          anchorRef={{ current: anchorRefs.current.brand_id }}
          visible
          singleSelect
        />
      )}
      {openField === "condition_status" && (
        <MultiSelectPopover
          options={selectOptions.condition_status.map(s => ({ value: s, label: s }))}
          selected={formData.condition_status ? [formData.condition_status] : []}
          onChange={([val]) => setFormData(prev => ({ ...prev, condition_status: val ?? "" }))}
          onClose={() => setOpenField(null)}
          anchorRef={{ current: anchorRefs.current.condition_status }}
          visible
          singleSelect
        />
      )}
      {openField === "wheel_size" && (
        <MultiSelectPopover
          options={selectOptions.wheel_size.map(s => ({ value: s, label: s }))}
          selected={formData.wheel_size ? [formData.wheel_size] : []}
          onChange={([val]) => setFormData(prev => ({ ...prev, wheel_size: val ?? "" }))}
          onClose={() => setOpenField(null)}
          anchorRef={{ current: anchorRefs.current.wheel_size }}
          visible
          singleSelect
        />
      )}
      {openField === "frame_size" && (
        <MultiSelectPopover
          options={selectOptions.frame_size.map(s => ({ value: s, label: s }))}
          selected={formData.frame_size ? [formData.frame_size] : []}
          onChange={([val]) => setFormData(prev => ({ ...prev, frame_size: val ?? "" }))}
          onClose={() => setOpenField(null)}
          anchorRef={{ current: anchorRefs.current.frame_size }}
          visible
          singleSelect
        />
      )}
      {openField === "gender" && (
        <MultiSelectPopover
          options={selectOptions.gender.map(g => ({ value: g, label: g }))}
          selected={formData.gender ? [formData.gender] : []}
          onChange={([val]) => setFormData(prev => ({ ...prev, gender: val ?? "" }))}
          onClose={() => setOpenField(null)}
          anchorRef={{ current: anchorRefs.current.gender }}
          visible
          singleSelect
        />
      )}
      {openField === "tariff_id" && (
        <MultiSelectPopover
          options={tariffs.map(t => ({ value: String(t.id), label: t.name }))}
          selected={formData.tariff_id ? [formData.tariff_id] : []}
          onChange={([val]) => setFormData(prev => ({ ...prev, tariff_id: val ?? "" }))}
          onClose={() => setOpenField(null)}
          anchorRef={{ current: anchorRefs.current.tariff_id }}
          visible
          singleSelect
        />
      )}

      <AddBrandModal
        isOpen={isAddBrandModalOpen}
        onClose={() => setIsAddBrandModalOpen(false)}
        onBrandAdded={handleBrandAdded}
      />
    </>
  );
};

export default BikeModal;
