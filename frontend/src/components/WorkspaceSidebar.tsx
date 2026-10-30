import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { navigation, type Section } from "../navigation";
import { containDialogFocus } from "../ui";

export function WorkspaceSidebar({
  active,
  isAdmin,
  open,
  mobile,
  disabled,
  invoiceCount,
  onClose,
  onOpen,
}: {
  active: Section;
  isAdmin: boolean;
  open: boolean;
  mobile: boolean;
  disabled: boolean;
  invoiceCount: number;
  onClose: () => void;
  onOpen: (section: Section) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open || !mobile) return;
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    return () => {
      node?.close();
      previous?.focus();
    };
  }, [open, mobile]);

  const content = (
    <>
      <div className="sidebar-heading">
        <span>Çalışma alanı</span>
        <button
          className="icon"
          aria-label="Yan menüyü kapat"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <nav aria-label="Çalışma alanı bölümleri">
        {navigation
          .filter((item) => item.id !== "admin" || isAdmin)
          .map(({ id, label, shortLabel, Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              disabled={disabled}
              aria-current={active === id ? "page" : undefined}
              className={active === id ? "selected" : ""}
              onClick={() => onOpen(id)}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{shortLabel}</span>
              {id === "invoices" && (
                <span className="nav-count" aria-hidden="true">
                  {invoiceCount}
                </span>
              )}
            </button>
          ))}
      </nav>
    </>
  );

  if (mobile)
    return (
      <dialog
        id="workspace-menu"
        className="sidebar-drawer"
        ref={dialog}
        aria-label="Çalışma alanı menüsü"
        onKeyDown={containDialogFocus}
        onCancel={(event) => {
          event.preventDefault();
          onClose();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX > rect.right) onClose();
          }
        }}
      >
        {content}
      </dialog>
    );
  return (
    <aside id="workspace-menu" className="workspace-sidebar" hidden={!open}>
      {content}
    </aside>
  );
}
