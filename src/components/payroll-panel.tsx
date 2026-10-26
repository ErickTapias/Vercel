"use client";
import { useState, useRef } from "react";
import {
  Users, CalendarDays, FileText, Plus, Pencil, Trash2, Printer, Download, Send, CheckCircle2,
  Banknote, Wallet, Clock, ShieldCheck, Upload, AlertCircle, Eye,
} from "lucide-react";
import { useApp } from "./app-context";
import { SectionHead, KpiCard, EmptyState, Avatar } from "./ui";
import { dateLabel, sum } from "@/lib/utils";
import type { PayrollEmployee, PayrollPeriod, PayrollTransaction, PayrollReceipt } from "@/lib/types";

async function payrollCall(action: string, data: unknown) {
  const res = await fetch("/api/payroll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, data }) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "No se pudo completar la operación de nómina.");
  return json;
}

export function PayrollPanel() {
  const { data, money, notify, refresh } = useApp();
  const [tab, setTab] = useState<"empleados" | "nominas" | "recibos">("empleados");
  const [employeeModal, setEmployeeModal] = useState<Partial<PayrollEmployee> | null>(null);
  const [previewTx, setPreviewTx] = useState<PayrollTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const employees = data.payrollEmployees || [];
  const periods = data.payrollPeriods || [];
  const transactions = data.payrollTransactions || [];
  const receipts = data.payrollReceipts || [];
  const config = data.payrollConfig;

  const handleProcess = async (employeeId: number) => {
    setBusy(true);
    try {
      const created = await payrollCall("payroll.process", { employeeIds: [employeeId], periodName: `Nómina ${new Date().toLocaleDateString("es-VE")}`, startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10) });
      await refresh();
      notify(`Nómina procesada. ${created.processed.length} recibo generado, listo para revisión y pago.`);
      setTab("nominas");
    } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); }
  };

  const handleMarkPaid = async (tx: PayrollTransaction) => {
    setBusy(true);
    try {
      const res = await payrollCall("payroll.markPaid", { transactionId: tx.id });
      notify(`Pago confirmado. Recibo ${res.receipt.receiptNumber} enviado al empleado y respaldado en la empresa.`);
      await refresh();
      setPreviewTx(null);
      setTab("recibos");
    } catch (e) { notify((e as Error).message, true); } finally { setBusy(false); }
  };

  const openReceipt = (receipt: PayrollReceipt | undefined, tx?: PayrollTransaction) => {
    const html = receipt?.receiptHtml || "";
    if (!html) return notify("El recibo se generará al procesar la nómina de este empleado.", true);
    const w = window.open("", "_blank", "width=880,height=900");
    if (!w) return notify("Permite ventanas emergentes para ver o imprimir el recibo.", true);
    w.document.open(); w.document.write(html); w.document.close();
  };

  return (
    <div className="module-stack payroll-scope">
      <section className="payroll-hero">
        <div>
          <span className="payroll-eyebrow">GESTIÓN DE NÓMINA · LOTTT · IVSS · FAOV · INCES · ISLR</span>
          <h2>Nómina y recibos de pago con respaldo automático</h2>
          <p>Cálculo independiente de asignaciones, deducciones legales y provisiones patronales. Al marcar el pago, el recibo se envía al empleado y se respalda para la empresa.</p>
        </div>
        <button className="button primary text-xs" onClick={() => setEmployeeModal({})}><Plus size={15} /> Registrar empleado</button>
      </section>

      <div className="kpi-grid">
        <KpiCard title="Empleados activos" value={String(employees.filter((e) => e.status === "activo").length)} icon={<Users size={18} />} color="purple" detail="Equipo registrado en nómina" />
        <KpiCard title="Nómina del período" value={money(sum(transactions.slice(0, 30), (t: PayrollTransaction) => t.net))} icon={<Banknote size={18} />} color="green" detail="Neto pagado a trabajadores" />
        <KpiCard title="Recibos emitidos" value={String(receipts.length)} icon={<FileText size={18} />} color="blue" detail="Con respaldo y hash de integridad" />
        <KpiCard title="Cargas patronales" value={money(sum(transactions.slice(0, 30), (t: PayrollTransaction) => t.gross * 0.17))} icon={<ShieldCheck size={18} />} color="peach" detail="IVSS 9% + FAOV 2% + INCES 2% + 3%" />
      </div>

      <div className="tabs">
        <button className={tab === "empleados" ? "active" : ""} onClick={() => setTab("empleados")}><Users size={16} /> Empleados ({employees.length})</button>
        <button className={tab === "nominas" ? "active" : ""} onClick={() => setTab("nominas")}><CalendarDays size={16} /> Nómina procesada ({transactions.length})</button>
        <button className={tab === "recibos" ? "active" : ""} onClick={() => setTab("recibos")}><FileText size={16} /> Recibos y respaldos ({receipts.length})</button>
      </div>

      {tab === "empleados" && (
        <section className="card">
          <SectionHead title="Directorio de empleados" subtitle="Datos laborales, salario y régimen de seguridad social aplicable." />
          {employees.length === 0 ? <EmptyState title="Registra a tu equipo de trabajo" description="Cada empleado podrá recibir su recibo de pago por correo al confirmar el pago." action={<button className="button primary" onClick={() => setEmployeeModal({})}><Plus size={16} /> Registrar empleado</button>} /> : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Empleado</th><th>Cargo / Área</th><th>Salario</th><th>Régimen social</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {employees.map((e) => (
                    <tr key={e.id}>
                      <td><div className="customer-cell"><Avatar name={e.name} /><span><strong>{e.name}</strong><small>{e.email || e.phone || e.document}</small></span></div></td>
                      <td>{e.position} · {e.department}</td>
                      <td><strong className="font-mono">{money(e.baseSalary || e.hourlyRate || e.pieceRate)}</strong><small className="block text-[9px] text-slate-500">{e.salaryType === "por_pieza" ? `Bs. ${e.pieceRate}/pieza` : e.salaryType === "por_hora" ? `Bs. ${e.hourlyRate}/hora` : e.salaryType === "quincenal" ? "Quincenal" : "Mensual"}</small></td>
                      <td><div className="permission-tags">{e.isIvss && <span>IVSS</span>}{e.isFaov && <span>FAOV</span>}{e.isInces && <span>INCES</span>}{e.withholdIslr && <span>ISLR</span>}</div></td>
                      <td><span className={`status-badge ${e.status === "activo" ? "paid" : "pending"}`}><i />{e.status === "activo" ? "Activo" : "Inactivo"}</span></td>
                      <td><div className="flex gap-1.5 justify-end"><button className="button secondary text-[10px] py-1 px-2 h-7" onClick={() => setEmployeeModal(e)}><Pencil size={12} /> Editar</button><button className="button primary text-[10px] py-1 px-2.5 h-7" disabled={busy} onClick={() => handleProcess(e.id)}><Banknote size={12} /> Procesar nómina</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "nominas" && (
        <section className="card">
          <SectionHead title="Nómina procesada" subtitle="Revisa el recibo antes de confirmar el pago y el envío automático al empleado." />
          {transactions.length === 0 ? <EmptyState title="Todavía no has procesado nómina" description="Procesa la nómina de un empleado para generar su recibo con deducciones legales." /> : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Empleado</th><th>Período</th><th>Asignaciones</th><th>Deducciones</th><th>Neto a pagar</th><th>Estado</th><th /></tr></thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.employeeName}</strong></td>
                      <td>{dateLabel(t.createdAt)}</td>
                      <td className="font-mono">{money(t.gross)}</td>
                      <td className="font-mono text-amber-700">−{money(t.totalDeductions)}</td>
                      <td className="amount font-bold">{money(t.net)}</td>
                      <td><span className={`status-badge ${t.status === "pagado" ? "paid" : "pending"}`}><i />{t.status === "pagado" ? "Pagado y enviado" : "Pendiente de pago"}</span></td>
                      <td><div className="flex gap-1.5 justify-end"><button className="button secondary text-[10px] py-1 px-2 h-7" onClick={() => setPreviewTx(t)}><Eye size={12} /> Vista previa</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === "recibos" && (
        <section className="card">
          <SectionHead title="Recibos de pago y respaldo de la empresa" subtitle="Cada recibo guardado incluye hash de integridad, copia en servidor y registro de envío." />
          {receipts.length === 0 ? <EmptyState title="Aún no hay recibos generados" description="Los recibos aparecerán aquí al procesar la nómina." /> : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Recibo</th><th>Empleado</th><th>Neto pagado</th><th>Hash de integridad</th><th>Respaldo</th><th>Envío</th><th /></tr></thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td><strong className="font-mono text-purple-700">{r.receiptNumber}</strong></td>
                      <td>{r.employeeName}</td>
                      <td className="amount font-bold">{money(r.amount)}</td>
                      <td className="font-mono text-[9px]">{(r.integrityHash || "").slice(0, 16)}…</td>
                      <td><span className="text-[10px] text-slate-600 dark:text-slate-300 font-mono">{r.backupPath || "En memoria del sistema"}</span></td>
                      <td><span className={`status-badge ${r.emailSent ? "paid" : "pending"}`}><i />{r.emailSent ? `Enviado ${dateLabel(r.emailSentAt || r.createdAt)}` : "Pendiente"}</span></td>
                      <td><div className="flex gap-1.5 justify-end"><button className="button secondary text-[10px] py-1 px-2 h-7" onClick={() => openReceipt(r)}><Printer size={12} /> Imprimir / PDF</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Vista previa del recibo antes de pagar */}
      {previewTx && (() => {
        const receipt = receipts.find((r) => r.transactionId === previewTx.id);
        return (
          <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setPreviewTx(null)}>
            <div className="modal wide" role="dialog" aria-modal="true">
              <div className="modal-header"><div><h2>Recibo de pago · {previewTx.employeeName}</h2><p>Revisa asignaciones, deducciones y neto antes de confirmar el pago.</p></div><button className="icon-button modal-close" onClick={() => setPreviewTx(null)}>✕</button></div>
              <div className="modal-body space-y-3">
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="payroll-mini"><span>Asignaciones</span><strong>{money(previewTx.gross)}</strong></div>
                  <div className="payroll-mini"><span>Deducciones legales</span><strong>−{money(previewTx.totalDeductions)}</strong></div>
                  <div className="payroll-mini total"><span>Neto a pagar</span><strong>{money(previewTx.net)}</strong></div>
                </div>
                <div className="payroll-lines"><h4>Asignaciones</h4>{(previewTx.assignments || []).map((l, i) => <div key={i}><span>{l.label}<small>{l.basis || l.note}</small></span><strong>{money(l.amount)}</strong></div>)}</div>
                <div className="payroll-lines"><h4>Deducciones del trabajador</h4>{(previewTx.deductions || []).map((l, i) => <div key={i}><span>{l.label}<small>{l.basis || l.note}</small></span><strong>−{money(l.amount)}</strong></div>)}</div>
                <div className="payroll-lines"><h4>Provisiones patronales</h4>{(previewTx.provisions || []).map((l, i) => <div key={i}><span>{l.label}<small>{l.note}</small></span><strong>{money(l.amount)}</strong></div>)}</div>
              </div>
              <div className="modal-footer">
                <button className="button secondary" onClick={() => openReceipt(receipt, previewTx)}><Printer size={15} /> Imprimir</button>
                <button className="button secondary" onClick={() => openReceipt(receipt, previewTx)}><Download size={15} /> Descargar PDF</button>
                {previewTx.status !== "pagado" ? (
                  <button className="button primary" disabled={busy} onClick={() => handleMarkPaid(previewTx)}><Send size={15} /> {busy ? "Enviando..." : "Marcar como Pagado y Enviar"}</button>
                ) : (
                  <button className="button primary" onClick={() => openReceipt(receipt, previewTx)}><FileText size={15} /> Ver recibo enviado</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Alta / edición de empleado */}
      {employeeModal && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setEmployeeModal(null)}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header"><div><h2>{employeeModal.id ? "Editar empleado" : "Registrar empleado"}</h2><p>Datos laborales, salario y régimen de seguridad social.</p></div><button className="icon-button modal-close" onClick={() => setEmployeeModal(null)}>✕</button></div>
            <EmployeeForm employee={employeeModal} onClose={() => setEmployeeModal(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeForm({ employee, onClose }: { employee: Partial<PayrollEmployee>; onClose: () => void }) {
  const { notify, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const v = Object.fromEntries(fd) as Record<string, FormDataEntryValue>;
      await payrollCall("employee.save", {
        id: employee.id, ...v,
        isIvss: fd.get("isIvss") === "on", isFaov: fd.get("isFaov") === "on", isInces: fd.get("isInces") === "on", withholdIslr: fd.get("withholdIslr") === "on",
      });
      await refresh();
      notify("Empleado registrado correctamente en el módulo de nómina.");
      onClose();
    } catch (err) { notify((err as Error).message, true); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        <div className="form-grid">
          <label className="full-span">Nombre completo<input name="name" required defaultValue={employee.name} /></label>
          <label>Cédula / RIF<input name="document" defaultValue={employee.document} placeholder="V-18.123.456" /></label>
          <label>Correo electrónico<input name="email" type="email" defaultValue={employee.email} /></label>
          <label>Teléfono<input name="phone" defaultValue={employee.phone} /></label>
          <label>Cargo<input name="position" defaultValue={employee.position} placeholder="Operario de costura" /></label>
          <label>Departamento<input name="department" defaultValue={employee.department || "Taller"} /></label>
          <label>Fecha de ingreso<input name="hireDate" type="date" defaultValue={employee.hireDate || new Date().toISOString().slice(0, 10)} /></label>
          <label>Tipo de salario<select name="salaryType" defaultValue={employee.salaryType || "mensual"}><option value="mensual">Mensual</option><option value="quincenal">Quincenal</option><option value="por_hora">Por hora</option><option value="por_pieza">Por pieza / producido</option></select></label>
          <label>Salario base mensual (Bs.)<input name="baseSalary" type="number" step="0.01" defaultValue={employee.baseSalary || 0} /></label>
          <label>Tarifa por hora (Bs.)<input name="hourlyRate" type="number" step="0.01" defaultValue={employee.hourlyRate || 0} /></label>
          <label>Tarifa por pieza (Bs.)<input name="pieceRate" type="number" step="0.01" defaultValue={employee.pieceRate || 0} /></label>
          <label>Días de cestaticket / mes<input name="cestaticketDays" type="number" min="0" max="31" defaultValue={employee.cestaticketDays ?? 30} /></label>
          <label>Provisión de prestaciones<select name="provisionMode" defaultValue={employee.provisionMode || "mensual"}><option value="mensual">Garantía mensual (LOTTT)</option><option value="fondo">Fondo colectivo (FIDE)</option></select></label>
          <label className="full-span">Banco y cuenta para pago<input name="bankName" defaultValue={employee.bankName} placeholder="Banesco" /><input name="bankAccount" defaultValue={employee.bankAccount} placeholder="0134-0123-45-678901" /></label>
        </div>
        <div className="form-section-label" style={{ marginTop: 20 }}><ShieldCheck size={15} /> Régimen de seguridad social</div>
        <div className="permissions-grid">
          {([["isIvss", "IVSS (4% obrero)"], ["isFaov", "FAOV (1% obrero)"], ["isInces", "INCES (0,5% obrero)"], ["withholdIslr", "Retención ISLR (Art. 143)"]] as const).map(([name, label]) => (
            <label className="permission-check" key={name}><input type="checkbox" name={name} defaultChecked={employee[name] ?? true} /><span>{label}</span></label>
          ))}
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="button secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" className="button primary" disabled={busy}>{busy ? "Guardando..." : "Guardar empleado"}</button>
      </div>
    </form>
  );
}
