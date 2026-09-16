export type UserRole = "Admin" | "Lecturer" | "Student";

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  role: UserRole;
  fullName: string;
}