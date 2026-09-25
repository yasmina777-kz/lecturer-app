import { t } from "../i18n";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { request, post } from "../api/httpClient";
import type { User } from "../types/auth";
import { setLanguage } from "../i18n";
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string;
  setUser: (user: User) => void;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, updateUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  function setUser(value: User | null) {
    updateUser(value);
    if (value?.interfaceLanguage) setLanguage(value.interfaceLanguage);
  }
  async function reload() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.status === 401) setUser(null);
      else if (response.ok) setUser(await response.json());
      else throw new Error(t("Сервер временно недоступен."));
    } catch {
      setError(t("Не удалось подключиться к серверу."));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // Remove tokens from the old MVP; new sessions use an HttpOnly cookie.
    ["token", "role", "fullName"].forEach((k) => localStorage.removeItem(k));
    void reload();
    const expired = () => setUser(null);
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  async function logout() {
    await post("/auth/logout");
    setUser(null);
  }
  return (
    <AuthContext.Provider
      value={{ user, loading, error, setUser, logout, reload }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider required");
  return ctx;
}
