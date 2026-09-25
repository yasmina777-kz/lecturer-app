import { t } from "./i18n";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "./context/AuthContext";
import { Shell } from "./components/Shell";
import { ErrorMessage, Loading } from "./components/UI";
import { AuthPage } from "./pages/AuthPage";
import LandingPage from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LibraryPage } from "./pages/LibraryPage";
import { CreatePage } from "./pages/CreatePage";
import { LecturePlayerPage } from "./pages/LecturePlayerPage";
import { PracticePage } from "./pages/PracticePage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminPage } from "./pages/AdminPage";
import { HelpPage } from "./pages/HelpPage";
function ProtectedRoute({ admin = false }: { admin?: boolean }) {
  const { user } = useAuth();
  return !user ? (
    <Navigate to="/login" replace />
  ) : admin && user.role !== "Admin" ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Outlet />
  );
}
function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function PlayerRoute() {
  const location = useLocation();
  return <LecturePlayerPage key={location.pathname} />;
}
import { useLanguage } from "./i18n";
export function App() {
  useLanguage();
  const { loading, error, reload } = useAuth();
  if (loading) return <Loading text={t("Открываем ваше пространство…")} />;
  if (error)
    return (
      <div className="connection-error">
        <ErrorMessage message={error} />
        <button className="button primary" onClick={reload}>
          {t("Подключиться снова")}
        </button>
      </div>
    );
  return (
    <BrowserRouter>
      <ScrollReset />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/welcome" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<AuthPage key="login" />} />
        <Route path="/register" element={<AuthPage key="register" signup />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Shell />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="create" element={<CreatePage />} />
            <Route path="lectures/:id" element={<PlayerRoute />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<HelpPage />} />
            <Route element={<ProtectedRoute admin />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
