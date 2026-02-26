// Утилиты для работы с украинскими номерами телефонов

/**
 * Нормализует номер телефона к формату +380XXXXXXXXX.
 * Возвращает нормализованный номер или null если формат нераспознан.
 */
export const normalizePhone = (raw) => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) return "+38" + digits;       // 0XXXXXXXXX
  if (digits.length === 12 && digits.startsWith("380")) return "+" + digits;       // 380XXXXXXXXX
  if (digits.length === 11 && digits.startsWith("380")) return "+" + digits;       // неполный — нет
  return null;
};

/**
 * Проверяет валидность украинского номера (любой поддерживаемый формат).
 */
export const isValidPhone = (raw) => normalizePhone(raw) !== null;

/**
 * Подсказка формата для пользователя.
 */
export const PHONE_HINT = "Формат: 0XXXXXXXXX или +380XXXXXXXXX";
