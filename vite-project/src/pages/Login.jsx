import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import PasswordInput from "../components/PasswordInput";
import logo from "../assets/images/logo.png";

const Login = () => {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка входа"); return; }
      login(data);
      navigate("/", { replace: true });
    } catch {
      setError("Не удалось подключиться к серверу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#f3f4f6",
    }}>
      <div style={{
        background: "white", borderRadius: 12, padding: "40px 36px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: 360,
      }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src={logo} alt="Логотип" style={{ height: 72, objectFit: "contain", marginBottom: 12 }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
            Пункт управления звездой смерти
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>
            Войдите в систему для уничтожения галактик
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="emperor_palpatine@galacticempire.gov"
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              Пароль
            </label>
            <PasswordInput
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••"
              style={{ width: "100%", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", outline: "none" }}
            />
          </div>

          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 12px", fontSize: 13, color: "#dc2626", marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary-green"
            style={{ width: "100%", padding: "10px", fontSize: 15, fontWeight: 600 }}
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
