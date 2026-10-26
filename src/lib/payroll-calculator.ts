import type { PayrollConfig, PayrollLine, Settings } from "@/lib/types";

export type PayrollEmployeeInput = {
  id?: number; name: string; document?: string; position?: string; department?: string; hireDate?: string | Date;
  salaryType: string; baseSalary?: number; hourlyRate?: number; pieceRate?: number; cestaticketDays?: number;
  extraHours?: number; bonus?: number; provisionMode?: string;
  isIvss?: boolean; isFaov?: boolean; isInces?: boolean; withholdIslr?: boolean;
};

export type PayrollCalculation = {
  employee: { id?: number; name: string; document: string; position: string; department: string; hireDate: string };
  period: { name: string; startDate: string; endDate: string };
  assignments: PayrollLine[];
  deductions: PayrollLine[];
  provisions: PayrollLine[];
  employerBurden: PayrollLine[];
  gross: number;
  totalDeductions: number;
  net: number;
  exchangeRate: number;
  netUsd: number;
  legalNotes: string[];
};

const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Servicio independiente de cálculo de nómina conforme a LOTTT, IVSS, FAOV, INCES e ISLR (Venezuela, octubre 2026)
export class PayrollCalculatorService {
  constructor(private config: PayrollConfig) {}

  calculate(employee: PayrollEmployeeInput, period: { name: string; startDate: string; endDate: string }, extras: { extraHours?: number; bonus?: number; pieceCount?: number; hourlyHours?: number; exchangeRate?: number } = {}): PayrollCalculation {
    const c = this.config;
    const round2 = round;
    const periodDays = Math.max(1, Math.min(31, Math.round((new Date(period.endDate).getTime() - new Date(period.startDate).getTime()) / 86400000) + 1));
    const proration = Math.min(1, periodDays / 30);

    // ---------- ASIGNACIONES (LOTTT Art. 129 - conceptos no deducibles) ----------
    const assignments: PayrollLine[] = [];
    let base = 0;
    if (employee.salaryType === "por_hora") {
      const hours = extras.hourlyHours ?? 176;
      base = round2((employee.hourlyRate || 0) * hours);
      assignments.push({ label: "Salario por hora", amount: base, basis: `${hours} h × Bs. ${employee.hourlyRate}`, note: "LOTTT Art. 129" });
    } else if (employee.salaryType === "por_pieza") {
      const pieces = extras.pieceCount ?? 0;
      base = round2((employee.pieceRate || 0) * pieces);
      assignments.push({ label: "Salario por pieza / producido", amount: base, basis: `${pieces} piezas × Bs. ${employee.pieceRate}`, note: "Remuneración a destajo LOTTT Art. 142" });
    } else {
      base = round2((employee.baseSalary || 0) * proration);
      assignments.push({ label: `Salario base ${employee.salaryType === "quincenal" ? "(quincena)" : "(mensual)"}`, amount: base, basis: `Bs. ${employee.baseSalary} × ${proration.toFixed(2)} período`, note: "LOTTT Art. 129" });
    }

    const extraHours = extras.extraHours ?? employee.extraHours ?? 0;
    const hourlyBase = employee.salaryType === "por_hora" ? (employee.hourlyRate || 0) : base / (periodDays * 8);
    const extraPay = round2(extraHours * hourlyBase * 1.5);
    if (extraPay > 0) assignments.push({ label: "Horas extraordinarias (recargo 50%)", amount: extraPay, basis: `${extraHours} h × ${hourlyBase.toFixed(2)} × 1,5`, note: "LOTTT Art. 87" });

    const bonus = round2(extras.bonus ?? employee.bonus ?? 0);
    if (bonus > 0) assignments.push({ label: "Bonificación / comisión de producción", amount: bonus, note: "LOTTT Art. 130" });

    const cestaDays = Math.min(31, employee.cestaticketDays ?? 30);
    const cestaticket = round2(cestaDays * c.cestaticketDay);
    if (cestaticket > 0) assignments.push({ label: "Bono de alimentación (Cestaticket)", amount: cestaticket, basis: `${cestaDays} días × Bs. ${c.cestaticketDay}`, note: "Ley de Alimentación / contrato colectivo" });

    const gross = round2(assignments.reduce((t, a) => t + a.amount, 0));

    // ---------- DEDUCCIONES LEGALES DEL TRABAJADOR ----------
    const deductions: PayrollLine[] = [];
    const ivssCeilingSalary = c.minimumWage * (c.ivssCeilingSalaries || 5);
    const ivssBase = employee.isIvss ? Math.min(base, ivssCeilingSalary) : 0;
    const ivss = employee.isIvss ? round2(ivssBase * c.ivssEmployee) : 0;
    if (ivss > 0) deductions.push({ label: "Cuota obrera IVSS (4%)", amount: ivss, basis: `Tope: 5 salarios mínimos (Bs. ${ivssCeilingSalary})`, note: "Ley del Seguro Social Art. 27" });

    const faov = employee.isFaov ? round2(gross * c.faovEmployee) : 0;
    if (faov > 0) deductions.push({ label: "FAOV empleado (1%)", amount: faov, basis: "1% sobre total asignaciones", note: "Ley del FAOV" });

    const inces = employee.isInces && c.incesApplicable ? round2(gross * c.incesEmployee) : 0;
    if (inces > 0) deductions.push({ label: "INCES cuota obrera (0,5%)", amount: inces, note: "Ley del INCES" });

    // Retención ISLR (Art. 143 LISLR, tarifa mensual sobre la base gravable expresada en Unidades Tributarias)
    const taxableBs = Math.max(0, gross - ivss - faov - inces);
    const taxableUT = taxableBs / c.utValue;
    const bracket = (c.islBrackets || []).find((b) => taxableUT >= b.from && taxableUT < b.to) || (c.islBrackets || []).at(-1);
    let islr = 0;
    if (employee.withholdIslr && bracket && taxableUT > 1000) {
      islr = round2(Math.max(0, taxableUT * bracket.rate - bracket.discount) * c.utValue);
      deductions.push({ label: "Retención ISLR (Art. 143 LISLR)", amount: islr, basis: `${taxableUT.toFixed(1)} UT · alícuota ${(bracket.rate * 100).toFixed(0)}% menos ${bracket.discount} UT`, note: "Retención mensual a cuenta del ISLR" });
    } else if (employee.withholdIslr) {
      deductions.push({ label: "Retención ISLR (Art. 143 LISLR)", amount: 0, basis: "Escalera exenta hasta 1.000 UT mensuales", note: "Sin retención este período" });
    }

    const totalDeductions = round2(deductions.reduce((t, d) => t + d.amount, 0));
    const net = round2(gross - totalDeductions);

    // ---------- PROVISIONES PATRONALES (no se descuentan al trabajador) ----------
    const provisions: PayrollLine[] = [];
    const dailySalary = base / 30;
    if (employee.provisionMode !== "fondo") {
      provisions.push({ label: "Provisión de prestaciones sociales", amount: round2(dailySalary * c.provisionDaysMonth), basis: "2,5 días de salario por mes", note: "LOTTT Art. 142 · Garantía mensual" });
      provisions.push({ label: "Provisión de vacaciones", amount: round2(dailySalary * c.vacationDaysMonth), basis: "15 días por año (1,25 días/mes)", note: "LOTTT Art. 190" });
      const years = Math.floor(Math.max(0, (Date.now() - new Date(employee.hireDate || Date.now()).getTime()) / (365 * 86400000)));
      if (years >= c.seniorityFromYear) provisions.push({ label: "Provisión de antigüedad (2 días/año)", amount: round2(dailySalary * c.seniorityDaysMonth), note: "LOTTT Art. 148" });
    } else {
      provisions.push({ label: "Aporte al fondo de prestaciones (FIDE)", amount: round2(dailySalary * c.provisionDaysMonth), note: "Régimen de fondo colectivo · LOPCYMAT" });
    }

    const employerBurden = (c.employerBurden || []).map((b) => ({ label: b.label, amount: round2(gross * b.rate), basis: `${(b.rate * 100).toFixed(0)}% sobre nómina`, note: "Carga patronal informativa" }));

    return {
      employee: { id: employee.id, name: employee.name, document: employee.document || "", position: employee.position || "", department: employee.department || "", hireDate: String(employee.hireDate || "") },
      period,
      assignments,
      deductions,
      provisions,
      employerBurden,
      gross,
      totalDeductions,
      net,
      exchangeRate: extras.exchangeRate || 0,
      netUsd: extras.exchangeRate ? round2(net / extras.exchangeRate) : 0,
      legalNotes: [
        "Cálculo conforme a la Ley Orgánica del Trabajo, los Trabajadores y las Trabajadoras (LOTTT).",
        "Cuota obrera de IVSS 4% (tope 5 salarios mínimos) conforme a la Ley del Seguro Social.",
        "FAOV 1% e INCES 0,5% del trabajador conforme a sus leyes orgánicas.",
        "Retención ISLR mensual según Art. 143 de la Ley de ISLR vigente (Unidad Tributaria actualizada).",
        "Provisiones patronales de prestaciones, vacacional y antigüedad no son deducibles del trabajador.",
      ],
    };
  }
}

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// Recibo de pago en HTML/CSS propio y encapsulado (imprimible y descargable como PDF por el navegador)
export function buildPayrollReceiptHtml(calc: PayrollCalculation, settings: Settings, receiptNumber: string): string {
  const rows = (lines: PayrollLine[]) =>
    lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${esc(l.basis || "—")}</td><td class="num">${l.amount.toFixed(2)}</td></tr>`).join("");
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Recibo ${esc(receiptNumber)}</title>
<style>
@page{size:letter;margin:15mm}body{margin:0;font:12px/1.5 Inter,Arial,sans-serif;color:#172033}
.pr-hd{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #6d28d9;padding-bottom:12px}
.pr-hd img{max-height:48px;max-width:180px}.pr-num{border:2px solid #6d28d9;border-radius:8px;padding:8px 14px;text-align:center}
.pr-num b{display:block;font-size:15px;color:#6d28d9}.pr-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}
.pr-card{border:1px solid #dbe1ec;border-radius:8px;padding:10px 12px;background:#f8fafc}
.pr-card h4{margin:0 0 5px;font-size:10px;letter-spacing:.8px;text-transform:uppercase;color:#64748b}
table{width:100%;border-collapse:collapse;font-size:11px}th{background:#6d28d9;color:#fff;padding:7px;text-align:left;font-size:10px}
td{padding:7px;border-bottom:1px solid #e7ecf3}.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
.pr-block{margin-top:16px}.pr-block h3{font-size:12px;color:#6d28d9;margin:0 0 6px}
.pr-total{margin-top:14px;background:#6d28d9;color:#fff;border-radius:10px;padding:13px 16px;display:flex;justify-content:space-between;align-items:center}
.pr-total b{font-size:21px}.pr-sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:42px}
.pr-sign div{border-top:1px solid #6b7280;text-align:center;padding-top:7px;font-size:10px;color:#64748b}
.pr-foot{margin-top:18px;font-size:9px;color:#64748b;line-height:1.6;border-top:1px solid #e7ecf3;padding-top:10px}
</style></head><body>
<div class="pr-hd">
  <div style="display:flex;gap:12px;align-items:center">${settings.logoUrl ? `<img src="${esc(settings.logoUrl)}" alt="logo">` : ""}<div><b style="font-size:15px">${esc(settings.legalName || settings.businessName)}</b><br><span style="font-size:10px;color:#64748b">RIF ${esc(settings.rif)} · ${esc(settings.address)}</span></div></div>
  <div class="pr-num"><span style="font-size:9px;letter-spacing:1px;color:#64748b">RECIBO DE PAGO</span><b>${esc(receiptNumber)}</b><span style="font-size:10px">${esc(calc.period.name)}<br>${esc(calc.period.startDate)} al ${esc(calc.period.endDate)}</span></div>
</div>
<div class="pr-cards">
  <div class="pr-card"><h4>Empleado</h4><b>${esc(calc.employee.name)}</b><br><span style="font-size:10px;color:#64748b">Cédula/RIF: ${esc(calc.employee.document)}<br>Cargo: ${esc(calc.employee.position)} · ${esc(calc.employee.department)}<br>Fecha de ingreso: ${esc(calc.employee.hireDate)}</span></div>
  <div class="pr-card"><h4>Detalles de pago</h4><span style="font-size:10px;color:#64748b">Tasa BCV de referencia: Bs. ${(calc.exchangeRate || 0).toFixed(2)} / USD<br>Moneda de pago: Bolívares (Bs.)<br>Equivalente referencial en divisas: $ ${calc.netUsd.toFixed(2)}</span></div>
</div>
<div class="pr-block"><h3>Asignaciones</h3><table><thead><tr><th>Concepto</th><th>Base de cálculo</th><th class="num">Monto (Bs.)</th></tr></thead><tbody>${rows(calc.assignments)}<tr><td colspan="2"><b>Total asignaciones</b></td><td class="num"><b>${calc.gross.toFixed(2)}</b></td></tr></tbody></table></div>
<div class="pr-block"><h3>Deducciones del trabajador</h3><table><thead><tr><th>Concepto</th><th>Base legal</th><th class="num">Monto (Bs.)</th></tr></thead><tbody>${rows(calc.deductions)}<tr><td colspan="2"><b>Total deducciones</b></td><td class="num"><b>${calc.totalDeductions.toFixed(2)}</b></td></tr></tbody></table></div>
<div class="pr-block"><h3>Provisiones patronales (no descontadas al trabajador)</h3><table><tbody>${rows(calc.provisions)}</tbody></table></div>
<div class="pr-total"><span>NETO A PAGAR AL TRABAJADOR</span><b>Bs. ${calc.net.toFixed(2)}</b></div>
<div class="pr-sign"><div>Firma del trabajador</div><div>Firma del empleador</div></div>
<div class="pr-foot">${calc.legalNotes.map((n) => `• ${esc(n)}`).join("<br>")}<br><br>Recibo generado por Tesorio · Hash de integridad del sistema. Este documento no constituye un certificado fiscal ni sustituye los registros contables exigidos por el SENIAT.</div>
</body></html>`;
}
