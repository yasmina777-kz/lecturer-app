import { at } from "../i18n/automation";
import { t } from "../i18n";
import { useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BookOpen,
  Network,
  Layers,
  BarChart3,
  Users,
  CircleHelp,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
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
  const nav = [
    ["/dashboard", t("Обзор"), LayoutDashboard],
    ["/courses", at("Курсы", "Courses", "Курстар"), Layers],
    ["/library", t("Мои лекции"), BookOpen],
    ["/practice", t("Моя практика"), GraduationCap],
    ["/knowledge", t("Карта знаний"), Network],
    ["/groups", user?.role === "Student" ? t("Мои группы") : t("Группы"), Users],
    ["/settings", t("Настройки"), Settings2],
  ] as const;
  return (
    <div
      className={`app-shell ${/^\/lectures\/[^/]+$/.test(location.pathname) ? "player-shell" : ""}`}
    >
      {menu && <div className="mobile-scrim" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link
          to="/dashboard"
          className="brand-link"
          onClick={() => setMenu(false)}
        >
          <Brand />
        </Link>
        <button
          className="icon-button close-menu"
          onClick={() => setMenu(false)}
          aria-label={t("Закрыть меню")}
        >
          <X />
        </button>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} onClick={() => setMenu(false)}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
          {user?.role !== "Student" && <NavLink to="/reports" onClick={()=>setMenu(false)}><BarChart3 size={19}/>{at("Недельный отчёт","Weekly report","Апталық есеп")}</NavLink>}
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
            {t("Как это работает")}
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
            <Link to="/create" className="button primary small">
              <Plus size={16} />
              {t("Создать лекцию")}
            </Link>
          </div>
        </header>
        <main className="main-content">
          <ErrorMessage message={error} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
