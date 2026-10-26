import { db } from "@/db";
import * as s from "@/db/schema";
import * as ops from "@/db/schema-operations";
import { eq, desc, or, like, sql } from "drizzle-orm";
import { PaymentUpdatedListener } from "../compliance/listeners/PaymentUpdatedListener";

const paymentListener = new PaymentUpdatedListener();

export type PaymentInput = {
  invoiceId: number;
  paymentMethod: string;
  referenceNumber: string;
  bankName: string;
  amount: number;
  paymentDate: string;
  status?: string;
  notes?: string;
};

/**
 * SERVICIO NUEVO · FASE 2 (conciliación operativa).
 * PRINCIPIO DE SEPARACIÓN: toda modificación vive en `tesorio_invoice_payments`;
 * la factura fiscal original es de SOLO LECTURA y jamás se actualiza.
 * Cada alta o edición dispara PaymentUpdatedListener (auditoría de cambios operativos).
 */
export class PaymentReconciliationService {
  /** Consulta de solo lectura del documento fiscal inmutable (no se escribe en la tabla de facturas). */
  async searchInvoices(query: string) {
    const q = `%${query.trim()}%`;
    return db
      .select({
        id: s.sales.id,
        invoiceNumber: s.sales.invoiceNumber,
        controlNumber: s.sales.controlNumber,
        customerName: s.sales.customerName,
        customerRif: s.sales.customerRif,
        total: s.sales.total,
        taxableBase: s.sales.taxableBase,
        ivaAmount: s.sales.ivaAmount,
        issueDate: s.sales.createdAt,
        status: s.sales.status,
      })
      .from(s.sales)
      .where(or(like(s.sales.invoiceNumber, q), like(s.sales.controlNumber, q), like(s.sales.customerName, q)))
      .orderBy(desc(s.sales.createdAt))
      .limit(30);
  }

  async listPayments(invoiceId: number) {
    return db.select().from(ops.invoicePayments).where(eq(ops.invoicePayments.invoiceId, invoiceId)).orderBy(desc(ops.invoicePayments.createdAt));
  }

  async listAuditLogs(invoicePaymentId: number) {
    return db.select().from(ops.paymentAuditLogs).where(eq(ops.paymentAuditLogs.invoicePaymentId, invoicePaymentId)).orderBy(desc(ops.paymentAuditLogs.changedAt));
  }

  async addPayment(input: PaymentInput, actor: string) {
    const [row] = await db
      .insert(ops.invoicePayments)
      .values({
        invoiceId: input.invoiceId,
        paymentMethod: input.paymentMethod || "Pago móvil",
        referenceNumber: input.referenceNumber,
        bankName: input.bankName,
        amount: Number(input.amount) || 0,
        paymentDate: input.paymentDate || new Date().toISOString().slice(0, 10),
        status: input.status || "pendiente",
        notes: input.notes || "",
      })
      .returning();
    await paymentListener.handle({ invoicePaymentId: row.id, field: "creación", newValue: `${row.paymentMethod} ${row.referenceNumber} ${row.amount}`, changedBy: actor, reason: "Alta de referencia de pago operativa" });
    return row;
  }

  async updatePayment(id: number, patch: Partial<PaymentInput>, actor: string, reason = "") {
    const [old] = await db.select().from(ops.invoicePayments).where(eq(ops.invoicePayments.id, id));
    if (!old) throw new Error("Registro de pago no encontrado.");
    const next = {
      paymentMethod: patch.paymentMethod ?? old.paymentMethod,
      referenceNumber: patch.referenceNumber ?? old.referenceNumber,
      bankName: patch.bankName ?? old.bankName,
      amount: patch.amount !== undefined ? Number(patch.amount) : old.amount,
      paymentDate: patch.paymentDate ?? old.paymentDate,
      status: patch.status ?? old.status,
      notes: patch.notes ?? old.notes,
    };
    const changed: Array<[string, string, string]> = [];
    if (next.paymentMethod !== old.paymentMethod) changed.push(["paymentMethod", old.paymentMethod, next.paymentMethod]);
    if (next.referenceNumber !== old.referenceNumber) changed.push(["referenceNumber", old.referenceNumber, next.referenceNumber]);
    if (next.bankName !== old.bankName) changed.push(["bankName", old.bankName, next.bankName]);
    if (next.amount !== old.amount) changed.push(["amount", String(old.amount), String(next.amount)]);
    if (next.paymentDate !== old.paymentDate) changed.push(["paymentDate", old.paymentDate, next.paymentDate]);
    if (next.status !== old.status) changed.push(["status", old.status, next.status]);
    if (next.notes !== old.notes) changed.push(["notes", old.notes, next.notes]);

    const [updated] = await db
      .update(ops.invoicePayments)
      .set({ ...next, updatedAt: new Date() })
      .where(eq(ops.invoicePayments.id, id))
      .returning();

    for (const [field, oldValue, newValue] of changed) {
      await paymentListener.handle({ invoicePaymentId: id, field, oldValue, newValue, changedBy: actor, reason: reason || "Corrección de referencia operativa para conciliación bancaria" });
    }
    return updated;
  }

  async deletePayment(id: number, actor: string, reason = "") {
    const [old] = await db.select().from(ops.invoicePayments).where(eq(ops.invoicePayments.id, id));
    if (!old) throw new Error("Registro de pago no encontrado.");
    await db.delete(ops.invoicePayments).where(eq(ops.invoicePayments.id, id));
    await paymentListener.handle({ invoicePaymentId: id, field: "anulación", oldValue: `${old.paymentMethod} ${old.referenceNumber}`, newValue: "anulado", changedBy: actor, reason: reason || "Registro operativo anulado durante conciliación" });
  }

  /** Resumen de conciliación: total fiscal inmutable frente a pagos operativos flexibles. */
  async reconciliationSummary(invoiceId: number) {
    const [invoice] = await db.select().from(s.sales).where(eq(s.sales.id, invoiceId));
    const payments = await this.listPayments(invoiceId);
    const applied = payments.filter((p) => p.status !== "anulado").reduce((t, p) => t + p.amount, 0);
    return {
      invoice: invoice || null,
      payments,
      applied,
      outstanding: invoice ? Math.round((invoice.total - applied) * 100) / 100 : 0,
      fullySettled: invoice ? Math.abs(invoice.total - applied) < 0.02 : false,
    };
  }
}
