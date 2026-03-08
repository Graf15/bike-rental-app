import { apiFetch } from "../utils/api";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Bike, Scooter, Package, Flashlight, Backpack } from "lucide-react";

const getEquipmentIcon = (tariffId, size = 18) => {
  if (Number(tariffId) === 9)  return <Flashlight size={size} color="#0369a1" />;
  if (Number(tariffId) === 10) return <Backpack size={size} color="#0369a1" />;
  return <Package size={size} color="#0369a1" />;
};
import MultiSelectPopover from "./MultiSelectPopover";
import DateTimePickerField from "./DateTimePickerField";
import CheckboxField from "./CheckboxField";
import ConfirmModal from "./ConfirmModal";
import CustomerStatsBlock from "./CustomerStatsBlock";
import { useConfirm } from "../utils/useConfirm";
import { toast } from "../utils/toast";
import { TARIFF_OPTIONS, WHEEL_OPTIONS, heightToFrameRec } from "../constants/bikeFilters";
import { normalizePhone, isValidPhone, PHONE_HINT } from "../constants/phoneUtils";
const looksLikePhone = (v) => /\d{6,}/.test(v.replace(/\s/g, ""));
import "./Modal.css";
import "./BikeTable.css";

const capitalizeName = (s) => s.replace(/(^|\s|-)(\S)/g, (_, sep, ch) => sep + ch.toUpperCase());

