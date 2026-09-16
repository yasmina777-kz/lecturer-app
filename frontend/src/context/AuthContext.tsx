import { createContext, useContext, useState, type ReactNode } from "react";
import type { UserRole } from "../types/auth";

interface AuthState {
  token: string | null;
  role: UserRole | null;
  fullName: string | null;
}

interface AuthContextValue extends AuthState {
  setAuth: (token: string, role: UserRole, fullName: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role") as UserRole | null;
    const fullName = localStorage.getItem("fullName");
    return { token, role, fullName };
  });

  function setAuth(token: string, role: UserRole, fullName: string) {
    localStorage.setItem("token", token);
    localStorage.setItem("role", role);
    localStorage.setItem("fullName", fullName);
    setState({ token, role, fullName });
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("fullName");
    setState({ token: null, role: null, fullName: null });
  }

  return (
    <AuthContext.Provider value={{ ...state, setAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return ctx;
}