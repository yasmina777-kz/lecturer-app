import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LecturePlayerPage } from "./pages/LecturePlayerPage";
import RegisterPage from "./pages/RegisterPage";
import LoginPage from "./pages/LoginPage";
import { useAuth } from "./context/AuthContext";

const DEMO_LECTURE_ID = "00000000-0000-0000-0000-000000000001";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <LecturePlayerPage lectureId={DEMO_LECTURE_ID} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