const INITIAL_FORM = {
  customer_id: "",
  issued_by: "",
  booked_start: "",
  booked_end: "",
  deposit_type: ["none"],
  deposit_amount: "",
  deposit_value: "",
  prepayment_amount: "",
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

const GENDER_OPTIONS = [
  { value: "", label: "— Не указан —" },
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
];

const DEPOSIT_TYPES_OPTIONS = [
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

const getBikeIcon = (bike, size = 20) => Number(bike?.tariff_id) === 5
  ? <Scooter size={size} color="#9ca3af" />
  : <Bike size={size} color="#9ca3af" />;

const BookingModal = ({ onClose, onSave, editingRental = null, onProceedToIssue = null }) => {
  const [confirmProps, showConfirm] = useConfirm();
  const [form, setForm]           = useState(() => ({ ...INITIAL_FORM, booked_start: toLocalStr(new Date()) }));
  const [items, setItems]         = useState([]);
  const [saving, setSaving]       = useState(false);
  const [errorSection, setErrorSection] = useState(null);
  const [dateError, setDateError]           = useState(null);
  // Редактирование клиента
  const [editCustOpen, setEditCustOpen]         = useState(false);
  const [editCustForm, setEditCustForm]         = useState({ last_name: "", first_name: "", middle_name: "", phone: "", birth_date: "", gender: "", is_veteran: false });
  const [editCustSaving, setEditCustSaving]     = useState(false);
  const [editCustError, setEditCustError]       = useState(null);
  const editCustGenderRef                       = useRef(null);
  const [editCustGenderPopover, setEditCustGenderPopover] = useState(false);

  // activeQuickLabel вычисляется из реальных дат — подсвечивается автоматически при открытии брони
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
  const [customerSearch, setCustomerSearch]         = useState("");
  const [customerSearching, setCustomerSearching]   = useState(false);
  const [noResultsConfirmed, setNoResultsConfirmed] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerStats, setCustomerStats]       = useState(null);
  const [showDropdown, setShowDropdown]         = useState(false);
  const [customerFocused, setCustomerFocused]   = useState(-1);
  const customerInputRef                        = useRef(null);
  const dropdownRef                             = useRef(null);
  const bookedStartRef                          = useRef(null);

  // Поповеры менеджера и залога
  const issuedByRef                   = useRef(null);
  const [issuedByPopover, setIssuedByPopover] = useState(false);
  const [discountPopoverIdx, setDiscountPopoverIdx] = useState(null);
  const discountAnchorRefs = useRef({});
  const depositTypeRef                = useRef(null);
  const [depositTypePopover, setDepositTypePopover] = useState(false);

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
      apiFetch("/api/users").then(r => r.json()),
      apiFetch("/api/tariffs").then(r => r.json()),
      apiFetch("/api/equipment").then(r => r.json()),
    ]).then(([u, t, e]) => {
      setUsers(Array.isArray(u) ? u : []);
      setTariffs(Array.isArray(t) ? t.filter(x => x.is_active) : []);
      setEquipment(Array.isArray(e) ? e : []);
    }).catch(console.error);
  }, []);

  // Серверный поиск клиентов по мере ввода
  useEffect(() => {
    if (customerSearch.length < 2) { setCustomers([]); setCustomerSearching(false); setNoResultsConfirmed(false); return; }
    setCustomerSearching(true);
    const timer = setTimeout(() => {
      apiFetch(`/api/customers?search=${encodeURIComponent(customerSearch)}&limit=10`)
        .then(r => r.json())
        .then(data => {
          const rows = data.rows || [];
          setCustomers(rows);
          setNoResultsConfirmed(rows.length === 0);
          setCustomerSearching(false);
        })
        .catch(() => { setCustomers([]); setNoResultsConfirmed(true); setCustomerSearching(false); });
    }, 200);
    return () => clearTimeout(timer);
  }, [customerSearch]);

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
      apiFetch(url).then(r => r.json()).then(b => setAllBikes(Array.isArray(b) ? b : [])).catch(console.error).finally(() => setBikesLoading(false));
      return;
    }
    if (dateError) return;
    setBikesLoading(true);
    const url = `/api/bikes/for-rental?start=${encodeURIComponent(form.booked_start)}&end=${encodeURIComponent(form.booked_end)}`;
    apiFetch(url).then(r => r.json()).then(b => setAllBikes(Array.isArray(b) ? b : [])).catch(console.error).finally(() => setBikesLoading(false));
  }, [form.booked_start, form.booked_end, dateError]);

  // Загружаем данные редактируемой брони (pre-fill)
  useEffect(() => {
    if (!editingRental) return;
    apiFetch(`/api/rentals/${editingRental.id}`)
      .then(r => r.json())
      .then(rental => {
        setForm({
          customer_id:       rental.customer_id    || "",
          issued_by:         rental.issued_by       || "",
          booked_start:      rental.booked_start    ? toLocalStr(new Date(rental.booked_start)) : "",
          booked_end:        rental.booked_end      ? toLocalStr(new Date(rental.booked_end))   : "",
          deposit_type:      rental.deposit_type && rental.deposit_type !== "none"
                               ? rental.deposit_type.split(",") : ["none"],
          deposit_amount:    rental.deposit_amount  != null ? String(rental.deposit_amount)  : "",
          deposit_value:     rental.deposit_value   || "",
          prepayment_amount: rental.prepayment_amount != null ? String(rental.prepayment_amount) : "",
          notes_issue:       rental.notes_issue      || "",
        });
        const customer = {
          id:            rental.customer_id,
          last_name:     rental.last_name,
          first_name:    rental.first_name,
          middle_name:   rental.middle_name,
          phone:         rental.phone,
          birth_date:    rental.birth_date,
          gender:        rental.gender,
          is_veteran:    rental.is_veteran,
          no_show_count: rental.no_show_count,
          status:        rental.customer_status || "active",
        };
        setSelectedCustomer(customer);
        setCustomerSearch([rental.last_name, rental.first_name, rental.middle_name].filter(Boolean).join(" "));
        setEditCustOpen(false);
        setEditCustForm({ last_name: rental.last_name || "", first_name: rental.first_name || "", middle_name: rental.middle_name || "", phone: rental.phone || "", birth_date: rental.birth_date ? rental.birth_date.slice(0, 10) : "", gender: rental.gender || "", is_veteran: rental.is_veteran || false });
        if (Array.isArray(rental.items)) {
          const mappedItems = rental.items.map(item => {
            const price = parseFloat(item.price) || "";
            const pct   = item.discount_percent  || 0;
            return {
              ...INITIAL_ITEM,
              _key:               item.id,
              item_type:          item.item_type,
              bike_id:            String(item.bike_id            || ""),
              equipment_model_id: String(item.equipment_model_id || ""),
              equipment_name:     item.equipment_name || "",
              tariff_id:          String(item.tariff_id || ""),
              tariff_type:        item.tariff_type || "hourly",
              price,
              final_price:        price !== "" ? computeFinalPrice(price, pct) : "",
              quantity:           item.quantity   || 1,
              discount_type:      item.discount_type   || "",
              discount_percent:   pct,
              discount_notes:     item.discount_notes  || "",
            };
          });
          setItems(autoApplyDiscounts(customer, mappedItems));
        }
      })
      .catch(console.error);
  }, [editingRental?.id]);

  // ── Расчёт цены ─────────────────────────────────────────────────────────────

  const fetchPrice = useCallback(async (tariff_id, start_time, end_time) => {
    if (!tariff_id || !start_time || !end_time) return null;
    const start = new Date(start_time), end = new Date(end_time);
    if (isNaN(start) || isNaN(end) || end <= start) return null;
    try {
      const r = await apiFetch("/api/calculate/price", {
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
        return { ...item, price: result.price, tariff_type: result.type || item.tariff_type, final_price: computeFinalPrice(result.price, item.discount_percent || 0) };
      })
    );
    setItems(updated);
  }, [fetchPrice]);

  // ── Клиент ──────────────────────────────────────────────────────────────────

  const filteredCustomers = customers;

  // Форма автоматически видна когда нет результатов и пользователь не скрыл её вручную
  const showQuickCreate = customerSearch.length >= 2 && noResultsConfirmed && !selectedCustomer && !quickDismissed;

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

  // Загрузка статистики клиента при выборе
  useEffect(() => {
    if (!selectedCustomer?.id) { setCustomerStats(null); return; }
    apiFetch(`/api/customers/${selectedCustomer.id}/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setCustomerStats(data))
      .catch(() => setCustomerStats(null));
  }, [selectedCustomer?.id]);

  // Авто-сброс подсветки секции когда условие исправлено
  useEffect(() => {
    if (!errorSection) return;
    if (errorSection === "customer" && form.customer_id) setErrorSection(null);
    if (errorSection === "dates" && form.booked_start && form.booked_end && !dateError) setErrorSection(null);
    if (errorSection === "bikes" && items.length > 0) setErrorSection(null);
  }, [form.customer_id, form.booked_start, form.booked_end, items.length, dateError, errorSection]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    setForm(prev => ({ ...prev, customer_id: customer.id }));
    setCustomerSearch([customer.last_name, customer.first_name, customer.middle_name].filter(Boolean).join(" "));
    setShowDropdown(false); setCustomerFocused(-1);
    setItems(prev => autoApplyDiscounts(customer, prev));
    setEditCustOpen(false);
    setEditCustForm({ last_name: customer.last_name || "", first_name: customer.first_name || "", middle_name: customer.middle_name || "", phone: customer.phone || "", birth_date: customer.birth_date ? customer.birth_date.slice(0, 10) : "", gender: customer.gender || "", is_veteran: customer.is_veteran || false });
    setTimeout(() => bookedStartRef.current?.focus?.(), 80);
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
      const res = await apiFetch("/api/customers", {
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

  const handleEditCustomerSave = async () => {
    if (!editCustForm.first_name.trim()) { setEditCustError("Укажите имя"); return; }
    const phone = normalizePhone(editCustForm.phone);
    if (!phone) { setEditCustError(`Неверный формат телефона. ${PHONE_HINT}`); return; }
    setEditCustSaving(true);
    setEditCustError(null);
    try {
      const res = await apiFetch(`/api/customers/${selectedCustomer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          last_name:   editCustForm.last_name.trim()   || null,
          first_name:  editCustForm.first_name.trim(),
          middle_name: editCustForm.middle_name.trim() || null,
          phone,
          birth_date:  editCustForm.birth_date || null,
          gender:      editCustForm.gender     || null,
          is_veteran:  editCustForm.is_veteran,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      const updated = { ...selectedCustomer, ...data };
      setSelectedCustomer(updated);
      setCustomerSearch([data.last_name, data.first_name, data.middle_name].filter(Boolean).join(" "));
      setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c));
      setItems(prev => autoApplyDiscounts(updated, prev));
      setEditCustOpen(false);
    } catch (err) {
      setEditCustError(err.message);
    } finally {
      setEditCustSaving(false);
    }
  };

  const getActiveQuickLabel = () => {
    if (!form.booked_start || !form.booked_end) return null;
    const startD = new Date(form.booked_start);
    const endD   = new Date(form.booked_end);
    const diffMin = Math.round((endD - startD) / 60000);
    if (diffMin === 60)    return "1ч";
    if (diffMin === 120)   return "2ч";
    if (diffMin === 180)   return "3ч";
    if (diffMin === 240)   return "4ч";
    if (diffMin === 1440)  return "Сутки";
    if (diffMin === 10080) return "Неделя";
    if (diffMin === 20160) return "2 нед";
    // "День" — конец в 21:00 того же дня что и старт
    const day2100 = new Date(startD); day2100.setHours(21, 0, 0, 0);
    if (Math.abs(endD - day2100) < 60000) return "День";
    return null;
  };

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
          if (isAdded) setItems(prev => prev.filter(i => String(i.bike_id) !== String(item.id)));
          else addBikeFromList(item);
        } else {
          handleEqSelect(item);
        }
      } else if (filteredBikes.length === 1) {
        const b = filteredBikes[0];
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

  const totalBase = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0) * (parseInt(i.quantity) || 1), 0);
  const totalFinal = items.reduce((sum, i) => {
    const qty = parseInt(i.quantity) || 1;
    const fp = parseFloat(i.final_price);
    if (!isNaN(fp)) return sum + fp * qty;
    return sum + Math.round((parseFloat(i.price) || 0) * (1 - (i.discount_percent || 0) / 100) / 10) * 10 * qty;
  }, 0);
  const totalDiscount = Math.round(totalBase - totalFinal);

  // ── Отправка ─────────────────────────────────────────────────────────────────

  const validateAndSave = async () => {
    if (!form.customer_id)  { setErrorSection("customer"); throw new Error("Выберите клиента"); }
    if (!form.booked_start || !form.booked_end || dateError) { setErrorSection("dates"); throw new Error(dateError || (!form.booked_start ? "Укажите время начала брони" : "Укажите время окончания брони")); }
    if (items.length === 0) { setErrorSection("bikes"); throw new Error("Добавьте хотя бы один велосипед или оборудование"); }

    const depositType = (() => {
      const dt = form.deposit_type;
      if (!Array.isArray(dt) || dt.length === 0 || dt.includes("none")) return "none";
      return dt.filter(v => v !== "none").join(",");
    })();
    const body = {
      ...form,
      deposit_type:      depositType,
      deposit_amount:    form.deposit_amount    !== "" ? parseFloat(form.deposit_amount)    : null,
      prepayment_amount: form.prepayment_amount !== "" ? parseFloat(form.prepayment_amount) : null,
      initial_status:    "booked",
      customer_id:       parseInt(form.customer_id),
      issued_by:         form.issued_by ? parseInt(form.issued_by) : null,
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

    const url    = editingRental ? `/api/rentals/${editingRental.id}` : "/api/rentals";
    const method = editingRental ? "PATCH" : "POST";
    const response = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Ошибка"); }
    return await response.json();
  };

  const handleCancelBooking = () => {
    showConfirm({
      title: `Отменить бронь #${editingRental?.id}?`,
      message: "Бронь будет отменена без штрафа для клиента.",
      confirmLabel: "Отменить бронь",
      danger: true,
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/rentals/${editingRental.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Ошибка при отмене");
          }
          toast.success(`Бронь #${editingRental.id} отменена`);
          onSave(null);
        } catch (err) {
          toast.error(err.message);
        }
      },
    });
  };

  const handleNoShow = () => {
    const customer = selectedCustomer;
    showConfirm({
      title: "Клиент не явился?",
      message: `${customer ? `${customer.last_name || ""} ${customer.first_name || ""}`.trim() + " — " : ""}неявка будет записана в карточку клиента. При 2 неявках — автоблокировка броней.`,
      confirmLabel: "Не явился (+штраф)",
      danger: true,
      onConfirm: async () => {
        try {
          const res = await apiFetch(`/api/rentals/${editingRental.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "no_show" }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Ошибка");
          }
          toast.warn(`Бронь #${editingRental.id}: зафиксирована неявка`);
          onSave(null);
        } catch (err) {
          toast.error(err.message);
        }
      },
    });
  };

  const handleSubmit = async () => {
    setErrorSection(null);
    setSaving(true);
    try {
      const saved = await validateAndSave();
      onSave(saved);
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  const handleProceedToIssue = async () => {
    setErrorSection(null);
    setSaving(true);
    try {
      const saved = await validateAndSave();
      onProceedToIssue(saved);
    } catch (err) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  // ── Рендер ───────────────────────────────────────────────────────────────────

  const hasDateRange = form.booked_start && form.booked_end && !dateError;

  return (
    <>
    <div
      className="modal-overlay"
      onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }}
      onMouseUp={(e)   => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-content" style={{ maxWidth: 920 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{editingRental ? `Бронь #${editingRental.id}` : "Создать бронь"}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-form">

            {/* ── 1. Клиент ── */}
            <div className={`form-section${errorSection === "customer" ? " form-section--error" : ""}`}>
              {selectedCustomer && (
                <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #10b981", borderRadius: 6, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, color: "#065f46" }}>{[selectedCustomer.last_name, selectedCustomer.first_name, selectedCustomer.middle_name].filter(Boolean).join(" ")}</span>
                  <span style={{ color: "#047857" }}>{selectedCustomer.phone}</span>
                  {selectedCustomer.is_veteran && <span style={{ color: "var(--color-primary-blue)", fontSize: 13, fontWeight: 500 }}>🎖 УБД — скидка −20%</span>}
                  {selectedCustomer.status !== "active" && <span style={{ color: "var(--color-primary-red)", fontWeight: 500 }}>⛔ {selectedCustomer.status === "no_booking" ? "Запрет брони" : "Запрет выдачи"}</span>}
                  {(() => {
                    if (!selectedCustomer.birth_date) return null;
                    const bd = new Date(selectedCustomer.birth_date), today = new Date();
                    const bday = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
                    const diff = Math.floor((today - bday) / 86400000);
                    if (diff >= 0 && diff <= 7) return <span style={{ color: "#7c3aed", fontSize: 13, fontWeight: 500 }}>🎂 Именинник — скидка −50%!</span>;
                    return null;
                  })()}
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 2 }}>
                    <button type="button" onClick={() => { setEditCustOpen(p => !p); setEditCustError(null); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16, lineHeight: 1, padding: "2px 6px", transform: "rotate(135deg)" }} title="Редактировать клиента">✏</button>
                    <button type="button" onClick={clearCustomer} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16, lineHeight: 1, padding: "2px 6px" }} title="Сменить клиента">✕</button>
                  </div>
                </div>
              )}

              {/* ── Статистика клиента ── */}
              {selectedCustomer && <CustomerStatsBlock stats={customerStats} />}

              {/* ── Редактирование клиента ── */}
              {editCustOpen && selectedCustomer && (
                <div style={{ marginTop: 10, padding: "12px 14px", background: "#f0fdf4", border: "1px solid #10b981", borderRadius: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#065f46", marginBottom: 10 }}><span style={{ display: "inline-block", transform: "rotate(135deg)" }}>✏</span> Редактирование данных клиента</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Фамилия</label>
                      <input className="form-input" value={editCustForm.last_name}
                        onChange={e => setEditCustForm(p => ({ ...p, last_name: capitalizeName(e.target.value) }))}
                        placeholder="Фамилия" autoComplete="off" style={{ fontSize: 13 }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="required-label" style={{ fontSize: 12 }}>Имя</label>
                      <input className="form-input" value={editCustForm.first_name}
                        onChange={e => setEditCustForm(p => ({ ...p, first_name: capitalizeName(e.target.value) }))}
                        placeholder="Имя" autoComplete="off" style={{ fontSize: 13 }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Отчество</label>
                      <input className="form-input" value={editCustForm.middle_name}
                        onChange={e => setEditCustForm(p => ({ ...p, middle_name: capitalizeName(e.target.value) }))}
                        placeholder="Необязательно" autoComplete="off" style={{ fontSize: 13 }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="required-label" style={{ fontSize: 12 }}>Телефон</label>
                      <input className="form-input" value={editCustForm.phone}
                        onChange={e => setEditCustForm(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+380..." autoComplete="off" style={{ fontSize: 13 }} />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label style={{ fontSize: 12 }}>Дата рождения</label>
                      <DateTimePickerField granularity="day" value={editCustForm.birth_date}
                        onChange={v => setEditCustForm(p => ({ ...p, birth_date: v }))} />
                    </div>
                    <div className="form-group" style={{ margin: 0, position: "relative" }}>
                      <label style={{ fontSize: 12 }}>Пол</label>
                      <button ref={editCustGenderRef} type="button" className="filter-select-box"
                        style={{ width: "100%", fontSize: 13 }}
                        onClick={() => setEditCustGenderPopover(p => !p)}>
                        <span>{GENDER_OPTIONS.find(o => o.value === editCustForm.gender)?.label ?? "— Не указан —"}</span>
                        <span className="arrow">▼</span>
                      </button>
                      {editCustGenderPopover && (
                        <MultiSelectPopover singleSelect options={GENDER_OPTIONS}
                          selected={[editCustForm.gender]}
                          onChange={vals => setEditCustForm(p => ({ ...p, gender: vals[0] ?? "" }))}
                          visible={true} anchorRef={editCustGenderRef} onClose={() => setEditCustGenderPopover(false)} />
                      )}
                    </div>
                    <div className="checkbox-field-wrapper">
                      <CheckboxField label="🎖 УБД" checked={editCustForm.is_veteran}
                        onChange={v => setEditCustForm(p => ({ ...p, is_veteran: v }))} />
                    </div>
                  </div>
                  {editCustError && <div style={{ fontSize: 12, color: "var(--color-primary-red)", marginBottom: 8 }}>{editCustError}</div>}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn btn-secondary-green" onClick={() => { setEditCustOpen(false); setEditCustError(null); }}
                      style={{ fontSize: 13, padding: "6px 14px" }}>Отмена</button>
                    <button type="button" className="btn btn-primary-green" onClick={handleEditCustomerSave}
                      disabled={editCustSaving} style={{ fontSize: 13, padding: "6px 18px" }}>
                      {editCustSaving ? "Сохранение..." : "Сохранить"}
                    </button>
                  </div>
                </div>
              )}

              {!selectedCustomer && (
                <div ref={dropdownRef} style={{ position: "relative" }}>
                  <div className="form-group">
                    <label className="required-label">Клиент</label>
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
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", marginBottom: 10 }}>+ Новый клиент</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="required-label" style={{ fontSize: 12 }}>Имя</label>
                          <input ref={quickFirstNameRef} className="form-input" value={quickForm.first_name}
                            onChange={e => setQuickForm(p => ({ ...p, first_name: capitalizeName(e.target.value) }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreateSave(); } if (e.key === "Escape") { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); } }}
                            placeholder="Имя" autoComplete="off" style={{ fontSize: 13 }} />
                          {looksLikePhone(quickForm.first_name) && <div style={{ fontSize: 11, marginTop: 2, color: "var(--color-primary-red)" }}>Похоже на номер телефона</div>}
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontSize: 12 }}>Фамилия</label>
                          <input className="form-input" value={quickForm.last_name}
                            onChange={e => setQuickForm(p => ({ ...p, last_name: capitalizeName(e.target.value) }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreateSave(); } if (e.key === "Escape") { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); } }}
                            placeholder="Необязательно" autoComplete="off" style={{ fontSize: 13 }} />
                          {looksLikePhone(quickForm.last_name) && <div style={{ fontSize: 11, marginTop: 2, color: "var(--color-primary-red)" }}>Похоже на номер телефона</div>}
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="required-label" style={{ fontSize: 12 }}>Телефон</label>
                          <input className="form-input" value={quickForm.phone}
                            onChange={e => setQuickForm(p => ({ ...p, phone: e.target.value }))}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleQuickCreateSave(); } if (e.key === "Escape") { setQuickDismissed(true); setTimeout(() => customerInputRef.current?.focus(), 0); } }}
                            placeholder="+38 (050) 000-00-00" autoComplete="off" style={{ fontSize: 13 }} />
                          {(() => {
                            const digits = quickForm.phone.replace(/\D/g, "");
                            if (digits.length < 6) return null;
                            const valid = isValidPhone(quickForm.phone);
                            return <div style={{ fontSize: 11, marginTop: 2, color: valid ? "var(--color-primary-green)" : "var(--color-primary-red)" }}>
                              {valid ? "✓ Номер корректен" : PHONE_HINT}
                            </div>;
                          })()}
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

            {/* ── 2. Период брони ── */}
            <div className={`form-section${errorSection === "dates" ? " form-section--error" : ""}`}>
              <h3>Период</h3>
              <div className="form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="form-group">
                  <label className="required-label">Начало</label>
                  <DateTimePickerField ref={bookedStartRef} value={form.booked_start}
                    onChange={v => { const synth = { target: { name: "booked_start", value: v } }; handleDateChange(synth); }} />
                </div>
                <div className="form-group">
                  <label className="required-label">Окончание</label>
                  <DateTimePickerField value={form.booked_end}
                    onChange={v => { const synth = { target: { name: "booked_end", value: v } }; handleDateChange(synth); }}
                    minDate={form.booked_start} />
                  {dateError && <span style={{ color: "var(--color-primary-red)", fontSize: 12, marginTop: 4, display: "block" }}>{dateError}</span>}
                </div>
                <div className="form-group" style={{ position: "relative" }}>
                  <label>Принял заявку</label>
                  <button ref={issuedByRef} type="button" className="filter-select-box"
                    style={{ width: "100%" }}
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
                {[
                  { label: "1ч",     minutes: 60 },
                  { label: "2ч",     minutes: 120 },
                  { label: "3ч",     minutes: 180 },
                  { label: "4ч",     minutes: 240 },
                  { label: "День",   until2100: true },
                  { label: "Сутки",  minutes: 1440 },
                  { label: "Неделя", minutes: 10080 },
                  { label: "2 нед",  minutes: 20160 },
                ].map(({ label, minutes, until2100 }) => (
                  <button key={label} type="button"
                    className={`btn-quick-duration${getActiveQuickLabel() === label ? " active" : ""}`}
                    onClick={() => applyQuickDuration(minutes, until2100)}
                    disabled={!form.booked_start}>
                    {label}
                  </button>
                ))}
              </div>
              {hasDateRange && (
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
                  ✓ Показаны велосипеды, свободные в указанный период
                </div>
              )}
            </div>

            {/* ── 3. Подбор велосипедов ── */}
            <div className={`form-section${errorSection === "bikes" ? " form-section--error" : ""}`}>
              <h3>Велосипеды</h3>

              {/* Фильтры подбора */}
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button type="button" ref={tariffFilterRef}
                  onClick={() => setPopoverKey(prev => prev === "tariff" ? null : "tariff")}
                  className="filter-select-box" style={{ minWidth: 140 }}>
                  {filterTariffs.length > 0 ? filterTariffs.join(", ") : "Все типы"}
                  <span className="arrow">▼</span>
                </button>
                <button type="button" ref={wheelFilterRef}
                  onClick={() => setPopoverKey(prev => prev === "wheel" ? null : "wheel")}
                  className="filter-select-box" style={{ minWidth: 130 }}>
                  {filterWheels.length > 0 ? filterWheels.map(w => `${w}"`).join(", ") : "Все колёса"}
                  <span className="arrow">▼</span>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <input className="form-input" type="number" placeholder="Рост см" value={filterHeight} onChange={e => setFilterHeight(e.target.value)}
                    style={{ width: 90, fontSize: 13 }} />
                  {heightRec && <span style={{ fontSize: 11, color: "#059669", whiteSpace: "nowrap" }}>→ {heightRec.label}</span>}
                </div>
                <input ref={filterSearchRef} className="form-input" placeholder="Поиск велосипедов / оборудования" value={filterSearch}
                  onChange={e => { setFilterSearch(e.target.value); setGridFocusedIdx(-1); }}
                  onFocus={() => setGridFocusedIdx(-1)}
                  onKeyDown={handleGridKeyDown}
                  style={{ width: 240, fontSize: 13 }} />
                {(filterTariffs.length > 0 || filterWheels.length > 0 || filterHeight || filterSearch) && (
                  <button type="button" className="btn-reset-filters"
                    onClick={() => { setFilterTariffs([]); setFilterWheels([]); setFilterHeight(""); setFilterSearch(""); }}
                    title="Сбросить фильтры">🔄</button>
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
                <div ref={bikeGridRef} onKeyDown={handleGridKeyDown} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 380, overflowY: "auto" }}>
                  {filteredBikes.map((bike, bIdx) => {
                    const isAdded    = items.some(i => String(i.bike_id) === String(bike.id));
                    const isFocused  = bIdx === gridFocusedIdx;
                    const isBooked   = bike.condition_status === "бронь";
                    const isRepair   = bike.condition_status === "в ремонте";
                    const isRental   = bike.condition_status === "в прокате";
                    const conflictEnd = bike.conflict_info?.booked_end ? formatDt(bike.conflict_info.booked_end) : null;
                    const photo      = bike.photos?.urls?.length ? bike.photos.urls[bike.photos.main ?? 0] : null;

                    // Если даты заданы и конфликт заканчивается до начала брони — считаем свободным
                    const freeByStart = conflictEnd && form.booked_start && new Date(bike.conflict_info.booked_end) <= new Date(form.booked_start);
                    const isUnavailable = !freeByStart && (isRental || isRepair);
                    const canAdd = !isUnavailable && !isBooked;

                    const isNoShow = ["no_show", "overdue"].includes(bike.conflict_info?.status);
                    let bgColor = "white", borderColor = "#e5e7eb", statusText = null, statusColor = "#6b7280";
                    if (isAdded)         { bgColor = "#f0fdf4"; borderColor = "#10b981"; statusText = "✓ добавлен"; statusColor = "#059669"; }
                    else if (freeByStart){ bgColor = "white";   borderColor = "#e5e7eb"; statusText = `освободится ${conflictEnd}`; statusColor = "#059669"; }
                    else if (isRental)   { bgColor = "#fef2f2"; borderColor = "#fca5a5"; statusText = conflictEnd ? `в прокате до ${conflictEnd}` : "в прокате"; statusColor = "#ef4444"; }
                    else if (isBooked)   { bgColor = "#fffbeb"; borderColor = "#fcd34d"; statusText = conflictEnd ? `бронь до ${conflictEnd}` : "забронирован"; statusColor = "#d97706"; }
                    else if (isNoShow) {
                      bgColor = "#fffbeb"; borderColor = "#fcd34d"; statusColor = "#d97706";
                      const t = bike.conflict_info.booked_start ? new Date(bike.conflict_info.booked_start).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : null;
                      statusText = <span>⚠️ опаздывает{t ? ` с ${t}` : ""} · <span onClick={e => { e.stopPropagation(); window.open(`/rentals?open=${bike.conflict_info.contract_id}`, "_blank"); }} style={{ textDecoration: "underline", cursor: "pointer" }}>договор #{bike.conflict_info.contract_id}</span></span>;
                    }
                    else if (isRepair)   { bgColor = "#f9fafb"; borderColor = "#d1d5db"; statusText = "в ремонте"; statusColor = "#9ca3af"; }

                    return (
                      <div key={bike.id}
                        tabIndex={-1}
                        className="grid-card-item"
                        onClick={() => {
                          setGridFocusedIdx(bIdx);
                          if (isAdded) {
                            setItems(prev => prev.filter(i => String(i.bike_id) !== String(bike.id)));
                          } else if (canAdd) {
                            addBikeFromList(bike);
                          }
                        }}
                        style={{
                          border: `2px solid ${isFocused ? "var(--color-focus-ring)" : borderColor}`,
                          borderRadius: 8, padding: "7px 9px",
                          background: bgColor, cursor: isUnavailable ? "not-allowed" : "pointer",
                          display: "flex", flexDirection: "column", gap: 4,
                          transition: "border-color 0.25s, box-shadow 0.15s",
                          opacity: isUnavailable ? 0.7 : 1,
                        }}
                        onMouseEnter={e => { if (!isFocused && !isUnavailable) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
                        onMouseLeave={e => { if (!isFocused) e.currentTarget.style.boxShadow = ""; }}
                      >
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {photo
                            ? <img src={photo} alt="" loading="lazy" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                            : <div style={{ width: 60, height: 60, background: "#e5e7eb", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{getBikeIcon(bike, 28)}</div>
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
                  <div ref={eqGridRef} onKeyDown={handleGridKeyDown} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 320, overflowY: "auto" }}>
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
                          tabIndex={-1}
                          className="grid-card-item"
                          onClick={() => { setGridFocusedIdx(filteredBikes.length + eqIdx); if (!isDup && !unavailable) handleEqSelect(eq); }}
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
                            <div style={{ width: 60, height: 60, background: isDup ? "#dbeafe" : "#e0f2fe", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{getEquipmentIcon(eq.rental_tariff_id, 28)}</div>
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
              <div className="form-section" style={{ marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Позиции договора</h3>
                  {(() => {
                    const scootCount = items.filter(i => i.item_type === "bike" && Number(allBikes.find(b => String(b.id) === String(i.bike_id))?.tariff_id) === 5).length;
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
                            {photo ? <img src={photo} alt="" loading="lazy" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                              : <div style={{ width: 36, height: 36, background: "#e5e7eb", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{getBikeIcon(bike, 18)}</div>}
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
                          <div style={{ width: 36, height: 36, background: "#e0f2fe", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{getEquipmentIcon(eq?.rental_tariff_id)}</div>
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
                          disabled placeholder="0" style={{ width: 55, fontSize: 12, padding: "8px 8px", background: "#f9fafb", color: "#6b7280" }} />
                        <span style={{ fontSize: 11, color: "#6b7280" }}>₴</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        <button
                          type="button"
                          ref={(el) => { discountAnchorRefs.current[realIndex] = { current: el }; }}
                          className="filter-select-box"
                          style={{ fontSize: 11, minWidth: 100, background: item.discount_percent > 0 ? "#f0fdf4" : undefined, color: item.discount_percent > 0 ? "var(--color-primary-green)" : undefined }}
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
                        <input className="form-input" type="number" min="0" value={item.final_price}
                          onChange={e => handleItemChange(realIndex, "final_price", e.target.value === "" ? "" : parseFloat(e.target.value) || 0)}
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
            )}

            {/* ── 7. Предоплата ── */}
            <div className="form-section">
              <h3>Предоплата</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Сумма предоплаты</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input className="form-input" type="number" min="0" name="prepayment_amount"
                      value={form.prepayment_amount} onChange={handleChange} placeholder="0" />
                    <span style={{ fontSize: 13, color: "#6b7280", flexShrink: 0 }}>₴</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── 8. Заметки ── */}
            <div className="form-section">
              <h3>Заметки</h3>
              <div className="form-group">
                <textarea className="form-textarea" name="notes_issue" value={form.notes_issue} onChange={handleChange} placeholder="Особые условия, пожелания клиента..." rows={2} />
              </div>
            </div>

          </div>
        </div>

        <div className="modal-footer">
          {editingRental ? (
            <>
              {editingRental.status === "overdue" && (
                <button type="button" className="btn btn-primary-small" disabled={saving}
                  style={{ background: "white", color: "var(--color-primary-red)", border: "1px solid var(--color-primary-red)", transition: "background 0.15s, color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--color-primary-red)"; e.currentTarget.style.color = "white"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "var(--color-primary-red)"; }}
                  onClick={handleNoShow}>
                  Не явился
                </button>
              )}
              <button type="button" className="btn btn-primary-small" disabled={saving}
                style={{ background: "white", color: "#6b7280", border: "1px solid #d1d5db", transition: "background 0.15s, color 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "white"; }}
                onClick={handleCancelBooking}>
                Отменить (без штрафа)
              </button>
              <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={handleSubmit} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить изменения"}
              </button>
              <button type="button" className="btn btn-primary-green btn-primary-small" onClick={handleProceedToIssue} disabled={saving}>
                {saving ? "Сохранение..." : "Перейти к оформлению ▶"}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary-green btn-primary-small" onClick={handleSubmit} disabled={saving}>
              {saving ? "Сохранение..." : "Создать бронь"}
            </button>
          )}
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
    {confirmProps && <ConfirmModal {...confirmProps} />}
    </>
  );
};

export default BookingModal;
