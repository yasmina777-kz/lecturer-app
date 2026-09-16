import { useState, type FormEvent } from "react";
import { login } from "../api/authApi";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { setAuth } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      const res = await login({ email, password });
      setAuth(res.token, res.role, res.fullName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Что-то пошло не так");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>Вход</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>

      <div>
        <label>Пароль</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>

      <button type="submit">Войти</button>
    </form>
  );
}