import type { BankStatementRow } from "@/lib/types";
import type { Sale, Expense } from "@/lib/types";

const norm = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s) || /\bdebito\b|\bcargo\b|salida/i.test(s);
  const cleaned = s.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return 0;
  return negative ? -Math.abs(value) : value;
}

export function parseBankDate(raw: unknown): string {
  const s = String(raw ?? "").trim();
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  const m = s.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return new Date().toISOString().slice(0, 10);
}

type RawRow = { date: unknown; description: unknown; reference: unknown; amount: unknown };

// Convierte matrices de Excel / CSV / texto pegado en movimientos bancarios estandarizados
export function normalizeBankRows(rawRows: RawRow[]): BankStatementRow[] {
  return rawRows
    .map((r, idx) => {
      const amount = parseAmount(r.amount);
      const description = String(r.description ?? "").trim().slice(0, 300);
      const reference = String(r.reference ?? "").trim().slice(0, 120);
      return {
        id: `mv-${Date.now()}-${idx}`,
        date: parseBankDate(r.date),
        description: description || "Movimiento bancario",
        reference,
        amount,
        direction: amount < 0 ? ("egreso" as const) : ("ingreso" as const),
        matchType: "none" as const,
        matchId: null,
        matchLabel: "",
        status: "sin_identificar" as const,
        confidence: "baja" as const,
        observation: "",
        suggestedCategory: suggestCategory(description),
      };
    })
    .filter((r) => r.amount !== 0 || r.description !== "Movimiento bancario");
}

export function suggestCategory(description: string): string {
  const d = norm(description);
  if (/alquiler|arriendo|canon/.test(d)) return "Alquiler";
  if (/nomina|sueldo|salario|pago de personal|vacaciones/.test(d)) return "Nómina";
  if (/comision|cargo bancario|mantenimiento de cuenta|iva servicio/.test(d)) return "Comisiones bancarias";
  if (/internet|telefono|movilnet|cantv|digitel|cable|luz|agua|gas|electricidad/.test(d)) return "Servicios e insumos";
  if (/seguro|poliza/.test(d)) return "Seguros";
  if (/impuesto|seniat|iva|islr/.test(d)) return "Impuestos";
  if (/tela|textil|hilo|tinta|film|dtf|poliamida|bordado|insumo|bolsa/.test(d)) return "Insumos de producción";
  if (/mantenimiento|reparacion|servicio tecnico|equipo/.test(d)) return "Mantenimiento";
  if (/delivery|flete|envio|transporte|mrw|zoom|tealca/.test(d)) return "Logística y envíos";
  if (/retiro|personal|socio/.test(d)) return "Retiro personal";
  if (/pago cliente|transferencia recibida|abono|depósito|deposito|cobro|ventas/.test(d)) return "Cobro de clientes";
  return "Por clasificar";
}

export type ReconcileLedger = { sales: Sale[]; expenses: Expense[] };

// Cruce automático del estado de cuenta contra facturas de venta, gastos y servicios del negocio
export function autoMatchRows(rows: BankStatementRow[], ledger: ReconcileLedger): BankStatementRow[] {
  const usedSales = new Set<number>();
  const usedExpenses = new Set<number>();

  return rows.map((row) => {
    const amount = Math.abs(Number(row.amount) || 0);
    const haystack = `${norm(row.description)} ${norm(row.reference)}`;

    if (row.amount > 0) {
      // INGRESO: buscar cobro de factura de venta
      const candidates = ledger.sales.filter((s) => !usedSales.has(s.id) && (s.payments || []).some((p) => Math.abs(Math.abs(p.amount) - amount) < 0.02));
      const exact = candidates.find((s) => haystack.includes(norm(s.invoiceNumber)) || haystack.includes(norm(s.controlNumber)) || (s.customerName && haystack.includes(norm(s.customerName).slice(0, 12))));
      const sale = exact || candidates[0];
      if (sale) {
        usedSales.add(sale.id);
        return {
          ...row,
          matchType: "sale",
          matchId: sale.id,
          matchLabel: `Factura ${sale.invoiceNumber} · ${sale.customerName}`,
          status: "conciliado",
          confidence: exact ? "alta" : "media",
          observation: exact ? "" : "Coincidencia por monto: verificar referencia del cliente antes del cierre.",
          suggestedCategory: "Cobro de clientes",
        };
      }
      return { ...row, matchType: "none", matchId: null, matchLabel: "", status: "sobrante", confidence: "baja", observation: row.observation || "Ingreso sin factura asociada. Registrar cobro manual o venta sin sistema.", suggestedCategory: row.suggestedCategory || suggestCategory(row.description) };
    }

    // EGRESO: buscar gasto o factura de proveedor
    const expCandidates = ledger.expenses.filter((e) => !usedExpenses.has(e.id) && Math.abs(Math.abs(e.amount) - amount) < 0.02);
    const exactExp = expCandidates.find((e) => {
      const hay = haystack;
      return (e.beneficiary && hay.includes(norm(e.beneficiary).slice(0, 10))) || (e.invoiceNumber && hay.includes(norm(e.invoiceNumber))) || (e.name && hay.includes(norm(e.name).slice(0, 12)));
    });
    const expense = exactExp || expCandidates[0];
    if (expense) {
      usedExpenses.add(expense.id);
      return {
        ...row,
        matchType: "expense",
        matchId: expense.id,
        matchLabel: `Gasto: ${expense.name}`,
        status: "conciliado",
        confidence: exactExp ? "alta" : "media",
        observation: exactExp ? "" : "Coincidencia por monto: revisar número de factura del proveedor.",
        suggestedCategory: expense.category,
      };
    }

    return {
      ...row,
      matchType: "none",
      matchId: null,
      matchLabel: "",
      status: "sin_identificar",
      confidence: "baja",
      observation: row.observation || "Egreso sin soporte registrado. Generar gasto con factura o conciliar manualmente.",
      suggestedCategory: row.suggestedCategory || suggestCategory(row.description),
    };
  });
}

