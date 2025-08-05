import React, { useState, useEffect } from "react";
import "./Modal.css";

const CreateMaintenanceModal = ({
  isOpen,
  onClose,
  onSubmit,
  selectedBikeId = null,
}) => {
  const [formData, setFormData] = useState({
    bike_id: selectedBikeId || "",
    тип_ремонта: "текущий",
    статус_ремонта: "в ремонте",
    ремонт_запланирован_на: "",
    менеджер_id: 1,
    исполнитель_id: "",
    примечания: "",
    обкатка_выполнена: false,
  });

  const [bikes, setBikes] = useState([]);
  const [users, setUsers] = useState([]);
  const [parts, setParts] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);

  const [showBikeTable, setShowBikeTable] = useState(!selectedBikeId);
  const [showPartsTable, setShowPartsTable] = useState(false);

  const [bikeSearch, setBikeSearch] = useState({
    number: "",
    model: "",
    status: "",
  });

  const [partsSearch, setPartsSearch] = useState({
    название: "",
    category: "",
  });

  const [filteredBikes, setFilteredBikes] = useState([]);
  const [filteredParts, setFilteredParts] = useState([]);
  const [selectedBike, setSelectedBike] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchBikes();
      fetchUsers();
      fetchParts();
      if (selectedBikeId) {
        fetchSelectedBike(selectedBikeId);
      }
    }
  }, [isOpen, selectedBikeId]);

  useEffect(() => {
    // Фильтрация велосипедов
    let filtered = bikes.filter((bike) => {
      return (
        (!bikeSearch.number ||
          bike.bike_number?.toString().includes(bikeSearch.number)) &&
        (!bikeSearch.model ||
          bike.model.toLowerCase().includes(bikeSearch.model.toLowerCase())) &&
        (!bikeSearch.status || bike.status === bikeSearch.status)
      );
    });
    setFilteredBikes(filtered);
  }, [bikes, bikeSearch]);

  useEffect(() => {
    // Фильтрация запчастей
    let filtered = parts.filter((part) => {
      return (
        (!partsSearch.название ||
          part.название
            .toLowerCase()
            .includes(partsSearch.название.toLowerCase())) &&
        (!partsSearch.category ||
          JSON.stringify(part.совместимость)
            .toLowerCase()
            .includes(partsSearch.category.toLowerCase()))
      );
    });
    setFilteredParts(filtered);
  }, [parts, partsSearch]);

  const fetchBikes = async () => {
    try {
      const response = await fetch("/api/bikes");
      const data = await response.json();
      setBikes(data);
      setFilteredBikes(data);
    } catch (error) {
      console.error("Ошибка загрузки велосипедов:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Ошибка загрузки пользователей:", error);
    }
  };

  const fetchParts = async () => {
    try {
      const response = await fetch("/api/parts");
      const data = await response.json();
      setParts(data);
      setFilteredParts(data);
    } catch (error) {
      console.error("Ошибка загрузки запчастей:", error);
    }
  };

  const fetchSelectedBike = async (bikeId) => {
    try {
      const response = await fetch(`/api/bikes/${bikeId}`);
      const bike = await response.json();
      setSelectedBike(bike);
      setFormData((prev) => ({ ...prev, bike_id: bikeId }));
    } catch (error) {
      console.error("Ошибка загрузки велосипеда:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setBikeSearch((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePartsSearchChange = (e) => {
    const { name, value } = e.target;
    setPartsSearch((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleBikeSelect = (bike) => {
    setSelectedBike(bike);
    setFormData((prev) => ({ ...prev, bike_id: bike.id }));
    setShowBikeTable(false);
  };

  const handlePartSelect = (part) => {
    // Проверяем, не выбрана ли уже эта запчасть
    const isAlreadySelected = selectedParts.some(
      (p) => p.деталь_id === part.id
    );
    if (isAlreadySelected) {
      alert("Эта запчасть уже добавлена");
      return;
    }

    const newPart = {
      деталь_id: part.id,
      название: part.название,
      purchase_price: part.purchase_price,
      количество_на_складе: part.количество_на_складе,
      использовано: 1,
      нужно: 0,
    };

    setSelectedParts([...selectedParts, newPart]);
  };

  const handlePartQuantityChange = (index, field, value) => {
    const updatedParts = [...selectedParts];
    updatedParts[index][field] = parseInt(value) || 0;
    setSelectedParts(updatedParts);
  };

  const handleRemovePart = (index) => {
    const updatedParts = selectedParts.filter((_, i) => i !== index);
    setSelectedParts(updatedParts);
  };

  const calculateTotalCost = () => {
    return selectedParts.reduce((total, part) => {
      return total + part.использовано * (part.purchase_price || 0);
    }, 0);
  };

  const checkStockAvailability = () => {
    const issues = [];
    selectedParts.forEach((part, index) => {
      if (part.использовано > part.количество_на_складе) {
        issues.push(
          `${part.название}: нужно ${part.использовано}, на складе ${part.количество_на_складе}`
        );
      }
    });
    return issues;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(""); // Очищаем предыдущие ошибки

    try {
      // Проверяем наличие запчастей на складе
      const stockIssues = checkStockAvailability();
      if (stockIssues.length > 0) {
        const proceed = window.confirm(
          `Недостаточно запчастей на складе:\n${stockIssues.join(
            "\n"
          )}\n\nПродолжить создание ремонта?`
        );
        if (!proceed) {
          setLoading(false);
          return;
        }
      }

      // Подготавливаем данные для отправки
      const submitData = {
        ...formData,
        дата_начала:
          formData.статус_ремонта === "запланирован"
            ? null
            : new Date().toISOString(),
      };

      const response = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка при создании события ремонта");
      }

      const createdEvent = await response.json();

      // Добавляем запчасти к событию, если они выбраны
      if (selectedParts.length > 0) {
        const partsResponse = await fetch(
          `/api/maintenance/${createdEvent.id}/parts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ parts: selectedParts }),
          }
        );

        if (!partsResponse.ok) {
          console.error("Ошибка при добавлении запчастей");
          // Не прерываем процесс, так как событие уже создано
        }
      }

      // Обновляем родительский компонент
      if (onSubmit) {
        onSubmit(createdEvent);
      }

      // Сбрасываем форму
      resetForm();
      onClose();
    } catch (error) {
      console.error("Ошибка создания ремонта:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      bike_id: "",
      тип_ремонта: "текущий",
      статус_ремонта: "в ремонте",
      ремонт_запланирован_на: "",
      менеджер_id: 1,
      исполнитель_id: "",
      примечания: "",
      обкатка_выполнена: false,
    });
    setSelectedBike(null);
    setSelectedParts([]);
    setShowBikeTable(true);
    setShowPartsTable(false);
    setError("");
  };

  const bikeStatuses = [
    "в наличии",
    "в прокате",
    "в ремонте",
    "бронь",
    "продан",
    "украден",
    "невозврат",
  ];

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создать событие обслуживания</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Выбор велосипеда */}
          <div className="form-section">
            <h3>Велосипед</h3>
            {showBikeTable ? (
              <div className="bike-selection">
                <div className="search-filters">
                  <input
                    type="text"
                    name="number"
                    placeholder="Номер"
                    value={bikeSearch.number}
                    onChange={handleSearchChange}
                    className="search-input"
                  />
                  <input
                    type="text"
                    name="model"
                    placeholder="Модель"
                    value={bikeSearch.model}
                    onChange={handleSearchChange}
                    className="search-input"
                  />
                  <select
                    name="status"
                    value={bikeSearch.status}
                    onChange={handleSearchChange}
                    className="search-select"
                  >
                    <option value="">Все статусы</option>
                    {bikeStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bikes-table-container">
                  <table className="bikes-table">
                    <thead>
                      <tr>
                        <th>№</th>
                        <th>Модель</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBikes.map((bike) => (
                        <tr
                          key={bike.id}
                          onClick={() => handleBikeSelect(bike)}
                          className="bike-row"
                        >
                          <td>{bike.bike_number || "—"}</td>
                          <td>{bike.model}</td>
                          <td>
                            <span
                              className={`status-badge status-${bike.status.replace(
                                /\s+/g,
                                "-"
                              )}`}
                            >
                              {bike.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="selected-bike">
                <div className="bike-info">
                  <span>
                    <strong>№:</strong> {selectedBike?.bike_number || "—"}
                  </span>
                  <span>
                    <strong>Модель:</strong> {selectedBike?.model}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBikeTable(true)}
                  className="btn-secondary"
                >
                  Изменить
                </button>
              </div>
            )}
          </div>

          {/* Основная информация */}
          <div className="form-section">
            <div className="form-row">
              <div className="form-group">
                <label>Тип ремонта</label>
                <select
                  name="тип_ремонта"
                  value={formData.тип_ремонта}
                  onChange={handleInputChange}
                  required
                >
                  <option value="текущий">Текущий</option>
                  <option value="еженедельный">Еженедельный</option>
                  <option value="долгосрочный">Долгосрочный</option>
                </select>
              </div>

              <div className="form-group">
                <label>Статус</label>
                <select
                  name="статус_ремонта"
                  value={formData.статус_ремонта}
                  onChange={handleInputChange}
                  required
                >
                  <option value="в ремонте">В ремонте</option>
                  <option value="ремонт выполнен">Ремонт выполнен</option>
                  <option value="запланирован">Запланирован</option>
                  <option value="ожидает деталей">Ожидает деталей</option>
                </select>
              </div>
            </div>

            {formData.статус_ремонта === "запланирован" && (
              <div className="form-group">
                <label>Дата начала</label>
                <input
                  type="date"
                  name="ремонт_запланирован_на"
                  value={formData.ремонт_запланирован_на}
                  onChange={handleInputChange}
                  required
                />
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Менеджер</label>
                <select
                  name="менеджер_id"
                  value={formData.менеджер_id}
                  onChange={handleInputChange}
                  required
                >
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Исполнитель</label>
                <select
                  name="исполнитель_id"
                  value={formData.исполнитель_id}
                  onChange={handleInputChange}
                >
                  <option value="">Не назначен</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formData.тип_ремонта === "еженедельный" && (
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="обкатка_выполнена"
                    checked={formData.обкатка_выполнена}
                    onChange={handleInputChange}
                  />
                  Обкатка выполнена
                </label>
              </div>
            )}

            <div className="form-group">
              <label>Примечания</label>
              <textarea
                name="примечания"
                value={formData.примечания}
                onChange={handleInputChange}
                rows="3"
                placeholder="Описание работ, выявленные проблемы..."
              />
            </div>
          </div>

          {/* Запчасти */}
          <div className="form-section">
            <div className="content-header">
              <h3>Необходимые запчасти</h3>
              <button
                type="button"
                onClick={() => setShowPartsTable(true)}
                className="btn-primary"
              >
                + Добавить запчасть
              </button>
            </div>

            {/* Выбранные запчасти */}
            {selectedParts.length > 0 && (
              <div className="selected-parts">
                <table className="parts-table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Цена</th>
                      <th>На складе</th>
                      <th>Использовано</th>
                      <th>Нужно</th>
                      <th>Стоимость</th>
                      <th>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedParts.map((part, index) => (
                      <tr
                        key={index}
                        className={
                          part.использовано > part.количество_на_складе
                            ? "insufficient-stock"
                            : ""
                        }
                      >
                        <td>{part.название}</td>
                        <td>{part.purchase_price?.toFixed(2) || "—"} ₴</td>
                        <td
                          className={
                            part.количество_на_складе <= 5 ? "low-stock" : ""
                          }
                        >
                          {part.количество_на_складе}
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={part.использовано}
                            onChange={(e) =>
                              handlePartQuantityChange(
                                index,
                                "использовано",
                                e.target.value
                              )
                            }
                            className="quantity-input"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            value={part.нужно}
                            onChange={(e) =>
                              handlePartQuantityChange(
                                index,
                                "нужно",
                                e.target.value
                              )
                            }
                            className="quantity-input"
                          />
                        </td>
                        <td>
                          {(
                            part.использовано * (part.purchase_price || 0)
                          ).toFixed(2)}{" "}
                          ₴
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => handleRemovePart(index)}
                            className="btn-delete btn-small"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="parts-summary">
                  <strong>
                    Общая стоимость запчастей: {calculateTotalCost().toFixed(2)}{" "}
                    ₴
                  </strong>
                </div>
              </div>
            )}

            {/* Таблица выбора запчастей */}
            {showPartsTable && (
              <div className="parts-selection">
                <div className="search-filters">
                  <input
                    type="text"
                    name="название"
                    placeholder="Поиск по названию"
                    value={partsSearch.название}
                    onChange={handlePartsSearchChange}
                    className="search-input"
                  />
                  <input
                    type="text"
                    name="category"
                    placeholder="Категория"
                    value={partsSearch.category}
                    onChange={handlePartsSearchChange}
                    className="search-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPartsTable(false)}
                    className="btn-secondary"
                  >
                    Закрыть
                  </button>
                </div>

                <div className="parts-table-container">
                  <table className="parts-table">
                    <thead>
                      <tr>
                        <th>Название</th>
                        <th>Цена</th>
                        <th>На складе</th>
                        <th>Описание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredParts.map((part) => (
                        <tr
                          key={part.id}
                          onClick={() => handlePartSelect(part)}
                          className="part-row"
                        >
                          <td>{part.название}</td>
                          <td>{part.purchase_price?.toFixed(2) || "—"} ₴</td>
                          <td
                            className={
                              part.количество_на_складе <= 5 ? "low-stock" : ""
                            }
                          >
                            {part.количество_на_складе}
                          </td>
                          <td>{part.описание || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary">
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !formData.bike_id}
            >
              {loading ? "Создание..." : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMaintenanceModal;
