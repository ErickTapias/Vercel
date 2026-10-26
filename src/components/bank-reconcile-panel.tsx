"use client";
import { useMemo, useRef, useState } from "react";
import {
  Upload,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  Save,
  RefreshCw,
  Sparkles,
  Landmark,
  CircleHelp,
} from "lucide-react";
import { useApp } from "./app-context";
import { SectionHead, EmptyState, StatusBadge } from "./ui";
import { exportExcel, printReport, dateLabel, sum } from "@/lib/utils";
import { autoMatchRows, normalizeBankRows, rowsFromMatrix, rowsFromPastedText, missingLedgerItems } from "@/lib/bank-reconcile";
import type { BankStatementRow, BankStatement } from "@/lib/types";

const BANKS = [
  { id: "banesco", name: "Banesco Banco Universal", match: (a: { name: string; method: string }) => /banesco/i.test(a.name) },
  { id: "mercantil", name: "Mercantil Banco", match: (a: { name: string }) => /mercantil/i.test(a.name) },
  { id: "provincial", name: "BBVA Provincial / Bancaribe", match: (a: { name: string }) => /provincial|bancaribe|banco de venezuela/i.test(a.name) },
  { id: "bofa", name: "Bank of America / Zelle / Divisas", match: (a: { name: string; method: string }) => /america|zelle/i.test(a.name + a.method) },
  { id: "efectivo", name: "Caja principal / Efectivo", match: (a: { method: string }) => /efectivo/i.test(a.method) },
  { id: "otro", name: "Otro banco (importación genérica)", match: () => true },
];

