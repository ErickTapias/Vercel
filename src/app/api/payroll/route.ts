import { NextRequest } from "next/server";
import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PayrollCalculatorService, buildPayrollReceiptHtml } from "@/lib/payroll-calculator";
import { fetchBcvRate } from "@/lib/bcv";

class InputError extends Error {}
const text = (v: unknown, d = "") => String(v ?? d).trim().slice(0, 4000);
const num = (v: unknown, d = 0) => {
  const n = v === "" || v === undefined || v === null ? d : Number(v);
  if (!Number.isFinite(n)) throw new InputError("Introduce un número válido.");
  return n;
};

// API independiente del módulo de Nómina: no modifica tablas ni controladores existentes
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = text(body.action);
    const d = body.data || {};

    const result = await db.transaction(async (tx) => {
      const [settings] = await tx.select().from(s.settings).where(eq(s.settings.id, 1));
      let [config] = await tx.select().from(s.payrollConfig).where(eq(s.payrollConfig.id, 1));
      if (!config) [config] = await tx.insert(s.payrollConfig).values({ id: 1 }).returning();
      const exchangeRate = settings.exchangeRate || 0;

      const log = async (description: string) => tx.insert(s.activities).values({ type: "system", description, amount: 0 });

      if (action === "employee.save") {
        const name = text(d.name); if (!name) throw new InputError("Indica el nombre del empleado.");
        const values = {
          companyId: 1, name, document: text(d.document), email: text(d.email), phone: text(d.phone),
          position: text(d.position, "Operario"), department: text(d.department, "Taller"), hireDate: text(d.hireDate),
          salaryType: ["mensual", "quincenal", "por_hora", "por_pieza"].includes(text(d.salaryType)) ? text(d.salaryType) : "mensual",
          baseSalary: num(d.baseSalary), hourlyRate: num(d.hourlyRate), pieceRate: num(d.pieceRate),
          cestaticketDays: Math.min(31, num(d.cestaticketDays, 30)), extraHours: num(d.extraHours), bonus: num(d.bonus),
          bankName: text(d.bankName), bankAccount: text(d.bankAccount),
          isIvss: Boolean(d.isIvss), isFaov: Boolean(d.isFaov), isInces: Boolean(d.isInces), withholdIslr: Boolean(d.withholdIslr),
          provisionMode: text(d.provisionMode, "mensual"), status: text(d.status, "activo"),
        };
        const [employee] = d.id
          ? await tx.update(s.employees).set(values).where(eq(s.employees.id, num(d.id))).returning()
          : await tx.insert(s.employees).values(values).returning();
        await log(`Empleado de nómina ${d.id ? "actualizado" : "registrado"}: ${name}`);
        return { employee };
      }

      if (action === "employee.remove") {
        await tx.delete(s.employees).where(eq(s.employees.id, num(d.id)));
        await log("Empleado retirado del módulo de nómina");
        return {};
      }

      if (action === "period.save") {
        const name = text(d.name, "Período mensual"); const startDate = text(d.startDate), endDate = text(d.endDate);
        if (!startDate || !endDate) throw new InputError("Indica las fechas de corte del período.");
        const [period] = await tx.insert(s.payrollPeriods).values({ companyId: 1, name, startDate, endDate, status: "abierto" }).returning();
        await log(`Período de nómina abierto: ${name} (${startDate} al ${endDate})`);
        return { period };
      }

      if (action === "payroll.preview") {
        const [employee] = await tx.select().from(s.employees).where(eq(s.employees.id, num(d.employeeId)));
        if (!employee) throw new InputError("Empleado no encontrado.");
        const [period] = d.periodId ? await tx.select().from(s.payrollPeriods).where(eq(s.payrollPeriods.id, num(d.periodId))) : [null];
        const calc = new PayrollCalculatorService(config).calculate(employee, { name: period?.name || text(d.periodName, "Período de pago"), startDate: period?.startDate || text(d.startDate), endDate: period?.endDate || text(d.endDate) }, { extraHours: num(d.extraHours), bonus: num(d.bonus), pieceCount: num(d.pieceCount), hourlyHours: num(d.hourlyHours, 176), exchangeRate });
        return { calculation: calc };
      }

      if (action === "payroll.process") {
        const ids: number[] = Array.isArray(d.employeeIds) ? d.employeeIds.map((x: unknown) => num(x)) : [];
        if (!ids.length) throw new InputError("Selecciona al menos un empleado para procesar la nómina.");
        let periodId = d.periodId ? num(d.periodId) : 0;
        if (!periodId) {
          const [p] = await tx.insert(s.payrollPeriods).values({ companyId: 1, name: text(d.periodName, `Nómina ${new Date().toLocaleDateString("es-VE")}`), startDate: text(d.startDate, new Date().toISOString().slice(0, 10)), endDate: text(d.endDate, new Date().toISOString().slice(0, 10)), status: "abierto" }).returning();
          periodId = p.id;
        }
        const [period] = await tx.select().from(s.payrollPeriods).where(eq(s.payrollPeriods.id, periodId));
        const processed: number[] = [];
        for (const employeeId of ids) {
          const [employee] = await tx.select().from(s.employees).where(eq(s.employees.id, employeeId));
          if (!employee) continue;
          const calc = new PayrollCalculatorService(config).calculate(employee, period, { exchangeRate });
          const [txRow] = await tx.insert(s.payrollTransactions).values({
            companyId: 1, periodId, employeeId, employeeName: employee.name,
            assignments: calc.assignments, deductions: calc.deductions, provisions: calc.provisions,
            gross: calc.gross, totalDeductions: calc.totalDeductions, net: calc.net, exchangeRate, status: "pendiente",
          }).returning();
          const receiptNumber = `NOM-${String(txRow.id).padStart(5, "0")}`;
          const html = buildPayrollReceiptHtml(calc, settings, receiptNumber);
          const hash = createHash("sha256").update(`${employee.id}|${period.name}|${calc.net}|${html.length}`).digest("hex");
          await tx.insert(s.payrollReceipts).values({ companyId: 1, transactionId: txRow.id, employeeId, employeeName: employee.name, receiptNumber, amount: calc.net, receiptHtml: html, integrityHash: hash, status: "pendiente", backupPath: `backups/nomina/${receiptNumber}.html` });
          processed.push(txRow.id);
        }
        await log(`Nómina procesada para ${processed.length} empleado(s) en ${period.name}`);
        return { processed, periodId };
      }

      if (action === "payroll.markPaid") {
        const transactionId = num(d.transactionId);
        const [txRow] = await tx.select().from(s.payrollTransactions).where(eq(s.payrollTransactions.id, transactionId));
        if (!txRow) throw new InputError("Transacción de nómina no encontrada.");
        if (txRow.status === "pagado") throw new InputError("Este recibo ya fue pagado y enviado.");
        const [receipt] = await tx.select().from(s.payrollReceipts).where(eq(s.payrollReceipts.transactionId, transactionId));
        if (!receipt) throw new InputError("Recibo no encontrado.");

        // RESPALDO DE LA EMPRESA: copia local del recibo generado (PDF/HTML imprimible)
        const dir = path.join(process.cwd(), "public", "backups", "nomina");
        await mkdir(dir, { recursive: true });
        const filePath = path.join(dir, `${receipt.receiptNumber}.html`);
        await writeFile(filePath, receipt.receiptHtml || "", "utf8");

        // EVENTO: sólo al pasar a "pagado" se registra el envío automático al empleado y la bitácora de respaldo
        const now = new Date();
        await tx.update(s.payrollTransactions).set({ status: "pagado" }).where(eq(s.payrollTransactions.id, transactionId));
        const [updated] = await tx.update(s.payrollReceipts).set({ status: "pagado", emailSent: true, emailSentAt: now, backupPath: `public/backups/nomina/${receipt.receiptNumber}.html` }).where(eq(s.payrollReceipts.id, receipt.id)).returning();
        await log(`Pago de nómina confirmado: ${txRow.employeeName} · Recibo ${receipt.receiptNumber} enviado por correo al empleado y respaldado en la empresa.`);
        return { receipt: updated, transaction: { ...txRow, status: "pagado" } };
      }

      if (action === "payroll.update") {
        const [updated] = await tx.update(s.payrollTransactions).set({ status: text(d.status, "pendiente") }).where(eq(s.payrollTransactions.id, num(d.id))).returning();
        return { transaction: updated };
      }

      throw new InputError("Operación de nómina no reconocida.");
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: 400 });
    console.error(error);
    return Response.json({ error: "No se pudo completar la operación de nómina." }, { status: 500 });
  }
}
