import { AdminPage } from "./components/AdminPage";
import { NewYearForm } from "./components/NewYearForm";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  Plus,
  Save,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Link2,
  Check,
  FolderOpen,
} from "lucide-react";
import {
  MONTHS,
  money,
  editAmount,
  parseAmount,
  sum,
  subtract,
  rate,
} from "../../shared/domain.mjs";
import { api, ApiError } from "./api";
import { budgetView, invoiceView } from "../../shared/report-scope.mjs";
import type { Snapshot, User, Invoice, BudgetRow } from "./types";
import { InvoiceEditor } from "./InvoiceEditor";
import { RecordEditor, type EditorSpec } from "./RecordEditor";
import { Empty, Modal } from "./ui";
import { navigation, type Section } from "./navigation";
import { WorkspaceHeader } from "./components/WorkspaceHeader";
import { WorkspaceSidebar } from "./components/WorkspaceSidebar";
import { WorkspaceFilters } from "./components/WorkspaceFilters";
import { BudgetMetrics } from "./components/BudgetMetrics";
import { HomePage } from "./components/HomePage";
export function Workspace({
  user,
  onLogout,
}: {
  user: User;
  onLogout: () => void;
}) {
  const [data, setData] = useState<Snapshot | null>(null),
    [year, setYear] = useState(2026),
    [version, setVersion] = useState<number | undefined>(),
    [tab, setTab] = useState<Section>("home"),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [searches, setSearches] = useState<Partial<Record<Section, string>>>(
      {},
    ),
    [category, setCategory] = useState(""),
    [month, setMonth] = useState(""),
    [hideZero, setHideZero] = useState(false),
    [showCancelled, setShowCancelled] = useState(false),
    [expanded, setExpanded] = useState<Set<number>>(new Set()),
    [draft, setDraft] = useState<Record<string, string>>({}),
    [cellError, setCellError] = useState<Record<string, string>>({});
  const [editor, setEditor] = useState<EditorSpec | null>(null),
    [invoiceEditor, setInvoiceEditor] = useState<{
      invoice?: Invoice;
      category?: number;
    } | null>(null),
    [categoriesOpen, setCategoriesOpen] = useState(false);
  const canEdit = user.role !== "viewer";
  const search = searches[tab] || "";
  const setSearch = (value: string) =>
    setSearches((previous) => ({ ...previous, [tab]: value }));
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 900px)").matches,
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const update = () => {
      setMobile(query.matches);
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    setMenuOpen(false);
  }, [mobile]);
  useEffect(() => {
    if (focusHeading.current) headingRef.current?.focus();
  }, [tab]);
  function navigate(next: Section) {
    if (loading || busy || editor || invoiceEditor || categoriesOpen) return;
    if (next === "admin" && user.role !== "admin") return;
    if (next !== tab && !discard()) return;
    focusHeading.current = true;
    setTab(next);
    setMenuOpen(!mobile && next !== "home");
  }
  const requestId = useRef(0),
    dirty = Object.keys(draft).length > 0;
  async function load(y = year, v = version) {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await api<Snapshot>(
        `/state?year=${y}${v ? `&version=${v}` : ""}`,
      );
      if (id === requestId.current) {
        setData(next);
        setError("");
      }
    } catch (e) {
      if (id === requestId.current) setError((e as Error).message);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [year, version]);
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty || editor || invoiceEditor) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, editor, invoiceEditor]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  function discard() {
    if (
      dirty &&
      !confirm("Kaydedilmemiş bütçe değişikliklerinden vazgeçilsin mi?")
    )
      return false;
    setDraft({});
    setCellError({});
    return true;
  }
  function openEditor(spec: EditorSpec) {
    if (!canEdit) return;
    if (dirty) {
      setError("Önce bütçe değişikliklerini kaydedin veya geri alın.");
      return;
    }
    setEditor(spec);
  }
  function openInvoice(invoice?: Invoice, c?: number) {
    if (!canEdit) return;
    if (dirty) {
      setError("Önce bütçe değişikliklerini kaydedin veya geri alın.");
      return;
    }
    setInvoiceEditor({ invoice, category: c });
  }
  async function save(path: string, body: unknown, method = "POST") {
    if (!canEdit)
      throw new Error("Bu hesap yalnız görüntüleme yetkisine sahiptir.");
    if (!data) throw new Error("Veriler henüz yüklenmedi.");
    const result = await api(path, method, {
      ...(body as object),
      revision: data.revision,
    });
    setEditor(null);
    setInvoiceEditor(null);
    setDraft({});
    setCellError({});
    setNotice("Değişiklikler kaydedildi.");
    // A committed write is never retried because a following refresh failed.
    if (path === "/years") {
      setVersion(undefined);
      setYear(result.result.year);
    } else if (path === "/versions") {
      setVersion(result.result.id);
    } else await load();
  }
  async function action(
    path: string,
    body: unknown = {},
    method = "POST",
    message?: string,
  ) {
    if (dirty) {
      setError("Önce bütçe değişikliklerini kaydedin veya geri alın.");
      return;
    }
    if (message && !confirm(message)) return;
    setBusy(true);
    try {
      await save(path, body, method);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function savePlan() {
    if (!canEdit || !data?.version) return;
    setBusy(true);
    setError("");
    try {
      const cells = Object.entries(draft).map(([key, amount]) => {
        parseAmount(amount, key);
        const [category_id, month] = key.split(":").map(Number);
        return { category_id, month, amount };
      });
      await save("/plan", { version_id: data.version.id, cells }, "PUT");
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      if (err.field) setCellError({ [err.field]: err.message });
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (!discard()) return;
    try {
      await api("/auth/logout", "POST", {});
      onLogout();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!data)
    return (
      <main className="loading">
        {loading ? (
          "Bütçe verileri yükleniyor…"
        ) : (
          <>
            <p role="alert">{error}</p>
            <button className="button primary" onClick={() => load()}>
              Tekrar dene
            </button>
          </>
        )}
      </main>
    );
  const name = (id: number) =>
    data.categories.find((c) => c.id === id)?.name || "—";
  const [fromMonth, toMonth] = !month
    ? [1, 12]
    : month.includes("-")
      ? month.split("-").map(Number)
      : [Number(month), Number(month)];
  const inPeriod = (m: number) => m >= fromMonth && m <= toMonth;
  const inScope = (c: number, m: number) =>
    (!category || c === Number(category)) && inPeriod(m);
  const budgetScope = budgetView(data, {
    from: fromMonth,
    to: toMonth,
    category: Number(category),
    search,
    hideZero,
    periodFiltered: Boolean(month),
  });
  const scopedRows: BudgetRow[] = budgetScope.rows;
  const total = (
    key: "plan" | "actual" | "remaining" | "pending" | "available",
  ) => sum(scopedRows.map((r) => r[key]));
  const invoices: Invoice[] = invoiceView(data, {
    from: fromMonth,
    to: toMonth,
    category: Number(category),
    search,
    showCancelled,
  });
  const payments = data.payments.filter(
    (p) =>
      (showCancelled || p.status === "active") &&
      inScope(p.category_id, p.month) &&
      (p.description + " " + name(p.category_id))
        .toLocaleLowerCase("tr-TR")
        .includes(search.toLocaleLowerCase("tr-TR")),
  );
  const paymentSavings = data.payments.filter(
    (p) => p.status === "active" && p.saving_units !== "0",
  );
  const reference =
      data.version?.effective_budget_units ??
      data.years.find((y) => y.year === year)?.reference_units ??
      "0",
    savingsTotal = sum([
      ...data.savings.map((s) => s.amount_units),
      ...paymentSavings.map((p) => p.saving_units),
    ]);
  const title = navigation.find((t) => t.id === tab)!.label;
  return (
    <div className={"app" + (menuOpen && !mobile ? " menu-open" : "")}>
      <a className="skip-link" href="#workspace-content">
        İçeriğe geç
      </a>
      <WorkspaceHeader
        user={user}
        title={title}
        menuOpen={menuOpen}
        busy={loading || busy}
        onMenu={() => setMenuOpen(!menuOpen)}
        onHome={() => navigate("home")}
        onLogout={logout}
      />
      <WorkspaceSidebar
        isAdmin={user.role === "admin"}
        active={tab}
        open={menuOpen}
        mobile={mobile}
        disabled={loading || busy}
        invoiceCount={data.invoices.filter((i) => i.status === "active").length}
        onClose={() => {
          setMenuOpen(false);
          document.getElementById("workspace-menu-toggle")?.focus();
        }}
        onOpen={navigate}
      />
      <main className="workspace" id="workspace-content" tabIndex={-1}>
        <div className="page-heading">
          <div>
            <div className="breadcrumb">
              İnsan, Kültür ve Dönüşüm Liderliği{" "}
              <span aria-hidden="true">&gt;</span> Yetenek Yönetimi
            </div>
            <h1 ref={headingRef} tabIndex={-1}>
              {title}
            </h1>
          </div>
          <div className="heading-actions">
            {tab === "invoices" && canEdit && (
              <button
                className="button primary"
                onClick={() => openInvoice()}
                disabled={loading || busy}
              >
                <Plus size={17} />
                Yeni fatura
              </button>
            )}
          </div>
        </div>
        {tab !== "home" && tab !== "admin" && (
          <WorkspaceFilters
            data={data}
            year={year}
            section={tab}
            month={month}
            category={category}
            search={search}
            loading={loading}
            busy={busy}
            onYear={(value) => {
              if (discard()) {
                setYear(value);
                setVersion(undefined);
              }
            }}
            onVersion={(value) => {
              if (discard()) setVersion(value);
            }}
            onMonth={setMonth}
            onCategory={setCategory}
            onSearch={setSearch}
            actions={
              <>
                {(tab === "budget" || tab === "invoices") && (
                  <button
                    className="button"
                    disabled={loading || busy || (tab === "budget" && dirty)}
                    title={
                      tab === "budget" && dirty
                        ? "Excel'e aktarmadan önce bütçe değişikliklerini kaydedin."
                        : undefined
                    }
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const exportSection =
                          tab === "budget" ? "budget" : "invoices";
                        const params = new URLSearchParams({
                          year: String(year),
                          from: String(fromMonth),
                          to: String(toMonth),
                          category,
                          search,
                          periodFiltered: String(Boolean(month)),
                          hideZero: String(hideZero),
                          showCancelled: String(showCancelled),
                          revision: String(data.revision),
                        });
                        if (data.version)
                          params.set("version", String(data.version.id));
                        const response = await fetch(
                          `/api/${exportSection}/export?${params}`,
                        );
                        if (!response.ok) {
                          if (response.status === 401)
                            window.dispatchEvent(new Event("session-expired"));
                          throw new Error(
                            (await response.json()).error ||
                              "Excel oluşturulamadı.",
                          );
                        }
                        const url = URL.createObjectURL(await response.blob());
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `${tab === "budget" ? "butce-planlama" : "faturalar"}-${year}-${fromMonth}-${toMonth}.xlsx`;
                        link.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Excel'e aktar
                  </button>
                )}
                {tab === "savings" && canEdit && (
                  <NewYearForm
                    nextYear={Math.min(
                      2100,
                      Math.max(year, ...data.years.map((y) => y.year)) + 1,
                    )}
                    onSave={save}
                  />
                )}
              </>
            }
            onRefresh={() => {
              if (discard()) void load();
            }}
          />
        )}
        {error && (
          <div className="error-box" role="alert">
            {error}
            <button className="link" onClick={() => setError("")}>
              Kapat
            </button>
          </div>
        )}
        {notice && (
          <div className="toast" role="status">
            <Check size={17} />
            {notice}
          </div>
        )}
        <div
          className={loading || busy ? "content is-busy" : "content"}
          aria-busy={loading || busy}
        >
          {tab === "admin" && user.role === "admin" && (
            <AdminPage currentUser={user} />
          )}
          {tab === "home" && (
            <HomePage onOpen={navigate} disabled={loading || busy} />
          )}
          {tab === "budget" && (
            <>
              <BudgetMetrics
                totals={budgetScope.totals}
                month={month}
                annual={budgetScope.annual}
                version={data.version?.name}
              />
              <section className="panel">
                <div className="panel-toolbar">
                  <div>
                    <h2>
                      Aylık Bütçe Planı{" "}
                      <span className="pill">{scopedRows.length} kalem</span>
                    </h2>
                    <p>{year} · Plan ve gerçekleşen tutarlar</p>
                  </div>
                  <div className="toolbar-actions">
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={hideZero}
                        onChange={(e) => setHideZero(e.target.checked)}
                      />
                      Boş kalemleri gizle
                    </label>
                    <button
                      className="button small"
                      onClick={() =>
                        setExpanded(
                          expanded.size
                            ? new Set()
                            : new Set(scopedRows.map((r) => r.id)),
                        )
                      }
                    >
                      {expanded.size ? "Detayları kapat" : "Detayları aç"}
                    </button>
                    <button
                      disabled={!canEdit}
                      className="button small"
                      onClick={() => setCategoriesOpen(true)}
                    >
                      <FolderOpen size={15} />
                      Kalemler
                    </button>
                  </div>
                </div>
                <div
                  className="table-scroll budget-scroll"
                  tabIndex={0}
                  aria-label="Aylık bütçe tablosu; tüm aylar için yatay kaydırın"
                >
                  <table className="budget-table">
                    <thead>
                      <tr>
                        <th className="frozen">Bütçe kalemi</th>
                        {MONTHS.map((m, i) => (
                          <th key={m} className={!inPeriod(i + 1) ? "dim" : ""}>
                            {m}
                          </th>
                        ))}
                        {[
                          "Plan toplamı",
                          "Harcanan",
                          "Kalan",
                          "Planlı ödeme",
                          "Son kalan",
                          "Kullanım",
                        ].map((h) => (
                          <th key={h} className="summary-col">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scopedRows.map((r) => (
                        <Fragment key={r.id}>
                          <tr className="plan-row">
                            <th className="frozen">
                              <div className="row-label">
                                <button
                                  className="icon"
                                  aria-label={`${r.name} detayları`}
                                  aria-expanded={expanded.has(r.id)}
                                  onClick={() => {
                                    const n = new Set(expanded);
                                    n.has(r.id) ? n.delete(r.id) : n.add(r.id);
                                    setExpanded(n);
                                  }}
                                >
                                  {expanded.has(r.id) ? (
                                    <ChevronDown size={16} />
                                  ) : (
                                    <ChevronRight size={16} />
                                  )}
                                </button>
                                <span>
                                  {r.name}
                                  <small>Planlanan</small>
                                </span>
                              </div>
                            </th>
                            {r.months.map((m, i) => {
                              const key = `${r.id}:${i + 1}`,
                                changed = key in draft;
                              return (
                                <td
                                  key={i}
                                  className={
                                    (!inPeriod(i + 1) ? "dim " : "") +
                                    (changed ? "edited" : "")
                                  }
                                >
                                  <input
                                    aria-label={`${r.name} ${MONTHS[i]} planı`}
                                    title={
                                      cellError[key] ||
                                      "TL · En fazla 6 ondalık"
                                    }
                                    aria-invalid={Boolean(cellError[key])}
                                    className={
                                      cellError[key] ? "invalid-input" : ""
                                    }
                                    inputMode="decimal"
                                    value={
                                      changed ? draft[key] : editAmount(m.plan)
                                    }
                                    onChange={(e) => {
                                      setDraft({
                                        ...draft,
                                        [key]: e.target.value,
                                      });
                                      setCellError({ ...cellError, [key]: "" });
                                    }}
                                    disabled={!canEdit || loading || busy}
                                  />
                                </td>
                              );
                            })}
                            <td className="summary-col">
                              <strong>{money(r.plan)}</strong>
                            </td>
                            <td>{money(r.actual)}</td>
                            <td
                              className={
                                BigInt(r.remaining) < 0n ? "negative" : ""
                              }
                            >
                              {money(r.remaining)}
                            </td>
                            <td>{money(r.pending)}</td>
                            <td
                              className={
                                BigInt(r.available) < 0n
                                  ? "negative"
                                  : "positive"
                              }
                            >
                              <strong>{money(r.available)}</strong>
                            </td>
                            <td>
                              <Usage row={r} />
                            </td>
                          </tr>
                          <tr className="actual-row">
                            <th className="frozen">Gerçekleşen</th>
                            {r.months.map((m, i) => (
                              <td
                                key={i}
                                className={!inPeriod(i + 1) ? "dim" : ""}
                              >
                                {m.actual === "0" ? "—" : money(m.actual)}
                              </td>
                            ))}
                            <td colSpan={6}>
                              {BigInt(r.remaining) < 0n ? (
                                <span className="danger-text">
                                  Bütçe aşımı:{" "}
                                  {money(subtract(r.actual, r.plan))} TL
                                </span>
                              ) : r.plan === "0" && r.actual !== "0" ? (
                                <span className="danger-text">
                                  Plansız harcama
                                </span>
                              ) : (
                                <span>{r.details.length} harcama kalemi</span>
                              )}
                            </td>
                          </tr>
                          {expanded.has(r.id) && (
                            <tr>
                              <td colSpan={19} className="detail-cell">
                                <div className="detail-inner">
                                  <div className="section-heading">
                                    <h3>{r.name} · Harcama detayları</h3>
                                  </div>
                                  {r.details.length ? (
                                    <table className="detail-table">
                                      <thead>
                                        <tr>
                                          <th>Eğitim adı</th>
                                          <th>Dönem</th>
                                          <th>Fatura no.</th>
                                          <th>Tutar · TL</th>
                                          <th>Katılımcı / Ar-Ge / Diğer</th>
                                          <th>Açıklama</th>
                                          <th>Döviz / Kur</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {r.details.map((l) => (
                                          <tr key={l.id}>
                                            <td>{l.training_name}</td>
                                            <td>
                                              {MONTHS[l.month - 1]} {l.year}
                                            </td>
                                            <td>
                                              <button
                                                disabled={!canEdit}
                                                className="link"
                                                onClick={() =>
                                                  openInvoice(
                                                    data.invoices.find(
                                                      (i) =>
                                                        i.id === l.invoice_id,
                                                    ),
                                                  )
                                                }
                                              >
                                                {l.number}
                                              </button>
                                            </td>
                                            <td>{money(l.amount_units)}</td>
                                            <td>
                                              {l.participant_count} /{" "}
                                              {l.rd_participant_count} /{" "}
                                              {l.other_participant_count}
                                            </td>
                                            <td>{l.description || "—"}</td>
                                            <td>
                                              {l.foreign_units !== null
                                                ? `${money(l.foreign_units)} ${l.currency} / ${editAmount(l.rate_units!)}`
                                                : "—"}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <Empty>
                                      Seçili dönemde bu bütçe kalemine bağlı
                                      harcama yok.
                                    </Empty>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th className="frozen">TOPLAM</th>
                        {MONTHS.map((_, i) => (
                          <td key={i}>
                            {money(
                              sum(scopedRows.map((r) => r.months[i].plan)),
                            )}
                          </td>
                        ))}
                        {(
                          [
                            "plan",
                            "actual",
                            "remaining",
                            "pending",
                            "available",
                          ] as const
                        ).map((k) => (
                          <td key={k}>{money(total(k))}</td>
                        ))}
                        <td>
                          {rate(total("actual"), total("plan")) === null
                            ? "—"
                            : `%${rate(total("actual"), total("plan"))}`}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!scopedRows.length && (
                  <Empty>Filtrelere uyan bütçe kalemi bulunamadı.</Empty>
                )}
                <div className="table-footer">
                  <span>
                    <span className="legend plan" />
                    Planlanan <span className="legend actual" />
                    Gerçekleşen
                  </span>
                </div>
              </section>
              {dirty && (
                <div className="savebar">
                  <span>
                    <b>{Object.keys(draft).length} hücre değişti.</b> Özetler
                    son kaydedilen tutarları gösteriyor.
                  </span>
                  <button className="button" onClick={discard} disabled={busy}>
                    Geri al
                  </button>
                  <button
                    className="button primary"
                    onClick={savePlan}
                    disabled={busy}
                  >
                    <Save size={16} />
                    {busy ? "Kaydediliyor…" : "Bütçeyi kaydet"}
                  </button>
                </div>
              )}
            </>
          )}
          {tab === "invoices" && (
            <section className="panel">
              <div className="panel-toolbar">
                <div>
                  <h2>
                    Fatura kayıtları{" "}
                    <span className="pill">{invoices.length} kayıt</span>
                  </h2>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={showCancelled}
                    onChange={(e) => setShowCancelled(e.target.checked)}
                  />
                  İptalleri göster
                </label>
              </div>
              <div className="table-scroll">
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>Fatura / Eğitim</th>
                      <th>Dönem</th>
                      <th>Bütçe kalemi</th>
                      <th>Tutar · TL</th>
                      <th>Katılımcı</th>
                      <th>Durum</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <button
                            disabled={!canEdit}
                            className="link strong"
                            onClick={() => openInvoice(i)}
                          >
                            {i.number}
                          </button>
                          <small>
                            {i.lines.map((l) => l.training_name).join(", ")}
                          </small>
                        </td>
                        <td>
                          {MONTHS[i.month - 1]} {i.year}
                        </td>
                        <td>
                          {[
                            ...new Set(i.lines.map((l) => name(l.category_id))),
                          ].join(", ")}
                        </td>
                        <td className="numeric">
                          {money(sum(i.lines.map((l) => l.amount_units)))}
                        </td>
                        <td>
                          {i.lines.reduce((a, l) => a + l.participant_count, 0)}
                        </td>
                        <td>
                          <span
                            className={
                              "status " +
                              (i.status === "active" ? "active" : "cancelled")
                            }
                          >
                            {i.status === "active"
                              ? "Kaydedildi"
                              : "İptal edildi"}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              disabled={!canEdit}
                              className="icon"
                              aria-label={`${i.number} düzenle`}
                              onClick={() => openInvoice(i)}
                            >
                              <Pencil size={16} />
                            </button>
                            {i.status === "active" && (
                              <button
                                disabled={!canEdit}
                                className="icon danger"
                                aria-label={`${i.number} iptal et`}
                                onClick={() =>
                                  action(
                                    `/invoices/${i.id}/cancel`,
                                    {},
                                    "POST",
                                    "Fatura iptal edilsin mi? Harcama toplamından çıkarılacak; bağlı planlı ödeme bakiyesi yeniden açılacak.",
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!invoices.length && (
                <Empty>
                  Henüz bu filtrelere uyan fatura yok. “Yeni fatura” ile kayıt
                  ekleyebilirsiniz.
                </Empty>
              )}
            </section>
          )}
          {tab === "payments" && (
            <section className="panel">
              <div className="panel-toolbar">
                <div>
                  <h2>Planlı Ödemeler</h2>
                </div>
                <div className="toolbar-actions">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={showCancelled}
                      onChange={(e) => setShowCancelled(e.target.checked)}
                    />
                    İptalleri göster
                  </label>
                  <button
                    disabled={!canEdit}
                    className="button primary"
                    onClick={() => openEditor({ kind: "payment" })}
                  >
                    <Plus size={16} />
                    Planlı ödeme ekle
                  </button>
                </div>
              </div>
              <div className="table-scroll">
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>Açıklama / Bütçe kalemi</th>
                      <th>Dönem</th>
                      <th>Planlanan · TL</th>
                      <th>Faturalanan · TL</th>
                      <th>Tasarruf · TL</th>
                      <th>Bekleyen · TL</th>
                      <th>Durum</th>
                      <th>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <Fragment key={p.id}>
                        <tr>
                          <td>
                            <strong>{p.description}</strong>
                            <small>{name(p.category_id)}</small>
                          </td>
                          <td>
                            {MONTHS[p.month - 1]} {p.year}
                          </td>
                          <td className="numeric">{money(p.amount_units)}</td>
                          <td className="numeric">{money(p.linked_units)}</td>
                          <td className="numeric">
                            {money(p.saving_units)}
                            {p.saving_note && <small>{p.saving_note}</small>}
                          </td>
                          <td className="numeric">
                            <strong>{money(p.remaining_units)}</strong>
                          </td>
                          <td>
                            <span
                              className={
                                "status " +
                                (p.status === "cancelled"
                                  ? "cancelled"
                                  : "active")
                              }
                            >
                              {p.status === "cancelled"
                                ? "İptal"
                                : p.remaining_units === "0"
                                  ? "Tamamlandı"
                                  : p.linked_units === "0"
                                    ? "Planlandı"
                                    : "Kısmi fatura"}
                            </span>
                          </td>
                          <td>
                            {p.status === "active" && (
                              <div className="row-actions">
                                <button
                                  disabled={!canEdit}
                                  className="button small"
                                  onClick={() =>
                                    openEditor({ kind: "link", record: p })
                                  }
                                >
                                  <Link2 size={14} />
                                  Eşleştir
                                </button>
                                <button
                                  disabled={
                                    !canEdit ||
                                    (p.remaining_units === "0" &&
                                      p.saving_units === "0")
                                  }
                                  className="button small"
                                  onClick={() =>
                                    openEditor({
                                      kind: "payment-saving",
                                      record: p,
                                    })
                                  }
                                >
                                  {p.saving_units === "0"
                                    ? "Tasarrufa ayır"
                                    : "Tasarrufu düzenle"}
                                </button>
                                <button
                                  disabled={!canEdit}
                                  className="icon"
                                  aria-label={`${p.description} düzenle`}
                                  onClick={() =>
                                    openEditor({ kind: "payment", record: p })
                                  }
                                >
                                  <Pencil size={16} />
                                </button>
                                <button
                                  disabled={!canEdit}
                                  className="icon danger"
                                  aria-label={`${p.description} iptal et`}
                                  onClick={() =>
                                    action(
                                      `/payments/${p.id}/cancel`,
                                      {},
                                      "POST",
                                      "Planlı ödeme iptal edilsin mi? Faturalar korunur; bekleyen tutar ve bu ödemeye ait tasarruf toplamdan çıkarılır.",
                                    )
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {data.links
                          .filter((l) => l.payment_id === p.id)
                          .map((l) => {
                            const inv = data.invoices.find((i) =>
                              i.lines.some((il) => il.id === l.line_id),
                            );
                            return (
                              <tr key={`link${l.id}`} className="link-row">
                                <td colSpan={7}>
                                  <Link2 size={14} /> Fatura {inv?.number} ·{" "}
                                  {money(l.amount_units)} TL{" "}
                                  {inv?.status === "cancelled"
                                    ? "· Fatura iptal; bu eşleştirme bakiyeden düşülmez."
                                    : ""}
                                </td>
                                <td>
                                  <button
                                    disabled={!canEdit}
                                    className="link"
                                    onClick={() =>
                                      action(
                                        `/links/${l.id}`,
                                        {},
                                        "DELETE",
                                        "Eşleştirme kaldırılsın mı?",
                                      )
                                    }
                                  >
                                    Eşleştirmeyi kaldır
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {!payments.length && (
                <Empty>Seçili dönemde planlı ödeme yok.</Empty>
              )}
            </section>
          )}
          {tab === "savings" && (
            <>
              <section className="metrics three">
                <Metric
                  title={`${year} Bütçe`}
                  onUpdate={
                    canEdit
                      ? () => openEditor({ kind: "reference" })
                      : undefined
                  }
                  value={reference}
                  caption={
                    data.version?.name
                      ? `${data.version.name} · Yıllık bütçe`
                      : "Yıllık bütçe"
                  }
                />
                <Metric
                  title="Tasarruf detay toplamı"
                  value={savingsTotal}
                  caption="Versiyon detayları ve planlı ödeme tasarrufları"
                />
                <Metric
                  title="Tasarruflu bütçe"
                  value={subtract(reference, savingsTotal)}
                  caption="Bütçe − tasarruf detay toplamı"
                />
              </section>
              <div className="split-panels">
                <section className="panel">
                  <div className="panel-toolbar">
                    <div>
                      <h2>Bütçe versiyonları</h2>
                      <p>Gerçekleşen harcamalar tüm versiyonlarda ortaktır.</p>
                    </div>
                    <button
                      disabled={!canEdit}
                      className="button primary small"
                      onClick={() => openEditor({ kind: "version" })}
                    >
                      <Plus size={15} />
                      Yeni versiyon
                    </button>
                  </div>
                  <div className="version-list">
                    {data.versions.map((v) => (
                      <article
                        key={v.id}
                        className={
                          "version-card " +
                          (v.id === data.version?.id ? "selected" : "")
                        }
                      >
                        <div>
                          <strong>{v.name}</strong>
                          {Boolean(v.active) && (
                            <span className="status active">Aktif takip</span>
                          )}
                          {v.budget_changed !== null && (
                            <p>
                              Bütçe değişikliği:{" "}
                              {v.budget_changed ? "Var" : "Yok"}
                            </p>
                          )}
                          <p>{v.description}</p>
                          <small>
                            {new Date(v.created_at).toLocaleString("tr-TR")}
                          </small>
                        </div>
                        <div className="align-right">
                          <strong>{money(v.effective_budget_units)} TL</strong>
                          <button
                            disabled={!canEdit}
                            className="button small"
                            aria-label={`${v.name} versiyonunu düzenle`}
                            onClick={() =>
                              openEditor({ kind: "version", record: v })
                            }
                          >
                            <Pencil size={14} /> Düzenle
                          </button>
                          {!v.active && (
                            <button
                              disabled={!canEdit}
                              className="link"
                              onClick={() =>
                                action(`/versions/${v.id}/activate`)
                              }
                            >
                              Aktif takip yap
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-toolbar">
                    <div>
                      <h2>Tasarruf detayları</h2>
                      <p>
                        {data.version?.name} · Ödeme tasarrufları yılın tüm
                        versiyonlarında ortaktır.
                      </p>
                    </div>
                    <button
                      disabled={!canEdit}
                      className="button small"
                      onClick={() => openEditor({ kind: "saving" })}
                    >
                      <Plus size={15} />
                      Ekle
                    </button>
                  </div>
                  <div className="savings-list">
                    {data.savings.map((s) => (
                      <article key={s.id}>
                        <span>{s.title}</span>
                        <strong>{money(s.amount_units)} TL</strong>
                        <button
                          disabled={!canEdit}
                          className="icon"
                          aria-label={`${s.title} düzenle`}
                          onClick={() =>
                            openEditor({ kind: "saving", record: s })
                          }
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          disabled={!canEdit}
                          className="icon danger"
                          aria-label={`${s.title} sil`}
                          onClick={() =>
                            action(
                              `/savings/${s.id}`,
                              {},
                              "DELETE",
                              "Tasarruf detayı silinsin mi? Plan tutarları değişmez.",
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </article>
                    ))}
                    {paymentSavings.map((p) => (
                      <article key={`payment-saving-${p.id}`}>
                        <span>
                          {p.description}
                          <small>
                            Planlı ödeme · {name(p.category_id)} ·{" "}
                            {MONTHS[p.month - 1]} {p.year}
                          </small>
                          {p.saving_note && <small>{p.saving_note}</small>}
                        </span>
                        <strong>{money(p.saving_units)} TL</strong>
                        <button
                          disabled={!canEdit}
                          className="icon"
                          aria-label={`${p.description} tasarrufunu düzenle`}
                          onClick={() =>
                            openEditor({ kind: "payment-saving", record: p })
                          }
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          disabled={!canEdit}
                          className="icon danger"
                          aria-label={`${p.description} tasarrufunu kaldır`}
                          onClick={() =>
                            action(
                              `/payments/${p.id}/saving`,
                              { amount: "0", note: "" },
                              "PUT",
                              "Ödeme tasarrufu kaldırılsın mı? Bu tutar tekrar bekleyen ödeme olur.",
                            )
                          }
                        >
                          <Trash2 size={15} />
                        </button>
                      </article>
                    ))}
                    {!data.savings.length && !paymentSavings.length && (
                      <Empty>Bu versiyona ait tasarruf detayı yok.</Empty>
                    )}
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      </main>
      {invoiceEditor && (
        <InvoiceEditor
          data={data}
          {...invoiceEditor}
          onClose={() => setInvoiceEditor(null)}
          onSave={save}
        />
      )}
      {editor && (
        <RecordEditor
          key={editor.kind + (editor.record?.id || "")}
          spec={editor}
          data={data}
          onClose={() => setEditor(null)}
          onSave={save}
        />
      )}
      {categoriesOpen && (
        <Modal title="Bütçe kalemleri" onClose={() => setCategoriesOpen(false)}>
          <div className="dialog-body">
            <button
              disabled={!canEdit}
              className="button primary"
              onClick={() => {
                setCategoriesOpen(false);
                openEditor({ kind: "category" });
              }}
            >
              <Plus size={15} />
              Yeni kalem
            </button>
            {data.categories.map((c) => (
              <div className="category-row" key={c.id}>
                <span>{c.name}</span>
                <button
                  disabled={!canEdit}
                  className="icon"
                  aria-label={`${c.name} adını düzenle`}
                  onClick={() => {
                    setCategoriesOpen(false);
                    openEditor({ kind: "category", record: c });
                  }}
                >
                  <Pencil size={16} />
                </button>
                <button
                  disabled={!canEdit}
                  className="icon danger"
                  aria-label={`${c.name} sil`}
                  onClick={async () => {
                    setCategoriesOpen(false);
                    await action(
                      `/categories/${c.id}`,
                      {},
                      "DELETE",
                      "Bütçe kalemi silinsin mi? Bağlı kayıt veya tutar varsa işlem reddedilir.",
                    );
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
function Metric({
  title,
  value,
  caption,
  onUpdate,
}: {
  title: string;
  value: string;
  caption: string;
  onUpdate?: () => void;
}) {
  return (
    <article className="metric">
      <div>
        <span>{title}</span>
      </div>
      <strong className={BigInt(value) < 0n ? "negative" : ""}>
        {money(value)}
        <small> TL</small>
      </strong>
      <p>{caption}</p>
      {onUpdate && (
        <button className="link metric-update" onClick={onUpdate}>
          Güncelleme
        </button>
      )}
    </article>
  );
}
function Usage({ row }: { row: BudgetRow }) {
  if (row.usage === null)
    return <span>{row.actual === "0" ? "—" : "Plansız harcama"}</span>;
  return (
    <div className={"usage " + (row.usage > 100 ? "over" : "")}>
      <span>%{row.usage.toLocaleString("tr-TR")}</span>
      <div>
        <i style={{ width: `${Math.min(row.usage, 100)}%` }} />
      </div>
    </div>
  );
}
