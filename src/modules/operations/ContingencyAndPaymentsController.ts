import { db } from "@/db";
import * as ops from "@/db/schema-operations";
import { eq, desc } from "drizzle-orm";
import { PaymentReconciliationService, type PaymentInput } from "./PaymentReconciliationService";
import { LegalReferenceService } from "../compliance/LegalReferenceService";
import { InvoiceCreatedListener } from "../compliance/listeners/InvoiceCreatedListener";

const reconciliation = new PaymentReconciliationService();
const legal = new LegalReferenceService();
const invoiceListener = new InvoiceCreatedListener();

/**
 * CONTROLADOR NUEVO · FASE 2 (rutas de operación y contingencia).
 * No modifica ningún controlador existente: expone operaciones propias de
 * contingencia y conciliación de pagos con trazabilidad legal independiente.
 */
export class ContingencyAndPaymentsController {
  async handle(action: string, payload: Record<string, any>, actor = "Sistema") {
    switch (action) {
      case "invoice.search":
        return { invoices: await reconciliation.searchInvoices(String(payload.query || "")) };

      case "reconciliation.summary":
        return { summary: await reconciliation.reconciliationSummary(Number(payload.invoiceId)) };

      case "payment.add":
        return {
          payment: await reconciliation.addPayment(
            { invoiceId: Number(payload.invoiceId), paymentMethod: payload.paymentMethod, referenceNumber: payload.referenceNumber, bankName: payload.bankName, amount: Number(payload.amount), paymentDate: payload.paymentDate, notes: payload.notes } as PaymentInput,
            actor
          ),
        };

      case "payment.update":
        return { payment: await reconciliation.updatePayment(Number(payload.id), payload, actor, String(payload.reason || "")) };

      case "payment.delete":
        await reconciliation.deletePayment(Number(payload.id), actor, String(payload.reason || ""));
        return { deleted: true };

      case "audit.list":
        return { logs: await reconciliation.listAuditLogs(Number(payload.invoicePaymentId)) };

      case "contingency.list":
        return { invoices: await db.select().from(ops.contingencyInvoices).orderBy(desc(ops.contingencyInvoices.createdAt)).limit(100) };

      case "contingency.create": {
        const [row] = await db
          .insert(ops.contingencyInvoices)
          .values({
            manualNumber: String(payload.manualNumber || `CONT-${Date.now()}`),
            issueDate: String(payload.issueDate || new Date().toISOString().slice(0, 10)),
            customerName: String(payload.customerName || "Cliente general"),
            customerRif: String(payload.customerRif || "V-00000000-0"),
            customerEmail: String(payload.customerEmail || ""),
            amount: Number(payload.amount) || 0,
            taxBase: Number(payload.taxBase) || Number(payload.amount || 0) / 1.16,
            taxAmount: Number(payload.taxAmount) || (Number(payload.amount || 0) - Number(payload.amount || 0) / 1.16),
            notes: String(payload.notes || "Emitida por contingencia conforme a la Providencia SNAT/2026/00093 Art. 15"),
            syncedStatus: "pendiente",
          })
          .returning();
        await invoiceListener.handle({ invoiceNumber: row.manualNumber, amount: row.amount, actor, contingency: true });
        return { invoice: row };
      }

      case "contingency.sync": {
        const id = Number(payload.id);
        const [row] = await db.select().from(ops.contingencyInvoices).where(eq(ops.contingencyInvoices.id, id));
        if (!row) throw new Error("Factura de contingencia no encontrada.");
        const authorizationCode = `CONT-SENIAT-${Date.now().toString(36).toUpperCase()}`;
        const [updated] = await db
          .update(ops.contingencyInvoices)
          .set({ syncedStatus: "sincronizado", syncedAt: new Date(), authorizationCode })
          .where(eq(ops.contingencyInvoices.id, id))
          .returning();
        await invoiceListener.handle({ invoiceNumber: row.manualNumber, amount: row.amount, actor, contingency: true });
        return { invoice: updated, authorizationCode, message: "Factura de contingencia sincronizada con la imprenta digital homologada (Providencia SNAT/2026/00093 Art. 15)." };
      }

      case "legal.references":
        return { references: await legal.listReferences() };

      case "compliance.logs":
        return { logs: await legal.listLogs(Number(payload.limit) || 60) };

      default:
        throw new Error("Operación no reconocida.");
    }
  }
}
