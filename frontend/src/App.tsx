import { t } from "./i18n";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";
import { useEffect, lazy, Suspense } from "react";
import { useAuth } from "./context/AuthContext";
import { Shell } from "./components/Shell";
import { ErrorMessage, Loading } from "./components/UI";
import { AuthPage } from "./pages/AuthPage";
const GesturePreviewPage = lazy(() => import("./pages/GesturePreviewPage").then(m => ({default:m.GesturePreviewPage})));
const MixamoPreviewPage = lazy(() => import("./pages/MixamoPreviewPage").then(m => ({default:m.MixamoPreviewPage})));
const WomanAvatarPreviewPage = lazy(() => import("./pages/WomanAvatarPreviewPage").then(m => ({default:m.WomanAvatarPreviewPage})));
import LandingPage from "./pages/LandingPage";
const SignLearningPage = lazy(() => import("./pages/SignWorkspace").then(m => ({default:m.SignLearningPage})));
const SignLessonPage = lazy(() => import("./pages/SignWorkspace").then(m => ({default:m.SignLessonPage})));
const SignTextPage = lazy(() => import("./pages/SignWorkspace").then(m => ({default:m.SignTextPage})));
const SignRecognitionPage = lazy(() => import("./pages/SignRecognition").then(m => ({default:m.SignRecognitionPage})));
const SignPracticePage = lazy(() => import("./pages/SignWorkspace").then(m => ({default:m.SignPracticePage})));
const SignDialoguesPage = lazy(() => import("./pages/SignActivities").then(m => ({default:m.SignDialoguesPage})));
const SignUnderstandingPage = lazy(() => import("./pages/SignActivities").then(m => ({default:m.SignUnderstandingPage})));
const SignHelpPage = lazy(() => import("./pages/SignWorkspace").then(m => ({default:m.SignHelpPage})));
import { LibraryPage } from "./pages/LibraryPage";
import { CreatePage } from "./pages/CreatePage";
import { LecturePlayerPage } from "./pages/LecturePlayerPage";
import { GroupsPage } from "./pages/GroupsPage";
import { KnowledgePage } from "./pages/KnowledgePage";
const LocalMentorPage = lazy(() => import("./pages/LocalMentorPage").then(m => ({default:m.LocalMentorPage})));
const CoursesPage = lazy(() => import("./pages/CoursesPage").then(m => ({default:m.CoursesPage})));
const ReportsPage = lazy(() => import("./pages/ReportsPage").then(m => ({default:m.ReportsPage})));
import { SettingsPage } from "./pages/SettingsPage";
const AdminPage = lazy(() => import("./pages/AdminPage").then(m => ({default:m.AdminPage})));
function ProtectedRoute({ admin = false, teacher = false }: { admin?: boolean; teacher?: boolean }) {
  const { user } = useAuth();
  return !user ? (
    <Navigate to="/login" replace />
  ) : (admin && user.role !== "Admin") || (teacher && user.role === "Student") ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Outlet />
  );
}
function ScrollReset() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    let observer: MutationObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const scrollToAnchor = () => {
      const target = document.getElementById(hash.slice(1));
      if (!target) return false;
      target.scrollIntoView(); observer?.disconnect();
      if (timeout) clearTimeout(timeout);
      return true;
    };
    const frame = requestAnimationFrame(() => {
      if (!hash) { window.scrollTo(0, 0); return; }
      if (scrollToAnchor()) return;
      // Lazy routes may mount after ScrollReset's first frame.
      observer = new MutationObserver(() => { scrollToAnchor(); });
      observer.observe(document.body, { childList: true, subtree: true });
      timeout = setTimeout(() => observer?.disconnect(), 5000);
    });
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); if (timeout) clearTimeout(timeout); };
  }, [pathname, hash]);
  return null;
}
function CoursesRoute() { const location = useLocation(); return <CoursesPage key={location.search}/>; }
function PlayerRoute() { const location = useLocation(); return <LecturePlayerPage key={location.pathname} />; }
import { useLanguage } from "./i18n";
export function App() {
  useLanguage();
  const { loading, error, reload } = useAuth();
  if (loading && window.location.pathname !== "/local-mentor") return <Loading text={t("Открываем ваше пространство…")} />;
  if (error && window.location.pathname !== "/local-mentor") return <div className="connection-error"><ErrorMessage message={error}/><button className="button primary" onClick={reload}>{t("Подключиться снова")}</button></div>;
  return (
    <BrowserRouter>
      <ScrollReset />
      <Suspense fallback={<Loading/>}><Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/local-mentor" element={<LocalMentorPage />} />
        <Route path="/gesture-preview" element={<GesturePreviewPage />} />
        <Route path="/avatar-study" element={<Navigate to="/" replace />} />
        <Route path="/welcome" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<AuthPage key="login" />} />
        <Route path="/register" element={<AuthPage key="register" signup />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Shell />}>
            <Route path="dashboard" element={<Navigate to="/learn" replace />} />
            <Route path="learn" element={<SignLearningPage />} />
            <Route path="learn/:id" element={<SignLessonPage />} />
            <Route path="text-to-sign" element={<SignTextPage />} />
            <Route path="avatar-woman" element={<WomanAvatarPreviewPage />} />
            <Route path="avatar-motion" element={<MixamoPreviewPage />} />

            <Route path="library" element={<LibraryPage />} />
            <Route path="create" element={<CreatePage />} />
            <Route path="lectures/:id" element={<PlayerRoute />} />
            <Route path="practice" element={<SignPracticePage />} />
            <Route path="recognition" element={<SignRecognitionPage />} />
            <Route path="dialogues" element={<SignDialoguesPage />} />
            <Route path="understanding" element={<SignUnderstandingPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="courses" element={<CoursesRoute />} />
            <Route element={<ProtectedRoute teacher />}><Route path="reports" element={<ReportsPage />} /></Route>
            <Route path="settings" element={<SettingsPage />} />
            <Route path="help" element={<SignHelpPage />} />
            <Route element={<ProtectedRoute admin />}>
              <Route path="admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>
    </BrowserRouter>
  );
}
