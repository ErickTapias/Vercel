import type { ReactNode } from "react";
import Link from "next/link";
import "./operations-panel.css";

/**
 * LAYOUT NUEVO · FASE 5 (ruta independiente /operations).
 * No modifica ninguna ruta ni layout existente; agrega únicamente un encabezado propio
 * de navegación hacia los dos módulos independientes de operaciones.
 */
export default function OperationsLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f9fb", padding: "22px 18px 32px" }}>
      <nav style={{ maxWidth: 1180, margin: "0 auto 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Link href="/" className="operations-panel__btn operations-panel__btn--ghost">← Volver al sistema</Link>
        <Link href="/operations" className="operations-panel__btn operations-panel__btn--ghost">Operaciones</Link>
        <Link href="/operations/conciliation" className="operations-panel__btn">Conciliación de pagos</Link>
        <Link href="/operations/contingency" className="operations-panel__btn">Contingencia fiscal</Link>
        <span style={{ fontSize: 10, color: "#4f7488", marginLeft: "auto" }}>
          Módulos independientes · datos fiscales inmutables · pagos operativos flexibles
        </span>
      </nav>
      <main style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</main>
    </div>
  );
}
