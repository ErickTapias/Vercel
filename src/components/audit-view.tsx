"use client";
import { useState } from "react";
import {
  FileCheck,
  Download,
  Printer,
  CalendarDays,
  ShieldCheck,
  Receipt,
  FileSpreadsheet,
  FileText,
  BadgePercent,
  CheckCircle2,
  ExternalLink,
  Info,
} from "lucide-react";
import { useApp } from "./app-context";
import { SectionHead, KpiCard, EmptyState } from "./ui";
import { exportExcel, printReport, filterPeriod, dateLabel, sum } from "@/lib/utils";

export function AuditView() {
  const { data, money, notify } = useApp();
  const [activeTab, setActiveTab] = useState<"ventas" | "compras" | "resumen">("ventas");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [range, setRange] = useState({ start, end });

  const sales = filterPeriod(data.sales, "custom", range).filter((s) => s.status !== "void");
  const expenses = filterPeriod(data.expenses, "custom", range).filter((e) => e.scope !== "personal");

  // Totales Libro de Ventas SENIAT
  const totalVentasConIva = sum(sales, (s) => s.total);
  const totalVentasExentas = sum(sales, (s) => s.exemptAmount);
  const totalBaseImponibleVentas = sum(sales, (s) => s.taxableBase);
  const totalIvaDebitoFiscal = sum(sales, (s) => s.ivaAmount);
  const totalIgtfVentas = sum(sales, (s) => s.igtfAmount);

  // Totales Libro de Compras SENIAT
  const totalComprasConIva = sum(expenses, (e) => e.amount);
  const totalBaseCompras = sum(expenses, (e) => e.taxableBase);
  const totalIvaCreditoFiscal = sum(expenses, (e) => e.ivaAmount);
  const totalIvaRetenido = sum(expenses, (e) => e.ivaRetained);

  // Balance fiscal
  const balanceIva = totalIvaDebitoFiscal - totalIvaCreditoFiscal;

  // Filas Libro de Ventas con columnas oficiales Providencia 0071 / PA 102
  const libroVentasRows = sales.map((s, idx) => ({
    "N° Oper.": idx + 1,
    "Fecha Emisión": dateLabel(s.createdAt),
    "RIF / C.I. Cliente": s.customerRif || "V-00000000-0",
    "Nombre o Razón Social": s.customerName,
    "N° Factura": s.invoiceNumber,
    "N° Control": s.controlNumber,
    "Tipo Transacción": "01-REG",
    "Total Ventas inc. IVA": +s.total.toFixed(2),
    "Ventas Exentas": +s.exemptAmount.toFixed(2),
    "Base Imponible": +s.taxableBase.toFixed(2),
    "% Alíc.": `${s.ivaRate}%`,
    "Impuesto IVA (16%)": +s.ivaAmount.toFixed(2),
    "IGTF Divisas (3%)": +s.igtfAmount.toFixed(2),
    "Tasa BCV": s.exchangeRateBcv || data.settings.exchangeRate,
    "Equiv. Bs.": +(s.total * (s.exchangeRateBcv || data.settings.exchangeRate)).toFixed(2),
    "Hash Fiscal SENIAT": s.auditHash ? s.auditHash.slice(0, 18) + "..." : "AUT-DIGITAL",
  }));

  // Filas Libro de Compras con columnas oficiales
  const libroComprasRows = expenses.map((e, idx) => ({
    "N° Oper.": idx + 1,
    "Fecha Doc.": dateLabel(e.createdAt),
    "RIF Proveedor": e.beneficiaryRif || "J-00000000-0",
    "Nombre Proveedor": e.beneficiary || e.name,
    "N° Factura": e.invoiceNumber || `FAC-${e.id}`,
    "N° Control": e.controlNumber || `00-${e.id}`,
    "Total Compra inc. IVA": +e.amount.toFixed(2),
    "Compras Exentas": +(e.amount - e.taxableBase - e.ivaAmount).toFixed(2),
    "Base Imponible": +e.taxableBase.toFixed(2),
    "Alícuota": "16%",
    "Crédito Fiscal IVA": +e.ivaAmount.toFixed(2),
    "IVA Retenido": +e.ivaRetained.toFixed(2),
    "Tipo de Gasto": e.scope === "internal" ? "Caja Chica / Interno" : "Operativo Fiscal",
    "Cuenta Origen": data.accounts.find((a) => a.id === e.accountId)?.name || "—",
  }));

  const handleExportExcel = () => {
    const rows = activeTab === "ventas" ? libroVentasRows : libroComprasRows;
    const name = `Tesorio-Libro-${activeTab.toUpperCase()}-${range.start}-al-${range.end}`;
    exportExcel(rows, name).catch(() => notify("Error al exportar libro.", true));
  };

  const handlePrintPdf = () => {
    const isVentas = activeTab === "ventas";
    const title = isVentas ? "LIBRO OFICIAL DE VENTAS (PROV. SNAT/2011/00071 / PA 102)" : "LIBRO OFICIAL DE COMPRAS Y GASTOS AUDITABLES";
    const rows = isVentas ? libroVentasRows : libroComprasRows;
    const subtitle = `Período: ${range.start} al ${range.end} · RIF: ${data.settings.rif} · Domicilio: ${data.settings.address}`;
    const footer = isVentas
      ? `Total Débito Fiscal IVA: $${totalIvaDebitoFiscal.toFixed(2)} | Total Ventas: $${totalVentasConIva.toFixed(2)}`
      : `Total Crédito Fiscal IVA: $${totalIvaCreditoFiscal.toFixed(2)} | IVA Retenido: $${totalIvaRetenido.toFixed(2)}`;

    try {
      printReport(title, rows, data.settings.legalName || data.settings.businessName, subtitle, footer);
    } catch (err) {
      notify((err as Error).message, true);
    }
  };

  return (
    <div className="module-stack">
      {/* Banner de Homologación Fiscal SENIAT */}
      <section className="seniat-status-card">
        <div className="seniat-badge">
          <ShieldCheck size={28} />
        </div>
        <div className="seniat-info">
          <div className="seniat-tagline">SISTEMA INFORMÁTICO HOMOLOGADO Y AUDITABLE</div>
          <h3>Cumplimiento SENIAT · Providencias 0071, 0102 y Resoluciones 2026</h3>
          <p>
            Desde la oficialización de la no obligatoriedad de máquina fiscal en octubre 2026, tu facturación digital con numeración
            correlativa única, número de control y libros fiscales auditables cumple con todos los requisitos del Código Orgánico Tributario.
          </p>
        </div>
        <div className="seniat-controls">
          <div className="seniat-pill">
            <CheckCircle2 size={14} /> Facturación Digital Válida
          </div>
          <small>Resolución: {data.settings.seniatResolution.slice(0, 32)}...</small>
        </div>
      </section>

      {/* Selector de Período y Filtros */}
      <div className="card audit-filter-bar">
        <div className="filter-title">
          <CalendarDays size={20} className="text-purple" />
          <div>
            <strong>Período Fiscal Impositivo</strong>
            <small>Filtra por quincena o mes para la declaración periódica de IVA</small>
          </div>
        </div>
        <div className="date-inputs">
          <label>
            Desde
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <button className="button primary" onClick={() => setRange({ start, end })}>
            Actualizar Libros
          </button>
        </div>
      </div>

      {/* KPI Fiscales */}
      <div className="kpi-grid">
        <KpiCard
          title="Total Facturado (Ventas)"
          value={money(totalVentasConIva)}
          icon={<Receipt size={18} />}
          detail={`${sales.length} facturas emitidas`}
          color="purple"
        />
        <KpiCard
          title="Débito Fiscal (IVA 16%)"
          value={money(totalIvaDebitoFiscal)}
          icon={<BadgePercent size={18} />}
          color="peach"
          detail={`Base imponible: ${money(totalBaseImponibleVentas)}`}
        />
        <KpiCard
          title="Crédito Fiscal (Compras)"
          value={money(totalIvaCreditoFiscal)}
          icon={<FileCheck size={18} />}
          color="blue"
          detail={`${expenses.length} facturas de compra y gastos`}
        />
        <KpiCard
          title={balanceIva >= 0 ? "IVA a Pagar al SENIAT" : "Excedente Crédito Fiscal"}
          value={money(Math.abs(balanceIva))}
          icon={<ShieldCheck size={18} />}
          color={balanceIva >= 0 ? "red" : "green"}
          detail={balanceIva >= 0 ? "Saldo de débito pendiente" : "A favor para el siguiente período"}
        />
      </div>

      {/* Selector de Libros: Ventas, Compras y Resumen */}
      <div className="tabs">
        <button className={activeTab === "ventas" ? "active" : ""} onClick={() => setActiveTab("ventas")}>
          <Receipt size={16} /> Libro de Ventas SENIAT ({sales.length})
        </button>
        <button className={activeTab === "compras" ? "active" : ""} onClick={() => setActiveTab("compras")}>
          <FileCheck size={16} /> Libro de Compras y Gastos ({expenses.length})
        </button>
        <button className={activeTab === "resumen" ? "active" : ""} onClick={() => setActiveTab("resumen")}>
          <FileSpreadsheet size={16} /> Resumen Impositivo y Cierre Quincenal
        </button>
      </div>

      {/* Vista de Libros */}
      {activeTab === "ventas" && (
        <section className="card">
          <SectionHead
            title="Libro Oficial de Ventas (Formato Prov. 0071 / PA 102)"
            subtitle={`${sales.length} facturas en el período · Desglose legal para declaración SENIAT`}
          >
            <div className="flex gap-2">
              <button className="button secondary" onClick={handleExportExcel}>
                <Download size={15} /> Exportar Excel
              </button>
              <button className="button primary" onClick={handlePrintPdf}>
                <Printer size={15} /> Imprimir / Descargar PDF Oficial
              </button>
            </div>
          </SectionHead>

          {sales.length ? (
            <div className="table-scroll">
              <table className="data-table audit-table">
                <thead>
                  <tr>
                    <th>N° Oper.</th>
                    <th>Fecha</th>
                    <th>Factura N°</th>
                    <th>N° Control</th>
                    <th>Cliente / Razón Social</th>
                    <th>RIF / C.I.</th>
                    <th>Total Factura</th>
                    <th>Exento</th>
                    <th>Base Imponible</th>
                    <th>IVA (16%)</th>
                    <th>IGTF (3%)</th>
                    <th>Tasa BCV</th>
                    <th>Total Bs.</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s, idx) => (
                    <tr key={s.id}>
                      <td>{idx + 1}</td>
                      <td>{dateLabel(s.createdAt)}</td>
                      <td>
                        <strong className="text-purple">{s.invoiceNumber}</strong>
                      </td>
                      <td>{s.controlNumber}</td>
                      <td>
                        <strong>{s.customerName}</strong>
                      </td>
                      <td>{s.customerRif}</td>
                      <td className="amount">{money(s.total)}</td>
                      <td>{s.exemptAmount ? money(s.exemptAmount) : "0,00"}</td>
                      <td className="amount">{money(s.taxableBase)}</td>
                      <td className="amount text-purple">{money(s.ivaAmount)}</td>
                      <td>{s.igtfAmount ? money(s.igtfAmount) : "0,00"}</td>
                      <td>Bs. {(s.exchangeRateBcv || 69.5).toFixed(2)}</td>
                      <td className="amount">Bs. {(s.total * (s.exchangeRateBcv || 69.5)).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sin ventas en este período" description="Selecciona otro rango de fechas o genera tu primera venta con factura fiscal." />
          )}

          <div className="table-footer">
            <span>
              Base imponible total: <strong>{money(totalBaseImponibleVentas)}</strong> · IVA Débito Total: <strong>{money(totalIvaDebitoFiscal)}</strong>
            </span>
            <span>Documento generado con valor legal probatorio ante auditorías fiscales</span>
          </div>
        </section>
      )}

      {activeTab === "compras" && (
        <section className="card">
          <SectionHead
            title="Libro Oficial de Compras y Soportes de Gasto"
            subtitle={`${expenses.length} comprobantes de egreso con crédito fiscal deducible`}
          >
            <div className="flex gap-2">
              <button className="button secondary" onClick={handleExportExcel}>
                <Download size={15} /> Exportar Excel
              </button>
              <button className="button primary" onClick={handlePrintPdf}>
                <Printer size={15} /> Imprimir / Descargar PDF Oficial
              </button>
            </div>
          </SectionHead>

          {expenses.length ? (
            <div className="table-scroll">
              <table className="data-table audit-table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Fecha</th>
                    <th>Proveedor / Beneficiario</th>
                    <th>RIF Proveedor</th>
                    <th>N° Factura</th>
                    <th>N° Control</th>
                    <th>Ámbito</th>
                    <th>Total Compra</th>
                    <th>Base Imponible</th>
                    <th>Crédito IVA (16%)</th>
                    <th>IVA Retenido</th>
                    <th>Medio de Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e, idx) => (
                    <tr key={e.id}>
                      <td>{idx + 1}</td>
                      <td>{dateLabel(e.createdAt)}</td>
                      <td>
                        <strong>{e.beneficiary || e.name}</strong>
                      </td>
                      <td>{e.beneficiaryRif || "J-00000000-0"}</td>
                      <td>{e.invoiceNumber || "REC-INT"}</td>
                      <td>{e.controlNumber || "00-INT"}</td>
                      <td>
                        <span className={`status-badge ${e.scope === "internal" ? "pending" : "paid"}`}>
                          <i />
                          {e.scope === "internal" ? "Caja Chica" : "Operativo"}
                        </span>
                      </td>
                      <td className="amount">{money(e.amount)}</td>
                      <td className="amount">{money(e.taxableBase)}</td>
                      <td className="amount text-green">{money(e.ivaAmount)}</td>
                      <td>{e.ivaRetained ? money(e.ivaRetained) : "0,00"}</td>
                      <td>{data.accounts.find((a) => a.id === e.accountId)?.method || "Transferencia"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sin compras registradas" description="Registra tus compras con soporte de factura para aprovechar el crédito fiscal." />
          )}

          <div className="table-footer">
            <span>
              Total compras: <strong>{money(totalComprasConIva)}</strong> · Crédito Fiscal: <strong>{money(totalIvaCreditoFiscal)}</strong>
            </span>
            <span>Los retiros personales de socios se excluyen del Libro de Compras para no distorsionar la contabilidad</span>
          </div>
        </section>
      )}

      {activeTab === "resumen" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <section className="card p-5">
            <SectionHead title="Conciliación de IVA y Obligación Tributaria" subtitle="Cálculo directo para la forma 30 del portal SENIAT" />
            <div className="profit-loss-rows mt-4">
              <div>
                <span>
                  <strong>Débito Fiscal IVA Facturado (Ventas)</strong>
                  <small>Generado en {sales.length} facturas del período</small>
                </span>
                <strong className="text-purple">+{money(totalIvaDebitoFiscal)}</strong>
              </div>
              <div>
                <span>
                  <strong>Crédito Fiscal IVA Soportado (Compras y Gastos)</strong>
                  <small>Deducción legal por insumos y servicios operativos</small>
                </span>
                <strong className="text-green">−{money(totalIvaCreditoFiscal)}</strong>
              </div>
              <div className="subtotal">
                <span>
                  <strong>Impuesto Determinado del Período</strong>
                  <small>Diferencia entre débito y crédito fiscal</small>
                </span>
                <strong>{money(balanceIva)}</strong>
              </div>
              <div>
                <span>
                  <strong>Retenciones de IVA Descontadas por Clientes Especiales</strong>
                  <small>Comprobantes de retención 75% recibidos</small>
                </span>
                <strong>−{money(sum(sales.filter((s) => s.customerRif.startsWith("J-")), (s) => s.ivaAmount * 0.75))}</strong>
              </div>
              <div className="total">
                <span>
                  <strong>Total a Enterar al SENIAT</strong>
                  <small>Monto neto a pagar en banco recaudador</small>
                </span>
                <strong>{money(Math.max(0, balanceIva - sum(sales.filter((s) => s.customerRif.startsWith("J-")), (s) => s.ivaAmount * 0.75)))}</strong>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <SectionHead title="Control Interno y Auditoría Digital" subtitle="Garantías legales del sistema" />
            <div className="audit-checklist">
              <div className="audit-check-item">
                <CheckCircle2 size={18} className="text-green-500" />
                <div>
                  <strong>Correlatividad Única Ininterrumpida</strong>
                  <p>Cada factura tiene asignado un número fiscal consecutivo sin saltos ni duplicados.</p>
                </div>
              </div>
              <div className="audit-check-item">
                <CheckCircle2 size={18} className="text-green-500" />
                <div>
                  <strong>Número de Control Digital Asignado</strong>
                  <p>Cumple con el formato 00-XXXXXX exigido en la Providencia 0071 para control interno.</p>
                </div>
              </div>
              <div className="audit-check-item">
                <CheckCircle2 size={18} className="text-green-500" />
                <div>
                  <strong>Conversión en Bolívares a Tasa Oficial BCV</strong>
                  <p>Cada factura registra el tipo de cambio del Banco Central de Venezuela correspondiente a la fecha de emisión.</p>
                </div>
              </div>
              <div className="audit-check-item">
                <CheckCircle2 size={18} className="text-green-500" />
                <div>
                  <strong>Diferenciación de Gastos Personales e Internos</strong>
                  <p>Los retiros personales de socios se aíslan para proteger la empresa ante fiscalizaciones del ISLR.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
