import { ProductSurface } from "./ProductSurface";
import { at } from "../i18n/automation";
import { t } from "../i18n";
import { useRef, useState } from "react";
import { useWorkspaceMotion } from "../hooks/useWorkspaceMotion";
import "../pages/workspace-motion.css";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BookOpen,
  MessageCircle,
  Eye,
  Type,
  CircleHelp,
  ScanLine,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  X,
  ArrowUpRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Brand, ErrorMessage, messageOf } from "./UI";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { LanguageSwitcher } from "./LanguageSwitcher";
export function Shell() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const workspace = useRef<HTMLElement>(null);
  useWorkspaceMotion(workspace, location.pathname + location.search);
  const nav = [
    {
      to: "/learn",
      label: at("Обучение", "Learning", "Оқу"),
      icon: BookOpen,
      active: path.startsWith("/learn"),
    },
    {
      to: "/text-to-sign",
      label: at("Текст → жесты", "Text → signs", "Мәтін → ымдар"),
      icon: Type,
      active: path === "/text-to-sign" || path === "/avatar-woman",
    },
    {
      to: "/recognition",
      label: at("Жесты → текст", "Signs → text", "Ымдар → мәтін"),
      icon: ScanLine,
      active: path === "/recognition",
    },
    {
      to: "/dialogues",
      label: at("Диалоги", "Dialogues", "Диалогтар"),
      icon: MessageCircle,
      active: path === "/dialogues",
    },
    {
      to: "/understanding",
      label: at("Понимание жестов", "Understand signs", "Ымдарды түсіну"),
      icon: Eye,
      active: path === "/understanding",
    },
    {
      to: "/settings",
      label: t("Настройки"),
      icon: Settings2,
      active: path === "/settings",
    },
  ];
  const Surface =
    path.startsWith("/learn") ||
    path === "/admin" ||
    path === "/text-to-sign" ||
    path === "/avatar-woman" ||
    path === "/recognition" ||
    path === "/dialogues" ||
    path === "/understanding" ||
    path === "/settings" ||
    path === "/help" ||
    path === "/practice"
      ? ProductSurface
      : "div";
  return (
    <Surface
      className={`app-shell ${/^\/lectures\/[^/]+$/.test(location.pathname) ? "player-shell" : ""}`}
    >
      {menu && <div className="mobile-scrim" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link to="/learn" className="brand-link" onClick={() => setMenu(false)}>
          <Brand />
        </Link>
        <button
          className="icon-button close-menu"
          onClick={() => setMenu(false)}
          aria-label={t("Закрыть меню")}
        >
          <X />
        </button>
        <nav
          aria-label={at(
            "Основные разделы",
            "Main sections",
            "Негізгі бөлімдер",
          )}
        >
          {nav.map(({ to, label, icon: Icon, active }) => (
            <Link
              key={to}
              to={to}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
              onClick={() => setMenu(false)}
            >
              <Icon size={19} />
              {label}
            </Link>
          ))}
          {user?.role === "Admin" && (
            <NavLink to="/admin" onClick={() => setMenu(false)}>
              <ShieldCheck size={19} />
              {t("Админ-панель")}
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/help" onClick={() => setMenu(false)}>
            <CircleHelp size={18} />
            {at(
              "Что где находится",
              "Where to find everything",
              "Қай бөлімде не бар",
            )}
          </NavLink>
          <Link to="/" onClick={() => setMenu(false)}>
            <ArrowUpRight size={18} />
            {t("О проекте")}
          </Link>
          <div className="user-row">
            <span className="user-avatar">
              {user?.fullName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user?.fullName}</strong>
              <small>
                {user?.role === "Admin"
                  ? t("Администратор")
                  : user?.role === "Lecturer"
                    ? t("Преподаватель")
                    : t("Студент")}
              </small>
            </div>
            <button
              className="icon-button"
              title={t("Выйти")}
              onClick={async () => {
                try {
                  await logout();
                  navigate("/");
                } catch (e) {
                  setError(messageOf(e));
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button menu-toggle"
              aria-label={t("Открыть меню")}
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
          </div>
          <div className="topbar-right">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </header>
        <main className="main-content" ref={workspace}>
          <ErrorMessage message={error} />
          <Outlet />
        </main>
      </div>
    </Surface>
  );
}