// Movimientos del sistema que no aparecen en el estado de cuenta importado (faltantes)
export function missingLedgerItems(rows: BankStatementRow[], ledger: ReconcileLedger) {
  const matchedSales = new Set(rows.filter((r) => r.matchType === "sale").map((r) => r.matchId));
  const matchedExpenses = new Set(rows.filter((r) => r.matchType === "expense").map((r) => r.matchId));
  const missingSales = ledger.sales.filter((s) => !matchedSales.has(s.id) && (s.payments || []).length > 0).slice(0, 40);
  const missingExpenses = ledger.expenses.filter((e) => !matchedExpenses.has(e.id)).slice(0, 40);
  return { missingSales, missingExpenses };
}

// Interpretación flexible de encabezados de estados de cuenta bancarios venezolanos
export function rowsFromMatrix(matrix: unknown[][]): { date: unknown; description: unknown; reference: unknown; amount: unknown }[] {
  if (!matrix.length) return [];
  const header = matrix[0].map((h) => norm(h));
  const find = (...names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const iDate = find("fecha", "date");
  const iDesc = find("descripcion", "concepto", "detalle", "movimiento", "description");
  const iRef = find("referencia", "documento", "ref", "numero");
  const iAmount = find("monto", "importe", "amount", "abono");
  const iDebe = find("debito", "cargo", "salida", "egreso");
  const iHaber = find("credito", "abono", "entrada", "ingreso");

  return matrix.slice(1).map((cells) => {
    let amountRaw: unknown = "";
    if (iDebe >= 0 || iHaber >= 0) {
      const deb = parseAmount(cells[iDebe] ?? 0);
      const hab = parseAmount(cells[iHaber] ?? 0);
      amountRaw = deb ? -Math.abs(deb) : Math.abs(hab);
    } else if (iAmount >= 0) {
      amountRaw = cells[iAmount];
    } else {
      const numeric = cells.map((c) => parseAmount(c)).filter((n) => n !== 0);
      amountRaw = numeric.length ? numeric[numeric.length - 1] : 0;
    }
    return {
      date: iDate >= 0 ? cells[iDate] : cells[0],
      description: iDesc >= 0 ? cells[iDesc] : cells[1] ?? cells[0],
      reference: iRef >= 0 ? cells[iRef] : "",
      amount: amountRaw,
    };
  });
}

export function rowsFromPastedText(text: string) {
  const matrix = text
    .split(/\r?\n/)
    .map((line) => line.split(/\t|,|;|\s{2,}/).map((v) => v.trim()))
    .filter((cells) => cells.some(Boolean));
  if (!matrix.length) return [];
  // Si la primera línea trae encabezados bancarios se interpreta; si no, son movimientos directos
  const first = matrix[0].map((h) => norm(h)).join(" ");
  if (/fecha|concepto|descripcion|movimiento|referencia/.test(first) && !/\d/.test(matrix[0][0] || "")) {
    return rowsFromMatrix(matrix);
  }
  return matrix.map((cells) => {
    const numeric = cells.map((c) => parseAmount(c)).filter((n) => n !== 0);
    return {
      date: cells[0],
      description: cells.slice(1, -1).join(" ") || cells[0],
      reference: cells[2] ?? "",
      amount: numeric.length ? numeric[numeric.length - 1] : 0,
    };
  });
}
