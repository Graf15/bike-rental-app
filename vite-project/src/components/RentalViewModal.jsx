import React, { useState, useEffect, useRef } from "react";
import MultiSelectPopover from "./MultiSelectPopover";
import DateTimePickerField from "./DateTimePickerField";
import ConfirmModal from "./ConfirmModal";
import { heightToFrameRec } from "../constants/bikeFilters";
import { toast } from "../utils/toast";
import { useConfirm } from "../utils/useConfirm";
import "./Modal.css";

const DISCOUNT_OPTIONS = [
  { value: "", label: "Без скидки" },
  { value: "veteran", label: "УБД −20%" },
  { value: "birthday", label: "ДР −50%" },
  { value: "group", label: "Группа −10%" },
  { value: "manual", label: "Вручную" },
];
const DISCOUNT_LABEL = Object.fromEntries(DISCOUNT_OPTIONS.map(o => [o.value, o.label]));
const DISCOUNT_PRESETS = { veteran: 20, birthday: 50, group: 10, "": 0 };
const computeFinalPrice = (price, pct) => {
  const base = parseFloat(price);
  if (isNaN(base) || base <= 0) return "";
  return Math.round(base * (1 - (pct || 0) / 100) / 10) * 10;
};

const formatConflictTime = (dateStr) => {
  if (!dateStr) return null;
  try { return new Date(dateStr).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return null; }
};

const formatDate = (dateString) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
};

const STATUS_LABELS = {
  booked: "Забронирован", active: "Активен", completed: "Завершён",
  cancelled: "Отменён", no_show: "Не явился", overdue: "Просрочен",
};
const STATUS_COLORS = {
  booked: "status-badge status-badge-blue", active: "status-badge status-badge-green",
  completed: "status-badge", cancelled: "status-badge status-badge-orange",
  no_show: "status-badge status-badge-red", overdue: "status-badge status-badge-red",
};
const ITEM_STATUS_LABELS = {
  returned: "Возвращено", overdue: "Просрочено",
  lost: "Утеряно", stolen: "Украдено",
};
const DEPOSIT_LABELS = { none: "Без залога", money: "Денежный", document: "Документ" };

