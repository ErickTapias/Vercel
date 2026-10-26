import { pgTable, serial, text, integer, doublePrecision, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

/**
 * ESQUEMA AISLADO DE OPERACIONES Y COMPLIANCE (FASE 1).
 * PRINCIPIO DE SEPARACIÓN DE DATOS:
 * - Datos FISCALES (montos, IVA, RIF, control, fechas de emisión) permanecen en las tablas existentes y son INMUTABLES.
 * - Datos OPERATIVOS (referencias de pago, conciliación, contingencias) viven exclusivamente en estas tablas nuevas.
 * Norma: Providencia SNAT/2026/00093 Art. 7 (integridad del documento fiscal) y Art. 15 (contingencia).
 */

// Catálogo de referencias legales citadas en cada operación (trazabilidad legal)
export const legalReferences = pgTable("tesorio_legal_references", {
  id: serial("id").primaryKey(),
  module: text("module").notNull().default("fiscal"), // 'fiscal' | 'operativo'
  lawName: text("law_name").notNull(),
  article: text("article").notNull(),
  description: text("description").notNull().default(""),
  effectiveDate: text("effective_date").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Facturas de contingencia (facturación manual en caso de caída del sistema homologado)
export const contingencyInvoices = pgTable("tesorio_contingency_invoices", {
  id: serial("id").primaryKey(),
  manualNumber: text("manual_number").notNull(),
  issueDate: text("issue_date").notNull(),
  customerName: text("customer_name").notNull(),
  customerRif: text("customer_rif").notNull().default("V-00000000-0"),
  customerEmail: text("customer_email").notNull().default(""),
  amount: doublePrecision("amount").notNull().default(0),
  taxBase: doublePrecision("tax_base").notNull().default(0),
  taxAmount: doublePrecision("tax_amount").notNull().default(0),
  notes: text("notes").notNull().default(""),
  syncedStatus: text("synced_status").notNull().default("pendiente"), // 'pendiente' | 'sincronizado'
  syncedAt: timestamp("synced_at"),
  authorizationCode: text("authorization_code").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Bitácora de compliance fiscal (solo acciones inmutables citan ley)
export const complianceLogs = pgTable("tesorio_compliance_logs", {
  id: serial("id").primaryKey(),
  actionType: text("action_type").notNull(),
  referenceId: text("reference_id").notNull().default(""),
  legalReferenceId: integer("legal_reference_id"),
  actor: text("actor").notNull().default("Sistema"),
  details: text("details").notNull().default(""),
  hash: text("hash").notNull().default(""),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Registros de pago operativos y flexibles (conciliación) — NUNCA modifica la factura fiscal
export const invoicePayments = pgTable("tesorio_invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(), // referencia lógica a la factura fiscal (lectura inmutable)
  paymentMethod: text("payment_method").notNull().default("Pago móvil"),
  referenceNumber: text("reference_number").notNull().default(""),
  bankName: text("bank_name").notNull().default(""),
  amount: doublePrecision("amount").notNull().default(0),
  paymentDate: text("payment_date").notNull(),
  status: text("status").notNull().default("pendiente"), // 'pendiente' | 'conciliado' | 'anulado'
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Auditoría de cambios en referencias operativas (principio de integridad de la trazabilidad)
export const paymentAuditLogs = pgTable("tesorio_payment_audit_logs", {
  id: serial("id").primaryKey(),
  invoicePaymentId: integer("invoice_payment_id").notNull(),
  field: text("field").notNull().default(""),
  oldValue: text("old_value").notNull().default(""),
  newValue: text("new_value").notNull().default(""),
  changedBy: text("changed_by").notNull().default("Sistema"),
  reason: text("reason").notNull().default(""),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
});

export type LegalReferenceRow = typeof legalReferences.$inferSelect;
export type ContingencyInvoiceRow = typeof contingencyInvoices.$inferSelect;
export type InvoicePaymentRow = typeof invoicePayments.$inferSelect;
export type PaymentAuditLogRow = typeof paymentAuditLogs.$inferSelect;
export type ComplianceLogRow = typeof complianceLogs.$inferSelect;
