import type { RegisterPayload, LoginPayload, AuthResponse } from "../types/auth";

const API_BASE = "http://localhost:5000/api/auth"; 

export async function register(payload: RegisterPayload): Promise<void> {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Ошибка регистрации");
  }
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || "Ошибка входа");
  }

  return res.json();
}