const RentalViewModal = ({ rental: initialRental, onClose, onUpdate }) => {
  const [rental, setRental] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const mouseDownOnOverlay = useRef(false);

  const [completionForm, setCompletionForm] = useState({ total_price: "", received_by: "", notes_return: "" });
  const [confirmProps, showConfirm] = useConfirm();

  const [returningItemId, setReturningItemId] = useState(null);
  const [returningItem, setReturningItem] = useState(null);
  const [returnForm, setReturnForm] = useState({ actual_end: "", paid_amount: "", condition_after: "", received_by: "", notes: "", quantity_return: "" });
  const [returnCalcPrice, setReturnCalcPrice] = useState(null);
  const [returnCalcLoading, setReturnCalcLoading] = useState(false);

  const [swappingItemId, setSwappingItemId] = useState(null);
  const [swapBikes, setSwapBikes] = useState([]);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapBikeId, setSwapBikeId] = useState("");
  const [oldBikeStatus, setOldBikeStatus] = useState("в ремонте");
  const [swapSearch, setSwapSearch] = useState("");
  const [swapFilterTariffs, setSwapFilterTariffs] = useState([]);
  const [swapFilterWheels, setSwapFilterWheels] = useState([]);
  const [swapFilterHeight, setSwapFilterHeight] = useState("");
  const [swapFocusedIdx, setSwapFocusedIdx] = useState(-1);
  const [swapPopoverKey, setSwapPopoverKey] = useState(null);
  const swapTariffRef    = useRef(null);
  const swapWheelRef     = useRef(null);
  const swapOldStatusRef = useRef(null);
  const swapSearchRef    = useRef(null);
  const swapGridRef      = useRef(null);

  const [liveItemPrices, setLiveItemPrices] = useState({});
  const [notesIssue, setNotesIssue] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  const [itemDiscounts, setItemDiscounts] = useState({});
  const [discountPopoverItemId, setDiscountPopoverItemId] = useState(null);
  const discountAnchorRefs = useRef({});
  const receivedByAnchorRef = useRef(null);
  const [showReceivedByPopover, setShowReceivedByPopover] = useState(false);
  const returnFormRef = useRef(null);
  const completionReceivedByRef = useRef(null);
  const [showCompletionReceivedByPopover, setShowCompletionReceivedByPopover] = useState(false);

  const getItemDiscount = (item) => itemDiscounts[item.id] !== undefined
    ? itemDiscounts[item.id]
    : { discount_type: item.discount_type || "", discount_percent: item.discount_percent || 0 };

  useEffect(() => {
    loadRental();
    fetch("/api/users").then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  useEffect(() => {
    if (!rental?.items) return;
    const activeItems = rental.items.filter(i => i.status === "active" && i.tariff_id);
    if (activeItems.length === 0) return;
    const now = new Date().toISOString();
    Promise.all(activeItems.map(async item => {
      const start = item.actual_start || rental.actual_start || rental.booked_start;
      if (!start) return null;
      try {
        const res = await fetch("/api/calculate/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tariff_id: item.tariff_id, start_time: start, end_time: now }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return { id: item.id, price: data.price };
      } catch { return null; }
    })).then(results => {
      const map = {};
      results.forEach(r => { if (r) map[r.id] = r.price; });
      setLiveItemPrices(map);
    });
  }, [rental]);

  const loadRental = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rentals/${initialRental.id}`);
      if (!res.ok) throw new Error("Не удалось загрузить договор");
      const data = await res.json();
      setRental(data);
      setNotesIssue(data.notes_issue || "");
      setCompletionForm(prev => ({ ...prev, total_price: data.total_price || "" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status, extra = {}) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/rentals/${rental.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка при смене статуса");
      }
      onUpdate();
      await loadRental();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (itemPayments = []) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/rentals/${rental.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "completed",
          received_by: completionForm.received_by ? parseInt(completionForm.received_by) : null,
          notes_return: completionForm.notes_return || null,
          total_price: completionForm.total_price !== "" ? parseFloat(completionForm.total_price) : null,
          active_item_payments: itemPayments,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка при завершении");
      }
      onUpdate();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      await fetch(`/api/rentals/${rental.id}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes_issue: notesIssue || null }),
      });
      setRental(prev => ({ ...prev, notes_issue: notesIssue || null }));
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setNotesSaving(false);
    }
  };

  const openSwap = async (item) => {
    setSwappingItemId(item.id);
    setSwapBikeId("");
    setOldBikeStatus("в ремонте");
    setSwapSearch("");
    setSwapFilterTariffs([]);
    setSwapFilterWheels([]);
    setSwapFilterHeight("");
    setSwapFocusedIdx(-1);
    setSwapPopoverKey(null);
    setReturningItemId(null);
    setSwapLoading(true);
    try {
      const start = rental.actual_start || rental.booked_start || "";
      const end = rental.booked_end || "";
      const res = await fetch(`/api/bikes/for-rental?start=${start}&end=${end}&exclude_contract_id=${rental.id}`);
      const data = await res.json();
      setSwapBikes((Array.isArray(data) ? data : []).filter(b => String(b.id) !== String(item.bike_id)));
    } catch {
      setSwapBikes([]);
    } finally {
      setSwapLoading(false);
    }
  };

  const calcReturnPrice = async (item, endTimeIso, discountPct = 0) => {
    if (!item?.tariff_id || !item?.actual_start || !endTimeIso) {
      setReturnCalcPrice(null);
      return;
    }
    setReturnCalcLoading(true);
    try {
      const res = await fetch("/api/calculate/price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tariff_id: item.tariff_id, start_time: item.actual_start, end_time: endTimeIso }),
      });
      const data = await res.json();
      const basePrice = data.price ?? null;
      setReturnCalcPrice(basePrice);
      if (basePrice !== null) {
        const final = computeFinalPrice(basePrice, discountPct) || basePrice;
        setReturnForm(prev => ({ ...prev, paid_amount: String(final) }));
      }
    } catch {
      setReturnCalcPrice(null);
    } finally {
      setReturnCalcLoading(false);
    }
  };

  const handleSwap = async (itemId) => {
    if (!swapBikeId) { toast.warn("Выберите велосипед для замены"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/rentals/${rental.id}/items/${itemId}/swap`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_bike_id: parseInt(swapBikeId), old_bike_status: oldBikeStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка при замене");
      }
      setSwappingItemId(null);
      toast.success("Велосипед заменён");
      onUpdate();
      await loadRental();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleItemReturn = async (itemId, withPayment = false) => {
    setSaving(true);
    const localDisc = itemDiscounts[itemId];
    try {
      const res = await fetch(`/api/rentals/${rental.id}/items/${itemId}/return`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          received_by: returnForm.received_by ? parseInt(returnForm.received_by) : null,
          condition_after: returnForm.condition_after || null,
          notes: returnForm.notes || null,
          actual_end: returnForm.actual_end ? new Date(returnForm.actual_end).toISOString() : null,
          paid_amount: withPayment && returnForm.paid_amount ? parseFloat(returnForm.paid_amount) : null,
          quantity_return: returnForm.quantity_return ? parseInt(returnForm.quantity_return) : null,
          discount_type: localDisc?.discount_type,
          discount_percent: localDisc?.discount_percent,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка при возврате позиции");
      }
      setReturningItemId(null);
      setReturningItem(null);
      setReturnForm({ actual_end: "", paid_amount: "", condition_after: "", received_by: "", notes: "", quantity_return: "" });
      setReturnCalcPrice(null);
      setShowReceivedByPopover(false);
      toast.success("Позиция возвращена");
      onUpdate();
      await loadRental();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }} onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}>
        <div className="modal-content" onClick={e => e.stopPropagation()}
          style={{ maxWidth: 920, minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#6b7280" }}>Загрузка договора...</div>
        </div>
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="modal-overlay" onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }} onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 920 }}>
          <div className="modal-header"><h2>Ошибка</h2><button className="modal-close" onClick={onClose}>✕</button></div>
          <div className="modal-body"><div className="error-message">{error || "Договор не найден"}</div></div>
        </div>
      </div>
    );
  }

  const canActivate   = rental.status === "booked";
  const canComplete   = rental.status === "active" || rental.status === "overdue";
  const canCancel     = rental.status === "booked";
  const canNoShow     = rental.status === "booked";

  const isActive      = rental.status === "active" || rental.status === "overdue";

  const activeItems = rental.items?.filter(i => i.status === "active") || [];

  return (
    <>
    <div className="modal-overlay" onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }} onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 920 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0 }}>Договор #{rental.id}</h2>
            <span className={STATUS_COLORS[rental.status] || "status-badge"}>
              {STATUS_LABELS[rental.status] || rental.status}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="modal-form">

            {/* Клиент + оплата + залог */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {/* Клиент */}
              <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Клиент</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {rental.last_name} {rental.first_name} {rental.middle_name || ""}
                </div>
                <div style={{ color: "#6b7280", fontSize: 13, marginTop: 2 }}>{rental.phone}</div>
                {rental.no_show_count > 0 && (
                  <div style={{ color: "var(--color-primary-orange)", fontSize: 12, marginTop: 4, fontWeight: 500 }}>
                    ⚠ Неявок: {rental.no_show_count}
                  </div>
                )}
              </div>

              {/* Оплата */}
              <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Оплата</div>
                {rental.prepayment_amount > 0 ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>✓ Оплачено при старте</span>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginTop: 2 }}>
                      {Math.round(rental.prepayment_amount)} ₴
                    </div>
                    {rental.booked_start && rental.booked_end && (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>
                        Период: {formatDate(rental.booked_start).slice(0, -5)} → {formatDate(rental.booked_end).slice(-5)}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    <span style={{ fontSize: 15 }}>⏳</span> Оплата при возврате
                  </div>
                )}
                {rental.total_price > 0 && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #e5e7eb", fontSize: 12, color: "#374151" }}>
                    Итого (факт): <b>{Math.round(rental.total_price)} ₴</b>
                  </div>
                )}
              </div>

              {/* Залог */}
              <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Залог</div>
                <div style={{ fontWeight: 500, color: rental.deposit_type === "none" ? "#9ca3af" : "#111827", fontSize: 13 }}>
                  {DEPOSIT_LABELS[rental.deposit_type] || "—"}
                </div>
                {rental.deposit_type === "money" && rental.deposit_amount > 0 && (
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginTop: 2 }}>
                    {Math.round(rental.deposit_amount)} ₴
                  </div>
                )}
                {rental.deposit_value && rental.deposit_type !== "none" && rental.deposit_type !== "money" && (
                  <div style={{ color: "#374151", fontSize: 13, marginTop: 2 }}>{rental.deposit_value}</div>
                )}
                {rental.deposit_type !== "none" && (
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 500, color: rental.deposit_returned ? "#059669" : "#9ca3af" }}>
                    {rental.deposit_returned
                      ? `✓ Возвращён${rental.deposit_returned_at ? " " + formatDate(rental.deposit_returned_at).slice(0, 10) : ""}`
                      : "· Не возвращён"}
                  </div>
                )}
              </div>
            </div>

            {/* Заметки */}
            <div style={{ marginBottom: 16, padding: "10px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Заметки</div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <textarea
                  value={notesIssue}
                  onChange={e => setNotesIssue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveNotes(); }}
                  placeholder="Клиент позвонил, опаздывает... (Ctrl+Enter для сохранения)"
                  rows={2}
                  style={{ flex: 1, resize: "vertical", fontSize: 13, padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontFamily: "inherit", outline: "none", lineHeight: 1.5 }}
                  onFocus={e => e.target.style.borderColor = "var(--color-primary-green)"}
                  onBlur={e => e.target.style.borderColor = "#d1d5db"}
                />
                {notesIssue !== (rental.notes_issue || "") && (
                  <button type="button" className="btn btn-primary-green btn-primary-small"
                    onClick={handleSaveNotes} disabled={notesSaving}
                    style={{ flexShrink: 0, alignSelf: "flex-end" }}>
                    {notesSaving ? "..." : "Сохранить"}
                  </button>
                )}
              </div>
            </div>

            {/* Даты */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 20, padding: "12px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
              {[
                ["Начало (план)", rental.booked_start],
                ["Конец (план)", rental.booked_end],
                ["Начало (факт)", rental.actual_start],
                ["Конец (факт)", rental.actual_end],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3, fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: value ? 500 : 400, color: value ? "#111827" : "#d1d5db" }}>
                    {formatDate(value)}
                  </div>
                </div>
              ))}
            </div>

            {/* Кто выдал / принял */}
            {(rental.issued_by_name || rental.received_by_name) && (
              <div style={{ display: "flex", gap: 24, marginBottom: 16, fontSize: 14, color: "#6b7280" }}>
                {rental.issued_by_name && <span>Выдал: <b style={{ color: "#374151" }}>{rental.issued_by_name}</b></span>}
                {rental.received_by_name && <span>Принял: <b style={{ color: "#374151" }}>{rental.received_by_name}</b></span>}
              </div>
            )}

            {/* Заметки при возврате */}
            {rental.notes_return && (
              <div style={{ marginBottom: 12, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, fontSize: 14 }}>
                <span style={{ fontWeight: 600, color: "#166534" }}>Заметки при возврате: </span>{rental.notes_return}
              </div>
            )}

            {/* Позиции */}
            <div style={{ marginBottom: 20 }}>
              {/* Заголовок с бейджами */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px" }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Позиции договора</h3>
                {rental.items?.length > 0 && (() => {
                  const scootCount = rental.items.filter(i => i.item_type === "bike" && i.bike_model?.toLowerCase().includes("самокат")).length;
                  const bikeCount  = rental.items.filter(i => i.item_type === "bike").length - scootCount;
                  const eqCount    = rental.items.filter(i => i.item_type === "equipment").length;
                  return (
                    <>
                      {bikeCount  > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>🚲 {bikeCount}</span>}
                      {scootCount > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>🛴 {scootCount}</span>}
                      {eqCount    > 0 && <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#e0f2fe", color: "#0369a1", fontWeight: 600 }}>🔦 {eqCount}</span>}
                    </>
                  );
                })()}
                {activeItems.length > 0 && isActive && (
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-primary-green)", fontWeight: 500 }}>
                    активных: {activeItems.length}
                  </span>
                )}
              </div>

              {(!rental.items || rental.items.length === 0) && (
                <div style={{ color: "#9ca3af", textAlign: "center", padding: "16px 0", fontSize: 14 }}>Нет позиций</div>
              )}

              {rental.items?.map((item, idx) => {
                const isItemActive = item.status === "active";
                const isBike = item.item_type === "bike";
                const photo = item.photos?.urls?.length ? item.photos.urls[item.photos.main ?? 0] : null;
                const bikeIcon = item.bike_model?.toLowerCase().includes("самокат") ? "🛴" : "🚲";
                const localDiscount = getItemDiscount(item);
                const livePrice = isItemActive ? liveItemPrices[item.id] : null;
                const paidAmount = !isItemActive && item.paid_amount ? Math.round(parseFloat(item.paid_amount)) : null;
                const disc = localDiscount.discount_percent || 0;
                const basePrice = paidAmount != null
                  ? (disc > 0 ? Math.round(paidAmount / (1 - disc / 100) / 10) * 10 : paidAmount)
                  : (livePrice != null ? livePrice : (item.price || 0));
                const finalPrice = paidAmount != null ? paidAmount : (computeFinalPrice(basePrice, disc) || basePrice);
                const bookedPriceDiffers = livePrice != null && Math.round(livePrice) !== Math.round(item.price || 0);
                return (
                <div key={item.id} style={{ marginBottom: 4 }}>
                  <div style={{
                    display: "flex", gap: 8, alignItems: "center", padding: "6px 10px",
                    background: "#f9fafb", border: "1px solid #e5e7eb",
                    borderRadius: (returningItemId === item.id || swappingItemId === item.id) ? "6px 6px 0 0" : 6,
                    opacity: !isItemActive ? 0.72 : 1,
                  }}>
                    {/* Номер */}
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", width: 18, textAlign: "center", flexShrink: 0 }}>{idx + 1}</span>

                    {/* Фото / иконка + название */}
                    {isBike ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        {photo
                          ? <img src={photo} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                          : <div style={{ width: 36, height: 36, background: "#e5e7eb", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{bikeIcon}</div>
                        }
                        <div style={{ fontSize: 12, lineHeight: 1.4, minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                            {item.internal_article && <span style={{ fontWeight: 700 }}>{item.internal_article}</span>}
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.bike_model || "Велосипед"}</span>
                          </div>
                          <div style={{ color: "#6b7280", fontSize: 11 }}>
                            {[item.bike_wheel_size ? `${item.bike_wheel_size}"` : null, item.frame_size || null].filter(Boolean).join(" · ")}
                            {!isItemActive && item.condition_after && <span style={{ marginLeft: 6 }}>· {item.condition_after}</span>}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 36, height: 36, background: "#e0f2fe", borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🔦</div>
                        <div style={{ fontSize: 12, lineHeight: 1.4, minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{item.equipment_model_name || item.equipment_name || "Оборудование"}</div>
                        </div>
                      </div>
                    )}

                    {/* Тариф */}
                    <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 10, flexShrink: 0, background: item.tariff_name ? "#dcfce7" : "transparent", color: "#15803d", fontWeight: 600, width: 100, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                      {item.tariff_name || ""}
                    </span>

                    {/* Кол-во */}
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                      {isBike
                        ? <span style={{ width: 36, textAlign: "center", display: "inline-block", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 4px", background: "#f9fafb", fontSize: 12, color: "#9ca3af", lineHeight: "normal" }}>1</span>
                        : <span style={{ width: 36, textAlign: "center", display: "inline-block", boxSizing: "border-box", border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 4px", fontSize: 12, color: "#374151", lineHeight: "normal" }}>{item.quantity || 1}</span>
                      }
                      <span style={{ fontSize: 11, color: "#6b7280" }}>×</span>
                    </div>

                    {/* Базовая цена — только для активных */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, gap: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input className="form-input" type="number" value={isItemActive && basePrice ? Math.round(basePrice) : ""} disabled
                          style={{ width: 55, fontSize: 12, padding: "8px 8px", background: "#f3f4f6", color: "#6b7280", cursor: "default" }} />
                        <span style={{ fontSize: 11, color: "#6b7280" }}>₴</span>
                      </div>
                      {bookedPriceDiffers && (
                        <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap" }}>
                          по брони: {Math.round(item.price)} ₴
                        </span>
                      )}
                    </div>

                    {/* Скидка — попов для активных, лейбл для остальных */}
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                      {isItemActive ? (
                        <>
                          <button type="button"
                            ref={(el) => { discountAnchorRefs.current[item.id] = { current: el }; }}
                            className="filter-select-box"
                            style={{ fontSize: 11, minWidth: 100, background: localDiscount.discount_percent > 0 ? "#f0fdf4" : undefined, color: localDiscount.discount_percent > 0 ? "var(--color-primary-green)" : undefined }}
                            onClick={() => setDiscountPopoverItemId(prev => prev === item.id ? null : item.id)}>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {DISCOUNT_LABEL[localDiscount.discount_type || ""] ?? "Скидка"}
                            </span>
                            <span className="arrow">▼</span>
                          </button>
                          {discountPopoverItemId === item.id && (
                            <MultiSelectPopover singleSelect
                              options={DISCOUNT_OPTIONS}
                              selected={[localDiscount.discount_type || ""]}
                              onChange={(vals) => {
                                const dt = vals[0] || "";
                                const pct = DISCOUNT_PRESETS[dt] ?? (dt === "manual" ? localDiscount.discount_percent : 0);
                                setItemDiscounts(prev => ({ ...prev, [item.id]: { discount_type: dt, discount_percent: pct } }));
                                setDiscountPopoverItemId(null);
                              }}
                              visible={true}
                              anchorRef={discountAnchorRefs.current[item.id] || { current: null }}
                              onClose={() => setDiscountPopoverItemId(null)} />
                          )}
                          {localDiscount.discount_type === "manual" && (
                            <input type="number" min="0" max="100" value={localDiscount.discount_percent}
                              onChange={e => setItemDiscounts(prev => ({ ...prev, [item.id]: { ...prev[item.id], discount_percent: parseFloat(e.target.value) || 0 } }))}
                              style={{ width: 38, fontSize: 11, padding: "8px 4px", textAlign: "center", border: "1px solid #d1d5db", borderRadius: 4 }} />
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: 11, minWidth: 100, padding: "0 4px", color: localDiscount.discount_percent > 0 ? "var(--color-primary-green)" : "#9ca3af" }}>
                          {DISCOUNT_LABEL[localDiscount.discount_type || ""] || "Без скидки"}
                        </span>
                      )}
                    </div>

                    {/* Итоговая цена */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <input className="form-input" type="number" value={finalPrice ? Math.round(finalPrice) : ""} disabled
                        style={{ width: 60, fontSize: 12, padding: "8px 8px", background: "#f3f4f6", color: "#374151", cursor: "default", fontWeight: 600 }} />
                      <span style={{ fontSize: 11, color: "#6b7280" }}>₴</span>
                    </div>

                    {/* Действия */}
                    {isItemActive && isBike && (isActive || canActivate) && (
                      <button type="button" title="Заменить велосипед"
                        onClick={() => swappingItemId === item.id ? setSwappingItemId(null) : openSwap(item)}
                        style={{ width: 28, height: 28, flexShrink: 0, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 6, cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                        🔄
                      </button>
                    )}
                    {isItemActive && isActive && (
                      <button type="button" title="Вернуть"
                        onClick={() => {
                          if (returningItemId === item.id) {
                            setReturningItemId(null);
                            setReturningItem(null);
                            setReturnCalcPrice(null);
                          } else {
                            setReturningItemId(item.id);
                            setReturningItem(item);
                            setSwappingItemId(null);
                            setShowReceivedByPopover(false);
                            const now = new Date();
                            now.setSeconds(0, 0);
                            const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                            const disc = getItemDiscount(item);
                            const liveBase = liveItemPrices[item.id] ?? item.price;
                            const prefill = computeFinalPrice(liveBase, disc.discount_percent) || liveBase || "";
                            setReturnForm({ actual_end: localIso, paid_amount: String(prefill), condition_after: "", received_by: "", notes: "", quantity_return: "" });
                            setReturnCalcPrice(null);
                            calcReturnPrice(item, now.toISOString(), disc.discount_percent);
                            setTimeout(() => returnFormRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
                          }
                        }}
                        style={{ width: 28, height: 28, flexShrink: 0, background: returningItemId === item.id ? "var(--color-primary-green)" : "white", color: returningItemId === item.id ? "white" : "var(--color-primary-green)", border: "1px solid var(--color-primary-green)", borderRadius: 6, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                        ↩
                      </button>
                    )}
                    {!isItemActive && (
                      <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, minWidth: 60, textAlign: "right" }}>
                        {ITEM_STATUS_LABELS[item.status] || item.status}
                      </span>
                    )}
                  </div>

                  {/* Форма замены велосипеда */}
                  {swappingItemId === item.id && (() => {
                    const swapHeightRec = heightToFrameRec(swapFilterHeight);

                    const filteredSwap = swapBikes
                      .filter(b => {
                        if (swapFilterTariffs.length > 0 && !swapFilterTariffs.includes(b.tariff_name)) return false;
                        if (swapFilterWheels.length > 0 && !swapFilterWheels.includes(String(b.wheel_size))) return false;
                        if (swapHeightRec) {
                          const ok = swapHeightRec.perfect.includes(b.frame_size) || swapHeightRec.acceptable.includes(b.frame_size);
                          if (!ok) return false;
                        }
                        if (swapSearch.length >= 2) {
                          const q = swapSearch.toLowerCase();
                          if (!(b.internal_article || "").toLowerCase().includes(q) && !(b.model || "").toLowerCase().includes(q)) return false;
                        }
                        return true;
                      })
                      .map(b => ({
                        ...b,
                        _heightMatch: swapHeightRec
                          ? (swapHeightRec.perfect.includes(b.frame_size) ? "perfect" : "acceptable")
                          : null,
                      }))
                      // Сортировка только по росту (как в ActiveRentalModal) — основной порядок от API
                      .sort((a, b) => {
                        if (!swapHeightRec) return 0;
                        return (a._heightMatch === "perfect" ? 0 : 1) - (b._heightMatch === "perfect" ? 0 : 1);
                      });

                    const getBikeIcon = (b) => b?.model?.toLowerCase().includes("самокат") ? "🛴" : "🚲";

                    return (
                      <div style={{ padding: "12px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderTop: "none", borderRadius: "0 0 6px 6px" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", marginBottom: 10 }}>🔄 Замена велосипеда</div>

                        {/* Фильтры */}
                        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <button type="button" ref={swapTariffRef}
                            onClick={() => setSwapPopoverKey(prev => prev === "tariff" ? null : "tariff")}
                            className="filter-select-box" style={{ minWidth: 140 }}>
                            {swapFilterTariffs.length > 0 ? swapFilterTariffs.join(", ") : "Все типы"}
                            <span className="arrow">▼</span>
                          </button>
                          <button type="button" ref={swapWheelRef}
                            onClick={() => setSwapPopoverKey(prev => prev === "wheel" ? null : "wheel")}
                            className="filter-select-box" style={{ minWidth: 130 }}>
                            {swapFilterWheels.length > 0 ? swapFilterWheels.map(w => `${w}"`).join(", ") : "Все колёса"}
                            <span className="arrow">▼</span>
                          </button>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input className="form-input" type="number" placeholder="Рост см" value={swapFilterHeight}
                              onChange={e => setSwapFilterHeight(e.target.value)} style={{ width: 90, fontSize: 13 }} />
                            {swapHeightRec && <span style={{ fontSize: 11, color: "#059669", whiteSpace: "nowrap" }}>→ {swapHeightRec.label}</span>}
                          </div>
                          <input ref={swapSearchRef} className="form-input" placeholder="Поиск велосипедов / оборудования" value={swapSearch}
                            onChange={e => { setSwapSearch(e.target.value); setSwapFocusedIdx(-1); }}
                            onFocus={() => setSwapFocusedIdx(-1)}
                            style={{ width: 240, fontSize: 13 }} />
                          {(swapFilterTariffs.length > 0 || swapFilterWheels.length > 0 || swapFilterHeight || swapSearch) && (
                            <button type="button" className="btn-reset-filters"
                              onClick={() => { setSwapFilterTariffs([]); setSwapFilterWheels([]); setSwapFilterHeight(""); setSwapSearch(""); setSwapFocusedIdx(-1); }}
                              title="Сбросить фильтры">🔄</button>
                          )}
                        </div>

                        {/* Сетка велосипедов */}
                        {swapLoading ? (
                          <div style={{ color: "#6b7280", fontSize: 13, padding: "12px 0" }}>Загрузка...</div>
                        ) : filteredSwap.length === 0 ? (
                          <div style={{ color: "#9ca3af", fontSize: 13, padding: "12px 0" }}>Нет велосипедов с такими параметрами</div>
                        ) : (
                          <div ref={swapGridRef} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8, maxHeight: 340, overflowY: "auto", marginBottom: 10 }}>
                            {filteredSwap.map((b, bIdx) => {
                              const isSelected    = String(swapBikeId) === String(b.id);
                              const isFocused     = bIdx === swapFocusedIdx;
                              const isRental      = b.condition_status === "в прокате";
                              const isRepairSt    = b.condition_status === "в ремонте";
                              const isUnavail     = !b.is_available || isRental || isRepairSt;
                              const conflictEnd   = b.conflict_info?.booked_end ? formatConflictTime(b.conflict_info.booked_end) : null;
                              const photo         = b.photos?.urls?.length ? b.photos.urls[b.photos.main ?? 0] : null;
                              let bgColor = "white", borderColor = "#e5e7eb", statusText = null, statusColor = "#6b7280";
                              if (isSelected)    { bgColor = "#f0fdf4"; borderColor = "#10b981"; statusText = "✓ выбран"; statusColor = "#059669"; }
                              else if (isRental) { bgColor = "#fef2f2"; borderColor = "#fca5a5"; statusText = conflictEnd ? `в прокате до ${conflictEnd}` : "в прокате"; statusColor = "#ef4444"; }
                              else if (isRepairSt){ bgColor = "#f9fafb"; borderColor = "#d1d5db"; statusText = "в ремонте"; statusColor = "#9ca3af"; }
                              else if (isUnavail){ bgColor = "#fffbeb"; borderColor = "#fcd34d"; statusText = conflictEnd ? `занят до ${conflictEnd}` : "занят"; statusColor = "#d97706"; }
                              return (
                                <div key={b.id}
                                  tabIndex={-1}
                                  className="grid-card-item"
                                  onClick={() => {
                                    setSwapFocusedIdx(bIdx);
                                    if (isUnavail) {
                                      toast.warn(statusText || "Велосипед недоступен");
                                      return;
                                    }
                                    setSwapBikeId(String(b.id));
                                  }}
                                  style={{
                                    border: `2px solid ${isFocused ? "var(--color-focus-ring)" : borderColor}`,
                                    borderRadius: 8, padding: "7px 9px", background: bgColor,
                                    cursor: isUnavail ? "not-allowed" : "pointer",
                                    display: "flex", flexDirection: "column", gap: 4,
                                    transition: "border-color 0.25s, box-shadow 0.15s",
                                    opacity: isUnavail ? 0.72 : 1,
                                  }}
                                  onMouseEnter={e => { if (!isFocused && !isUnavail) e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)"; }}
                                  onMouseLeave={e => { if (!isFocused) e.currentTarget.style.boxShadow = ""; }}
                                >
                                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    {photo
                                      ? <img src={photo} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                                      : <div style={{ width: 60, height: 60, background: "#e5e7eb", borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>{getBikeIcon(b)}</div>
                                    }
                                    <div style={{ minWidth: 0 }}>
                                      <div style={{ fontWeight: 700, fontSize: 12 }}>{b.internal_article || "—"}</div>
                                      <div style={{ fontSize: 11, color: "#4b5563", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.model}</div>
                                    </div>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 11, color: "#6b7280" }}>
                                      {[b.wheel_size ? `${b.wheel_size}"` : null, b.frame_size || null].filter(Boolean).join(" · ")}
                                    </span>
                                    {b.tariff_name && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 8, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>{b.tariff_name}</span>}
                                  </div>
                                  {b._heightMatch === "perfect"    && <div style={{ fontSize: 10, fontWeight: 600, color: "#059669" }}>🟢 идеально по росту</div>}
                                  {b._heightMatch === "acceptable" && <div style={{ fontSize: 10, fontWeight: 600, color: "#d97706" }}>🟡 допустимо по росту</div>}
                                  {statusText && <div style={{ fontSize: 11, fontWeight: 500, color: statusColor }}>{statusText}</div>}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Куда отправить старый + подтверждение */}
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <label style={{ fontSize: 12, color: "#374151", flexShrink: 0 }}>Старый велосипед →</label>
                          <button type="button" ref={swapOldStatusRef}
                            onClick={() => setSwapPopoverKey(prev => prev === "oldStatus" ? null : "oldStatus")}
                            className="filter-select-box" style={{ minWidth: 130 }}>
                            {oldBikeStatus === "в ремонте" ? "В ремонт" : "В наличие"}
                            <span className="arrow">▼</span>
                          </button>
                          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                            <button type="button" onClick={() => setSwappingItemId(null)}
                              style={{ padding: "6px 12px", background: "none", border: "1px solid #e5e7eb", borderRadius: 4, cursor: "pointer", color: "#6b7280", fontSize: 13 }}>
                              Отмена
                            </button>
                            <button type="button"
                              onClick={() => handleSwap(item.id)} disabled={saving || !swapBikeId}
                              style={{ padding: "6px 16px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500, fontSize: 13, opacity: !swapBikeId ? 0.5 : 1 }}>
                              {saving ? "..." : "Подтвердить"}
                            </button>
                          </div>
                        </div>

                        {/* Поповеры фильтров */}
                        {swapPopoverKey && (
                          <MultiSelectPopover
                            options={swapPopoverKey === "tariff"
                              ? [...new Set(swapBikes.map(b => b.tariff_name).filter(Boolean))].map(v => ({ value: v, label: v }))
                              : swapPopoverKey === "wheel"
                              ? [...new Set(swapBikes.map(b => b.wheel_size).filter(Boolean))].sort((a, b) => parseFloat(a) - parseFloat(b)).map(v => ({ value: String(v), label: `${v}"` }))
                              : [{ value: "в ремонте", label: "В ремонт" }, { value: "в наличии", label: "В наличие" }]
                            }
                            selected={swapPopoverKey === "tariff" ? swapFilterTariffs : swapPopoverKey === "wheel" ? swapFilterWheels : [oldBikeStatus]}
                            onChange={swapPopoverKey === "tariff" ? setSwapFilterTariffs : swapPopoverKey === "wheel" ? setSwapFilterWheels : (val) => setOldBikeStatus(val[0])}
                            singleSelect={swapPopoverKey === "oldStatus"}
                            visible={true}
                            anchorRef={swapPopoverKey === "tariff" ? swapTariffRef : swapPopoverKey === "wheel" ? swapWheelRef : swapOldStatusRef}
                            onClose={() => setSwapPopoverKey(null)}
                          />
                        )}
                      </div>
                    );
                  })()}

                  {/* Форма возврата позиции */}
                  {returningItemId === item.id && (
                    <div ref={returnFormRef} style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderTop: "none", borderRadius: "0 0 6px 6px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: 12 }}>Время возврата</label>
                          <DateTimePickerField value={returnForm.actual_end}
                            onChange={v => {
                              setReturnForm(p => ({ ...p, actual_end: v }));
                              if (v) calcReturnPrice(returningItem, new Date(v).toISOString(), getItemDiscount(returningItem).discount_percent);
                            }} />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: 12 }}>Состояние</label>
                          <input className="form-input" value={returnForm.condition_after}
                            onChange={e => setReturnForm(p => ({ ...p, condition_after: e.target.value }))}
                            placeholder="Хорошее, царапины..." />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label style={{ fontSize: 12 }}>Принял</label>
                          <button type="button" ref={receivedByAnchorRef}
                            onClick={() => setShowReceivedByPopover(p => !p)}
                            className="filter-select-box">
                            {returnForm.received_by
                              ? (users.find(u => String(u.id) === String(returnForm.received_by))?.name || "Выбрать")
                              : "— Не указан —"}
                            <span className="arrow">▼</span>
                          </button>
                          {showReceivedByPopover && (
                            <MultiSelectPopover singleSelect
                              options={[{ value: "", label: "— Не указан —" }, ...users.map(u => ({ value: String(u.id), label: u.name }))]}
                              selected={[String(returnForm.received_by || "")]}
                              onChange={(vals) => { setReturnForm(p => ({ ...p, received_by: vals[0] || "" })); setShowReceivedByPopover(false); }}
                              visible={true}
                              anchorRef={receivedByAnchorRef}
                              onClose={() => setShowReceivedByPopover(false)} />
                          )}
                        </div>
                        {item.item_type === "equipment" && (item.quantity || 1) > 1 && (
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: 12 }}>Кол-во возврата (из {item.quantity})</label>
                            <input type="number" className="form-input" min="1" max={item.quantity}
                              value={returnForm.quantity_return || item.quantity}
                              onChange={e => setReturnForm(p => ({ ...p, quantity_return: e.target.value }))} />
                          </div>
                        )}
                      </div>
                      <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                        <span style={{ color: "#6b7280" }}>К оплате:</span>
                        {returnCalcLoading
                          ? <span style={{ color: "#9ca3af" }}>считаем...</span>
                          : <>
                              <input type="number" min="0"
                                value={returnForm.paid_amount}
                                onChange={e => setReturnForm(p => ({ ...p, paid_amount: e.target.value }))}
                                style={{ width: 80, fontSize: 12, padding: "3px 8px", border: "1px solid #86efac", borderRadius: 4, background: "white" }} />
                              <span style={{ color: "#6b7280" }}>₴</span>
                              {returnCalcPrice !== null && <span style={{ color: "#9ca3af", fontSize: 11 }}>(рассчитано по тарифу)</span>}
                            </>
                        }
                      </div>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button type="button"
                          onClick={() => { setReturningItemId(null); setReturningItem(null); setReturnCalcPrice(null); setShowReceivedByPopover(false); }}
                          style={{ padding: "6px 12px", background: "none", border: "1px solid #e5e7eb", borderRadius: 4, cursor: "pointer", color: "#6b7280", fontSize: 13 }}>
                          Отмена
                        </button>
                        <button type="button" className="btn btn-secondary-green btn-primary-small"
                          onClick={() => handleItemReturn(item.id, false)} disabled={saving}>
                          {saving ? "..." : "Зафиксировать время"}
                        </button>
                        <button type="button" className="btn btn-primary-green btn-primary-small"
                          onClick={() => handleItemReturn(item.id, true)} disabled={saving || !returnForm.paid_amount}>
                          {saving ? "..." : `Принять оплату ${returnForm.paid_amount || "—"} ₴`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>


            {/* Расчёт — постоянный блок для активных/завершаемых/завершённых */}
            {(isActive || canComplete || rental.status === "completed") && rental.items?.length > 0 && (() => {
              const returnedItems = rental.items.filter(i => i.status !== "active");
              const stillActive   = rental.items.filter(i => i.status === "active");
              const alreadyPaid   = Math.round(returnedItems.reduce((s, i) => s + (parseFloat(i.paid_amount) || 0), 0));
              const activeTotal   = Math.round(stillActive.reduce((s, i) => {
                const lp   = liveItemPrices[i.id];
                const base = lp != null ? lp : (parseFloat(i.price) || 0);
                const disc = getItemDiscount(i);
                return s + (computeFinalPrice(base, disc.discount_percent) || base);
              }, 0));
              const totalBase = Math.round(
                returnedItems.reduce((s, i) => {
                  const disc = i.discount_percent || 0;
                  const paid = parseFloat(i.paid_amount) || 0;
                  return s + (disc > 0 ? Math.round(paid / (1 - disc / 100) / 10) * 10 : paid);
                }, 0) +
                stillActive.reduce((s, i) => {
                  const lp = liveItemPrices[i.id];
                  return s + (lp != null ? lp : (parseFloat(i.price) || 0));
                }, 0)
              );
              const grandTotal    = alreadyPaid + activeTotal;
              const totalDiscounts = totalBase - grandTotal;
              const prepayment    = Math.round(parseFloat(rental.prepayment_amount) || 0);
              const toPay         = Math.max(0, activeTotal - prepayment);

              return (
                <div style={{ marginBottom: 12, padding: "12px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ display: "inline-grid", gridTemplateColumns: "auto auto", gap: "4px 20px", alignItems: "baseline", fontSize: 13 }}>
                    <span style={{ color: "#374151" }}>Базовая цена</span>
                    <span style={{ textAlign: "right", fontWeight: 500 }}>{totalBase} ₴</span>
                    {totalDiscounts > 0 && (<>
                      <span style={{ color: "#374151" }}>Скидки</span>
                      <span style={{ textAlign: "right" }}>−{totalDiscounts} ₴</span>
                    </>)}
                    {prepayment > 0 && stillActive.length > 0 && (<>
                      <span style={{ color: "#374151" }}>Предоплата</span>
                      <span style={{ textAlign: "right" }}>−{prepayment} ₴</span>
                    </>)}
                    {alreadyPaid > 0 && (<>
                      <span style={{ color: "#374151" }}>Оплачено</span>
                      <span style={{ textAlign: "right" }}>−{alreadyPaid} ₴</span>
                    </>)}
                    <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #e5e7eb", margin: "4px 0" }} />
                    <span style={{ fontWeight: 700, color: "#111827" }}>Итого: {grandTotal} ₴</span>
                    <span style={{ textAlign: "right", fontWeight: 700, color: toPay > 0 ? "#111827" : "#059669" }}>
                      {toPay > 0 ? `к доплате: ${toPay} ₴` : "✓ оплачено"}
                    </span>
                  </div>
                  </div>
                </div>
              );
            })()}

            {/* Принял + Заметки при возврате — постоянные поля */}
            {(isActive || canComplete) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div className="form-group" style={{ position: "relative", marginBottom: 0 }}>
                  <label style={{ fontSize: 12 }}>Принял</label>
                  <button ref={completionReceivedByRef} type="button" className="filter-select-box"
                    style={{ width: "100%" }}
                    onClick={() => setShowCompletionReceivedByPopover(p => !p)}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {users.find(u => String(u.id) === String(completionForm.received_by))?.name || "— Не указан —"}
                    </span>
                    <span className="arrow">▼</span>
                  </button>
                  {showCompletionReceivedByPopover && (
                    <MultiSelectPopover singleSelect
                      options={[{ value: "", label: "— Не указан —" }, ...users.map(u => ({ value: String(u.id), label: u.name }))]}
                      selected={[String(completionForm.received_by || "")]}
                      onChange={vals => { setCompletionForm(p => ({ ...p, received_by: vals[0] || "" })); setShowCompletionReceivedByPopover(false); }}
                      visible={true} anchorRef={completionReceivedByRef}
                      onClose={() => setShowCompletionReceivedByPopover(false)} />
                  )}
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 12 }}>Заметки при возврате</label>
                  <input className="form-input" value={completionForm.notes_return}
                    onChange={e => setCompletionForm(p => ({ ...p, notes_return: e.target.value }))}
                    placeholder="Замечания, претензии..." />
                </div>
              </div>
            )}

            {error && <div className="error-message">{error}</div>}
          </div>
        </div>

        {/* Футер с кнопками действий */}
        <div className="modal-footer" style={{ justifyContent: "space-between" }}>
          <button type="button" className="btn btn-secondary-green btn-primary-small" onClick={onClose}>
            Закрыть
          </button>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canNoShow && (
              <button type="button" className="btn btn-primary-small"
                style={{ background: "var(--color-primary-orange)", color: "white", border: "none", borderRadius: 6, cursor: "pointer", padding: "6px 14px", fontSize: "0.875rem", fontWeight: 500 }}
                onClick={() => showConfirm({ title: "Не явился", message: "Отметить клиента как «Не явился»? Счётчик неявок увеличится.", confirmLabel: "Отметить", danger: true, onConfirm: () => handleStatusChange("no_show") })}
                disabled={saving}>
                Не явился
              </button>
            )}
            {canCancel && (
              <button type="button" className="btn btn-primary-small"
                style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", padding: "6px 14px", fontSize: "0.875rem", fontWeight: 500 }}
                onClick={() => showConfirm({ title: "Отменить договор?", message: "Договор будет отменён, велосипеды освободятся.", confirmLabel: "Отменить", danger: true, onConfirm: () => handleStatusChange("cancelled") })}
                disabled={saving}>
                Отменить
              </button>
            )}
            {canActivate && (
              <button type="button" className="btn btn-primary-green btn-primary-small"
                onClick={() => handleStatusChange("active")} disabled={saving}>
                {saving ? "..." : "▶ Активировать прокат"}
              </button>
            )}
            {canComplete && (() => {
              const returnedItems = rental.items?.filter(i => i.status !== "active") || [];
              const stillActive   = rental.items?.filter(i => i.status === "active") || [];
              const activeTotal   = Math.round(stillActive.reduce((s, i) => {
                const lp   = liveItemPrices[i.id];
                const base = lp != null ? lp : (parseFloat(i.price) || 0);
                const disc = getItemDiscount(i);
                return s + (computeFinalPrice(base, disc.discount_percent) || base);
              }, 0));
              const prepayment = Math.round(parseFloat(rental.prepayment_amount) || 0);
              const toPay = Math.max(0, activeTotal - prepayment);
              const label = toPay > 0 ? `Принять ${toPay} ₴ и завершить` : "Завершить прокат";
              return (
                <button type="button" className="btn btn-primary-green btn-primary-small"
                  disabled={saving}
                  onClick={() => {
                    showConfirm({
                      title: toPay > 0 ? `Принять ${toPay} ₴ и завершить?` : "Завершить прокат?",
                      message: toPay > 0 ? `Клиент доплачивает ${toPay} ₴. Прокат будет завершён.` : "Все позиции оплачены. Прокат будет завершён.",
                      confirmLabel: toPay > 0 ? `Принять ${toPay} ₴` : "Завершить",
                      onConfirm: () => {
                        const itemPayments = stillActive.map(item => {
                          const lp   = liveItemPrices[item.id];
                          const base = lp != null ? lp : (parseFloat(item.price) || 0);
                          const disc = getItemDiscount(item);
                          return { id: item.id, paid_amount: computeFinalPrice(base, disc.discount_percent) || base };
                        });
                        setCompletionForm(p => ({ ...p, total_price: String(toPay) }));
                        handleComplete(itemPayments);
                      },
                    });
                  }}>
                  {saving ? "..." : label}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
    {confirmProps && <ConfirmModal {...confirmProps} />}
    </>
  );
};

export default RentalViewModal;