export function ImportBankStatement() {
  const { data, mutate, notify, close } = useApp();
  const [bank, setBank] = useState("banesco");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [fileName, setFileName] = useState("");
  const [pasted, setPasted] = useState("");
  const [rawRows, setRawRows] = useState<{ date: unknown; description: unknown; reference: unknown; amount: unknown }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const bankInfo = BANKS.find((b) => b.id === bank) || BANKS[0];
  const matchingAccounts = data.accounts.filter((a) => bank === "otro" || bankInfo.match(a));
  const singleAccount = matchingAccounts.length === 1 ? matchingAccounts[0] : null;
  const selectedAccount = singleAccount || data.accounts.find((a) => a.id === accountId) || matchingAccounts[0] || data.accounts[0];

  const preview = useMemo(
    () => (rawRows.length ? autoMatchRows(normalizeBankRows(rawRows), { sales: data.sales, expenses: data.expenses }) : []),
    [rawRows, data.sales, data.expenses]
  );

  const readFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setFileName(file.name);
    try {
      if (/\.(csv|xlsx|xls)$/i.test(file.name)) {
        const XLSX = await import("xlsx");
        const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]], { header: 1, blankrows: false, raw: true }) as unknown[][];
        const parsed = rowsFromMatrix(matrix);
        if (!parsed.length) throw new Error("No se identificaron movimientos. Revisa el formato del banco.");
        setRawRows(parsed);
      } else if (/\.txt$/i.test(file.name)) {
        setPasted(await file.text());
        setRawRows(rowsFromPastedText(await file.text()));
      } else {
        setError("Para archivos PDF del banco, usa la opción inferior de pegar los movimientos o exporta el estado de cuenta en Excel/CSV.");
      }
    } catch (e) {
      setError((e as Error).message || "No se pudo leer el estado de cuenta.");
    }
  };

  const submit = async () => {
    if (!rawRows.length) return setError("Sube o pega los movimientos del estado de cuenta antes de procesar.");
    if (!selectedAccount) return setError("Selecciona la cuenta contable asociada al banco.");
    setBusy(true);
    setError("");
    try {
      await mutate(
        "bankStatement.import",
        {
          accountId: selectedAccount.id,
          bankName: bankInfo.name,
          fileName: fileName || "estado_de_cuenta_manual",
          periodLabel: `${new Date().toLocaleDateString("es-VE")} · Importación bancaria`,
          rows: normalizeBankRows(rawRows),
        },
        `¡Estado de cuenta conciliado! ${preview.filter((r) => r.status === "conciliado").length} de ${preview.length} movimientos cruzados automáticamente con facturas y gastos.`
      );
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="modal wide" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h2>Importar Estado de Cuenta Bancario</h2>
            <p>Sube el archivo del banco y cruza cada movimiento con facturas de venta, alquiler, comisiones y servicios con un solo clic.</p>
          </div>
          <button className="icon-button modal-close" onClick={close}>✕</button>
        </div>

        <div className="modal-body space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-xs">
              Banco emisor del estado de cuenta
              <select value={bank} onChange={(e) => { setBank(e.target.value); setAccountId(null); }} className="mt-1">
                {BANKS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>

            <label className="text-xs">
              Cuenta contable asociada {singleAccount ? "(única cuenta detectada)" : "(si el banco tiene varias)"}
              <select
                className="mt-1"
                value={selectedAccount?.id || ""}
                disabled={Boolean(singleAccount)}
                onChange={(e) => setAccountId(Number(e.target.value))}
              >
                {matchingAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.currency}) · {a.method}</option>
                ))}
              </select>
              {singleAccount && <small className="block text-[10px] text-emerald-600 mt-1">✓ Cuenta seleccionada automáticamente por el sistema</small>}
            </label>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"><FileSpreadsheet size={15} className="text-purple-600" /> Formato bancario del estado de cuenta</span>
              <span className="text-[10px] text-slate-500">Excel, CSV, TXT · PDF (pegar movimientos)</span>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt,.pdf" className="text-xs w-full" onChange={(e) => readFile(e.target.files?.[0])} />
            {fileName && <p className="text-[10px] text-emerald-600 font-semibold">Archivo cargado: {fileName} · {rawRows.length} movimiento(s) detectados</p>}
          </div>

          <div>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Opcional · Pega los movimientos (una fila por movimiento con fecha, concepto, referencia y monto)</span>
            <textarea
              rows={4}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"12/10/2026, Pago cliente Textiles Los Andes, FAC-2026-001102, 450.00\n13/10/2026, Alquiler galpón Los Ruices, FAC-1240, -1400"}
              className="w-full"
            />
            <button type="button" className="button secondary text-xs mt-1.5" onClick={() => setRawRows(rowsFromPastedText(pasted))}>
              <Sparkles size={13} /> Reconocer movimientos pegados
            </button>
          </div>

          {error && <div className="form-error"><AlertTriangle size={16} />{error}</div>}

          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <strong className="text-xs text-slate-800 dark:text-slate-200">Vista previa del cruce automático</strong>
                <span className="text-[10px] text-emerald-600 font-bold">{preview.filter((r) => r.status === "conciliado").length} conciliados · {preview.filter((r) => r.status !== "conciliado").length} por revisar</span>
              </div>
              <div className="table-scroll border rounded-lg">
                <table className="data-table">
                  <thead><tr><th>Fecha</th><th>Concepto bancario</th><th>Ref.</th><th>Monto</th><th>Aplicado a</th></tr></thead>
                  <tbody>
                    {preview.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        <td>{r.date}</td>
                        <td className="truncate max-w-[220px]">{r.description}</td>
                        <td className="font-mono text-[10px]">{r.reference || "—"}</td>
                        <td className={`amount ${r.amount > 0 ? "positive" : ""}`}>{r.amount > 0 ? "+" : "−"}{Math.abs(r.amount).toFixed(2)}</td>
                        <td><span className={`status-badge ${r.status === "conciliado" ? "paid" : "pending"}`}><i />{r.status === "conciliado" ? r.matchLabel : `Sugerido: ${r.suggestedCategory}`}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.length > 8 && <p className="text-[10px] text-slate-500 mt-1">Y {preview.length - 8} movimientos adicionales que quedarán listados para revisión.</p>}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="button secondary" onClick={close}>Cancelar</button>
          <button className="button primary" disabled={busy} onClick={submit}>
            {busy ? <span className="spinner" /> : <CheckCircle2 size={16} />} {busy ? "Conciliando..." : "Procesar y conciliar con un clic"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BankReconcilePanel() {
  const { data, money, mutate, notify, open } = useApp();
  const [selectedId, setSelectedId] = useState<number | null>(data.bankStatements[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const statement = data.bankStatements.find((b) => b.id === selectedId) || data.bankStatements[0];
  const rows: BankStatementRow[] = statement?.rows || [];
  const ledger = { sales: data.sales, expenses: data.expenses };
  const missing = useMemo(() => missingLedgerItems(rows, ledger), [rows, data.sales, data.expenses]);

  const totals = {
    ingresos: sum(rows.filter((r) => r.amount > 0), (r) => r.amount),
    egresos: sum(rows.filter((r) => r.amount < 0), (r) => Math.abs(r.amount)),
    conciliados: rows.filter((r) => r.status === "conciliado").length,
    observados: rows.filter((r) => r.status !== "conciliado").length,
    ventasCruzadas: sum(rows.filter((r) => r.matchType === "sale"), (r) => r.amount),
  };

  const updateRow = async (rowIndex: number, patch: Partial<BankStatementRow>) => {
    if (!statement) return;
    setBusy(true);
    try {
      await mutate("bankStatement.updateRow", { statementId: statement.id, rowIndex, ...patch }, "Movimiento de la conciliación actualizado");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const exportRows = () => rows.map((r) => ({
    Fecha: r.date, Concepto: r.description, Referencia: r.reference, MontoUSD: r.amount,
    Tipo: r.amount > 0 ? "Ingreso" : "Egreso", "Aplicado a": r.matchLabel || "Sin identificar",
    Estado: r.status, Observacion: r.observation, CategoriaSugerida: r.suggestedCategory,
  }));

  return (
    <section className="card">
      <SectionHead
        title="Conciliación Bancaria Automática"
        subtitle="Cruce inteligente del estado de cuenta contra facturas de venta, alquiler, comisiones y servicios del negocio."
      >
        <div className="flex flex-wrap gap-2">
          <button className="button primary text-xs" onClick={() => open("import-statement")}><Upload size={14} /> Importar Estado de Cuenta</button>
          {statement && (
            <>
              <button className="button secondary text-xs" onClick={() => exportExcel(exportRows(), `Tesorio-Conciliacion-${statement.id}`)}><Download size={14} /> Excel</button>
              <button
                className="button secondary text-xs"
                onClick={() => {
                  try {
                    printReport(`CONCILIACIÓN BANCARIA · ${statement.bankName}`, exportRows(), data.settings.legalName, `${statement.fileName} · ${statement.periodLabel} · Cuenta: ${data.accounts.find((a) => a.id === statement.accountId)?.name || ""}`);
                  } catch (e) { notify((e as Error).message, true); }
                }}
              ><Printer size={14} /> Imprimir / PDF</button>
              <button
                className="button secondary text-xs"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await mutate("bankStatement.complete", { statementId: statement.id, allowPartial: true, notes: "Conciliación procesada con observaciones" }, "Conciliación bancaria guardada");
                  } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); }
                }}
              ><Save size={14} /> Guardar conciliación</button>
            </>
          )}
        </div>
      </SectionHead>

      {!statement ? (
        <EmptyState
          title="Aún no has importado estados de cuenta"
          description="Sube el archivo del banco y con un clic Tesorio reconoce cada movimiento, lo cruza con tus facturas de venta y lo aplica a alquiler, comisiones y servicios."
          action={<button className="button primary" onClick={() => open("import-statement")}><Upload size={16} /> Importar estado de cuenta</button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 pb-1">
            <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl">
              <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold uppercase block">Movimientos importados</span>
              <strong className="text-xl font-black text-purple-900 dark:text-purple-100 font-mono">{rows.length}</strong>
              <small className="text-[10px] text-slate-500 block">{statement.bankName}</small>
            </div>
            <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase block">Conciliados automáticamente</span>
              <strong className="text-xl font-black text-emerald-900 dark:text-emerald-100 font-mono">{totals.conciliados}</strong>
              <small className="text-[10px] text-emerald-600 block font-semibold">{rows.length ? Math.round((totals.conciliados / rows.length) * 100) : 0}% de efectividad</small>
            </div>
            <div className="p-3 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl">
              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold uppercase block">Por revisar / observados</span>
              <strong className="text-xl font-black text-amber-900 dark:text-amber-100 font-mono">{totals.observados}</strong>
              <small className="text-[10px] text-slate-500 block">Sobrantes y sin identificar</small>
            </div>
            <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
              <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase block">Cobros de venta aplicados</span>
              <strong className="text-lg font-black text-blue-900 dark:text-blue-100 font-mono">{money(totals.ventasCruzadas)}</strong>
              <small className="text-[10px] text-slate-500 block">{totals.egresos ? `${money(totals.egresos)} en egresos conciliados` : "Ingresos cruzados"}</small>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Fecha</th><th>Concepto bancario</th><th>Referencia</th><th>Monto</th><th>Aplicado a</th><th>Estado</th><th>Observación / Ajuste</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id || i}>
                    <td className="whitespace-nowrap">{r.date}</td>
                    <td className="max-w-[220px]"><span className="block truncate font-semibold">{r.description}</span><small className="text-[9px] text-slate-500">{r.suggestedCategory}</small></td>
                    <td className="font-mono text-[10px]">{r.reference || "—"}</td>
                    <td className={`amount ${r.amount > 0 ? "positive" : ""}`}>{r.amount > 0 ? "+" : "−"}{Math.abs(r.amount).toFixed(2)}</td>
                    <td>{r.matchLabel ? <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300">{r.matchType === "sale" ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}{r.matchLabel}</span> : <span className="text-[10px] text-amber-600 font-semibold">Sin identificar</span>}</td>
                    <td>
                      <select
                        className="text-[10px] py-1 px-1.5 border rounded"
                        value={r.status}
                        disabled={busy}
                        onChange={(e) => updateRow(i, { status: e.target.value as BankStatementRow["status"] })}
                      >
                        <option value="conciliado">Conciliado</option>
                        <option value="sin_identificar">Sin identificar</option>
                        <option value="sobrante">Sobrante</option>
                        <option value="ajustado">Ajustado</option>
                      </select>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <input
                          className="text-[10px] py-1 px-2 border rounded flex-1 min-w-[150px]"
                          defaultValue={r.observation}
                          placeholder="Observación para el ajuste"
                          onBlur={(e) => { if (e.target.value !== r.observation) updateRow(i, { observation: e.target.value }); }}
                        />
                        <button className="icon-button small-button" title="Guardar observación" onClick={() => updateRow(i, { observation: r.observation })}><Save size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(missing.missingSales.length > 0 || missing.missingExpenses.length > 0) && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                <AlertTriangle size={15} className="text-amber-600" /> Faltantes en el estado de cuenta (no aparecen en el banco)
                <span className="count-pill">{missing.missingSales.length + missing.missingExpenses.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {missing.missingSales.slice(0, 5).map((s) => (
                  <div key={`s${s.id}`} className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 rounded-lg text-xs flex items-center justify-between gap-2">
                    <span><strong className="text-amber-900 dark:text-amber-200">{s.invoiceNumber}</strong> · {s.customerName}<small className="block text-[9px] text-amber-700">Cobro registrado en sistema pero no aparece en el banco</small></span>
                    <button className="button secondary text-[10px] py-1 px-2 h-7" onClick={() => open("receipt", s)}>Ver factura</button>
                  </div>
                ))}
                {missing.missingExpenses.slice(0, 5).map((e) => (
                  <div key={`e${e.id}`} className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 rounded-lg text-xs flex items-center justify-between gap-2">
                    <span><strong className="text-amber-900 dark:text-amber-200">{e.name}</strong> · {money(e.amount)}<small className="block text-[9px] text-amber-700">Egreso registrado pero sin movimiento bancario conciliado</small></span>
                    <button className="button secondary text-[10px] py-1 px-2 h-7" onClick={() => open("expense-detail", e)}>Ver soporte</button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 flex items-center gap-1.5"><CircleHelp size={13} /> Ajusta los montos o registra el movimiento faltante en el banco para completar la conciliación del período.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
