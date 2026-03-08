import {
  Bike, ClipboardList, Users, Tags, Wrench,
  CalendarCog, Package, ShoppingCart, UserCog,
  BarChart3, Settings,
} from "lucide-react";

// roles: null = все авторизованные пользователи
// roles: ["admin"] = только admin
// Добавить новую страницу = одна запись здесь
export const ROUTES = [
  { path: "/",                 label: "Велосипеды",        Icon: Bike,          roles: ["admin", "manager"] },
  { path: "/rentals",          label: "Аренда",            Icon: ClipboardList,  roles: ["admin", "manager"] },
  { path: "/customers",        label: "Клиенты",           Icon: Users,          roles: ["admin", "manager"] },
  { path: "/tariffs",          label: "Тарифы",            Icon: Tags,           roles: ["admin"] },
  { path: "/maintenance",      label: "Обслуживание",      Icon: Wrench,         roles: ["admin", "manager"] },
  { path: "/repairs-schedule", label: "Планирование",      Icon: CalendarCog,    roles: ["admin"] },
  { path: "/parts",            label: "Запчасти",          Icon: Package,        roles: ["admin", "manager"] },
  { path: "/parts-requests",   label: "Закупка запчастей", Icon: ShoppingCart,   roles: ["admin", "manager"] },
  { path: "/users",            label: "Сотрудники",        Icon: UserCog,        roles: ["admin"] },
  { path: "/analytics",        label: "Аналитика",         Icon: BarChart3,      roles: ["admin"] },
  { path: "/settings",         label: "Настройки",         Icon: Settings,       roles: ["admin"] },
];

// Утилита: есть ли у пользователя доступ к маршруту
export const canAccess = (route, userRole) =>
  !route.roles || route.roles.includes(userRole);
