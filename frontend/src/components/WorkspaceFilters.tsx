import type { ReactNode } from "react";
import { RefreshCw, Search, X } from "lucide-react";
import { MONTHS } from "../../../shared/domain.mjs";
import type { Section } from "../navigation";
import type { Snapshot } from "../types";

export function WorkspaceFilters({
  data,
  year,
  section,
  month,
  category,
  search,
  loading,
  busy,
  onYear,
  onVersion,
  onMonth,
  onCategory,
  onSearch,
  onRefresh,
  actions,
}: {
  data: Snapshot;
  year: number;
  section: Section;
  month: string;
  category: string;
  search: string;
  loading: boolean;
  busy: boolean;
  onYear: (value: number) => void;
  onVersion: (value: number) => void;
  onMonth: (value: string) => void;
  onCategory: (value: string) => void;
  onSearch: (value: string) => void;
  onRefresh: () => void;
  actions?: ReactNode;
}) {
  const detailed = section !== "home" && section !== "savings";
  const filtered = Boolean(month || category || search);
  const [from, to] = month.includes("-")
    ? month.split("-").map(Number)
    : [1, 12];
  return (
    <section
      className={`workspace-filters ${detailed ? "" : "compact"}`}
      aria-label="Çalışma alanı filtreleri"
    >
      <div className="filterbar">
        <label>
          Yıl
          <select
            aria-label="Bütçe yılı"
            value={year}
            disabled={loading || busy}
            onChange={(e) => onYear(Number(e.target.value))}
          >
            {data.years.map((y) => (
              <option key={y.year}>{y.year}</option>
            ))}
          </select>
        </label>
        <label>
          Planlama Dönemi
          <select
            aria-label="Plan versiyonu"
            value={data.version?.id || ""}
            disabled={loading || busy}
            onChange={(e) => onVersion(Number(e.target.value))}
          >
            {!data.versions.length && <option value="">Plan yok</option>}
            {data.versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.active ? " · Aktif" : ""}
              </option>
            ))}
          </select>
        </label>
        {detailed && (
          <>
            <label>
              Dönem
              <select
                aria-label="Dönem filtresi"
                value={month.includes("-") ? "range" : month}
                onChange={(e) =>
                  onMonth(e.target.value === "range" ? "1-12" : e.target.value)
                }
                disabled={loading || busy}
              >
                <option value="">Tüm yıl</option>
                <option value="range">Ay aralığı</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            {month.includes("-") && (
              <>
                <label>
                  Başlangıç ayı
                  <select
                    aria-label="Başlangıç ayı"
                    value={from}
                    disabled={loading || busy}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      onMonth(`${n}-${Math.max(n, to)}`);
                    }}
                  >
                    {MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Bitiş ayı
                  <select
                    aria-label="Bitiş ayı"
                    value={to}
                    disabled={loading || busy}
                    onChange={(e) => onMonth(`${from}-${e.target.value}`)}
                  >
                    {MONTHS.map(
                      (m, i) =>
                        i + 1 >= from && (
                          <option key={m} value={i + 1}>
                            {m}
                          </option>
                        ),
                    )}
                  </select>
                </label>
              </>
            )}
            <label className="category-field">
              Bütçe kalemi
              <select
                className="category-filter"
                aria-label="Bütçe kalemi filtresi"
                value={category}
                onChange={(e) => onCategory(e.target.value)}
                disabled={loading || busy}
              >
                <option value="">Tüm kalemler</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="search">
              <Search size={17} aria-hidden="true" />
              <input
                aria-label="Kayıtlarda ara"
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={
                  section === "invoices"
                    ? "Fatura veya eğitim ara…"
                    : "Kayıtlarda ara…"
                }
                disabled={loading || busy}
              />
            </label>
          </>
        )}
        {actions}
        <button
          className="icon refresh-button"
          aria-label="Verileri yenile"
          title="Verileri yenile"
          disabled={loading || busy}
          onClick={onRefresh}
        >
          <RefreshCw size={18} className={loading ? "spin" : ""} />
        </button>
      </div>
      {detailed && filtered && (
        <div className="filter-summary">
          {filtered && (
            <button
              className="link"
              disabled={loading || busy}
              onClick={() => {
                onMonth("");
                onCategory("");
                onSearch("");
              }}
            >
              <X size={13} /> Filtreleri temizle
            </button>
          )}
        </div>
      )}
    </section>
  );
}
