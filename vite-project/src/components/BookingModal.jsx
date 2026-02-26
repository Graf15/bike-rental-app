import React, { useState, useEffect, useRef, useCallback } from "react";
import MultiSelectPopover from "./MultiSelectPopover";
import { TARIFF_OPTIONS, WHEEL_OPTIONS, heightToFrameRec } from "../constants/bikeFilters";
import { normalizePhone, PHONE_HINT } from "../constants/phoneUtils";
import "./Modal.css";
import "./BikeTable.css";

const INITIAL_FORM = {
  customer_id: "",
  issued_by: "",
  booked_start: "",
  booked_end: "",
  deposit_type: "none",
  deposit_value: "",
  notes_issue: "",
};

const INITIAL_ITEM = {
  item_type: "bike",
  bike_id: "",
  equipment_model_id: "",
  equipment_name: "",
  tariff_id: "",
  tariff_type: "hourly",
  price: "",
  quantity: 1,
  prepaid: false,
  discount_type: "",
  discount_percent: 0,
  discount_notes: "",
};

const DISCOUNT_PRESETS = { veteran: 20, birthday: 50, group: 10, "": 0 };

const isBirthdayCustomer = (customer) => {
  if (!customer?.birth_date) return false;
  const bd = new Date(customer.birth_date), today = new Date();
  const bday = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  const diff = Math.floor((today - bday) / 86400000);
  return diff >= 0 && diff <= 7;
};

const autoApplyDiscounts = (customer, currentItems) => {
  if (!customer) return currentItems.map(i => i.discount_type === "manual" ? i : { ...i, discount_type: "", discount_percent: 0 });
  const isBirthday = isBirthdayCustomer(customer);
  const isVeteran = customer.is_veteran || false;
  const isGroup = currentItems.length >= 5;
  const firstBikeIdx = currentItems.findIndex(i => i.item_type === "bike");
  return currentItems.map((item, idx) => {
    if (item.discount_type === "manual") return item;
    let discountType = "", discountPercent = 0;
    if (isGroup) { discountType = "group"; discountPercent = 10; }
    if (item.item_type === "bike" && idx === firstBikeIdx) {
      if (isVeteran && 20 > discountPercent) { discountType = "veteran"; discountPercent = 20; }
      if (isBirthday && 50 > discountPercent) { discountType = "birthday"; discountPercent = 50; }
    }
    return { ...item, discount_type: discountType, discount_percent: discountPercent };
  });
};

const DEPOSIT_TYPES = [
  { value: "none",     label: "Без залога" },
  { value: "money",    label: "Денежный залог" },
  { value: "document", label: "Документ" },
];

