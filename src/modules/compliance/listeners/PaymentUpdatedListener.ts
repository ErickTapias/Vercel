import { db } from "@/db";
import * as ops from "@/db/schema-operations";

/**
 * LISTENER NUEVO · FASE 4 (auditoría operativa).
 * Se dispara cuando se crea o edita una referencia de pago (Pago Móvil, transferencia,
 * referencia bancaria, fecha de cobro). Principio aplicado: INTEGRIDAD DE LA TRAZABILIDAD
 * OPERATIVA — todo cambio deja rastro con valor anterior y posterior, sin alterar la
 * factura fiscal ni sus datos inmutables (montos, IVA, RIF, número de control, fecha).
 */
export class PaymentUpdatedListener {
  async handle(payload: {
    invoicePaymentId: number;
    field?: string;
    oldValue?: string;
    newValue?: string;
    changedBy?: string;
    reason?: string;
  }) {
    const [row] = await db
      .insert(ops.paymentAuditLogs)
      .values({
        invoicePaymentId: payload.invoicePaymentId,
        field: payload.field || "registro",
        oldValue: payload.oldValue || "",
        newValue: payload.newValue || "",
        changedBy: payload.changedBy || "Sistema",
        reason: payload.reason || "Actualización de datos operativos de pago (conciliación bancaria)",
      })
      .returning();
    return row;
  }
}
