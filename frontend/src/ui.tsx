import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type HTMLAttributes,
  type KeyboardEvent,
} from "react";
import { X } from "lucide-react";

export function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const controls = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
    ),
  ).filter((element) => element.getClientRects().length > 0);
  const first = controls[0],
    last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={"modal " + (wide ? "wide" : "")}
      aria-labelledby={titleId}
      onKeyDown={containDialogFocus}
      onFocusCapture={(event) => {
        const field = event.target as HTMLElement;
        const body = field.closest(".dialog-body");
        if (!body) return;
        requestAnimationFrame(() => {
          if (document.activeElement !== field) return;
          const bounds = field.getBoundingClientRect();
          const viewport = body.getBoundingClientRect();
          if (bounds.top < viewport.top || bounds.bottom > viewport.bottom) {
            field.scrollIntoView({ block: "center", inline: "nearest" });
          }
        });
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <div>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button
          type="button"
          className="icon"
          aria-label="Pencereyi kapat"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  required = false,
  error,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;
  const field = isValidElement<HTMLAttributes<HTMLElement>>(children)
    ? cloneElement(children, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : children;
  return (
    <label className={"field " + (error ? "invalid" : "")}>
      <span>
        {label}
        {required && <b className="required"> * </b>}
      </span>
      {field}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} role="alert" className="error-text">
          {error}
        </small>
      )}
    </label>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}
