import { useState, type FormEvent } from "react";
import { register } from "../api/authApi";
import type { UserRole } from "../types/auth";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("Student");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await register({ email, password, fullName, role });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    }
  }

  if (success) {
    return <p>Регистрация прошла успешно! Теперь можно войти.</p>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Регистрация</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div>
        <label>Имя</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>

      <div>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>

      <div>
        <label>Пароль</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>

      <div>
        <label>Роль</label>
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
          <option value="Student">Студент</option>
          <option value="Lecturer">Преподаватель</option>
          <option value="Admin">Админ</option>
        </select>
      </div>

      <button type="submit">Зарегистрироваться</button>
    </form>
  );
}