const toLocalStr = (date) => {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatDt = (dateStr) => {
  if (!dateStr) return null;
  try { return new Date(dateStr).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return null; }
};

const getBikeIcon = (bike) => bike?.model?.toLowerCase().includes("самокат") ? "🛴" : "🚲";

const BookingModal = ({ onClose, onSave }) => {
  const [form, setForm]           = useState(() => ({ ...INITIAL_FORM, booked_start: toLocalStr(new Date()) }));
  const [items, setItems]         = useState([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [dateError, setDateError] = useState(null);
  const mouseDownOnOverlay        = useRef(false);

  const [customers, setCustomers]   = useState([]);
  const [users, setUsers]           = useState([]);
  const [allBikes, setAllBikes]     = useState([]); // для отображения карточек
  const [tariffs, setTariffs]       = useState([]);
  const [equipment, setEquipment]   = useState([]);
  const [bikesLoading, setBikesLoading] = useState(false);

  // Фильтры велосипедов
  const [filterTariffs, setFilterTariffs] = useState([]);
  const [filterWheels, setFilterWheels]   = useState([]);
  const [filterHeight, setFilterHeight]   = useState("");
  const [filterSearch, setFilterSearch]   = useState("");
  const [gridFocusedIdx, setGridFocusedIdx] = useState(-1);
  const [popoverKey, setPopoverKey]       = useState(null);
  const tariffFilterRef                   = useRef(null);
  const wheelFilterRef                    = useRef(null);
  const filterSearchRef                   = useRef(null);
  const bikeGridRef                       = useRef(null);
  const eqGridRef                         = useRef(null);

  // Попап количества оборудования
  const [qtyPopup, setQtyPopup] = useState(null);
  const [qtyValue, setQtyValue] = useState(1);
  const qtyInputRef             = useRef(null);

  // Поиск клиента
  const [customerSearch, setCustomerSearch]     = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown]         = useState(false);
  const [customerFocused, setCustomerFocused]   = useState(-1);
  const customerInputRef                        = useRef(null);
  const dropdownRef                             = useRef(null);
  const bookedStartRef                          = useRef(null);

  // Быстрое создание клиента
  const [quickDismissed, setQuickDismissed]   = useState(false);
  const [quickForm, setQuickForm]             = useState({ phone: "", first_name: "", last_name: "" });
  const [quickSaving, setQuickSaving]         = useState(false);
  const [quickError, setQuickError]           = useState(null);
  const [quickExisting, setQuickExisting]     = useState(null);
  const quickFirstNameRef                     = useRef(null);
  const prevShowQuickCreate                   = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers").then(r => r.json()),
      fetch("/api/users").then(r => r.json()),
      fetch("/api/tariffs").then(r => r.json()),
      fetch("/api/equipment").then(r => r.json()),
    ]).then(([c, u, t, e]) => {
      setCustomers(Array.isArray(c) ? c : []);
      setUsers(Array.isArray(u) ? u : []);
      setTariffs(Array.isArray(t) ? t.filter(x => x.is_active) : []);
      setEquipment(Array.isArray(e) ? e : []);
    }).catch(console.error);
  }, []);

  useEffect(() => { setTimeout(() => customerInputRef.current?.focus(), 50); }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Загружаем велосипеды при изменении дат
  useEffect(() => {
    if (!form.booked_start || !form.booked_end) {
      // без дат — грузим без фильтра по времени
      const url = "/api/bikes/for-rental";
      setBikesLoading(true);
      fetch(url).then(r => r.json()).then(b => setAllBikes(Array.isArray(b) ? b : [])).catch(console.error).finally(() => setBikesLoading(false));
      return;
    }
    if (dateError) return;
    setBikesLoading(true);
    const url = `/api/bikes/for-rental?start=${encodeURIComponent(form.booked_start)}&end=${encodeURIComponent(form.booked_end)}`;
    fetch(url).then(r => r.json()).then(b => setAllBikes(Array.isArray(b) ? b : [])).catch(console.error).finally(() => setBikesLoading(false));
  }, [form.booked_start, form.booked_end, dateError]);

  // ── Расчёт цены ─────────────────────────────────────────────────────────────

  const fetchPrice = useCallback(async (tariff_id, start_time, end_time) => {
    if (!tariff_id || !start_time || !end_time) return null;
    const start = new Date(start_time), end = new Date(end_time);
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    try {
      const r = await fetch("/api/calculate/price", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tariff_id, start_time, end_time }),
      });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }, []);

  const recalcAll = useCallback(async (startTime, endTime, currentItems) => {
    if (!startTime || !endTime) return;
    const start = new Date(startTime), end = new Date(endTime);
    if (isNaN(start) || isNaN(end) || end <= start) return;
    const updated = await Promise.all(
      currentItems.map(async (item) => {
        if (!item.tariff_id) return item;
        const result = await fetchPrice(item.tariff_id, startTime, endTime);
        if (!result || result.price == null) return item;
        return { ...item, price: result.price, tariff_type: result.type || item.tariff_type };
      })
    );
    setItems(updated);
  }, [fetchPrice]);

  // ── Клиент ──────────────────────────────────────────────────────────────────

  const filteredCustomers = customerSearch.length >= 2
    ? customers.filter(c =>
        `${c.last_name} ${c.first_name} ${c.middle_name || ""} ${c.phone}`
          .toLowerCase().includes(customerSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  // Форма автоматически видна когда нет результатов и пользователь не скрыл её вручную
  const showQuickCreate = customerSearch.length >= 2 && filteredCustomers.length === 0 && !selectedCustomer && !quickDismissed;

  // Предзаполняем/синхронизируем телефон пока форма открыта
  useEffect(() => {
    if (!showQuickCreate) {
      prevShowQuickCreate.current = false;
      return;
    }
    const isPhone = /^\+?[\d\s\-()+]{6,}$/.test(customerSearch.trim());
    if (!prevShowQuickCreate.current) {
      // Первое появление — сбрасываем форму
      setQuickForm({ first_name: "", last_name: "", phone: isPhone ? customerSearch.trim() : "" });
      setQuickError(null);
      setQuickExisting(null);
      prevShowQuickCreate.current = true;
    } else if (isPhone) {
      // Форма уже открыта — обновляем только телефон по мере набора
      setQuickForm(prev => ({ ...prev, phone: customerSearch.trim() }));
    }
  }, [customerSearch, showQuickCreate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Авто-сброс ошибки когда условие исправлено
  useEffect(() => {
    if (!error) return;
    if (error.includes("клиента") && form.customer_id) setError(null);
    if ((error.includes("позиц") || error.includes("велосипед")) && items.length > 0) setError(null);
    if (error.includes("начала") && form.booked_start) setError(null);
    if (error.includes("окончания") && form.booked_end) setError(null);
  }, [form.customer_id, form.booked_start, form.booked_end, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setForm(prev => ({ ...prev, customer_id: customer.id }));
    setCustomerSearch([customer.last_name, customer.first_name, customer.middle_name].filter(Boolean).join(" "));
    setShowDropdown(false); setCustomerFocused(-1);
    setItems(prev => autoApplyDiscounts(customer, prev));
    setTimeout(() => bookedStartRef.current?.focus(), 80);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setForm(prev => ({ ...prev, customer_id: "" }));
    setCustomerSearch("");
    setQuickDismissed(false);
    setItems(prev => autoApplyDiscounts(null, prev));
    setTimeout(() => customerInputRef.current?.focus(), 0);
  };

  const handleCustomerKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault(); setShowDropdown(true);
      setCustomerFocused(prev => filteredCustomers.length === 0 ? -1 : prev >= filteredCustomers.length - 1 ? 0 : prev + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); setShowDropdown(true);
      setCustomerFocused(prev => filteredCustomers.length === 0 ? -1 : prev <= 0 ? filteredCustomers.length - 1 : prev - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = customerFocused >= 0 ? filteredCustomers[customerFocused]
        : filteredCustomers.length === 1 ? filteredCustomers[0] : null;
      if (target) {
        handleCustomerSelect(target);
      } else if (customerSearch.length >= 2 && filteredCustomers.length === 0) {
        // Форма уже видна — просто фокусируем первое поле
        setShowDropdown(false);
        setTimeout(() => quickFirstNameRef.current?.focus(), 50);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false); setCustomerFocused(-1); setQuickDismissed(true);
    }
  };

  // ── Быстрое создание клиента ─────────────────────────────────────────────────

  const handleQuickCreateSave = async () => {
    setQuickError(null);
    setQuickExisting(null);
    if (!quickForm.first_name.trim()) { setQuickError("Укажите имя"); return; }
    const phone = normalizePhone(quickForm.phone);
    if (!phone) { setQuickError(`Неверный формат телефона. ${PHONE_HINT}`); return; }
    setQuickSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: quickForm.first_name.trim(),
          last_name:  quickForm.last_name.trim() || null,
          phone,
        }),
      });
      const d = await res.json();
      if (res.status === 409 && d.existing) {
        setQuickExisting(d.existing);
        setQuickError(d.error);
        return;
      }
      if (!res.ok) throw new Error(d.error || "Ошибка");
      setCustomers(prev => [d, ...prev]);
      handleCustomerSelect(d);
    } catch (err) {
      setQuickError(err.message);
    } finally {
      setQuickSaving(false);
    }
  };

  // ── Даты ────────────────────────────────────────────────────────────────────

  const applyQuickDuration = (minutes, until2100) => {
    if (!form.booked_start) return;
    let endStr;
    if (until2100) {
      const d = new Date(form.booked_start);
      d.setHours(21, 0, 0, 0);
      endStr = toLocalStr(d);
    } else {
      endStr = toLocalStr(new Date(new Date(form.booked_start).getTime() + minutes * 60000));
    }
    if (new Date(endStr) <= new Date(form.booked_start)) return;
    setForm(prev => ({ ...prev, booked_end: endStr }));
    setDateError(null);
    recalcAll(form.booked_start, endStr, items);
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    const newStart = name === "booked_start" ? value : form.booked_start;
    const newEnd   = name === "booked_end"   ? value : form.booked_end;
    setForm(prev => ({ ...prev, [name]: value }));
    if (newStart && newEnd && new Date(newEnd) <= new Date(newStart)) {
      setDateError("Время окончания должно быть позже времени начала"); return;
    }
    setDateError(null);
    recalcAll(newStart, newEnd, items);
  };

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Велосипеды — фильтры и выбор ────────────────────────────────────────────

  const heightRec = heightToFrameRec(filterHeight);

  const filteredBikes = allBikes
    .filter(b => {
      if (filterTariffs.length > 0 && !filterTariffs.includes(b.tariff_name)) return false;
      if (filterWheels.length > 0 && !filterWheels.includes(String(b.wheel_size))) return false;
      if (heightRec) {
        const ok = heightRec.perfect.includes(b.frame_size) || heightRec.acceptable.includes(b.frame_size);
        if (!ok) return false;
      }
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (!(b.internal_article || "").toLowerCase().includes(q) && !b.model.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .map(b => ({
      ...b,
      _heightMatch: heightRec
        ? (heightRec.perfect.includes(b.frame_size) ? "perfect" : "acceptable")
        : null,
    }))
    .sort((a, b) => {
      const isFree = (bike) =>
        bike.is_available !== false &&
        bike.condition_status !== "бронь" &&
        bike.condition_status !== "в ремонте";

      const getOrder = (bike) => {
        const free = isFree(bike);
        if (heightRec) {
          if (free && bike._heightMatch === "perfect")    return 0;
          if (free && bike._heightMatch === "acceptable") return 1;
          return 2;
        }
        return free ? 0 : 1;
      };

      return getOrder(a) - getOrder(b);
    });

  const addBikeFromList = async (bike) => {
    if (items.some(i => String(i.bike_id) === String(bike.id))) return;
    const newItem = { ...INITIAL_ITEM, bike_id: String(bike.id), tariff_id: bike.tariff_id ? String(bike.tariff_id) : "" };
    if (newItem.tariff_id && form.booked_start && form.booked_end && !dateError) {
      const result = await fetchPrice(newItem.tariff_id, form.booked_start, form.booked_end);
      if (result?.price != null) { newItem.price = result.price; newItem.tariff_type = result.type || newItem.tariff_type; }
    }
    setItems(prev => autoApplyDiscounts(selectedCustomer, [...prev, newItem]));
  };

  // ── Оборудование (интегрировано в filterSearch) ──────────────────────────────

  const filteredEquipment = filterSearch.length >= 2
    ? equipment.filter(eq => eq.name.toLowerCase().includes(filterSearch.toLowerCase()))
    : [];

  const handleEqSelect = (eq) => {
    if (items.some(i => String(i.equipment_model_id) === String(eq.id))) return;
    setQtyValue(1);
    setQtyPopup({ eq });
    setTimeout(() => qtyInputRef.current?.focus(), 50);
  };

  const confirmEquipmentAdd = async () => {
    if (!qtyPopup) return;
    const eq = qtyPopup.eq;
    const qty = Math.max(1, parseInt(qtyValue) || 1);
    const newItem = {
      ...INITIAL_ITEM, item_type: "equipment",
      equipment_model_id: String(eq.id),
      tariff_id: eq.rental_tariff_id ? String(eq.rental_tariff_id) : "",
      price: "", quantity: qty,
    };
    if (newItem.tariff_id && form.booked_start && form.booked_end && !dateError) {
      const result = await fetchPrice(newItem.tariff_id, form.booked_start, form.booked_end);
      if (result?.price != null) { newItem.price = result.price; newItem.tariff_type = result.type || newItem.tariff_type; }
    }
    setItems(prev => autoApplyDiscounts(selectedCustomer, [...prev, newItem]));
    setQtyPopup(null); setQtyValue(1);
    setTimeout(() => filterSearchRef.current?.focus(), 0);
  };

  const getColsFor = (idx) => {
    const ref = idx >= filteredBikes.length ? eqGridRef : bikeGridRef;
    if (!ref.current) return 1;
    return window.getComputedStyle(ref.current).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
  };

  useEffect(() => {
    if (gridFocusedIdx < 0) return;
    const bLen = filteredBikes.length;
    if (gridFocusedIdx < bLen) {
      bikeGridRef.current?.children[gridFocusedIdx]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else {
      eqGridRef.current?.children[gridFocusedIdx - bLen]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [gridFocusedIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGridKeyDown = (e) => {
    const allItems = [...filteredBikes, ...filteredEquipment];
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (allItems.length > 0) setGridFocusedIdx(prev => prev < 0 ? 0 : Math.min(prev + 1, allItems.length - 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (allItems.length > 0) setGridFocusedIdx(prev => prev < 0 ? 0 : Math.max(prev - 1, 0));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (allItems.length > 0) setGridFocusedIdx(prev => {
        if (prev < 0) return 0;
        return Math.min(prev + getColsFor(prev), allItems.length - 1);
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (allItems.length > 0) setGridFocusedIdx(prev => {
        if (prev < 0) return 0;
        return Math.max(prev - getColsFor(prev), 0);
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (gridFocusedIdx >= 0) {
        const item = allItems[gridFocusedIdx];
        if (gridFocusedIdx < filteredBikes.length) {
          const isAdded = items.some(i => String(i.bike_id) === String(item.id));
          if (isAdded) setItems(prev => autoApplyDiscounts(selectedCustomer, prev.filter(i => String(i.bike_id) !== String(item.id))));
          else addBikeFromList(item);
        } else {
          handleEqSelect(item);
        }
      } else if (filteredBikes.length === 1) {
        const b = filteredBikes[0];
        const isAdded = items.some(i => String(i.bike_id) === String(b.id));
        if (isAdded) setItems(prev => autoApplyDiscounts(selectedCustomer, prev.filter(i => String(i.bike_id) !== String(b.id))));
        else addBikeFromList(b);
      } else if (filteredEquipment.length === 1) {
        handleEqSelect(filteredEquipment[0]);
      }
    } else if (e.key === "Escape") {
      setGridFocusedIdx(-1);
    }
  };

  // ── Позиции ─────────────────────────────────────────────────────────────────

  const handleItemChange = async (index, field, value) => {
    let newItems = items.map((item, i) => i === index ? { ...item, [field]: value } : item);
    if (field === "tariff_id" && value && form.booked_start && form.booked_end && !dateError) {
      const result = await fetchPrice(value, form.booked_start, form.booked_end);
      if (result?.price != null) {
        newItems[index] = { ...newItems[index], price: result.price, tariff_type: result.type || newItems[index].tariff_type };
      }
    }
    if (field === "discount_type") {
      newItems[index] = { ...newItems[index], discount_type: value, discount_percent: value in DISCOUNT_PRESETS ? DISCOUNT_PRESETS[value] : newItems[index].discount_percent };
    }
    setItems(newItems);
  };

  const removeItem = (index) => setItems(prev => {
    const newItems = prev.filter((_, i) => i !== index);
    return autoApplyDiscounts(selectedCustomer, newItems);
  });

  const totalPrice = items.reduce((sum, i) => {
    const base = (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1);
    return sum + base * (1 - (i.discount_percent || 0) / 100);
  }, 0);
  const totalDiscount = items.reduce((sum, i) => {
    const base = (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1);
    return sum + base * (i.discount_percent || 0) / 100;
  }, 0);

  // ── Отправка ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    if (!form.customer_id)  { setError("Выберите клиента"); return; }
    if (!form.booked_start) { setError("Укажите время начала брони"); return; }
    if (!form.booked_end)   { setError("Укажите время окончания брони"); return; }
    if (dateError)          { setError(dateError); return; }
    if (items.length === 0) { setError("Добавьте хотя бы один велосипед или оборудование"); return; }

    setSaving(true);
    try {
      const body = {
        ...form,
        initial_status: "booked",
        customer_id: parseInt(form.customer_id),
        issued_by: form.issued_by ? parseInt(form.issued_by) : null,
        items: items.map(i => ({
          ...i,
          bike_id:            i.bike_id            ? parseInt(i.bike_id)            : null,
          equipment_model_id: i.equipment_model_id ? parseInt(i.equipment_model_id) : null,
          tariff_id:          i.tariff_id           ? parseInt(i.tariff_id)          : null,
          price:              i.price !== ""        ? parseFloat(i.price)            : null,
          quantity:           parseInt(i.quantity)  || 1,
          discount_type:      i.discount_type       || null,
          discount_percent:   i.discount_percent    > 0 ? i.discount_percent : null,
          discount_notes:     i.discount_notes      || null,
        })),
      };
      const response = await fetch("/api/rentals", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Ошибка"); }
      onSave(await response.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Рендер ───────────────────────────────────────────────────────────────────

  const hasDateRange = form.booked_start && form.booked_end && !dateError;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e)   => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content" style={{ maxWidth: 980 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📅 Создать бронь</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-form">

            {/* ── 1. Клиент ── */}
            <div className="form-section">
              <h3>Клиент</h3>
              {selectedCustomer ? (
                <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #10b981", borderRadius: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#065f46" }}>{[selectedCustomer.last_name, selectedCustomer.first_name, selectedCustomer.middle_name].filter(Boolean).join(" ")}</span>
                  <span style={{ color: "#047857" }}>{selectedCustomer.phone}</span>
                  {selectedCustomer.is_veteran && <span style={{ color: "var(--color-primary-blue)", fontSize: 13, fontWeight: 500 }}>🎖 УБД — скидка −20%</span>}
                  {selectedCustomer.no_show_count > 0 && <span style={{ color: "var(--color-primary-orange)", fontSize: 13, fontWeight: 500 }}>⚠ Неявок: {selectedCustomer.no_show_count}</span>}
                  {selectedCustomer.status !== "active" && <span style={{ color: "var(--color-primary-red)", fontWeight: 500 }}>⛔ {selectedCustomer.status === "no_booking" ? "Запрет брони" : "Запрет выдачи"}</span>}
                  {(() => {
                    if (!selectedCustomer.birth_date) return null;
                    const bd = new Date(selectedCustomer.birth_date), today = new Date();
                    const bday = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
                    const diff = Math.floor((today - bday) / 86400000);
                    if (diff >= 0 && diff <= 7) return <span style={{ color: "#7c3aed", fontSize: 13, fontWeight: 500 }}>🎂 Именинник — скидка −50%!</span>;
                    return null;
                  })()}
                  <button type="button" onClick={clearCustomer} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16, padding: "2px 6px" }} title="Сменить клиента">✕</button>
                </div>
              ) : (
                <div ref={dropdownRef} style={{ position: "relative" }}>
                  <div className="form-group">
                    <label className="required-label">Поиск клиента</label>
                    <input ref={customerInputRef} className="form-input" value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setForm(p => ({ ...p, customer_id: "" })); setShowDropdown(true); setCustomerFocused(-1); setQuickDismissed(false); }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => { setShowDropdown(false); setCustomerFocused(-1); }, 150)}
                      onKeyDown={handleCustomerKeyDown}
                      placeholder="Введите фамилию, имя или номер телефона..." autoComplete="off" />
                  </div>
                  {showDropdown && filteredCustomers.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "white", border: "1px solid #d1d5db", borderRadius: 6, zIndex: 200, maxHeight: 240, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}>
                      {filteredCustomers.map((c, i) => (
                        <div key={c.id} onMouseDown={() => handleCustomerSelect(c)} onMouseEnter={() => setCustomerFocused(i)} onMouseLeave={() => setCustomerFocused(-1)}
                          style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", gap: 10, background: i === customerFocused ? "#f0fdf4" : "white" }}>
                          <span style={{ fontWeight: 500 }}>{[c.last_name, c.first_name, c.middle_name].filter(Boolean).join(" ")}</span>
                          <span style={{ color: "#6b7280", fontSize: 13 }}>{c.phone}</span>
                          {c.status !== "active" && (
                            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 500, color: c.status === "no_rental" ? "var(--color-primary-red)" : "var(--color-primary-orange)" }}>
                              {c.status === "no_booking" ? "⚠ Запрет брони" : "⛔ Запрет выдачи"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Форма быстрого создания клиента */}
                  {showQuickCreate && (
                    <div style={{ marginTop: 8, padding: "14px 16px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", marginBottom: 10 }}>➕ Новый клиент</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="required-label" style={{ fontSize: 12 }}>Имя</label>
                          <input ref={quickFirstNameRef} className="form-input" value={quickForm.first_name}
                            onChange={e => setQuickForm(p => ({ ...p, first_name: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreateSave(); } if (e.key === "Escape") { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); } }}
                            placeholder="Имя" autoComplete="off" style={{ fontSize: 13 }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 12 }}>Фамилия</label>
                          <input className="form-input" value={quickForm.last_name}
                            onChange={e => setQuickForm(p => ({ ...p, last_name: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreateSave(); } if (e.key === "Escape") { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); } }}
                            placeholder="Необязательно" autoComplete="off" style={{ fontSize: 13 }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="required-label" style={{ fontSize: 12 }}>Телефон</label>
                          <input className="form-input" value={quickForm.phone}
                            onChange={e => setQuickForm(p => ({ ...p, phone: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreateSave(); } if (e.key === "Escape") { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); } }}
                            placeholder="+38 (050) 000-00-00" autoComplete="off" style={{ fontSize: 13 }} />
                        </div>
                      </div>
                      {quickError && (
                        <div style={{ fontSize: 12, color: "var(--color-primary-red)", marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span>{quickError}</span>
                          {quickExisting && (
                            <button type="button"
                              onClick={() => { setCustomers(prev => prev.some(c => c.id === quickExisting.id) ? prev : [quickExisting, ...prev]); handleCustomerSelect(quickExisting); }}
                              style={{ fontSize: 12, padding: "2px 10px", borderRadius: 4, border: "1px solid #10b981", background: "#f0fdf4", color: "#059669", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                              Выбрать {[quickExisting.last_name, quickExisting.first_name].filter(Boolean).join(" ")}
                            </button>
                          )}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#9ca3af", marginRight: "auto" }}>Enter — создать · Esc — отмена</span>
                        <button type="button" onClick={() => { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); }}
                          style={{ padding: "5px 14px", fontSize: 12, borderRadius: 5, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}>
                          Отмена
                        </button>
                        <button type="button" onClick={handleQuickCreateSave} disabled={quickSaving || !quickForm.first_name.trim() || !quickForm.phone.trim()}
                          className="btn btn-primary-green" style={{ padding: "5px 14px", fontSize: 12 }}>
                          {quickSaving ? "Сохранение..." : "Создать и выбрать"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 2. Даты брони ── */}
            <div className="form-section">
              <h3>Даты брони <span style={{ color: "var(--color-primary-red)", fontSize: 13 }}>*</span></h3>
              <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="form-group">
                  <label className="required-label">Начало</label>
                  <input ref={bookedStartRef} className="form-input" type="datetime-local" name="booked_start" value={form.booked_start} onChange={handleDateChange} />
                </div>
                <div className="form-group">
                  <label className="required-label">Окончание</label>
                  <input className="form-input" type="datetime-local" name="booked_end" value={form.booked_end} onChange={handleDateChange}
                    style={dateError ? { borderColor: "var(--color-primary-red)" } : {}} />
                  {dateError && <span style={{ color: "var(--color-primary-red)", fontSize: 12, marginTop: 4, display: "block" }}>{dateError}</span>}
                </div>
                <div className="form-group">
                  <label>Принял заявку</label>
                  <select className="form-select" name="issued_by" value={form.issued_by} onChange={handleChange}>
                    <option value="">— Не указан —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                {[
                  { label: "1",      minutes: 60 },
                  { label: "2",      minutes: 120 },
                  { label: "3",      minutes: 180 },
                  { label: "4",      minutes: 240 },
                  { label: "День",   until2100: true },
                  { label: "Сутки",  minutes: 1440 },
                  { label: "Неделя", minutes: 10080 },
                  { label: "2 нед",  minutes: 20160 },
                ].map(({ label, minutes, until2100 }) => (
                  <button key={label} type="button" onClick={() => applyQuickDuration(minutes, until2100)} disabled={!form.booked_start}
                    style={{ padding: "3px 6px", fontSize: 12, borderRadius: 4, cursor: form.booked_start ? "pointer" : "default", border: "1px solid #d1d5db", background: form.booked_start ? "#f9fafb" : "#f3f4f6", color: form.booked_start ? "#374151" : "#9ca3af", minWidth: 52, textAlign: "center" }}
                    onMouseEnter={e => { if (form.booked_start) e.currentTarget.style.background = "#e5e7eb"; }}
                    onMouseLeave={e => { if (form.booked_start) e.currentTarget.style.background = "#f9fafb"; }}>
                    {label}
                  </button>
                ))}
              </div>
              {hasDateRange && (
                <div style={{ fontSize: 12, color: "#059669", marginTop: 6 }}>
                  ✓ Показаны велосипеды, свободные в указанный период
                </div>
              )}
            </div>

            {/* ── 3. Подбор велосипедов ── */}
            <div className="form-section">
              <h3>Велосипеды</h3>

              {/* Фильтры подбора */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div ref={tariffFilterRef}
                  onClick={() => setPopoverKey(prev => prev === "tariff" ? null : "tariff")}
                  className="filter-select-box" style={{ minWidth: 140, padding: "5px 8px" }}>
                  {filterTariffs.length > 0 ? filterTariffs.join(", ") : "Все типы"}
                  <span className="arrow">▼</span>
                </div>
                <div ref={wheelFilterRef}
                  onClick={() => setPopoverKey(prev => prev === "wheel" ? null : "wheel")}
                  className="filter-select-box" style={{ minWidth: 130, padding: "5px 8px" }}>
                  {filterWheels.length > 0 ? filterWheels.map(w => `${w}"`).join(", ") : "Все колёса"}
                  <span className="arrow">▼</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input className="form-input" type="number" placeholder="Рост см" value={filterHeight} onChange={e => setFilterHeight(e.target.value)}
                    style={{ width: 90, fontSize: 13 }} />
                  {heightRec && <span style={{ fontSize: 11, color: "#059669", whiteSpace: "nowrap" }}>→ {heightRec.label}</span>}
                </div>
                <input ref={filterSearchRef} className="form-input" placeholder="Поиск велосипедов / оборудования" value={filterSearch}
                  onChange={e => { setFilterSearch(e.target.value); setGridFocusedIdx(-1); }}
                  onKeyDown={handleGridKeyDown}
                  style={{ width: 240, fontSize: 13 }} />
                {(filterTariffs.length > 0 || filterWheels.length > 0 || filterHeight || filterSearch) && (
                  <button type="button" onClick={() => { setFilterTariffs([]); setFilterWheels([]); setFilterHeight(""); setFilterSearch(""); }}
                    style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>× сбросить</button>
                )}
              </div>

              {/* Список велосипедов */}
              {bikesLoading ? (
                <div style={{ color: "#6b7280", fontSize: 13, padding: "12px 0" }}>Загрузка...</div>
              ) : filteredBikes.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>
                  {allBikes.length === 0 ? "Нет доступных велосипедов" : "Велосипеды с такими параметрами не найдены"}
                </div>
              ) : (
                <div ref={bikeGridRef} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 380, overflowY: "auto" }}>
                  {filteredBikes.map((bike, bIdx) => {
                    const isAdded    = items.some(i => String(i.bike_id) === String(bike.id));
                    const isFocused  = bIdx === gridFocusedIdx;
                    const isAvail    = bike.is_available !== false;
                    const isBooked   = bike.condition_status === "бронь";
                    const isRepair   = bike.condition_status === "в ремонте";
                    const conflictEnd = formatDt(bike.conflict_info?.booked_end);
                    const photo      = bike.photos?.urls?.length ? bike.photos.urls[bike.photos.main ?? 0] : null;

                    let bgColor = "white", borderColor = "#e5e7eb", statusText = null, statusColor = "#6b7280";
                    if (isAdded)      { bgColor = "#f0fdf4"; borderColor = "#10b981"; statusText = "✓ добавлен"; statusColor = "#059669"; }
                    else if (!isAvail && !isBooked) { bgColor = "#fef2f2"; borderColor = "#fca5a5"; statusText = "занят"; statusColor = "#ef4444"; }
                    else if (isBooked) { bgColor = "#fffbeb"; borderColor = "#fcd34d"; statusText = conflictEnd ? `бронь до ${conflictEnd}` : "есть бронь"; statusColor = "#d97706"; }
                    else if (isRepair) { bgColor = "#f9fafb"; borderColor = "#d1d5db"; statusText = "в ремонте"; statusColor = "#9ca3af"; }

                    return (
                      <div key={bike.id}
                        onClick={() => {
                          if (isAdded) {
                            setItems(prev => autoApplyDiscounts(selectedCustomer, prev.filter(i => String(i.bike_id) !== String(bike.id))));
                          } else if (isAvail && !isRepair) {
                            addBikeFromList(bike);
                          }
                        }}
                        style={{
                          border: `2px solid ${isFocused ? "var(--color-primary-orange)" : borderColor}`,
                          borderRadius: 8, padding: "7px 9px",
                          background: bgColor, cursor: isAdded ? "pointer" : (!isAvail && !isBooked) || isRepair ? "not-allowed" : "pointer",
                          display: "flex", flexDirection: "column", gap: 4,
                          transition: "border-color 0.25s, box-shadow 0.15s",
                          opacity: (!isAvail && !isBooked) || isRepair ? 0.7 : 1,
                        }}
                        onMouseEnter={e => { if (!isFocused && (isAdded || (isAvail && !isRepair))) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
                        onMouseLeave={e => { if (!isFocused) e.currentTarget.style.boxShadow = "none"; }}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {photo
                            ? <img src={photo} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                            : <div style={{ width: 60, height: 60, background: "#e5e7eb", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{getBikeIcon(bike)}</div>
                          }
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>{bike.internal_article || "—"}</div>
                            <div style={{ fontSize: 11, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bike.model}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#6b7280" }}>
                            {[bike.wheel_size ? `${bike.wheel_size}"` : null, bike.frame_size || null].filter(Boolean).join(" · ")}
                          </span>
                          {bike.tariff_name && (
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>{bike.tariff_name}</span>
                          )}
                        </div>
                        {bike._heightMatch === "perfect"    && <div style={{ fontSize: 10, fontWeight: 600, color: "#059669" }}>🟢 идеально по росту</div>}
                        {bike._heightMatch === "acceptable" && <div style={{ fontSize: 10, fontWeight: 600, color: "#d97706" }}>🟡 допустимо по росту</div>}
                        {statusText && (
                          <div style={{ fontSize: 11, fontWeight: 500, color: statusColor }}>{statusText}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Карточки оборудования */}
              {filteredEquipment.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Оборудование ({filteredEquipment.length})
                  </div>
                  <div ref={eqGridRef} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                    {filteredEquipment.map((eq, eqIdx) => {
                      const isFocused   = (filteredBikes.length + eqIdx) === gridFocusedIdx;
                      const isDup       = items.some(i => String(i.equipment_model_id) === String(eq.id));
                      const unavailable = eq.available_quantity != null && eq.available_quantity <= 0;
                      let bgColor = "white", borderColor = "#e5e7eb", statusText = null, statusColor = "#6b7280";
                      if (isDup)           { bgColor = "#eff6ff"; borderColor = "#93c5fd"; statusText = "✓ добавлен"; statusColor = "#2563eb"; }
                      else if (unavailable){ bgColor = "#fef2f2"; borderColor = "#fca5a5"; statusText = "нет на складе"; statusColor = "#ef4444"; }
                      else if (eq.available_quantity != null) { statusText = `${eq.available_quantity} шт.`; statusColor = "#059669"; }
                      return (
                        <div key={eq.id}
                          onClick={() => !isDup && !unavailable && handleEqSelect(eq)}
                          style={{
                            border: `2px solid ${isFocused ? "var(--color-primary-orange)" : borderColor}`,
                            borderRadius: 8, padding: "7px 9px",
                            background: bgColor, cursor: (isDup || unavailable) ? "default" : "pointer",
                            display: "flex", flexDirection: "column", gap: 4,
                            transition: "border-color 0.25s, box-shadow 0.15s",
                            opacity: unavailable ? 0.6 : 1,
                          }}
                          onMouseEnter={e => { if (!isFocused && !isDup && !unavailable) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
                          onMouseLeave={e => { if (!isFocused) e.currentTarget.style.boxShadow = "none"; }}
                        >
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <div style={{ width: 60, height: 60, background: isDup ? "#dbeafe" : "#e0f2fe", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🔦</div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eq.name}</div>
                              {eq.category && <div style={{ fontSize: 11, color: "#4b5563" }}>{eq.category}</div>}
                            </div>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
                            {statusText && <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>{statusText}</span>}
                            {eq.tariff_name && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#e0f2fe", color: "#0369a1", fontWeight: 600, flexShrink: 0 }}>{eq.tariff_name}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* ── 4. Добавленные позиции ── */}
            {items.length > 0 && (
              <div className="form-section">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Позиции договора</h3>
                  {(() => {
                    const bikeCount = items.filter(i => i.item_type === "bike").length;
                    const eqCount   = items.filter(i => i.item_type === "equipment").length;
                    return (
                      <>
                        {bikeCount > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>🚲 {bikeCount}</span>}
                        {eqCount   > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>⛑️ {eqCount}</span>}
                      </>
                    );
                  })()}
                  {totalPrice > 0 && (
                    <span style={{ marginLeft: "auto", fontWeight: 700, color: "#111827", fontSize: 15 }}>
                      Итого: {Math.round(totalPrice)} ₴
                      {totalDiscount > 0 && <span style={{ fontSize: 12, color: "#d97706", marginLeft: 6, fontWeight: 500 }}>(скидка −{Math.round(totalDiscount)} ₴)</span>}
                    </span>
                  )}
                </div>
                {[...items].reverse().map((item, revIndex) => {
                  const realIndex = items.length - 1 - revIndex;
                  const bike = item.item_type === "bike" && item.bike_id ? allBikes.find(b => String(b.id) === String(item.bike_id)) : null;
                  const eq   = item.item_type === "equipment" && item.equipment_model_id ? equipment.find(e => String(e.id) === String(item.equipment_model_id)) : null;
                  const tariffName = bike?.tariff_name || eq?.tariff_name || (item.tariff_id ? tariffs.find(t => String(t.id) === String(item.tariff_id))?.name : null);
                  return (
                    <div key={realIndex} style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center", padding: "6px 10px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", width: 18, textAlign: "center", flexShrink: 0 }}>{realIndex + 1}</span>
                      {item.item_type === "bike" && bike ? (() => {
                        const photo = bike.photos?.urls?.length ? bike.photos.urls[bike.photos.main ?? 0] : null;
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                            {photo ? <img src={photo} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                              : <div style={{ width: 36, height: 36, background: "#e5e7eb", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🚲</div>}
                            <div style={{ fontSize: 12, lineHeight: 1.4, minWidth: 0, flex: 1 }}>
                              <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                                {bike.internal_article && <span style={{ fontWeight: 700 }}>{bike.internal_article}</span>}
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bike.model}</span>
                              </div>
                              <div style={{ color: "#6b7280", fontSize: 11 }}>{[bike.wheel_size ? `${bike.wheel_size}"` : null, bike.frame_size || null].filter(Boolean).join(" · ")}</div>
                            </div>
                          </div>
                        );
                      })() : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 36, height: 36, background: "#e0f2fe", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⛑️</div>
                          <div style={{ fontSize: 12, lineHeight: 1.4, minWidth: 0, flex: 1 }}>
                            <div style={{ fontWeight: 600 }}>{eq?.name || "Оборудование"}</div>
                            {eq?.category && <div style={{ color: "#6b7280", fontSize: 11 }}>{eq.category}</div>}
                          </div>
                        </div>
                      )}
                      <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 10, flexShrink: 0, background: tariffName ? "#dcfce7" : "transparent", color: "#15803d", fontWeight: 600, width: 100, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                        {tariffName || ""}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        {item.item_type === "bike" ? (
                          <span style={{ width: 36, textAlign: "center", display: "inline-block", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 4px", background: "#f9fafb", fontSize: 12, color: "#9ca3af", lineHeight: "normal" }}>1</span>
                        ) : (
                          <input className="form-input" type="number" min="1" value={item.quantity}
                            onChange={e => handleItemChange(realIndex, "quantity", parseInt(e.target.value) || 1)}
                            style={{ width: 36, fontSize: 12, padding: "8px 4px", textAlign: "center" }} />
                        )}
                        <span style={{ fontSize: 11, color: "#6b7280" }}>×</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                        <input className="form-input" type="number" min="0" value={item.price}
                          onChange={e => handleItemChange(realIndex, "price", e.target.value)}
                          placeholder="0" style={{ width: 80, fontSize: 12 }} />
                        <span style={{ fontSize: 11, color: "#6b7280" }}>₴</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0, minWidth: 160 }}>
                        <select
                          value={item.discount_type || ""}
                          onChange={e => handleItemChange(realIndex, "discount_type", e.target.value)}
                          title="Скидка"
                          style={{ fontSize: 11, padding: "5px 3px", border: "1px solid #d1d5db", borderRadius: 4, background: item.discount_percent > 0 ? "#eff6ff" : "white", color: item.discount_percent > 0 ? "var(--color-primary-blue)" : "#9ca3af", cursor: "pointer", width: 110 }}
                        >
                          <option value="">−%</option>
                          <option value="veteran">🎖 УБД −20%</option>
                          <option value="birthday">🎂 Имен. −50%</option>
                          <option value="group">👥 Группа −10%</option>
                          <option value="manual">✏ Вручную</option>
                        </select>
                        {item.discount_type === "manual" && (
                          <input type="number" min="0" max="100" value={item.discount_percent}
                            onChange={e => handleItemChange(realIndex, "discount_percent", parseFloat(e.target.value) || 0)}
                            style={{ width: 38, fontSize: 11, padding: "5px 3px", textAlign: "center", border: "1px solid #d1d5db", borderRadius: 4 }} />
                        )}
                        <span style={{ fontSize: 11, color: "var(--color-primary-blue)", fontWeight: 600, whiteSpace: "nowrap", minWidth: 44, display: "inline-block" }}>
                          {item.discount_percent > 0 && item.price !== "" ? `=${Math.round(parseFloat(item.price || 0) * (1 - item.discount_percent / 100))}₴` : ""}
                        </span>
                      </div>
                      <button type="button" onClick={() => removeItem(realIndex)}
                        style={{ padding: "4px 8px", background: "none", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", color: "#ef4444", flexShrink: 0, fontSize: 12 }} title="Удалить">✕</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── 6. Залог ── */}
            <div className="form-section">
              <h3>Залог</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Тип залога</label>
                  <select className="form-select" name="deposit_type" value={form.deposit_type} onChange={handleChange}>
                    {DEPOSIT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                {form.deposit_type !== "none" && (
                  <div className="form-group">
                    <label>{form.deposit_type === "money" ? "Сумма залога (грн)" : "Документ (серия и номер)"}</label>
                    <input className="form-input" name="deposit_value" value={form.deposit_value} onChange={handleChange} placeholder={form.deposit_type === "money" ? "500" : "АА 123456"} />
                  </div>
                )}
              </div>
            </div>

            {/* ── 7. Заметки ── */}
            <div className="form-section">
              <h3>Заметки</h3>
              <div className="form-group">
                <textarea className="form-textarea" name="notes_issue" value={form.notes_issue} onChange={handleChange} placeholder="Особые условия, пожелания клиента..." rows={2} />
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-primary-green btn-primary-small" onClick={handleSubmit} disabled={saving}>
            {saving ? "Сохранение..." : "Создать бронь"}
          </button>
        </div>

        {/* Поповеры фильтров */}
        {popoverKey && (
          <MultiSelectPopover
            options={popoverKey === "tariff" ? TARIFF_OPTIONS : WHEEL_OPTIONS.map(w => ({ value: w, label: `${w}"` }))}
            selected={popoverKey === "tariff" ? filterTariffs : filterWheels}
            onChange={popoverKey === "tariff" ? setFilterTariffs : setFilterWheels}
            visible={true}
            anchorRef={popoverKey === "tariff" ? tariffFilterRef : wheelFilterRef}
            onClose={() => setPopoverKey(null)}
          />
        )}

        {/* Попап количества оборудования */}
        {qtyPopup && (
          <div style={{ position: "absolute", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.18)", borderRadius: "inherit" }}
            onMouseDown={() => setQtyPopup(null)}>
            <div onMouseDown={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: 10, padding: "20px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.22)", minWidth: 270, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                ⛑️ {qtyPopup.eq.name}
                {qtyPopup.eq.category && <span style={{ fontWeight: 400, color: "#6b7280", fontSize: 12, marginLeft: 8 }}>{qtyPopup.eq.category}</span>}
              </div>
              {qtyPopup.eq.available_quantity != null && (
                <div style={{ fontSize: 12, color: "#6b7280" }}>Доступно: <strong style={{ color: "#111" }}>{qtyPopup.eq.available_quantity}</strong> шт.</div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "#374151" }}>Количество:</span>
                <input ref={qtyInputRef} type="number" min="1" max={qtyPopup.eq.available_quantity || 999} value={qtyValue}
                  onChange={e => setQtyValue(e.target.value)}
                  onBlur={e => { const v = parseInt(e.target.value); setQtyValue(isNaN(v) || v < 1 ? 1 : v); }}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); confirmEquipmentAdd(); }
                    if (e.key === "Escape") { e.preventDefault(); setQtyPopup(null); setTimeout(() => filterSearchRef.current?.focus(), 0); }
                  }}
                  style={{ width: 72, padding: "8px 10px", fontSize: 18, fontWeight: 600, border: "2px solid #3b82f6", borderRadius: 6, textAlign: "center", outline: "none" }} />
                <span style={{ fontSize: 13, color: "#374151" }}>шт.</span>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setQtyPopup(null); setTimeout(() => filterSearchRef.current?.focus(), 0); }}
                  style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 13 }}>Отмена</button>
                <button type="button" style={{ background: "#3b82f6", color: "white", border: "none", padding: "7px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13 }} onClick={confirmEquipmentAdd}>Добавить</button>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>↑↓ стрелки · Enter — добавить · Esc — отмена</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingModal;
