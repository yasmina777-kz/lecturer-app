import { post } from "./httpClient";
import type {
  RegisterPayload,
  LoginPayload,
  AuthResponse,
} from "../types/auth";
export const register = (payload: RegisterPayload) =>
  post<AuthResponse>("/auth/register", payload);
export const login = (payload: LoginPayload) =>
  post<AuthResponse>("/auth/login", payload);
