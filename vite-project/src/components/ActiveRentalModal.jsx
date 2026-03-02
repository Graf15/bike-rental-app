import React, { useState, useEffect, useRef, useCallback } from "react";
import MultiSelectPopover from "./MultiSelectPopover";
import DateTimePickerField from "./DateTimePickerField";
import CheckboxField from "./CheckboxField";
import { printContract } from "../utils/contractPrint";
import { TARIFF_OPTIONS, WHEEL_OPTIONS, heightToFrameRec } from "../constants/bikeFilters";
import { normalizePhone, PHONE_HINT } from "../constants/phoneUtils";
import "./Modal.css";
import "./BikeTable.css";

const INITIAL_FORM = {
  customer_id: "",
  issued_by: "",
  booked_start: "",
  booked_end: "",
  deposit_type: ["none"],
  deposit_amount: "",
  deposit_value: "",
  notes_issue: "",
  is_paid: false,
};

const INITIAL_ITEM = {
  item_type: "bike",
  bike_id: "",
  equipment_model_id: "",
  equipment_name: "",
  tariff_id: "",
  tariff_type: "hourly",
  price: "",
  final_price: "",
  quantity: 1,
  prepaid: false,
  discount_type: "",
  discount_percent: 0,
  discount_notes: "",
};

const DISCOUNT_PRESETS = { veteran: 20, birthday: 50, group: 10, "": 0 };

const computeFinalPrice = (price, pct) => {
  const base = parseFloat(price);
  if (isNaN(base) || base <= 0) return "";
  return Math.round(base * (1 - (pct || 0) / 100) / 10) * 10;
};

const DISCOUNT_OPTIONS = [
  { value: "", label: "Без скидки" },
  { value: "veteran", label: "УБД −20%" },
  { value: "birthday", label: "ДР −50%" },
  { value: "group", label: "Группа −10%" },
  { value: "manual", label: "Вручную" },
];
const DISCOUNT_LABEL = Object.fromEntries(DISCOUNT_OPTIONS.map(o => [o.value, o.label]));

const GENDER_OPTIONS = [
  { value: "", label: "— Не указан —" },
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
];

const isBirthdayCustomer = (customer) => {
  if (!customer?.birth_date) return false;
  const bd = new Date(customer.birth_date), today = new Date();
  const bday = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  const diff = Math.floor((today - bday) / 86400000);
  return diff >= 0 && diff <= 7;
};

const autoApplyDiscounts = (customer, currentItems) => {
  if (!customer) return currentItems.map(i => i.discount_type === "manual" ? i : { ...i, discount_type: "", discount_percent: 0, final_price: computeFinalPrice(i.price, 0) });
  const isBirthday = isBirthdayCustomer(customer);
  const isVeteran = customer.is_veteran || false;
  const isGroup = currentItems.length >= 5;
  const firstBikeIdx = currentItems.findIndex(i => i.item_type === "bike");
  return currentItems.map((item, idx) => {
    if (item.discount_type) return item;
    let discountType = "", discountPercent = 0;
    if (isGroup) { discountType = "group"; discountPercent = 10; }
    if (item.item_type === "bike" && idx === firstBikeIdx) {
      if (isVeteran && 20 > discountPercent) { discountType = "veteran"; discountPercent = 20; }
      if (isBirthday && 50 > discountPercent) { discountType = "birthday"; discountPercent = 50; }
    }
    return { ...item, discount_type: discountType, discount_percent: discountPercent, final_price: computeFinalPrice(item.price, discountPercent) };
  });
};

const capName = (s) => s.replace(/(^|[\s-])\S/g, c => c.toUpperCase());

const DEPOSIT_TYPES_OPTIONS = [
  { value: "none",     label: "Без залога" },
  { value: "money",    label: "Денежный залог" },
  { value: "document", label: "Документ" },
];

const getBikeIcon = (bike) => bike?.model?.toLowerCase().includes("самокат") ? "🛴" : "🚲";

const QUICK_DURATIONS = [
  { label: "1",      minutes: 60 },
  { label: "2",      minutes: 120 },
  { label: "3",      minutes: 180 },
  { label: "4",      minutes: 240 },
  { label: "День",   until2100: true },
  { label: "Сутки",  minutes: 1440 },
  { label: "Неделя", minutes: 10080 },
  { label: "2 нед",  minutes: 20160 },
];

const toLocalStr = (date) => {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const formatConflictTime = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return null; }
};

const getDefault2100 = () => {
  const d = new Date();
  d.setHours(21, 0, 0, 0);
  return toLocalStr(d);
};

