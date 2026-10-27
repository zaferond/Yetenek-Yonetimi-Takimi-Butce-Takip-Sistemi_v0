import { useState, type FormEvent } from "react";
export function NewYearForm({
  nextYear,
  onSave,
}: {
  nextYear: number;
  onSave: (path: string, body: unknown, method?: string) => Promise<void>;
}) {
  const [year, setYear] = useState(String(nextYear)),
    [reference, setReference] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave("/years", { year, reference });
      setReference("");
      setYear(String(Number(year) + 1));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="new-year-form"
      onSubmit={submit}
      aria-label="Yeni yıl bütçesi"
    >
      <fieldset disabled={busy}>
        <label>
          Yeni yıl
          <input
            required
            aria-label="Yeni bütçe yılı"
            type="number"
            min="2000"
            max="2100"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </label>
        <label>
          Bütçe · TL
          <input
            required
            aria-label="Yeni yıl bütçesi TL"
            inputMode="decimal"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <button className="button primary">Yeni yıl ekle</button>
      </fieldset>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
    </form>
  );
}
