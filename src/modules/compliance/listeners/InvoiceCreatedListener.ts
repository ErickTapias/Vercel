import { LegalReferenceService } from "../LegalReferenceService";

const compliance = new LegalReferenceService();

/**
 * LISTENER NUEVO · FASE 4.
 * Se dispara cuando se emite una factura (digital o de contingencia) y registra la
 * trazabilidad legal exigida por la Providencia SNAT/2026/00093 Art. 7 (documento fiscal
 * e integridad de su numeración) y Art. 15 cuando opera en modo contingencia.
 * Este listener SOLO agrega trazabilidad: jamás modifica el documento fiscal emitido.
 */
export class InvoiceCreatedListener {
  async handle(payload: { invoiceNumber: string; controlNumber?: string; amount: number; actor?: string; contingency?: boolean }) {
    const action = payload.contingency ? "factura_contingencia_creada" : "factura_creada";
    return compliance.logFiscalCompliance(action, {
      referenceId: `${payload.invoiceNumber}${payload.controlNumber ? `/${payload.controlNumber}` : ""}`,
      actor: payload.actor || "Sistema",
      module: "fiscal",
      details: payload.contingency
        ? "Factura de contingencia emitida manualmente conforme a la Providencia SNAT/2026/00093 Art. 15, pendiente de sincronización con el sistema homologado."
        : "Documento fiscal digital emitido conforme a la Providencia SNAT/2026/00093 Art. 7. Datos fiscales inmutables.",
    });
  }
}
