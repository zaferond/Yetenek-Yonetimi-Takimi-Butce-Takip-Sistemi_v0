import { LogOut, Menu, PanelLeftClose, UserRound } from "lucide-react";
import type { User } from "../types";

export function WorkspaceHeader({
  user,
  title,
  menuOpen,
  busy,
  onMenu,
  onHome,
  onLogout,
}: {
  user: User;
  title: string;
  menuOpen: boolean;
  busy: boolean;
  onMenu: () => void;
  onHome: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="mast">
      <div className="mast-brand">
        <button
          id="workspace-menu-toggle"
          className="icon menu-toggle"
          aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
          aria-controls="workspace-menu"
          aria-expanded={menuOpen}
          onClick={onMenu}
        >
          {menuOpen ? <PanelLeftClose size={20} /> : <Menu size={20} />}
        </button>
        <button
          type="button"
          className="mast-home"
          aria-label="Otokar · Ana sayfaya dön"
          title="Ana sayfaya dön"
          disabled={busy}
          onClick={onHome}
        >
          <img
            src="/assets/otokar-logo.svg"
            alt="Otokar"
            width={86}
            height={24}
          />
        </button>
        <div className="mast-product">
          <strong>Yetenek Yönetimi</strong>
          <span>Bütçe Takip Sistemi</span>
        </div>
        <span className="mast-location">{title}</span>
      </div>
      <div className="mast-actions">
        <span className="mast-user" title={user.username}>
          <UserRound size={16} />
          <span>{user.username}</span>
        </span>
        <button
          className="button logout-button"
          disabled={busy}
          onClick={onLogout}
          aria-label="Çıkış yap"
        >
          <LogOut size={16} />
          <span>Çıkış</span>
        </button>
      </div>
    </header>
  );
}
