// Константы и утилиты для фильтрации велосипедов в модалках проката/бронирования

// Значения tariff_name из таблицы велосипедов
export const TARIFF_OPTIONS = ["kids", "econom", "standart", "premium", "эл.вел", "эл.самокат"];

// Размеры колёс
export const WHEEL_OPTIONS = ["16", "18", "20", "24", "26", "27.5", "29"];

// Рекомендуемые размеры рам по росту клиента.
// Возвращает { label, perfect[], acceptable[] }:
//   perfect    — идеально подходит
//   acceptable — допустимо (чуть маловат / чуть великоват)
export const heightToFrameRec = (height) => {
  const h = parseInt(height);
  if (!h) return null;
  if (h <= 110) return {
    label: "д20",
    perfect:    ["д20"],
    acceptable: [],
  };
  if (h <= 125) return {
    label: "д20",
    perfect:    ["д20"],
    acceptable: ["д24"],
  };
  if (h <= 138) return {
    label: "д24",
    perfect:    ["д24"],
    acceptable: ["д20"],
  };
  if (h <= 148) return {
    label: "д24 / XS",
    perfect:    ["д24", "XS", "13", "14"],
    acceptable: ["S", "15"],
  };
  if (h <= 156) return {
    label: "S / 15–15,5\"",
    perfect:    ["S", "15", "15,5"],
    acceptable: ["14", "16"],
  };
  if (h <= 164) return {
    label: "S / 15,5–16,5\"",
    perfect:    ["S", "15,5", "16", "16,5"],
    acceptable: ["M", "17", "17,5"],
  };
  if (h <= 172) return {
    label: "M / 17–18\"",
    perfect:    ["M", "17", "17,5", "18"],
    acceptable: ["16", "16,5", "L", "19"],
  };
  if (h <= 178) return {
    label: "M–L / 17,5–19,5\"",
    perfect:    ["M", "17,5", "18", "18,5", "L", "19", "19,5"],
    acceptable: ["17", "20"],
  };
  if (h <= 185) return {
    label: "L / 19,5–20,5\"",
    perfect:    ["L", "19,5", "20", "20,5"],
    acceptable: ["18,5", "XL", "21"],
  };
  if (h <= 192) return {
    label: "XL / 21–22\"",
    perfect:    ["XL", "21", "21,5", "22"],
    acceptable: ["20", "20,5", "22,5"],
  };
  return {
    label: "XL / 22\"+ / XXL",
    perfect:    ["XL", "XXL", "22", "22,5", "23", "23,5"],
    acceptable: ["20", "20,5", "21", "21,5"],
  };
};
