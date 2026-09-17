import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { token, fullName, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link to="/" className="brand">
          AI-лектор
          <span className="brand-badge">MVP v1.0</span>
        </Link>
        <nav className="header-nav">
          {token ? (
            <>
              <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{fullName}</span>
              <Link to="/lecture">Личный кабинет</Link>
              <button onClick={handleLogout}>Выйти</button>
            </>
          ) : (
            <>
              <Link to="/login">Вход</Link>
              <Link to="/register" className="cta">
                Регистрация
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}