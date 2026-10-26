import Link from "next/link";

/**
 * RUTA NUEVA · /operations (hub de módulos independientes).
 * Agregada sin modificar rutas existentes.
 */
export default function OperationsHome() {
  return (
    <div className="operations-panel__container">
      <header className="operations-panel__hero">
        <div>
          <span className="operations-panel__eyebrow">MÓDULOS INDEPENDIENTES · OPERACIONES Y COMPLIANCE</span>
          <h2>Contingencia, pagos y trazabilidad legal</h2>
          <p>
            Dos módulos nuevos conectados a tu sistema sin alterar facturación, nómina ni base de datos existente.
            Los datos fiscales son inmutables; los datos operativos y de pago son flexibles y quedan auditados.
          </p>
        </div>
        <span className="operations-panel__legal-chip">Providencia SNAT/2026/00093 · Art. 7 y 15</span>
      </header>

      <div className="operations-panel__grid">
        <section className="operations-panel__card">
          <h3 style={{ fontSize: 15, color: "#0e627e", margin: "0 0 8px" }}>Conciliación y pagos</h3>
          <p style={{ fontSize: 11, color: "#4c7082", lineHeight: 1.8 }}>
            Busca una factura en modo solo lectura y gestiona Pago Móvil, transferencias, fechas de cobro y conciliación.
            Cada modificación queda registrada en la bitácora <strong>payment_audit_logs</strong>.
          </p>
          <Link href="/operations/conciliation" className="operations-panel__btn">Ir a conciliación</Link>
        </section>

        <section className="operations-panel__card">
          <h3 style={{ fontSize: 15, color: "#0e627e", margin: "0 0 8px" }}>Contingencia fiscal</h3>
          <p style={{ fontSize: 11, color: "#4c7082", lineHeight: 1.8 }}>
            Emite facturas manuales por contingencia y sincronízalas con la imprenta digital homologada.
            La trazabilidad legal se registra en <strong>compliance_logs</strong> con hash de integridad.
          </p>
          <Link href="/operations/contingency" className="operations-panel__btn">Ir a contingencia</Link>
        </section>
      </div>
    </div>
  );
}
