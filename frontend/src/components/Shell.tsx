import { useChooseSignLang } from "./SignLangSwitcher";
import "../pages/sign-courses.css";
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
  ArrowLeft,
  BookOpen,
  Languages,
  UserRound,
  LogOut,
  Menu,
  ShieldCheck,
  X,
  ArrowUpRight,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useStudyTimer } from "../sign/dailyGoal";
import { useAuth } from "../context/AuthContext";
import { Brand, ErrorMessage, messageOf } from "./UI";
export function Shell() {
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  // Desktop: the sidebar can be hidden; remembered per browser.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  const toggleSidebar = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      } catch {
        /* still toggles for this visit */
      }
      return !c;
    });
  const [error, setError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const workspace = useRef<HTMLElement>(null);
  useWorkspaceMotion(workspace, location.pathname + location.search);
  const learnPaths = ["/grammar", "/dialogues", "/understanding", "/practice"];
  const studying = path.startsWith("/learn") || path === "/vocab" || learnPaths.includes(path);
  useStudyTimer(studying);
  const translate = path === "/text-to-sign";
  const [signLang, chooseSignLang] = useChooseSignLang();
  const inCourse =
    (path.startsWith("/learn") && location.search !== "") ||
    path.startsWith("/course") ||
    path === "/kazakh" ||
    learnPaths.includes(path);
  const nav = [
    {
      to: "/learn",
      label: at("Учиться", "Learn", "Оқу"),
      icon: BookOpen,
      active: path === "/learn" && location.search === "",
    },
    {
      to: "/vocab",
      label: at("Тренажёр", "Trainer", "Жаттықтырғыш"),
      icon: Layers,
      active: path === "/vocab",
    },
    {
      to: "/text-to-sign",
      label: at("Перевод", "Translate", "Аударма"),
      icon: Languages,
      active: translate,
    },
    {
      to: "/settings",
      label: at("Профиль", "Profile", "Профиль"),
      icon: UserRound,
      active: path === "/settings",
    },
  ];
  const Surface =
    path.startsWith("/learn") ||
    path === "/admin" ||
    path === "/text-to-sign" ||
    path === "/vocab" ||
    path === "/grammar" ||
    path === "/dialogues" ||
    path.startsWith("/understanding") ||
    path === "/fingerspell" ||
    path.startsWith("/course") ||
    ["/culture", "/kazakh", "/numbers", "/face-trainer", "/live-practice", "/avatar-review", "/record-signs"].includes(path) ||
    path === "/settings" ||
    path === "/help" ||
    path === "/knowledge" ||
    path === "/library" ||
    path === "/practice"
      ? ProductSurface
      : "div";
  return (
    <Surface
      className={`app-shell ${/^\/lectures\/[^/]+$/.test(location.pathname) ? "player-shell" : ""}${collapsed ? " sidebar-collapsed" : ""}`}
    >
      {menu && <div className="mobile-scrim" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link to="/learn" className="brand-link" onClick={() => setMenu(false)}>
          <Brand />
        </Link>
        <button
          type="button"
          className="icon-button sidebar-collapse"
          onClick={toggleSidebar}
          aria-label={at("Скрыть меню", "Hide menu", "Мәзірді жасыру")}
          title={at("Скрыть меню", "Hide menu", "Мәзірді жасыру")}
        >
          <PanelLeftClose size={18} />
        </button>
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
          <div className="sidebar-courses">
            <span>{at("Мои курсы", "My courses", "Менің курстарым")}</span>
            {(
              [
                ["rsl", "РЖЯ", at("Русский жестовый", "Russian Sign Language", "Орыс ым тілі")],
                ["ksl", "ҚЖЯ", at("Казахский жестовый", "Kazakh Sign Language", "Қазақ ым тілі")],
              ] as const
            ).map(([code, tag, label]) => {
              const on = inCourse && signLang === code;
              return (
                <Link
                  key={code}
                  to={`/learn?lang=${code}`}
                  className={on ? "active" : undefined}
                  aria-current={on ? "page" : undefined}
                  onClick={() => {
                    chooseSignLang(code);
                    setMenu(false);
                  }}
                >
                  <i>{tag}</i>
                  {label}
                </Link>
              );
            })}
          </div>
          {user?.role === "Admin" && (
            <NavLink to="/admin" onClick={() => setMenu(false)}>
              <ShieldCheck size={19} />
              {t("Админ-панель")}
            </NavLink>
          )}
        </nav>
        <div className="sidebar-bottom">
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
      {collapsed && (
        <button
          type="button"
          className="sidebar-reopen"
          onClick={toggleSidebar}
          aria-label={at("Показать меню", "Show menu", "Мәзірді көрсету")}
          title={at("Показать меню", "Show menu", "Мәзірді көрсету")}
        >
          <PanelLeftOpen size={18} />
        </button>
      )}
      <div className="app-main">
        <header className="topbar topbar-menu-only">
          <div className="topbar-left">
            <button
              className="icon-button menu-toggle"
              aria-label={t("Открыть меню")}
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
          </div>

        </header>
        <main className="main-content" ref={workspace}>
          <ErrorMessage message={error} />
          {learnPaths.includes(path) && (
            <Link to="/course" className="shell-back">
              <ArrowLeft size={16} />
              {at("К курсу", "Back to course", "Курсқа")}
            </Link>
          )}
          <Outlet />
        </main>
      </div>
    </Surface>
  );
}
