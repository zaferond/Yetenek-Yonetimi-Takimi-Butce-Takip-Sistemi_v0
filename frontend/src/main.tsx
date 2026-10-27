import { Component, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { api, setCsrf } from "./api";
import { Login } from "./Login";
import { Workspace } from "./Workspace";
import type { User } from "./types";
import "./styles/tokens.css";
import "./style.css";
import "./styles/workspace.css";
import "./login.css";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="empty">
        <h1>Ekran yüklenemedi</h1>
        <p>Kaydedilmiş verileriniz korunuyor.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Yeniden yükle
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [expired, setExpired] = useState(false),
    [startupError, setStartupError] = useState("");
  useEffect(() => {
    api("/auth/me")
      .then((r) => {
        setCsrf(r.csrf);
        setUser(r.user);
      })
      .catch((e) => {
        if (e.status !== 401) setStartupError(e.message);
      })
      .finally(() => setLoading(false));
    const listener = () => setExpired(true);
    window.addEventListener("session-expired", listener);
    return () => window.removeEventListener("session-expired", listener);
  }, []);
  if (loading)
    return <main className="loading">Çalışma alanı hazırlanıyor…</main>;
  if (startupError)
    return (
      <main className="empty">
        <p role="alert">{startupError}</p>
        <button className="button primary" onClick={() => location.reload()}>
          Tekrar dene
        </button>
      </main>
    );
  return (
    <>
      {user ? (
        <Workspace user={user} onLogout={() => setUser(null)} />
      ) : (
        <Login onLogin={setUser} />
      )}
      {user && expired && (
        <Login
          expired
          onLogin={(u) => {
            setUser(u);
            setExpired(false);
          }}
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
