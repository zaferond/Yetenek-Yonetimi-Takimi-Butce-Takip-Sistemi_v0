import { useState, useEffect, useRef, type FormEvent } from "react";
import { UserRound, LockKeyhole, Eye, EyeOff, ArrowRight } from "lucide-react";
import { api, setCsrf } from "./api";
import type { User } from "./types";
import { containDialogFocus } from "./ui";
export function Login({
  onLogin,
  expired = false,
}: {
  onLogin: (user: User) => void;
  expired?: boolean;
}) {
  const [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [remember, setRemember] = useState(false),
    [visible, setVisible] = useState(false),
    [caps, setCaps] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const reauthRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!expired) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = reauthRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, [expired]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/auth/login", "POST", {
        username,
        password,
        remember,
      });
      setCsrf(r.csrf);
      onLogin(r.user);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const screen = (
    <main className={"auth-screen " + (expired ? "reauth" : "")}>
      <div className="auth-shell">
        <aside className="auth-brand">
          <span className="auth-brand-label">İNSAN, KÜLTÜR VE DÖNÜŞÜM LİDERLİĞİ</span>
          <div className="auth-brand-content">
            <span className="auth-kicker">YETENEK YÖNETİMİ TAKIMI</span>
            <h1>
              Bütçe Takip
              <br />
              Sistemi
            </h1>
            <p>
              Gelişime ayırdığınız bütçeyi planlayın, harcamaları ve faturaları
              tek çalışma alanında takip edin.
            </p>
          </div>
          <div className="auth-brand-footer">
            Planlama · Harcama · Fatura Takibi
          </div>
        </aside>
        <section className="auth-panel" aria-label="Hesap girişi">
          <div className="auth-panel-inner">
            <div className="auth-heading">
              <h2>{expired ? "Oturumunuzu yenileyin" : "Oturum Aç"}</h2>
              <p>
                {expired
                  ? "Düzenlemeleriniz korunuyor. Devam etmek için giriş yapın."
                  : "Kullanıcı adınız ve parolanızla giriş yapın."}
              </p>
            </div>
            <form className="auth-form" onSubmit={submit}>
              <label htmlFor="username">Kullanıcı Adı</label>
              <div className="auth-field">
                <UserRound size={19} />
                <input
                  autoFocus
                  id="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={busy}
                  placeholder="Kullanıcı adınız"
                />
              </div>
              <label htmlFor="password">Parola</label>
              <div className="auth-field">
                <LockKeyhole size={19} />
                <input
                  id="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => setCaps(e.getModifierState("CapsLock"))}
                  required
                  disabled={busy}
                  placeholder="Parolanız"
                />
                <button
                  className="auth-visibility"
                  type="button"
                  aria-label={visible ? "Parolayı gizle" : "Parolayı göster"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {caps && (
                <small className="auth-caps" role="status">
                  Caps Lock açık.
                </small>
              )}
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  disabled={busy}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Beni hatırla</span>
              </label>
              {error && (
                <p role="alert" className="auth-error">
                  {error}
                </p>
              )}
              <button className="auth-submit" disabled={busy}>
                <span>{busy ? "Giriş yapılıyor…" : "Giriş Yap"}</span>
                <ArrowRight size={19} />
              </button>
            </form>
          </div>
          <div className="auth-footer">
            <span>Bütçe ve Eğitim Operasyonları</span>
            <img
              src="/assets/otokar-logo.svg"
              alt="Otokar"
              width={86}
              height={24}
            />
          </div>
        </section>
      </div>
    </main>
  );
  return expired ? (
    <dialog
      className="reauth-dialog"
      ref={reauthRef}
      onCancel={(e) => e.preventDefault()}
      aria-label="Oturum yenileme"
      onKeyDown={containDialogFocus}
    >
      {screen}
    </dialog>
  ) : (
    screen
  );
}