const ActiveRentalModal = ({ onClose, onSave }) => {
  const [form, setForm]           = useState({ ...INITIAL_FORM, booked_start: toLocalStr(new Date()), booked_end: getDefault2100() });
  const [items, setItems]         = useState([]);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState(null);
  const [dateError, setDateError]           = useState(null);
  const [activeQuickLabel, setActiveQuickLabel] = useState(null);
  const mouseDownOnOverlay        = useRef(false);

  const [customers, setCustomers] = useState([]);
  const [users, setUsers]         = useState([]);
  const [bikes, setBikes]         = useState([]);
  const [tariffs, setTariffs]     = useState([]);
  const [equipment, setEquipment] = useState([]);

  // Фильтры велосипедов
  const [filterTariffs, setFilterTariffs] = useState([]);
  const [filterWheels, setFilterWheels]   = useState([]);
  const [filterHeight, setFilterHeight]   = useState("");
  const [popoverKey, setPopoverKey]       = useState(null);

  const [filterSearch, setFilterSearch]     = useState("");
  const [gridFocusedIdx, setGridFocusedIdx] = useState(-1);
  const tariffFilterRef                     = useRef(null);
  const wheelFilterRef                      = useRef(null);
  const filterSearchRef                     = useRef(null);
  const bikeGridRef                         = useRef(null);
  const eqGridRef                           = useRef(null);

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

  // Поповеры менеджера и залога
  const issuedByRef                   = useRef(null);
  const [issuedByPopover, setIssuedByPopover] = useState(false);
  const [discountPopoverIdx, setDiscountPopoverIdx] = useState(null);
  const discountAnchorRefs = useRef({});
  const depositTypeRef                = useRef(null);
  const [depositTypePopover, setDepositTypePopover] = useState(false);

  // Поповеры пола
  const completionGenderRef           = useRef(null);
  const [completionGenderPopover, setCompletionGenderPopover] = useState(false);
  const quickGenderRef                = useRef(null);
  const [quickGenderPopover, setQuickGenderPopover] = useState(false);

  // Быстрое создание клиента
  const [quickDismissed, setQuickDismissed]   = useState(false);
  const [quickForm, setQuickForm]             = useState({ phone: "", last_name: "", first_name: "", middle_name: "", birth_date: "", gender: "", is_veteran: false });
  const [quickSaving, setQuickSaving]         = useState(false);
  const [quickError, setQuickError]           = useState(null);
  const [quickExisting, setQuickExisting]     = useState(null);
  const quickFirstNameRef                     = useRef(null);
  const prevShowQuickCreate                   = useRef(false);

  // Дозаполнение данных клиента для договора
  const [completionForm, setCompletionForm]   = useState({ last_name: "", first_name: "", middle_name: "", birth_date: "", gender: "", is_veteran: false });
  const [completionSaving, setCompletionSaving] = useState(false);
  const [completionError, setCompletionError]   = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/customers").then(r => r.json()),
      fetch("/api/users").then(r => r.json()),
      fetch("/api/bikes/for-rental").then(r => r.json()),
      fetch("/api/tariffs").then(r => r.json()),
      fetch("/api/equipment").then(r => r.json()),
    ]).then(([c, u, b, t, e]) => {
      setCustomers(Array.isArray(c) ? c : []);
      setUsers(Array.isArray(u) ? u : []);
      setBikes(Array.isArray(b) ? b : []);
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

  // ── Расчёт цены ─────────────────────────────────────────────────────────────

  const fetchPrice = useCallback(async (tariff_id, start_time, end_time) => {
    if (!tariff_id || !start_time || !end_time) return null;
    const start = new Date(start_time), end = new Date(end_time);
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    try {
      const r = await fetch("/api/calculate/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        return { ...item, price: result.price, tariff_type: result.type || item.tariff_type, final_price: computeFinalPrice(result.price, item.discount_percent || 0) };
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

  const showQuickCreate = customerSearch.length >= 2 && filteredCustomers.length === 0 && !selectedCustomer && !quickDismissed;

  useEffect(() => {
    if (!showQuickCreate) { prevShowQuickCreate.current = false; return; }
    const isPhone = /^\+?[\d\s\-()+]{6,}$/.test(customerSearch.trim());
    if (!prevShowQuickCreate.current) {
      setQuickForm({ first_name: "", last_name: "", phone: isPhone ? customerSearch.trim() : "" });
      setQuickError(null); setQuickExisting(null);
      prevShowQuickCreate.current = true;
    } else if (isPhone) {
      setQuickForm(prev => ({ ...prev, phone: customerSearch.trim() }));
    }
  }, [customerSearch, showQuickCreate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Авто-сброс ошибки когда условие исправлено
  useEffect(() => {
    if (!error) return;
    if (error.includes("клиента") && form.customer_id) setError(null);
    if ((error.includes("позиц") || error.includes("велосипед")) && items.length > 0) setError(null);
  }, [form.customer_id, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setForm(prev => ({ ...prev, customer_id: customer.id }));
    setCustomerSearch([customer.last_name, customer.first_name, customer.middle_name].filter(Boolean).join(" "));
    setShowDropdown(false);
    setCustomerFocused(-1);
    setItems(prev => autoApplyDiscounts(customer, prev));
    setCompletionForm({
      last_name:   customer.last_name   || "",
      first_name:  customer.first_name  || "",
      middle_name: customer.middle_name || "",
      birth_date:  customer.birth_date  ? customer.birth_date.slice(0, 10) : "",
      gender:      customer.gender      || "",
      is_veteran:  customer.is_veteran  || false,
    });
    setCompletionError(null);
    setTimeout(() => filterSearchRef.current?.focus(), 50);
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
      if (target) { handleCustomerSelect(target); }
      else if (customerSearch.length >= 2 && filteredCustomers.length === 0) {
        setShowDropdown(false);
        setTimeout(() => quickFirstNameRef.current?.focus(), 50);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false); setCustomerFocused(-1); setQuickDismissed(true);
    }
  };

  const handleQuickCreateSave = async () => {
    setQuickError(null); setQuickExisting(null);
    if (!quickForm.last_name.trim())  { setQuickError("Укажите фамилию"); return; }
    if (!quickForm.first_name.trim()) { setQuickError("Укажите имя"); return; }
    if (!quickForm.birth_date)        { setQuickError("Укажите дату рождения"); return; }
    const phone = normalizePhone(quickForm.phone);
    if (!phone) { setQuickError(`Неверный формат телефона. ${PHONE_HINT}`); return; }
    setQuickSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          last_name:   quickForm.last_name.trim(),
          first_name:  quickForm.first_name.trim(),
          middle_name: quickForm.middle_name.trim() || null,
          phone,
          birth_date:  quickForm.birth_date || null,
          gender:      quickForm.gender     || null,
          is_veteran:  quickForm.is_veteran,
        }),
      });
      const d = await res.json();
      if (res.status === 409 && d.existing) { setQuickExisting(d.existing); setQuickError(d.error); return; }
      if (!res.ok) throw new Error(d.error || "Ошибка");
      setCustomers(prev => [d, ...prev]);
      handleCustomerSelect(d);
    } catch (err) {
      setQuickError(err.message);
    } finally {
      setQuickSaving(false);
    }
  };

  // ── Проверка полноты данных клиента ─────────────────────────────────────────
  const customerNeedsCompletion = selectedCustomer && (
    !selectedCustomer.last_name || !selectedCustomer.first_name || !selectedCustomer.birth_date
  );

  const handleCustomerCompletion = async () => {
    if (!completionForm.last_name.trim()) { setCompletionError("Укажите фамилию"); return; }
    if (!completionForm.first_name.trim()) { setCompletionError("Укажите имя"); return; }
    if (!completionForm.birth_date) { setCompletionError("Укажите дату рождения"); return; }
    setCompletionSaving(true);
    setCompletionError(null);
    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          last_name:   completionForm.last_name.trim(),
          first_name:  completionForm.first_name.trim(),
          middle_name: completionForm.middle_name.trim() || null,
          birth_date:  completionForm.birth_date || null,
          gender:      completionForm.gender     || null,
          is_veteran:  completionForm.is_veteran,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      const updated = { ...selectedCustomer, ...data };
      setSelectedCustomer(updated);
      setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
      setItems(prev => autoApplyDiscounts(updated, prev));
    } catch (err) {
      setCompletionError(err.message);
    } finally {
      setCompletionSaving(false);
    }
  };

  // ── Даты ────────────────────────────────────────────────────────────────────

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    const newStart = name === "booked_start" ? value : form.booked_start;
    const newEnd   = name === "booked_end"   ? value : form.booked_end;
    setActiveQuickLabel(null);
    setForm(prev => ({ ...prev, [name]: value }));
    if (newStart && newEnd && new Date(newEnd) <= new Date(newStart)) {
      setDateError("Время окончания должно быть позже времени начала");
      return;
    }
    setDateError(null);
    recalcAll(newStart, newEnd, items);
  };

  const applyQuickDuration = (minutes, until2100) => {
    const nowStr = toLocalStr(new Date());
    let endStr;
    if (until2100) {
      const d = new Date();
      d.setHours(21, 0, 0, 0);
      endStr = toLocalStr(d);
    } else {
      endStr = toLocalStr(new Date(new Date(nowStr).getTime() + minutes * 60000));
    }
    setForm(prev => ({ ...prev, booked_start: nowStr, booked_end: endStr }));
    setDateError(null);
    recalcAll(nowStr, endStr, items);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // ── Позиции ─────────────────────────────────────────────────────────────────

  const handleItemChange = async (index, field, value) => {
    let newItems = items.map((item, i) => i === index ? { ...item, [field]: value } : item);
    if (field === "tariff_id" && value && form.booked_start && form.booked_end && !dateError) {
      const result = await fetchPrice(value, form.booked_start, form.booked_end);
      if (result?.price != null) {
        const pct = newItems[index].discount_percent || 0;
        newItems[index] = { ...newItems[index], price: result.price, tariff_type: result.type || newItems[index].tariff_type, final_price: computeFinalPrice(result.price, pct) };
      }
    }
    if (field === "discount_type") {
      const pct = value in DISCOUNT_PRESETS ? DISCOUNT_PRESETS[value] : newItems[index].discount_percent;
      newItems[index] = { ...newItems[index], discount_type: value, discount_percent: pct, final_price: computeFinalPrice(newItems[index].price, pct) };
    }
    if (field === "discount_percent") {
      newItems[index] = { ...newItems[index], final_price: computeFinalPrice(newItems[index].price, parseFloat(value) || 0) };
    }
    setItems(newItems);
  };

  const removeItem = (index) => setItems(prev => {
    const newItems = prev.filter((_, i) => i !== index);
    return autoApplyDiscounts(selectedCustomer, newItems);
  });

  // Велосипеды: показываем в наличии + бронь (с предупреждением), скрываем в прокате
  const selectableBikes = bikes.filter(b => b.condition_status !== "в прокате");

  // Фильтрованный список с учётом фильтров
  const heightRec = heightToFrameRec(filterHeight);
  const filteredEquipment = filterSearch.length >= 2
    ? equipment.filter(eq => eq.name.toLowerCase().includes(filterSearch.toLowerCase()))
    : [];

  const filteredByOptions = selectableBikes
    .filter(b => {
      if (filterTariffs.length > 0 && !filterTariffs.includes(b.tariff_name)) return false;
      if (filterWheels.length > 0 && !filterWheels.includes(String(b.wheel_size))) return false;
      if (heightRec) {
        const ok = heightRec.perfect.includes(b.frame_size) || heightRec.acceptable.includes(b.frame_size);
        if (!ok) return false;
      }
      if (filterSearch.length >= 2) {
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
      if (!heightRec) return 0;
      return (a._heightMatch === "perfect" ? 0 : 1) - (b._heightMatch === "perfect" ? 0 : 1);
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
    const ref = idx >= filteredByOptions.length ? eqGridRef : bikeGridRef;
    if (!ref.current) return 1;
    return window.getComputedStyle(ref.current).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
  };

  useEffect(() => {
    if (gridFocusedIdx < 0) return;
    const bLen = filteredByOptions.length;
    let el;
    if (gridFocusedIdx < bLen) {
      el = bikeGridRef.current?.children[gridFocusedIdx];
    } else {
      el = eqGridRef.current?.children[gridFocusedIdx - bLen];
    }
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    el?.focus();
  }, [gridFocusedIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGridKeyDown = (e) => {
    const allItems = [...filteredByOptions, ...filteredEquipment];
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
        if (gridFocusedIdx < filteredByOptions.length) {
          const isAdded = items.some(i => String(i.bike_id) === String(item.id));
          if (isAdded) setItems(prev => prev.filter(i => String(i.bike_id) !== String(item.id)));
          else addBikeFromList(item);
        } else {
          handleEqSelect(item);
        }
      } else if (filteredByOptions.length === 1) {
        const b = filteredByOptions[0];
        const isAdded = items.some(i => String(i.bike_id) === String(b.id));
        if (isAdded) setItems(prev => prev.filter(i => String(i.bike_id) !== String(b.id)));
        else addBikeFromList(b);
      } else if (filteredEquipment.length === 1) {
        handleEqSelect(filteredEquipment[0]);
      }
    } else if (e.key === "Escape") {
      setGridFocusedIdx(-1);
    }
  };

  const totalBase = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1), 0);
  const totalFinal = items.reduce((sum, i) => {
    const qty = parseInt(i.quantity) || 1;
    const fp = parseFloat(i.final_price);
    if (!isNaN(fp)) return sum + fp * qty;
    return sum + Math.round((parseFloat(i.price) || 0) * (1 - (i.discount_percent || 0) / 100) / 10) * 10 * qty;
  }, 0);
  const totalDiscount = Math.round(totalBase - totalFinal);

  // ── Отправка ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError(null);
    if (!form.customer_id)  { setError("Выберите клиента"); return; }
    if (items.length === 0) { setError("Добавьте хотя бы одну позицию"); return; }
    if (dateError)          { setError(dateError); return; }

    setSaving(true);
    try {
      const depositType = (() => {
        const dt = form.deposit_type;
        if (!Array.isArray(dt) || dt.length === 0 || dt.includes("none")) return "none";
        return dt.filter(v => v !== "none").join(",");
      })();
      const body = {
        ...form,
        deposit_type: depositType,
        deposit_amount: form.deposit_amount !== "" ? parseFloat(form.deposit_amount) : null,
        initial_status: "active",
        customer_id: parseInt(form.customer_id),
        issued_by: form.issued_by ? parseInt(form.issued_by) : null,
        items: items.map(i => ({
          ...i,
          bike_id:            i.bike_id            ? parseInt(i.bike_id)            : null,
          equipment_model_id: i.equipment_model_id ? parseInt(i.equipment_model_id) : null,
          tariff_id:          i.tariff_id           ? parseInt(i.tariff_id)          : null,
          price:              i.final_price !== "" && i.final_price != null ? parseFloat(i.final_price) : (i.price !== "" ? parseFloat(i.price) : null),
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

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e)   => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content" style={{ maxWidth: 920 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Выдать сейчас</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-form">

            {/* ── 1. Клиент ── */}
            <div className="form-section">
              {selectedCustomer && (
                <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #10b981", borderRadius: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#065f46" }}>
                    {[selectedCustomer.last_name, selectedCustomer.first_name, selectedCustomer.middle_name].filter(Boolean).join(" ")}
                  </span>
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
              )}

              {/* ── Блок дозаполнения данных клиента ── */}
              {customerNeedsCompletion && (
                <div style={{ marginTop: 10, padding: "12px 14px", background: "#fffbeb", border: "1px solid #fbbf24", borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", marginBottom: 10 }}>
                    ⚠️ Для оформления договора нужно дозаполнить данные клиента
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="required-label" style={{ fontSize: 12 }}>Фамилия</label>
                      <input className="form-input" value={completionForm.last_name}
                        onChange={e => setCompletionForm(p => ({ ...p, last_name: capName(e.target.value) }))}
                        placeholder="Фамилия" autoComplete="off" style={{ fontSize: 13 }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="required-label" style={{ fontSize: 12 }}>Имя</label>
                      <input className="form-input" value={completionForm.first_name}
                        onChange={e => setCompletionForm(p => ({ ...p, first_name: capName(e.target.value) }))}
                        placeholder="Имя" autoComplete="off" style={{ fontSize: 13 }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Отчество</label>
                      <input className="form-input" value={completionForm.middle_name}
                        onChange={e => setCompletionForm(p => ({ ...p, middle_name: capName(e.target.value) }))}
                        placeholder="Необязательно" autoComplete="off" style={{ fontSize: 13 }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="required-label" style={{ fontSize: 12 }}>Дата рождения</label>
                      <DateTimePickerField granularity="day" value={completionForm.birth_date}
                        onChange={v => setCompletionForm(p => ({ ...p, birth_date: v }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0, position: "relative" }}>
                      <label style={{ fontSize: 12 }}>Пол</label>
                      <button ref={completionGenderRef} type="button" className="filter-select-box"
                        style={{ width: "100%", justifyContent: "space-between", padding: "7px 10px", fontSize: 13 }}
                        onClick={() => setCompletionGenderPopover(p => !p)}>
                        <span>{GENDER_OPTIONS.find(o => o.value === completionForm.gender)?.label ?? "— Не указан —"}</span>
                        <span className="arrow">▼</span>
                      </button>
                      {completionGenderPopover && (
                        <MultiSelectPopover singleSelect
                          options={GENDER_OPTIONS}
                          selected={[completionForm.gender]}
                          onChange={vals => setCompletionForm(p => ({ ...p, gender: vals[0] ?? "" }))}
                          visible={true} anchorRef={completionGenderRef} onClose={() => setCompletionGenderPopover(false)} />
                      )}
                    </div>
                    <div className="checkbox-field-wrapper">
                      <CheckboxField
                        label="🎖 УБД"
                        checked={completionForm.is_veteran}
                        onChange={v => setCompletionForm(p => ({ ...p, is_veteran: v }))} />
                    </div>
                  </div>
                  {completionError && <div style={{ fontSize: 12, color: "var(--color-primary-red)", marginBottom: 8 }}>{completionError}</div>}
                  <button type="button" className="btn btn-primary-green" onClick={handleCustomerCompletion}
                    disabled={completionSaving} style={{ fontSize: 13, padding: "6px 18px" }}>
                    {completionSaving ? "Сохранение..." : "Сохранить данные клиента"}
                  </button>
                </div>
              )}

              {!selectedCustomer && (
                <div ref={dropdownRef} style={{ position: "relative" }}>
                  <div className="form-group">
                    <label className="required-label">Клиент</label>
                    <input
                      ref={customerInputRef} className="form-input" value={customerSearch}
                      onChange={e => { setCustomerSearch(e.target.value); setSelectedCustomer(null); setForm(p => ({ ...p, customer_id: "" })); setShowDropdown(true); setCustomerFocused(-1); setQuickDismissed(false); }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => { setShowDropdown(false); setCustomerFocused(-1); }, 150)}
                      onKeyDown={handleCustomerKeyDown}
                      placeholder="Введите фамилию, имя или номер телефона..." autoComplete="off"
                    />
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
                          <label className="required-label" style={{ fontSize: 12 }}>Фамилия</label>
                          <input ref={quickFirstNameRef} className="form-input" value={quickForm.last_name}
                            onChange={e => setQuickForm(p => ({ ...p, last_name: capName(e.target.value) }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreateSave(); } if (e.key === "Escape") { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); } }}
                            placeholder="Фамилия" autoComplete="off" style={{ fontSize: 13 }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="required-label" style={{ fontSize: 12 }}>Имя</label>
                          <input className="form-input" value={quickForm.first_name}
                            onChange={e => setQuickForm(p => ({ ...p, first_name: capName(e.target.value) }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreateSave(); } if (e.key === "Escape") { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); } }}
                            placeholder="Имя" autoComplete="off" style={{ fontSize: 13 }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 12 }}>Отчество</label>
                          <input className="form-input" value={quickForm.middle_name}
                            onChange={e => setQuickForm(p => ({ ...p, middle_name: capName(e.target.value) }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreateSave(); } if (e.key === "Escape") { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); } }}
                            placeholder="Необязательно" autoComplete="off" style={{ fontSize: 13 }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="required-label" style={{ fontSize: 12 }}>Телефон</label>
                          <input className="form-input" value={quickForm.phone}
                            onChange={e => setQuickForm(p => ({ ...p, phone: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreateSave(); } if (e.key === "Escape") { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); } }}
                            placeholder="0XXXXXXXXX" autoComplete="off" style={{ fontSize: 13 }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="required-label" style={{ fontSize: 12 }}>Дата рождения</label>
                          <DateTimePickerField granularity="day" value={quickForm.birth_date}
                            onChange={v => setQuickForm(p => ({ ...p, birth_date: v }))} />
                        </div>
                        <div className="form-group" style={{ margin: 0, position: "relative" }}>
                          <label style={{ fontSize: 12 }}>Пол</label>
                          <button ref={quickGenderRef} type="button" className="filter-select-box"
                            style={{ width: "100%", justifyContent: "space-between", padding: "7px 10px", fontSize: 13 }}
                            onClick={() => setQuickGenderPopover(p => !p)}>
                            <span>{GENDER_OPTIONS.find(o => o.value === quickForm.gender)?.label ?? "— Не указан —"}</span>
                            <span className="arrow">▼</span>
                          </button>
                          {quickGenderPopover && (
                            <MultiSelectPopover singleSelect
                              options={GENDER_OPTIONS}
                              selected={[quickForm.gender]}
                              onChange={vals => setQuickForm(p => ({ ...p, gender: vals[0] ?? "" }))}
                              visible={true} anchorRef={quickGenderRef} onClose={() => setQuickGenderPopover(false)} />
                          )}
                        </div>
                        <div className="checkbox-field-wrapper">
                          <CheckboxField
                            label="🎖 УБД"
                            checked={quickForm.is_veteran}
                            onChange={v => setQuickForm(p => ({ ...p, is_veteran: v }))} />
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
                          style={{ padding: "5px 14px", fontSize: 12, borderRadius: 5, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}>Отмена</button>
                        <button type="button" onClick={handleQuickCreateSave} disabled={quickSaving || !quickForm.last_name.trim() || !quickForm.first_name.trim() || !quickForm.birth_date || !quickForm.phone.trim()}
                          className="btn btn-primary-green" style={{ padding: "5px 14px", fontSize: 12 }}>
                          {quickSaving ? "Сохранение..." : "Создать и выбрать"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── 2. Позиции ── */}
            <div className="form-section">

              {/* Фильтры велосипедов */}
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
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
                  <input className="form-input" type="number" placeholder="Рост см" value={filterHeight}
                    onChange={e => setFilterHeight(e.target.value)} style={{ width: 90, fontSize: 13 }} />
                  {heightRec && <span style={{ fontSize: 11, color: "#059669", whiteSpace: "nowrap" }}>→ {heightRec.label}</span>}
                </div>
                <input ref={filterSearchRef} className="form-input" placeholder="Поиск велосипедов / оборудования" value={filterSearch}
                  onChange={e => { setFilterSearch(e.target.value); setGridFocusedIdx(-1); }}
                  onFocus={() => setGridFocusedIdx(-1)}
                  onKeyDown={handleGridKeyDown}
                  style={{ width: 240, fontSize: 13 }} />
                {(filterTariffs.length > 0 || filterWheels.length > 0 || filterHeight || filterSearch) && (
                  <button type="button" className="btn-reset-filters"
                    onClick={() => { setFilterTariffs([]); setFilterWheels([]); setFilterHeight(""); setFilterSearch(""); setGridFocusedIdx(-1); }}
                    title="Сбросить фильтры">🔄</button>
                )}
              </div>

              {/* Карточки велосипедов */}
              {filteredByOptions.length === 0 ? (
                <div style={{ color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>Нет велосипедов с такими параметрами</div>
              ) : (
                <div ref={bikeGridRef} onKeyDown={handleGridKeyDown} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 380, overflowY: "auto", marginBottom: 10 }}>
                  {filteredByOptions.map((bike, bIdx) => {
                    const isAdded   = items.some(i => String(i.bike_id) === String(bike.id));
                    const isBooked  = bike.condition_status === "бронь";
                    const isFocused = bIdx === gridFocusedIdx;
                    const photo     = bike.photos?.urls?.length ? bike.photos.urls[bike.photos.main ?? 0] : null;
                    const conflictEnd = isBooked ? formatConflictTime(bike.conflict_info?.booked_end) : null;
                    let bgColor = "white", borderColor = "#e5e7eb", statusText = null, statusColor = "#6b7280";
                    if (isAdded)       { bgColor = "#f0fdf4"; borderColor = "#10b981"; statusText = "✓ добавлен"; statusColor = "#059669"; }
                    else if (isBooked) { bgColor = "#fffbeb"; borderColor = "#fcd34d"; statusText = conflictEnd ? `бронь до ${conflictEnd}` : "есть бронь"; statusColor = "#d97706"; }
                    return (
                      <div key={bike.id}
                        tabIndex={-1}
                        className="grid-card-item"
                        onClick={() => {
                          setGridFocusedIdx(bIdx);
                          if (isAdded) setItems(prev => prev.filter(i => String(i.bike_id) !== String(bike.id)));
                          else addBikeFromList(bike);
                        }}
                        style={{
                          border: `2px solid ${isFocused ? "var(--color-focus-ring)" : borderColor}`,
                          borderRadius: 8, padding: "7px 9px", background: bgColor,
                          cursor: "pointer", display: "flex", flexDirection: "column", gap: 4,
                          transition: "border-color 0.25s, box-shadow 0.15s",
                        }}
                        onMouseEnter={e => { if (!isFocused) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
                        onMouseLeave={e => { if (!isFocused) e.currentTarget.style.boxShadow = ""; }}
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
                          {bike.tariff_name && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>{bike.tariff_name}</span>}
                        </div>
                        {bike._heightMatch === "perfect"    && <div style={{ fontSize: 10, fontWeight: 600, color: "#059669" }}>🟢 идеально по росту</div>}
                        {bike._heightMatch === "acceptable" && <div style={{ fontSize: 10, fontWeight: 600, color: "#d97706" }}>🟡 допустимо по росту</div>}
                        {statusText && <div style={{ fontSize: 11, fontWeight: 500, color: statusColor }}>{statusText}</div>}
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
                  <div ref={eqGridRef} onKeyDown={handleGridKeyDown} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                    {filteredEquipment.map((eq, eqIdx) => {
                      const isFocused   = (filteredByOptions.length + eqIdx) === gridFocusedIdx;
                      const isDup       = items.some(i => String(i.equipment_model_id) === String(eq.id));
                      const unavailable = eq.available_quantity != null && eq.available_quantity <= 0;
                      let bgColor = "white", borderColor = "#e5e7eb", statusText = null, statusColor = "#6b7280";
                      if (isDup)           { bgColor = "#eff6ff"; borderColor = "#93c5fd"; statusText = "✓ добавлен"; statusColor = "#2563eb"; }
                      else if (unavailable){ bgColor = "#fef2f2"; borderColor = "#fca5a5"; statusText = "нет на складе"; statusColor = "#ef4444"; }
                      else if (eq.available_quantity != null) { statusText = `${eq.available_quantity} шт.`; statusColor = "#059669"; }
                      return (
                        <div key={eq.id}
                          tabIndex={-1}
                          className="grid-card-item"
                          onClick={() => { setGridFocusedIdx(filteredByOptions.length + eqIdx); if (!isDup && !unavailable) handleEqSelect(eq); }}
                          style={{
                            border: `2px solid ${isFocused ? "var(--color-focus-ring)" : borderColor}`,
                            borderRadius: 8, padding: "7px 9px",
                            background: bgColor, cursor: (isDup || unavailable) ? "default" : "pointer",
                            display: "flex", flexDirection: "column", gap: 4,
                            transition: "border-color 0.25s, box-shadow 0.15s",
                            opacity: unavailable ? 0.6 : 1,
                          }}
                          onMouseEnter={e => { if (!isFocused && !isDup && !unavailable) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
                          onMouseLeave={e => { if (!isFocused) e.currentTarget.style.boxShadow = ""; }}
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

              {/* Заголовок позиций */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "24px 0 8px" }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Позиции договора</h3>
                {items.length > 0 && (() => {
                  const scootCount = items.filter(i => i.item_type === "bike" && bikes.find(b => String(b.id) === String(i.bike_id))?.model?.toLowerCase().includes("самокат")).length;
                  const bikeCount  = items.filter(i => i.item_type === "bike").length - scootCount;
                  const eqCount    = items.filter(i => i.item_type === "equipment").length;
                  return (
                    <>
                      {bikeCount  > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>🚲 {bikeCount}</span>}
                      {scootCount > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>🛴 {scootCount}</span>}
                      {eqCount    > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>🔦 {eqCount}</span>}
                    </>
                  );
                })()}
              </div>

              {/* Список позиций */}
              {[...items].reverse().map((item, revIndex) => {
                const realIndex = items.length - 1 - revIndex;
                const bike = item.item_type === "bike" && item.bike_id ? bikes.find(b => String(b.id) === String(item.bike_id)) : null;
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
                            : <div style={{ width: 36, height: 36, background: "#e5e7eb", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{getBikeIcon(bike)}</div>}
                          <div style={{ fontSize: 12, lineHeight: 1.4, minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                              {bike.internal_article && <span style={{ fontWeight: 700 }}>{bike.internal_article}</span>}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bike.model}</span>
                            </div>
                            <div style={{ color: "#6b7280", fontSize: 11 }}>{[bike.wheel_size ? `${bike.wheel_size}"` : null, bike.frame_size || null].filter(Boolean).join(" · ")}</div>
                          </div>
                        </div>
                      );
                    })() : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, background: "#e0f2fe", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔦</div>
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
                        disabled
                        placeholder="0" style={{ width: 55, fontSize: 12, padding: "8px 8px", background: "#f3f4f6", color: "#6b7280", cursor: "default" }} />
                      <span style={{ fontSize: 11, color: "#6b7280" }}>₴</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                      <button
                        type="button"
                        ref={(el) => { discountAnchorRefs.current[realIndex] = { current: el }; }}
                        className="filter-select-box"
                        style={{ fontSize: 11, padding: "8px 8px", minWidth: 100, background: item.discount_percent > 0 ? "#f0fdf4" : undefined, color: item.discount_percent > 0 ? "var(--color-primary-green)" : undefined }}
                        onClick={() => setDiscountPopoverIdx(prev => prev === realIndex ? null : realIndex)}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {DISCOUNT_LABEL[item.discount_type || ""] ?? "Скидка"}
                        </span>
                        <span className="arrow">▼</span>
                      </button>
                      {discountPopoverIdx === realIndex && (
                        <MultiSelectPopover singleSelect
                          options={DISCOUNT_OPTIONS}
                          selected={[item.discount_type || ""]}
                          onChange={(vals) => { handleItemChange(realIndex, "discount_type", vals[0] || ""); setDiscountPopoverIdx(null); }}
                          visible={true}
                          anchorRef={discountAnchorRefs.current[realIndex] || { current: null }}
                          onClose={() => setDiscountPopoverIdx(null)} />
                      )}
                      {item.discount_type === "manual" && (
                        <input type="number" min="0" max="100" value={item.discount_percent}
                          onChange={e => handleItemChange(realIndex, "discount_percent", parseFloat(e.target.value) || 0)}
                          style={{ width: 38, fontSize: 11, padding: "8px 4px", textAlign: "center", border: "1px solid #d1d5db", borderRadius: 4 }} />
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <input className="form-input" type="number" min="0"
                        value={item.final_price}
                        onChange={e => handleItemChange(realIndex, "final_price", e.target.value)}
                        placeholder="0" style={{ width: 60, fontSize: 12, padding: "8px 8px" }} />
                      <span style={{ fontSize: 11, color: "#6b7280" }}>₴</span>
                    </div>
                    <button type="button" onClick={() => removeItem(realIndex)}
                      style={{ padding: "4px 8px", background: "none", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", color: "#ef4444", flexShrink: 0, fontSize: 12 }} title="Удалить">✕</button>
                  </div>
                );
              })}
              {totalBase > 0 && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, paddingTop: 8, borderTop: "1px solid #e5e7eb" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 64px", gap: "3px 8px", alignItems: "baseline" }}>
                    {totalDiscount > 0 && (<>
                      <span style={{ fontSize: 12, textAlign: "right" }}>База:</span>
                      <span style={{ fontSize: 12, textAlign: "right" }}>{Math.round(totalBase)} ₴</span>
                      <span style={{ fontSize: 12, textAlign: "right" }}>Скидка:</span>
                      <span style={{ fontSize: 12, fontWeight: 600, textAlign: "right" }}>−{totalDiscount} ₴</span>
                      <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #444444", margin: "2px 0" }} />
                    </>)}
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", textAlign: "right" }}>Итого:</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#111827", textAlign: "right" }}>{Math.round(totalFinal)} ₴</span>
                  </div>
                </div>
              )}
            </div>

            {/* ── 3. Время ── */}
            <div className="form-section">
              <h3>Возврат и менеджер</h3>
              <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <div className="form-group">
                  <label>Возврат до</label>
                  <DateTimePickerField value={form.booked_end}
                    onChange={v => { const synth = { target: { name: "booked_end", value: v } }; handleDateChange(synth); }}
                    minDate={form.booked_start} />
                  {dateError && <span style={{ color: "var(--color-primary-red)", fontSize: 12, marginTop: 4, display: "block" }}>{dateError}</span>}
                </div>
                <div className="form-group" style={{ position: "relative" }}>
                  <label>Выдал</label>
                  <button ref={issuedByRef} type="button" className="filter-select-box"
                    style={{ width: "100%", justifyContent: "space-between", padding: "7px 10px" }}
                    onClick={() => setIssuedByPopover(p => !p)}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {users.find(u => String(u.id) === String(form.issued_by))?.name || "— Не указан —"}
                    </span>
                    <span className="arrow">▼</span>
                  </button>
                  {issuedByPopover && (
                    <MultiSelectPopover singleSelect
                      options={[{ value: "", label: "— Не указан —" }, ...users.map(u => ({ value: String(u.id), label: u.name }))]}
                      selected={form.issued_by ? [String(form.issued_by)] : [""]}
                      onChange={(vals) => { setForm(prev => ({ ...prev, issued_by: vals[0] === "" ? "" : vals[0] || "" })); }}
                      visible={true} anchorRef={issuedByRef} onClose={() => setIssuedByPopover(false)} />
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                {QUICK_DURATIONS.map(({ label, minutes, until2100 }) => (
                  <button key={label} type="button"
                    className={`btn-quick-duration${activeQuickLabel === label ? " active" : ""}`}
                    onClick={() => { applyQuickDuration(minutes, until2100); setActiveQuickLabel(label); }}
                    disabled={!form.booked_start}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── 4. Залог и оплата ── */}
            <div className="form-section">
              <h3>Залог и оплата</h3>
              <div className="form-row">
                <div className="checkbox-field-wrapper">
                  <CheckboxField
                    id="is_paid"
                    label="Оплата при старте"
                    checked={form.is_paid}
                    onChange={(v) => setForm(prev => ({ ...prev, is_paid: v }))}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ position: "relative" }}>
                  <label>Тип залога</label>
                  <button ref={depositTypeRef} type="button" className="filter-select-box"
                    style={{ width: "100%", justifyContent: "space-between", padding: "7px 10px" }}
                    onClick={() => setDepositTypePopover(p => !p)}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(Array.isArray(form.deposit_type) && form.deposit_type.length > 0 && !form.deposit_type.includes("none"))
                        ? form.deposit_type.filter(v => v !== "none").map(v => DEPOSIT_TYPES_OPTIONS.find(d => d.value === v)?.label || v).join(", ")
                        : "Без залога"}
                    </span>
                    <span className="arrow">▼</span>
                  </button>
                  {depositTypePopover && (
                    <MultiSelectPopover
                      options={DEPOSIT_TYPES_OPTIONS}
                      selected={Array.isArray(form.deposit_type) ? form.deposit_type : [form.deposit_type || "none"]}
                      onChange={(vals) => {
                        let result;
                        if (vals.length === 0) {
                          result = ["none"];
                        } else if (vals.includes("none") && vals.length > 1) {
                          const prevHasNone = Array.isArray(form.deposit_type) && form.deposit_type.includes("none");
                          result = prevHasNone ? vals.filter(v => v !== "none") : ["none"];
                        } else {
                          result = vals;
                        }
                        setForm(prev => ({ ...prev, deposit_type: result }));
                      }}
                      visible={true} anchorRef={depositTypeRef} onClose={() => setDepositTypePopover(false)} />
                  )}
                </div>
                {Array.isArray(form.deposit_type) && form.deposit_type.includes("money") && (
                  <div className="form-group">
                    <label>Сумма залога</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input className="form-input" type="number" min="0" name="deposit_amount"
                        value={form.deposit_amount} onChange={handleChange} placeholder="500" />
                      <span style={{ fontSize: 13, color: "#6b7280", flexShrink: 0 }}>₴</span>
                    </div>
                  </div>
                )}
                {Array.isArray(form.deposit_type) && form.deposit_type.includes("document") && (
                  <div className="form-group">
                    <label>Документ (серия и номер)</label>
                    <input className="form-input" name="deposit_value" value={form.deposit_value}
                      onChange={handleChange} placeholder="АА 123456" />
                  </div>
                )}
              </div>
            </div>

            {/* ── 5. Заметки ── */}
            <div className="form-section">
              <h3>Заметки при выдаче</h3>
              <div className="form-group">
                <textarea className="form-textarea" name="notes_issue" value={form.notes_issue} onChange={handleChange} placeholder="Особые условия, пожелания клиента..." rows={2} />
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={onClose}>Отмена</button>
          <button type="button" className="btn btn-secondary-green btn-primary-small"
            disabled={!form.customer_id || items.length === 0 || !!customerNeedsCompletion}
            title={
              customerNeedsCompletion ? "Дозаполните данные клиента для договора"
              : items.length > 8 ? `${items.length} позицій — може не влізти на 1 сторінку`
              : "Распечатать договор"
            }
            onClick={() => {
              const now = new Date();
              const durationMs = new Date(form.booked_end) - new Date(form.booked_start);
              const newStart = toLocalStr(now);
              const newEnd   = toLocalStr(new Date(now.getTime() + (durationMs > 0 ? durationMs : 0)));
              printContract({ form: { ...form, booked_start: newStart, booked_end: newEnd }, items, selectedCustomer, bikes, equipment, tariffs });
            }}>
            🖨 Договір
            {items.length > 0 && (
              <span style={{
                marginLeft: 5,
                padding: '1px 5px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 700,
                background: items.length > 10 ? '#fee2e2' : items.length > 8 ? '#ffedd5' : '#dcfce7',
                color:      items.length > 10 ? '#b91c1c' : items.length > 8 ? '#c2410c' : '#15803d',
              }}>
                {items.length > 8 ? '⚠ ' : ''}{items.length}
              </span>
            )}
          </button>
          <button type="button" className="btn btn-primary-green btn-primary-small" onClick={handleSubmit}
            disabled={saving || !!customerNeedsCompletion}
            title={customerNeedsCompletion ? "Дозаполните данные клиента для договора" : undefined}>
            {saving ? "Сохранение..." : "Старт проката"}
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
                  style={{ width: 72, padding: "8px 10px", fontSize: 18, fontWeight: 600, border: "2px solid var(--color-primary-green)", borderRadius: 6, textAlign: "center", outline: "none" }} />
                <span style={{ fontSize: 13, color: "#374151" }}>шт.</span>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { setQtyPopup(null); setTimeout(() => filterSearchRef.current?.focus(), 0); }}
                  style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#f9fafb", cursor: "pointer", fontSize: 13 }}>Отмена</button>
                <button type="button" className="btn btn-primary-green btn-primary-small" onClick={confirmEquipmentAdd}>Добавить</button>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>↑↓ стрелки · Enter — добавить · Esc — отмена</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveRentalModal;
