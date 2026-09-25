export type Language = "ru" | "en" | "kk";
export type AvatarId = "classic-male" | "classic-female";
export type VoiceGender = "male" | "female";
export type UserRole = "Admin" | "Lecturer" | "Student";
export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarStyle: string;
  avatarId: AvatarId;
  voiceGender: VoiceGender;
  interfaceLanguage: Language;
  teachingLanguage: Language;
  speechRate: number;
  createdAt: string;
}
export interface RegisterPayload {
  accountType?: "Student" | "Lecturer";
  avatarId?: AvatarId;
  voiceGender?: VoiceGender;
  interfaceLanguage?: Language;
  teachingLanguage?: Language;
  email: string;
  password: string;
  fullName: string;
}
export interface LoginPayload {
  email: string;
  password: string;
}
export type AuthResponse = User;
