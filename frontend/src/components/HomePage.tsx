import { modules, type WorkSection } from "../navigation";

/** Decorative illustrations only; these shapes do not represent budget data. */
function CardArt({ section }: { section: WorkSection }) {
  return (
    <div className={`home-card-art art-${section}`} aria-hidden="true">
      <svg viewBox="0 0 320 100" fill="none" focusable="false">
        {section === "budget" && (
          <>
            <rect
              className="art-paper"
              x="62"
              y="13"
              width="196"
              height="76"
              rx="8"
            />
            <path
              className="art-rule"
              d="M62 36h196M112 36v53M160 36v53M208 36v53M62 62h196"
            />
            <path className="art-line" d="M77 25h28m86 0h14m12 0h14" />
            <rect
              className="art-fill"
              x="121"
              y="43"
              width="30"
              height="12"
              rx="3"
            />
            <rect
              className="art-strong"
              x="169"
              y="69"
              width="30"
              height="12"
              rx="3"
            />
            <rect
              className="art-fill"
              x="217"
              y="43"
              width="30"
              height="12"
              rx="3"
            />
          </>
        )}
        {section === "invoices" && (
          <>
            <rect
              className="art-fill"
              x="126"
              y="19"
              width="90"
              height="73"
              rx="6"
              transform="rotate(9 126 19)"
            />
            <path
              className="art-paper"
              d="M109 9h91v79l-9-5-9 5-9-5-9 5-9-5-9 5-9-5-9 5-9-5-10 5Z"
            />
            <path
              className="art-line"
              d="M125 26h30m-30 14h58m-58 13h58m-58 14h25m16 0h17"
            />
            <circle className="art-strong" cx="215" cy="66" r="18" />
            <path className="art-white" d="m207 66 5 5 11-11" />
          </>
        )}
        {section === "payments" && (
          <>
            <rect
              className="art-paper"
              x="83"
              y="19"
              width="139"
              height="69"
              rx="8"
            />
            <path className="art-line" d="M83 38h139M111 12v14m82-14v14" />
            {[0, 1, 2, 3, 4].map((i) => (
              <rect
                key={i}
                className={i === 2 ? "art-strong" : "art-fill"}
                x={98 + i * 23}
                y="49"
                width="13"
                height="12"
                rx="3"
              />
            ))}
            {[0, 1, 2].map((i) => (
              <rect
                key={i}
                className="art-fill"
                x={98 + i * 23}
                y="68"
                width="13"
                height="10"
                rx="3"
              />
            ))}
            <circle className="art-paper" cx="221" cy="73" r="20" />
            <path className="art-line" d="M221 61v13l8 5" />
          </>
        )}
        {section === "savings" && (
          <>
            <path className="art-rule" d="M74 83h180M83 19v64" />
            <rect
              className="art-fill"
              x="103"
              y="52"
              width="24"
              height="31"
              rx="3"
            />
            <rect
              className="art-fill"
              x="145"
              y="36"
              width="24"
              height="47"
              rx="3"
            />
            <rect
              className="art-strong"
              x="187"
              y="19"
              width="24"
              height="64"
              rx="3"
            />
            <path
              className="art-line"
              d="m100 41 42-17 34 3 48-16m-12 0h12v12"
            />
            <circle className="art-paper" cx="239" cy="65" r="17" />
            <path className="art-line" d="m232 65 5 5 10-11" />
          </>
        )}
      </svg>
    </div>
  );
}

export function HomePage({
  onOpen,
  disabled,
}: {
  onOpen: (section: WorkSection) => void;
  disabled: boolean;
}) {
  return (
    <section className="home-page" aria-label="Modüller">
      <div className="home-cards">
        {modules.map(({ id, label, group }) => (
          <button
            key={id}
            className="home-card"
            type="button"
            aria-label={label}
            onClick={() => onOpen(id)}
            disabled={disabled}
          >
            <CardArt section={id} />
            <span className="home-card-body">
              <span className="home-card-top">
                <span className="home-card-group">{group}</span>
              </span>
              <strong>{label}</strong>
              <span className="home-card-go">Çalışma alanını aç</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
