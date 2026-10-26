"use client";
import { useEffect, useState } from "react";
import {
  Search, Lock, Plus, Save, Trash2, Send, RefreshCw, History, Scale, FileWarning, CheckCircle2, Printer,
} from "lucide-react";

/**
 * UI AISLADA · FASE 5 (namespace `.operations-panel__*`).
 * Muestra documentos fiscales en SOLO LECTURA y permite gestionar pagos operativos flexibles
 * con auditoría de cambios, sin modificar la factura original.
 */
type LegalRef = { id: number; module: string; lawName: string; article: string; description: string; effectiveDate: string };
type InvoiceLite = { id: number; invoiceNumber: string; controlNumber: string; customerName: string; customerRif: string; total: number; taxableBase: number; ivaAmount: number; issueDate: string; status: string };
type PaymentRow = { id: number; invoiceId: number; paymentMethod: string; referenceNumber: string; bankName: string; amount: number; paymentDate: string; status: string; notes: string };

async function api<T>(action: string, data: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/operations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data, actor: "Usuario Tesorio" }) });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || "No se pudo completar la operación.");
  return json as T;
}

export function PaymentConciliationPanel({ mode }: { mode: "conciliation" | "contingency" }) {
  const [legalRefs, setLegalRefs] = useState<LegalRef[]>([]);
  const [query, setQuery] = useState("");
  const [invoices, setInvoices] = useState<InvoiceLite[]>([]);
  const [invoice, setInvoice] = useState<InvoiceLite | null>(null);
  const [summary, setSummary] = useState<{ payments: PaymentRow[]; applied: number; outstanding: number; fullySettled: boolean } | null>(null);
  const [audit, setAudit] = useState<Array<{ field: string; oldValue: string; newValue: string; changedBy: string; changedAt: string; reason: string }>>([]);
  const [form, setForm] = useState({ paymentMethod: "Pago móvil", referenceNumber: "", bankName: "Banesco", amount: "", paymentDate: new Date().toISOString().slice(0, 10), notes: "" });
  const [contingencies, setContingencies] = useState<Array<{ id: number; manualNumber: string; issueDate: string; customerName: string; customerRif: string; amount: number; syncedStatus: string; authorizationCode: string; notes: string }>>([]);
  const [contingency, setContingency] = useState({ manualNumber: `CONT-${new Date().getFullYear()}-`, issueDate: new Date().toISOString().slice(0, 10), customerName: "", customerRif: "", customerEmail: "", amount: "", notes: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<{ references: LegalRef[] }>("legal.references").then((r) => setLegalRefs(r.references)).catch(() => undefined);
    if (mode === "contingency") refreshContingencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const fiscalRef = legalRefs.find((r) => r.article.includes("7"));
  const contingencyRef = legalRefs.find((r) => r.article.includes("15"));

  const refreshContingencies = async () => {
    const r = await api<{ invoices: typeof contingencies }>("contingency.list");
    setContingencies(r.invoices);
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api<{ invoices: InvoiceLite[] }>("invoice.search", { query });
    setInvoices(r.invoices);
  };

  const selectInvoice = async (inv: InvoiceLite) => {
    setInvoice(inv);
    const r = await api<{ summary: typeof summary }>("reconciliation.summary", { invoiceId: inv.id });
    setSummary(r.summary as typeof summary);
  };

  const addPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    await api("payment.add", { ...form, invoiceId: invoice.id, amount: Number(form.amount) });
    setMessage("Referencia de pago registrada. La factura fiscal permanece intacta.");
    setForm({ ...form, referenceNumber: "", amount: "" });
    selectInvoice(invoice);
  };

  const updatePayment = async (p: PaymentRow, patch: Partial<PaymentRow>, reason = "Corrección de referencia de pago") => {
    await api("payment.update", { id: p.id, ...patch, reason });
    setMessage("Cambio operativo guardado y auditado en payment_audit_logs.");
    if (invoice) selectInvoice(invoice);
  };

  const showAudit = async (paymentId: number) => {
    const r = await api<{ logs: typeof audit }>("audit.list", { invoicePaymentId: paymentId });
    setAudit(r.logs);
  };

  const createContingency = async (e: React.FormEvent) => {
    e.preventDefault();
    await api("contingency.create", { ...contingency, amount: Number(contingency.amount) });
    setMessage("Factura de contingencia registrada y citada conforme a la Providencia SNAT/2026/00093 Art. 15.");
    setContingency({ ...contingency, customerName: "", customerRif: "", customerEmail: "", amount: "", notes: "" });
    refreshContingencies();
  };

  const syncContingency = async (id: number) => {
    const r = await api<{ message: string }>("contingency.sync", { id });
    setMessage(r.message || "Contingencia sincronizada con la imprenta digital.");
    refreshContingencies();
  };

  return (
    <div className="operations-panel__container">
      <header className="operations-panel__hero">
        <div>
          <span className="operations-panel__eyebrow">
            {mode === "conciliation" ? "OPERACIONES · CONCILIACIÓN DE PAGOS" : "OPERACIONES · CONTINGENCIA FISCAL"}
          </span>
          <h2>{mode === "conciliation" ? "Pagos y referencias operativas" : "Facturación por contingencia"}</h2>
          <p>
            {mode === "conciliation"
              ? "Busca una factura existente (solo lectura) y gestiona Pago Móvil, transferencias y conciliaciones. Cada cambio queda auditado sin alterar el documento fiscal."
              : "Emite facturas manuales por contingencia y sincronízalas después con la imprenta digital homologada del SENIAT."}
          </p>
        </div>
        <span className="operations-panel__legal-chip">
          <Scale size={12} />
          {mode === "conciliation" ? "Auditoría operativa · separación de datos" : `${contingencyRef?.lawName || "Providencia SNAT/2026/00093"} ${contingencyRef?.article || "Art. 15"}`}
        </span>
      </header>

      {message && (
        <div className="operations-panel__card">
          <p className="operations-panel__audit-row"><CheckCircle2 size={15} /> <strong>{message}</strong></p>
        </div>
      )}

      {mode === "conciliation" ? (
        <>
          <section className="operations-panel__card">
            <form onSubmit={search} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <label className="operations-panel__form-grid" style={{ flex: 1, minWidth: 220, display: "block" }}>
                Buscar factura fiscal (solo lectura)
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="N° de factura, control o cliente" />
              </label>
              <button className="operations-panel__btn" type="submit"><Search size={14} /> Buscar factura</button>
            </form>

            {invoices.length > 0 && (
              <table className="operations-panel__table" style={{ marginTop: 14 }}>
                <thead><tr><th>Factura</th><th>Control</th><th>Cliente</th><th>RIF</th><th>Total</th><th /></tr></thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td><strong>{inv.invoiceNumber}</strong></td>
                      <td>{inv.controlNumber}</td>
                      <td>{inv.customerName}</td>
                      <td>{inv.customerRif}</td>
                      <td>${inv.total.toFixed(2)}</td>
                      <td><button className="operations-panel__btn operations-panel__btn--ghost" onClick={() => selectInvoice(inv)}>Seleccionar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {invoice && (
              <>
                <div className="operations-panel__fiscal-lock" style={{ marginTop: 17 }}>
                  <Lock size={19} />
                  <div style={{ flex: 1 }}>
                    <h4>Documento fiscal inmutable · {invoice.invoiceNumber}</h4>
                    <div className="operations-panel__fiscal-grid">
                      <div><span>N° Control</span><strong>{invoice.controlNumber}</strong></div>
                      <div><span>Cliente</span><strong>{invoice.customerName}</strong></div>
                      <div><span>RIF / Cédula</span><strong>{invoice.customerRif}</strong></div>
                      <div><span>Base imponible</span><strong>${invoice.taxableBase.toFixed(2)}</strong></div>
                      <div><span>IVA</span><strong>${invoice.ivaAmount.toFixed(2)}</strong></div>
                      <div><span>Total factura</span><strong>${invoice.total.toFixed(2)}</strong></div>
                    </div>
                    <span className="operations-panel__immutable">
                      FISCAL INMUTABLE · {fiscalRef ? `${fiscalRef.lawName} ${fiscalRef.article}` : "Providencia SNAT/2026/00093 Art. 7"}
                    </span>
                  </div>
                </div>

                {summary && (
                  <div className="operations-panel__summary" style={{ marginTop: 16 }}>
                    <div className="operations-panel__metric"><span>Pagado según registros operativos</span><strong>${summary.applied.toFixed(2)}</strong></div>
                    <div className={`operations-panel__metric ${summary.outstanding > 0.02 ? "operations-panel__metric--pending" : "operations-panel__metric--done"}`}><span>Saldo por conciliar</span><strong>${summary.outstanding.toFixed(2)}</strong></div>
                    <div className={`operations-panel__metric ${summary.fullySettled ? "operations-panel__metric--done" : ""}`}><span>Estado</span><strong>{summary.fullySettled ? "Saldado" : "En conciliación"}</strong></div>
                  </div>
                )}
              </>
            )}
          </section>

          {invoice && (
            <div className="operations-panel__grid">
              <section className="operations-panel__card">
                <h3 style={{ fontSize: 13, color: "#0e627e", margin: "0 0 12px" }}>Referencias de pago (editables)</h3>
                <form onSubmit={addPayment} className="operations-panel__form-grid">
                  <label>Tipo de pago<select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}><option>Pago móvil</option><option>Transferencia bancaria</option><option>Zelle / Divisas</option><option>Efectivo</option><option>Punto de venta</option></select></label>
                  <label>Banco<select value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })}><option>Banesco</option><option>Mercantil</option><option>Banco de Venezuela</option><option>Provincial</option><option>Bank of America</option><option>Otro</option></select></label>
                  <label>N° referencia / Pago Móvil<input required value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })} placeholder="Ej. 0134-123456" /></label>
                  <label>Monto (USD)<input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
                  <label>Fecha de cobro<input type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} /></label>
                  <label>Nota operativa<input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Motivo o referencia bancaria" /></label>
                  <div style={{ gridColumn: "1 / -1" }}><button className="operations-panel__btn" type="submit"><Plus size={14} /> Agregar referencia de pago</button></div>
                </form>

                <table className="operations-panel__table" style={{ marginTop: 17 }}>
                  <thead><tr><th>Fecha</th><th>Tipo</th><th>Referencia</th><th>Banco</th><th>Monto</th><th>Estado</th><th /></tr></thead>
                  <tbody>
                    {summary?.payments.map((p) => (
                      <tr key={p.id}>
                        <td><input value={p.paymentDate} onChange={(e) => updatePayment(p, { paymentDate: e.target.value }, "Edición de fecha de cobro") } /></td>
                        <td><input value={p.paymentMethod} onChange={(e) => updatePayment(p, { paymentMethod: e.target.value }, "Edición de tipo de pago") } /></td>
                        <td><input value={p.referenceNumber} onChange={(e) => updatePayment(p, { referenceNumber: e.target.value }, "Corrección de número de referencia") } /></td>
                        <td><input value={p.bankName} onChange={(e) => updatePayment(p, { bankName: e.target.value }, "Corrección de banco") } /></td>
                        <td><input type="number" step="0.01" value={p.amount} onChange={(e) => updatePayment(p, { amount: Number(e.target.value) }, "Ajuste de monto operativo") } /></td>
                        <td>
                          <select value={p.status} onChange={(e) => updatePayment(p, { status: e.target.value }, "Cambio de estado de conciliación") }>
                            <option value="pendiente">Pendiente</option>
                            <option value="conciliado">Conciliado</option>
                            <option value="anulado">Anulado</option>
                          </select>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="operations-panel__btn operations-panel__btn--ghost" onClick={() => showAudit(p.id)} title="Ver auditoría"><History size={13} /></button>
                          <button className="operations-panel__btn operations-panel__btn--ghost" onClick={() => confirm("¿Eliminar referencia operativa?") && api("payment.delete", { id: p.id, reason: "Eliminación durante conciliación" }).then(() => selectInvoice(invoice!))} title="Eliminar"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <aside className="operations-panel__card">
                <h3 style={{ fontSize: 13, color: "#0e627e", margin: "0 0 12px" }}>Auditoría de cambios operativos</h3>
                <div className="operations-panel__audit">
                  <h4>payment_audit_logs</h4>
                  {audit.length === 0 ? (
                    <div className="operations-panel__empty">Selecciona un pago para ver su historial de cambios.</div>
                  ) : audit.map((a, i) => (
                    <div className="operations-panel__audit-row" key={i}>
                      <History size={13} />
                      <div><strong>{a.field}</strong> · {a.oldValue || "—"} → <strong>{a.newValue || "—"}</strong><br /><span>{a.changedBy} · {new Date(a.changedAt).toLocaleString("es-VE")}</span><br /><span>{a.reason}</span></div>
                    </div>
                  ))}
                </div>
                <div className="operations-panel__audit" style={{ marginTop: 13 }}>
                  <h4>Referencia legal</h4>
                  {legalRefs.map((r) => (
                    <div className="operations-panel__audit-row" key={r.id}>
                      <Scale size={13} />
                      <div><strong>{r.lawName} · {r.article}</strong><br /><span>{r.description}</span></div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          )}
        </>
      ) : (
        <div className="operations-panel__grid">
          <section className="operations-panel__card">
            <h3 style={{ fontSize: 13, color: "#0e627e", margin: "0 0 12px" }}>Emitir factura de contingencia</h3>
            <form onSubmit={createContingency} className="operations-panel__form-grid">
              <label>Número manual<input required value={contingency.manualNumber} onChange={(e) => setContingency({ ...contingency, manualNumber: e.target.value })} /></label>
              <label>Fecha de emisión<input type="date" required value={contingency.issueDate} onChange={(e) => setContingency({ ...contingency, issueDate: e.target.value })} /></label>
              <label>Cliente<input required value={contingency.customerName} onChange={(e) => setContingency({ ...contingency, customerName: e.target.value })} /></label>
              <label>RIF / Cédula<input value={contingency.customerRif} onChange={(e) => setContingency({ ...contingency, customerRif: e.target.value })} /></label>
              <label>Correo para envío<input type="email" value={contingency.customerEmail} onChange={(e) => setContingency({ ...contingency, customerEmail: e.target.value })} /></label>
              <label>Monto total (USD)<input required type="number" step="0.01" value={contingency.amount} onChange={(e) => setContingency({ ...contingency, amount: e.target.value })} /></label>
              <label style={{ gridColumn: "1 / -1" }}>Motivo de contingencia<textarea rows={2} value={contingency.notes} onChange={(e) => setContingency({ ...contingency, notes: e.target.value })} placeholder="Caída del sistema homologado, falla eléctrica, etc." /></label>
              <div style={{ gridColumn: "1 / -1" }}><button className="operations-panel__btn" type="submit"><FileWarning size={14} /> Registrar contingencia</button></div>
            </form>
          </section>

          <section className="operations-panel__card">
            <h3 style={{ fontSize: 13, color: "#0e627e", margin: "0 0 12px" }}>Contingencias registradas</h3>
            <table className="operations-panel__table">
              <thead><tr><th>N° Manual</th><th>Fecha</th><th>Cliente</th><th>Monto</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {contingencies.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.manualNumber}</strong></td>
                    <td>{c.issueDate}</td>
                    <td>{c.customerName}<br /><small style={{ color: "#6c8b99" }}>{c.customerRif}</small></td>
                    <td>${c.amount.toFixed(2)}</td>
                    <td><span className={`operations-panel__tag ${c.syncedStatus === "sincronizado" ? "operations-panel__tag--done" : "operations-panel__tag--pending"}`}>{c.syncedStatus === "sincronizado" ? `Sincronizada ${c.authorizationCode}` : "Pendiente de sincronizar"}</span></td>
                    <td>{c.syncedStatus !== "sincronizado" && <button className="operations-panel__btn operations-panel__btn--ghost" onClick={() => syncContingency(c.id)}><RefreshCw size={12} /> Sincronizar</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="operations-panel__audit" style={{ marginTop: 14 }}>
              <h4>Marco legal aplicado</h4>
              <div className="operations-panel__audit-row"><Scale size={13} /><div><strong>{contingencyRef?.lawName || "Providencia SNAT/2026/00093"} · {contingencyRef?.article || "Art. 15"}</strong><br /><span>{contingencyRef?.description || "Facturación por contingencia y transmisión posterior al sistema homologado."}</span></div></div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
