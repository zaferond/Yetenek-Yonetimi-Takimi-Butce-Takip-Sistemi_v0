import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { Empty } from "../ui";
import type { User } from "../types";
const PAGE_SIZE = 200;
const roles = {
  admin: "Yönetici",
  editor: "Düzenleyici",
  viewer: "Görüntüleyici",
};
export function AdminPage({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<User[]>([]),
    [logs, setLogs] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [hasMore, setHasMore] = useState(false),
    [loadingMore, setLoadingMore] = useState(false),
    [showSessions, setShowSessions] = useState(true);
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [role, setRole] = useState<User["role"]>("viewer");
  async function load() {
    setLoading(true);
    try {
      const [u, l] = await Promise.all([
        api<User[]>("/admin/users"),
        api<any[]>(`/audit?limit=${PAGE_SIZE}`),
      ]);
      setUsers(u);
      setLogs(l);
      setHasMore(l.length === PAGE_SIZE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function loadMore() {
    const last = logs[logs.length - 1];
    if (!last) return;
    setError("");
    setLoadingMore(true);
    try {
      const more = await api<any[]>(
        `/audit?limit=${PAGE_SIZE}&before=${encodeURIComponent(String(last.id))}`,
      );
      setLogs((prev) => [...prev, ...more]);
      setHasMore(more.length === PAGE_SIZE);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }
  const visibleLogs = showSessions
    ? logs
    : logs.filter((a) => a.entity !== "sessions");
  useEffect(() => {
    void load();
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/admin/users", "POST", { username, password, role });
      setUsername("");
      setPassword("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function update(user: User, next: string) {
    if (next === user.role) return;
    if (
      !confirm(
        `${user.username} kullanıcısının yetkisi ${roles[next as User["role"]]} olarak değiştirilsin mi? Kullanıcının açık oturumları kapatılacak.`,
      )
    )
      return;
    setError("");
    setBusy(true);
    try {
      await api(`/admin/users/${user.id}/role`, "PUT", { role: next });
      if (user.id === currentUser.id) {
        window.dispatchEvent(new Event("session-expired"));
      } else await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-page">
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <div className="panel-toolbar">
          <h2>Kullanıcı yetkileri</h2>
          <button
            className="button"
            disabled={busy || loading}
            onClick={() => void load()}
          >
            Yenile
          </button>
        </div>
        <p className="note">
          Yönetici: tüm işlemler ve kullanıcı yönetimi. Düzenleyici: iş
          kayıtları ve raporlar. Görüntüleyici: okuma ve raporlar.
        </p>
        <div className="table-scroll">
          <table className="list-table">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Yetki</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.username}
                    {u.id === currentUser.id ? " (siz)" : ""}
                  </td>
                  <td>
                    <select
                      aria-label={`${u.username} yetkisi`}
                      value={u.role}
                      disabled={busy || loading}
                      onChange={(e) => void update(u, e.target.value)}
                    >
                      {Object.entries(roles).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form className="admin-create" onSubmit={create}>
          <h3>Yeni kullanıcı</h3>
          <fieldset className="form-grid" disabled={busy || loading}>
            <label className="field">
              Kullanıcı adı
              <input
                required
                maxLength={100}
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label className="field">
              İlk parola
              <input
                required
                type="password"
                minLength={12}
                maxLength={256}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <small>En az 12 karakter</small>
            </label>
            <label className="field">
              Yetki
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as User["role"])}
              >
                {Object.entries(roles).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary">Kullanıcı oluştur</button>
          </fieldset>
        </form>
      </section>
      <section className="panel">
        <div className="panel-toolbar">
          <h2>İşlem geçmişi ve log kayıtları</h2>
          <label>
            <input
              type="checkbox"
              checked={showSessions}
              onChange={(e) => setShowSessions(e.target.checked)}
            />{" "}
            Oturum kayıtlarını göster (giriş/çıkış)
          </label>
          <span>
            {visibleLogs.length} kayıt gösteriliyor
            {visibleLogs.length !== logs.length
              ? ` (yüklenen ${logs.length})`
              : ""}
          </span>
        </div>
        <div className="admin-logs">
          {visibleLogs.map((a) => (
            <article className="audit-row" key={a.id}>
              <div>
                <strong>{a.action}</strong>
                <small>
                  {a.username} ·{" "}
                  {new Date(a.created_at).toLocaleString("tr-TR")} · {a.entity}{" "}
                  #{a.entity_id}
                </small>
              </div>
              <details>
                <summary>Değişiklik ayrıntıları</summary>
                <pre>
                  {JSON.stringify(
                    {
                      önce: JSON.parse(a.before_json),
                      sonra: JSON.parse(a.after_json),
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </article>
          ))}
          {!loading && !visibleLogs.length && (
            <Empty>
              {logs.length
                ? "Yüklenen kayıtlar arasında oturum dışı işlem yok."
                : "Henüz işlem kaydı yok."}
            </Empty>
          )}
        </div>
        {hasMore && (
          <div className="panel-toolbar">
            <button
              className="button"
              disabled={loading || loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Yükleniyor…" : "Daha fazla yükle"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
