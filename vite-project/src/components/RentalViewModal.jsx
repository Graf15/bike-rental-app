import React, { useState, useEffect, useRef } from "react";
import "./Modal.css";

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
  active: "Активна", returned: "Возвращена", overdue: "Просрочена",
  lost: "Утеряна", stolen: "Украдена",
};
const DEPOSIT_LABELS = { none: "Без залога", money: "Денежный", document: "Документ" };

const RentalViewModal = ({ rental: initialRental, onClose, onUpdate }) => {
  const [rental, setRental] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const mouseDownOnOverlay = useRef(false);

  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [completionForm, setCompletionForm] = useState({ total_price: "", received_by: "", notes_return: "" });

  const [returningItemId, setReturningItemId] = useState(null);
  const [returnForm, setReturnForm] = useState({ received_by: "", condition_after: "", notes: "" });

  const [swappingItemId, setSwappingItemId] = useState(null);
  const [availableBikes, setAvailableBikes] = useState([]);
  const [swapBikeId, setSwapBikeId] = useState("");
  const [oldBikeStatus, setOldBikeStatus] = useState("в ремонте");

  useEffect(() => {
    loadRental();
    fetch("/api/users").then(r => r.json()).then(d => setUsers(Array.isArray(d) ? d : [])).catch(console.error);
  }, []);

  const loadRental = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rentals/${initialRental.id}`);
      if (!res.ok) throw new Error("Не удалось загрузить договор");
      const data = await res.json();
      setRental(data);
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

  const handleComplete = async () => {
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

  const openSwap = async (item) => {
    setSwappingItemId(item.id);
    setSwapBikeId("");
    setOldBikeStatus("в ремонте");
    setReturningItemId(null);
    try {
      const res = await fetch(`/api/bikes/for-rental?start=${rental.booked_start || ""}&end=${rental.booked_end || ""}`);
      const data = await res.json();
      // Исключаем текущий велосипед этой позиции
      setAvailableBikes((Array.isArray(data) ? data : []).filter(b =>
        String(b.id) !== String(item.bike_id) && b.is_available
      ));
    } catch {
      setAvailableBikes([]);
    }
  };

  const handleSwap = async (itemId) => {
    if (!swapBikeId) { setError("Выберите велосипед для замены"); return; }
    setSaving(true);
    setError(null);
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
      onUpdate();
      await loadRental();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleItemReturn = async (itemId) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/rentals/${rental.id}/items/${itemId}/return`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          received_by: returnForm.received_by ? parseInt(returnForm.received_by) : null,
          condition_after: returnForm.condition_after || null,
          notes: returnForm.notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Ошибка при возврате позиции");
      }
      setReturningItemId(null);
      setReturnForm({ received_by: "", condition_after: "", notes: "" });
      onUpdate();
      await loadRental();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }} onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}>
        <div className="modal-content" onClick={e => e.stopPropagation()}
          style={{ maxWidth: 860, minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ color: "#6b7280" }}>Загрузка договора...</div>
        </div>
      </div>
    );
  }

  if (!rental) {
    return (
      <div className="modal-overlay" onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }} onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 860 }}>
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
  const canMarkOverdue = rental.status === "active";
  const isActive      = rental.status === "active" || rental.status === "overdue";

  const activeItems = rental.items?.filter(i => i.status === "active") || [];

  return (
    <div className="modal-overlay" onMouseDown={(e) => { mouseDownOnOverlay.current = e.target === e.currentTarget; }} onMouseUp={(e) => { if (mouseDownOnOverlay.current && e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content" style={{ maxWidth: 860 }} onClick={e => e.stopPropagation()}>
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

            {/* Клиент + залог */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Клиент</div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>
                  {rental.last_name} {rental.first_name} {rental.middle_name || ""}
                </div>
                <div style={{ color: "#6b7280", marginTop: 2 }}>{rental.phone}</div>
                {rental.no_show_count > 0 && (
                  <div style={{ color: "var(--color-primary-orange)", fontSize: 13, marginTop: 4, fontWeight: 500 }}>
                    ⚠ Неявок: {rental.no_show_count}
                  </div>
                )}
              </div>
              <div style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 6, border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Залог</div>
                <div style={{ fontWeight: 500 }}>{DEPOSIT_LABELS[rental.deposit_type] || "—"}</div>
                {rental.deposit_value && <div style={{ color: "#374151", marginTop: 2 }}>{rental.deposit_value}</div>}
                {rental.deposit_type === "none" && <div style={{ color: "#9ca3af", fontSize: 13 }}>Без залога</div>}
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

            {/* Заметки */}
            {rental.notes_issue && (
              <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, fontSize: 14 }}>
                <span style={{ fontWeight: 600, color: "#92400e" }}>Заметки при выдаче: </span>{rental.notes_issue}
              </div>
            )}
            {rental.notes_return && (
              <div style={{ marginBottom: 12, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, fontSize: 14 }}>
                <span style={{ fontWeight: 600, color: "#166534" }}>Заметки при возврате: </span>{rental.notes_return}
              </div>
            )}

            {/* Позиции */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                Позиции ({rental.items?.length || 0})
                {activeItems.length > 0 && isActive && (
                  <span style={{ marginLeft: 8, color: "var(--color-primary-green)", fontWeight: 500 }}>
                    — активных: {activeItems.length}
                  </span>
                )}
              </div>

              {(!rental.items || rental.items.length === 0) && (
                <div style={{ color: "#9ca3af", textAlign: "center", padding: "16px 0", fontSize: 14 }}>Нет позиций</div>
              )}

              {rental.items?.map(item => (
                <div key={item.id} style={{ marginBottom: 8 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                    background: item.status === "returned" ? "#f9fafb" : "#f0fdf4",
                    border: `1px solid ${item.status === "returned" ? "#e5e7eb" : "#86efac"}`,
                    borderRadius: (returningItemId === item.id || swappingItemId === item.id) ? "6px 6px 0 0" : 6,
                    opacity: item.status !== "active" ? 0.7 : 1,
                  }}>
                    <span style={{ fontSize: 18 }}>{item.item_type === "bike" ? "🚲" : "⛑️"}</span>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500 }}>
                        {item.item_type === "bike"
                          ? `${item.bike_model || "Велосипед"}${item.internal_article ? ` (${item.internal_article})` : ""}`
                          : item.equipment_model_name || item.equipment_name || "Оборудование"}
                      </span>
                      {item.tariff_name && (
                        <span style={{ color: "#6b7280", fontSize: 13, marginLeft: 10 }}>{item.tariff_name}</span>
                      )}
                      {item.price && (
                        <span style={{ color: "#374151", fontSize: 13, marginLeft: 10, fontWeight: 600 }}>
                          {item.price} грн
                        </span>
                      )}
                      {item.condition_after && (
                        <span style={{ color: "#6b7280", fontSize: 12, marginLeft: 10 }}>
                          Состояние: {item.condition_after}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 500, padding: "3px 9px", borderRadius: 4, whiteSpace: "nowrap",
                      background: item.status === "active" ? "var(--color-primary-green-light-background)" : "#f3f4f6",
                      color: item.status === "active" ? "var(--color-primary-green)" : "#9ca3af",
                    }}>
                      {ITEM_STATUS_LABELS[item.status] || item.status}
                    </span>
                    {item.status === "active" && item.item_type === "bike" && (isActive || canActivate) && (
                      <button
                        type="button"
                        className="btn btn-primary-small"
                        onClick={() => swappingItemId === item.id ? setSwappingItemId(null) : openSwap(item)}
                        style={{ fontSize: 12, padding: "4px 12px", flexShrink: 0, background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}
                      >
                        🔄 Заменить
                      </button>
                    )}
                    {item.status === "active" && isActive && (
                      <button
                        type="button"
                        className="btn btn-secondary-green btn-primary-small"
                        onClick={() => {
                          setReturningItemId(returningItemId === item.id ? null : item.id);
                          setSwappingItemId(null);
                          setReturnForm({ received_by: "", condition_after: "", notes: "" });
                          setError(null);
                        }}
                        style={{ fontSize: 12, padding: "4px 12px", flexShrink: 0 }}
                      >
                        Вернуть
                      </button>
                    )}
                  </div>

                  {/* Форма замены велосипеда */}
                  {swappingItemId === item.id && (
                    <div style={{
                      padding: "12px 14px", background: "#eff6ff",
                      border: "1px solid #bfdbfe", borderTop: "none",
                      borderRadius: "0 0 6px 6px",
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#1e40af", marginBottom: 10 }}>🔄 Замена велосипеда</div>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div className="form-group" style={{ flex: 2, minWidth: 200, marginBottom: 0 }}>
                          <label style={{ fontSize: 12 }}>Новый велосипед</label>
                          <select className="form-select" value={swapBikeId} onChange={e => setSwapBikeId(e.target.value)}>
                            <option value="">— Выберите велосипед —</option>
                            {availableBikes.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.internal_article ? `${b.internal_article} · ` : ""}{b.model}{b.wheel_size ? ` (${b.wheel_size}")` : ""}
                              </option>
                            ))}
                          </select>
                          {availableBikes.length === 0 && (
                            <span style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, display: "block" }}>Нет доступных велосипедов</span>
                          )}
                        </div>
                        <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                          <label style={{ fontSize: 12 }}>Куда отправить старый</label>
                          <select className="form-select" value={oldBikeStatus} onChange={e => setOldBikeStatus(e.target.value)}>
                            <option value="в ремонте">В ремонт</option>
                            <option value="в наличии">В наличие</option>
                          </select>
                        </div>
                        <button type="button" className="btn btn-primary-small"
                          onClick={() => handleSwap(item.id)} disabled={saving || !swapBikeId}
                          style={{ marginBottom: 2, background: "#2563eb", color: "white", border: "none", borderRadius: 6, padding: "7px 16px", cursor: "pointer", fontWeight: 500, fontSize: 13, opacity: !swapBikeId ? 0.5 : 1 }}>
                          {saving ? "..." : "Подтвердить"}
                        </button>
                        <button type="button" onClick={() => setSwappingItemId(null)}
                          style={{ marginBottom: 2, padding: "7px 12px", background: "none", border: "1px solid #e5e7eb", borderRadius: 4, cursor: "pointer", color: "#6b7280" }}>
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Форма возврата позиции */}
                  {returningItemId === item.id && (
                    <div style={{
                      padding: "12px 14px", background: "white",
                      border: "1px solid #86efac", borderTop: "none",
                      borderRadius: "0 0 6px 6px",
                    }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                        <div className="form-group" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                          <label style={{ fontSize: 12 }}>Принял</label>
                          <select className="form-select" value={returnForm.received_by}
                            onChange={e => setReturnForm(p => ({ ...p, received_by: e.target.value }))}>
                            <option value="">— Не указан —</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ flex: 1, minWidth: 120, marginBottom: 0 }}>
                          <label style={{ fontSize: 12 }}>Состояние</label>
                          <input className="form-input" value={returnForm.condition_after}
                            onChange={e => setReturnForm(p => ({ ...p, condition_after: e.target.value }))}
                            placeholder="Хорошее, царапины..." />
                        </div>
                        <div className="form-group" style={{ flex: 1.5, minWidth: 160, marginBottom: 0 }}>
                          <label style={{ fontSize: 12 }}>Заметки</label>
                          <input className="form-input" value={returnForm.notes}
                            onChange={e => setReturnForm(p => ({ ...p, notes: e.target.value }))}
                            placeholder="Любые заметки..." />
                        </div>
                        <button type="button" className="btn btn-primary-green btn-primary-small"
                          onClick={() => handleItemReturn(item.id)} disabled={saving}
                          style={{ marginBottom: 2 }}>
                          {saving ? "..." : "Подтвердить"}
                        </button>
                        <button type="button" onClick={() => setReturningItemId(null)}
                          style={{ marginBottom: 2, padding: "7px 12px", background: "none", border: "1px solid #e5e7eb", borderRadius: 4, cursor: "pointer", color: "#6b7280" }}>
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Итоговая сумма */}
            {rental.total_price && (
              <div style={{ textAlign: "right", fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#111827" }}>
                Итого: {rental.total_price} грн
              </div>
            )}

            {/* Форма завершения */}
            {showCompletionForm && (
              <div style={{ padding: "16px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, marginBottom: 8 }}>
                <div style={{ fontWeight: 600, color: "#166534", marginBottom: 12 }}>Завершение проката</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label style={{ fontSize: 12 }}>Итоговая сумма (грн)</label>
                    <input className="form-input" type="number" min="0"
                      value={completionForm.total_price}
                      onChange={e => setCompletionForm(p => ({ ...p, total_price: e.target.value }))}
                      placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 12 }}>Принял</label>
                    <select className="form-select" value={completionForm.received_by}
                      onChange={e => setCompletionForm(p => ({ ...p, received_by: e.target.value }))}>
                      <option value="">— Не указан —</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: 12 }}>Заметки при возврате</label>
                    <input className="form-input" value={completionForm.notes_return}
                      onChange={e => setCompletionForm(p => ({ ...p, notes_return: e.target.value }))}
                      placeholder="Замечания, претензии..." />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                  <button type="button" className="btn btn-secondary-green btn-primary-small"
                    onClick={() => setShowCompletionForm(false)}>
                    Отмена
                  </button>
                  <button type="button" className="btn btn-primary-green btn-primary-small"
                    onClick={handleComplete} disabled={saving}>
                    {saving ? "Сохранение..." : "Подтвердить завершение"}
                  </button>
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
                onClick={() => window.confirm("Отметить клиента как «Не явился»? Счётчик неявок увеличится.") && handleStatusChange("no_show")}
                disabled={saving}>
                Не явился
              </button>
            )}
            {canCancel && (
              <button type="button" className="btn btn-primary-small"
                style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: 6, cursor: "pointer", padding: "6px 14px", fontSize: "0.875rem", fontWeight: 500 }}
                onClick={() => window.confirm("Отменить договор?") && handleStatusChange("cancelled")}
                disabled={saving}>
                Отменить
              </button>
            )}
            {canMarkOverdue && (
              <button type="button" className="btn btn-primary-small"
                style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", padding: "6px 14px", fontSize: "0.875rem", fontWeight: 500 }}
                onClick={() => window.confirm("Отметить прокат как просроченный?") && handleStatusChange("overdue")}
                disabled={saving}>
                Просрочить
              </button>
            )}
            {canActivate && (
              <button type="button" className="btn btn-primary-green btn-primary-small"
                onClick={() => handleStatusChange("active")} disabled={saving}>
                {saving ? "..." : "▶ Активировать прокат"}
              </button>
            )}
            {canComplete && !showCompletionForm && (
              <button type="button" className="btn btn-primary-green btn-primary-small"
                onClick={() => setShowCompletionForm(true)} disabled={saving}>
                ✓ Завершить прокат
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RentalViewModal;
