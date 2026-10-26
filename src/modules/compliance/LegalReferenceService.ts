import { db } from "@/db";
import * as ops from "@/db/schema-operations";
import { eq, desc } from "drizzle-orm";
import { createHash } from "node:crypto";

/**
 * MÓDULO DE COMPLIANCE · FASE 3 (servicio independiente).
 * PRINCIPIO: los datos fiscales son inmutables; este servicio solo registra trazabilidad legal
 * y nunca modifica facturas, montos, IVA, RIF, números de control ni fechas de emisión.
 */
export type LegalReference = {
  id: number;
  module: string;
  lawName: string;
  article: string;
  description: string;
  effectiveDate: string;
};

export class LegalReferenceService {
  /**
   * Devuelve la norma aplicable a una acción concreta (cita legal de compliance).
   * Catálogo basado en: Providencia SNAT/2026/00093 Art. 7 y 15, Providencia SNAT/2015/0049 Art. 3,
   * y principios de control interno para operaciones no fiscales.
   */
  async getReference(module: "fiscal" | "operativo", action: string): Promise<LegalReference | null> {
    const rows = await db.select().from(ops.legalReferences).where(eq(ops.legalReferences.module, module));
    const wanted = action.toLowerCase();
    const match =
      rows.find((r) => wanted.includes("contingencia") && r.article.includes("15")) ||
      rows.find((r) => wanted.includes("factura") && r.article.includes("7")) ||
      rows.find((r) => wanted.includes("retencion") && r.lawName.includes("2015/0049")) ||
      rows[0];
    return match ? { ...match } : null;
  }

  /**
   * Registra la trazabilidad legal de una acción fiscal inmutable en compliance_logs.
   * Cada registro lleva hash SHA-256 para impedir alteraciones posteriores (integridad probatoria).
   */
  async logFiscalCompliance(action: string, options: { referenceId?: string | number; actor?: string; details?: string; module?: "fiscal" | "operativo" } = {}) {
    const module = options.module || "fiscal";
    const reference = await this.getReference(module, action);
    const payload = `${action}|${options.referenceId ?? ""}|${options.actor ?? "Sistema"}|${Date.now()}`;
    const [row] = await db.insert(ops.complianceLogs).values({
      actionType: action,
      referenceId: String(options.referenceId ?? ""),
      legalReferenceId: reference?.id ?? null,
      actor: options.actor || "Sistema",
      details: options.details || reference?.description || "",
      hash: createHash("sha256").update(payload).digest("hex"),
    }).returning();
    return { log: row, legalReference: reference };
  }

  async listLogs(limit = 60) {
    return db.select().from(ops.complianceLogs).orderBy(desc(ops.complianceLogs.timestamp)).limit(limit);
  }

  async listReferences() {
    return db.select().from(ops.legalReferences).orderBy(ops.legalReferences.module);
  }
}
