import type { AppData, Sale, Expense } from "./types";

export const sum = <T,>(rows: T[], get: (row: T) => number) => rows.reduce((total, row) => total + get(row), 0);

export function dateLabel(value: string | Date, withTime = false) {
  const date = new Date(value);
  return date.toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

export function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

export function getBounds(period: string, custom?: { start: string; end: string }) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  if (period === "today") start.setDate(now.getDate());
  if (period === "week") start.setDate(now.getDate() - 6);
  if (period === "all") start.setFullYear(2020);
  if (period === "custom" && custom) {
    return { start: new Date(custom.start + "T00:00:00"), end: new Date(custom.end + "T23:59:59.999") };
  }
  return { start, end };
}

export function filterPeriod<T extends { createdAt: string }>(rows: T[], period: string, custom?: { start: string; end: string }) {
  const { start, end } = getBounds(period, custom);
  return rows.filter((row) => new Date(row.createdAt) >= start && new Date(row.createdAt) <= end);
}

export function financials(sales: Sale[], expenses: Expense[]) {
  const validSales = sales.filter((s) => s.status !== "void");
  const revenue = sum(validSales, (s) => s.total);
  const taxable = sum(validSales, (s) => s.taxableBase);
  const ivaCollected = sum(validSales, (s) => s.ivaAmount);
  const igtfCollected = sum(validSales, (s) => s.igtfAmount);
  const costs = sum(validSales, (s) => s.cost);

  // Gastos operativos deducibles
  const businessExpenses = expenses.filter((e) => e.scope !== "personal");
  const fixed = sum(businessExpenses.filter((e) => e.type === "fixed"), (e) => e.amount);
  const variable = sum(businessExpenses.filter((e) => e.type !== "fixed"), (e) => e.amount);
  const ivaPaid = sum(businessExpenses, (e) => e.ivaAmount);
  const ivaRetained = sum(businessExpenses, (e) => e.ivaRetained);

  // Gastos internos y personales diferenciados
  const internalExpenses = expenses.filter((e) => e.scope === "internal");
  const personalDraws = expenses.filter((e) => e.scope === "personal");
  const internalAmount = sum(internalExpenses, (e) => e.amount);
  const personalAmount = sum(personalDraws, (e) => e.amount);

  const totalExpenses = fixed + variable;
  const gross = revenue - costs;
  const net = gross - totalExpenses;
  const margin = revenue ? (net / revenue) * 100 : 0;

  // Balance fiscal de IVA (Débito Fiscal vs Crédito Fiscal)
  const ivaBalance = ivaCollected - ivaPaid; // Positivo: por pagar al SENIAT, Negativo: crédito a favor

  return {
    revenue,
    taxable,
    ivaCollected,
    igtfCollected,
    costs,
    fixed,
    variable,
    expenses: totalExpenses,
    ivaPaid,
    ivaRetained,
    ivaBalance,
    internalAmount,
    personalAmount,
    gross,
    net,
    margin,
  };
}

export function topProducts(data: AppData, sales: Sale[]) {
  const valid = sales.filter((s) => s.status !== "void");
  return data.products
    .map((p) => {
      const items = valid.flatMap((s) => s.items).filter((i) => i.productId === p.id);
      return {
        ...p,
        sold: sum(items, (i) => i.quantity),
        revenue: sum(items, (i) => i.price * i.quantity),
      };
    })
    .filter((p) => p.sold > 0)
    .sort((a, b) => b.sold - a.sold);
}

export async function exportExcel(rows: Record<string, unknown>[], name: string) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet["!cols"] = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.min(45, Math.max(16, key.length + 3)),
  }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Tesorio");
  XLSX.writeFile(book, `${name}.xlsx`);
}

const escape = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Impresión y generación de PDF para reportes y libros fiscales auditables
export function printReport(title: string, rows: Record<string, unknown>[], business: string, subtitle = "", footerNote = "") {
  const w = window.open("", "_blank", "width=1000,height=800");
  if (!w) throw new Error("Permite las ventanas emergentes para imprimir o guardar en PDF.");
  const keys = Object.keys(rows[0] || {});

  w.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escape(title)} - ${escape(business)}</title>
  <style>
    @page { size: landscape; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; padding: 24px; color: #1e1b2e; background: #fff; }
    header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #7c3aed; padding-bottom: 14px; margin-bottom: 16px; }
    .header-info h1 { font-size: 18px; font-weight: 800; margin: 0 0 4px; color: #0f172a; letter-spacing: -0.3px; }
    .header-info strong { font-size: 13px; color: #7c3aed; display: block; margin-bottom: 2px; }
    .header-info p { font-size: 10px; color: #64748b; margin: 0; }
    .header-brand { text-align: right; }
    .header-brand .brand-logo { font-size: 26px; font-weight: 900; font-style: italic; letter-spacing: -1.5px; color: #7c3aed; margin: 0; }
    .header-brand .brand-logo span { color: #34d399; }
    .header-brand small { font-size: 8px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; display: block; }
    table { border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 9.5px; }
    th { background: #f8fafc; color: #334155; text-align: left; padding: 7px 8px; border: 1px solid #cbd5e1; font-weight: 700; white-space: nowrap; font-size: 9px; }
    td { padding: 6px 8px; border: 1px solid #e2e8f0; color: #1e293b; }
    tr:nth-child(even) td { background: #fbfcfe; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 9px; color: #64748b; }
    .seal { display: inline-block; padding: 3px 6px; background: #ede9fe; color: #6d28d9; border-radius: 4px; font-weight: 600; font-size: 8px; }
    @media print {
      body { padding: 0; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-info">
      <h1>${escape(title)}</h1>
      <strong>${escape(business)}</strong>
      <p>${escape(subtitle)}</p>
    </div>
    <div class="header-brand">
      <div class="brand-logo">tesorio<span>.</span></div>
      <small>Libro Oficial Auditable · SENIAT</small>
    </div>
  </header>
  <table>
    <thead>
      <tr>${keys.map((k) => `<th>${escape(k)}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => `<tr>${keys.map((k) => `<td class="${typeof row[k] === "number" ? "num" : ""}">${escape(row[k])}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
  <footer>
    <div>
      <span class="seal">CONFORME A PROVIDENCIA SNAT/2011/00071 Y PA 000102</span>
      ${footerNote ? `<span style="margin-left: 8px;">${escape(footerNote)}</span>` : ""}
    </div>
    <div>Impreso con Tesorio · ${escape(new Date().toLocaleString("es-VE"))}</div>
  </footer>
  <script>
    window.onload = () => { setTimeout(() => window.print(), 350); };
  </script>
</body>
</html>`);
  w.document.close();
}
