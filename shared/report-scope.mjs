import { sum, subtract, rate } from "./domain.mjs";

// Screen and export share these selectors so their visible scopes stay identical.
export function budgetView(data, options = {}) {
  const {
    from = 1,
    to = 12,
    category = 0,
    search = "",
    hideZero = false,
    periodFiltered = false,
  } = options;
  const rows = data.rows
    .filter(
      (r) =>
        (!category || r.id === category) &&
        r.name
          .toLocaleLowerCase("tr-TR")
          .includes(search.toLocaleLowerCase("tr-TR")),
    )
    .map((r) => {
      const months = r.months.filter((_, i) => i + 1 >= from && i + 1 <= to);
      const plan = sum(months.map((m) => m.plan)),
        actual = sum(months.map((m) => m.actual)),
        pending = sum(months.map((m) => m.pending)),
        remaining = subtract(plan, actual);
      return {
        ...r,
        plan,
        actual,
        pending,
        remaining,
        available: subtract(remaining, pending),
        usage: rate(actual, plan),
        details: r.details.filter((l) => l.month >= from && l.month <= to),
      };
    })
    .filter(
      (r) =>
        !hideZero || r.plan !== "0" || r.actual !== "0" || r.pending !== "0",
    );
  const total = (key) => sum(rows.map((r) => r[key]));
  const annual =
    !periodFiltered && from === 1 && to === 12 && !category && !search;
  const plan = annual
    ? (data.version?.effective_budget_units ??
      data.years.find((y) => y.year === data.year)?.reference_units ??
      "0")
    : total("plan");
  const actual = total("actual"),
    pending = total("pending"),
    remaining = subtract(plan, actual);
  return {
    rows,
    annual,
    totals: {
      plan,
      actual,
      remaining,
      pending,
      available: subtract(remaining, pending),
    },
  };
}

export function invoiceView(data, options = {}) {
  const {
    from = 1,
    to = 12,
    category = 0,
    search = "",
    showCancelled = false,
  } = options;
  const name = (id) => data.categories.find((c) => c.id === id)?.name || "—";
  return data.invoices.filter(
    (i) =>
      (showCancelled || i.status === "active") &&
      i.month >= from &&
      i.month <= to &&
      i.lines.some(
        (l) =>
          (!category || l.category_id === category) &&
          (i.number + " " + l.training_name + " " + name(l.category_id))
            .toLocaleLowerCase("tr-TR")
            .includes(search.toLocaleLowerCase("tr-TR")),
      ),
  );
}
