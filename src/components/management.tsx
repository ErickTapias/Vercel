"use client";
import { useState, type FormEvent } from "react";
import {
  TrendingUp,
  ShoppingBag,
  Receipt,
  Wallet,
  ArrowUpRight,
  ArrowRight,
  Download,
  FileText,
  CalendarDays,
  Users,
  Megaphone,
  Plus,
  Pencil,
  ShieldCheck,
  CircleHelp,
  Check,
  Store,
  Globe,
  Save,
  Package,
  Clock3,
  Sparkles,
  Image as ImageIcon,
  Building2,
  FileSpreadsheet,
  Printer,
  Database,
} from "lucide-react";
import { useApp } from "./app-context";
import { KpiCard, SectionHead, SearchField, Avatar, EmptyState, ProductImage } from "./ui";
import { financials, sum, filterPeriod, dateLabel, topProducts, exportExcel, printReport } from "@/lib/utils";
import { RevenueChart } from "./dashboard";
import { ModernFinanceCharts, ModernSalesAnalyticsCharts } from "./modern-charts";
import { OperatorPerformanceDashboard } from "./operator-performance-dashboard";
import { BackupManagerCard } from "./backup-manager-card";
import type { Customer } from "@/lib/types";

export function FinanceView() {
  const { data, money, period, customDates, navigate, notify } = useApp();
  const sales = filterPeriod(data.sales, period, customDates),
    expenses = filterPeriod(data.expenses, period, customDates),
    f = financials(sales, expenses);

  const inventory = sum(data.products.filter((p) => p.kind === "product"), (p) => p.cost * p.stock);
  const available = sum(data.accounts, (a) => a.balance / (a.currency === "VES" ? data.settings.exchangeRate : 1));
  const receivable = sum(data.pending.filter((p) => p.type === "receivable" && p.status === "pending"), (p) => p.amount);
  const payable = sum(data.pending.filter((p) => p.type === "payable" && p.status === "pending"), (p) => p.amount);

  const rows = [
    { label: "Ventas Netas Facturadas", amount: f.revenue, note: `${sales.length} facturas emitidas`, type: "revenue" },
    { label: "Costo de Ventas y Producción (Telas / Insumos)", amount: -f.costs, note: "Costo directo de uniformes y materiales DTF", type: "" },
    { label: "Utilidad Bruta Operativa", amount: f.gross, note: "Ingresos netos menos costo de fabricación", type: "subtotal" },
    { label: "Gastos Fijos Operativos", amount: -f.fixed, note: "Alquiler galpón Los Ruices, nómina operarios", type: "" },
    { label: "Gastos Variables / Mantenimiento", amount: -f.variable, note: "Insumos, cajas chicas y comisiones", type: "" },
    { label: "Utilidad Neta de Fábrica Cristo Rey", amount: f.net, note: "Ganancia real antes de retiros de socios", type: "total" },
    { label: "Retiros Personales de Socios (No Deducibles)", amount: -f.personalAmount, note: "Fondos retirados para gastos personales", type: "" },
  ];

  return (
    <div className="module-stack">
      <div className="three-stat-grid">
        <KpiCard title="Ingresos Totales" value={money(f.revenue)} icon={<ShoppingBag size={18} />} detail={`${sales.length} facturas emitidas`} onClick={() => navigate("ventas", "historial")} />
        <KpiCard title="Utilidad Bruta" value={money(f.gross)} icon={<TrendingUp size={18} />} color="blue" detail="Margen sobre confección y DTF" />
        <KpiCard title="Utilidad Neta Real" value={money(f.net)} icon={<Wallet size={18} />} color="green" detail={`${f.margin.toFixed(1)}% de rentabilidad`} />
      </div>

      <div className="finance-layout">
        <section className="card profit-loss">
          <SectionHead title="Estado de Resultados Operativo" subtitle="Desglose contable para la gestión interna de Fábrica Cristo Rey.">
            <div className="flex gap-2">
              <button className="button secondary" onClick={() => exportExcel(rows.map((r) => ({ Concepto: r.label, "Monto USD": r.amount })), "Tesorio-Estado-Resultados")} title="Descargar Excel">
                <Download size={15} /> Excel
              </button>
              <button
                className="button secondary"
                title="Imprimir o guardar como PDF"
                onClick={() => {
                  try {
                    printReport(
                      "ESTADO DE RESULTADOS OPERATIVO",
                      rows.map((r) => ({ Concepto: r.label, "Monto USD": money(r.amount), Detalle: r.note })),
                      data.settings.legalName,
                      `Fábrica Cristo Rey C.A. · Margen Neto: ${f.margin.toFixed(1)}%`
                    );
                  } catch (e) {
                    notify((e as Error).message, true);
                  }
                }}
              >
                <Printer size={15} /> Imprimir / PDF
              </button>
            </div>
          </SectionHead>
          <div className="profit-loss-rows">
            {rows.map((r) => (
              <div className={r.type} key={r.label}>
                <span>
                  <strong>{r.label}</strong>
                  <small>{r.note}</small>
                </span>
                <strong>
                  {r.amount < 0 ? "−" : ""}
                  {money(Math.abs(r.amount))}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card margin-card">
          <SectionHead title="Salud Financiera" />
          <div className="margin-ring" style={{ background: `conic-gradient(#7c3aed ${Math.max(0, Math.min(100, f.margin))}%, #f1ebfb 0)` }}>
            <div>
              <strong>
                {f.margin.toFixed(1)}
                <small>%</small>
              </strong>
              <span>Margen Neto</span>
            </div>
          </div>
          <h3>{f.net > 0 ? "Operación rentable y en crecimiento" : "Atención a los costos"}</h3>
          <p>
            Por cada $100 facturados en uniformes y DTF, la empresa genera ${Math.abs(f.margin).toFixed(2)} de utilidad neta para reinversión.
          </p>
          <button className="text-link" onClick={() => navigate("auditoria")}>
            Ver libros fiscales SENIAT <ArrowRight size={14} />
          </button>
        </section>
      </div>

      {/* NUEVO GRÁFICO DINÁMICO FINANCIERO EN TIEMPO REAL */}
      <ModernFinanceCharts
        revenue={f.revenue}
        costs={f.costs}
        expenses={f.expenses}
        net={f.net}
        margin={f.margin}
      />

      <section className="card capital-card">
        <SectionHead title="Patrimonio y Capital de Trabajo" subtitle="Valoración de activos líquidos, inventario de telas y compromisos." />
        <div className="capital-grid">
          {[
            { label: "Dinero en Cuentas y Cajas", amount: available, icon: <Wallet /> },
            { label: "Valor Inventario de Telas y Prendas", amount: inventory, icon: <Package /> },
            { label: "Cuentas por Cobrar (Clientes)", amount: receivable, icon: <ArrowUpRight /> },
            { label: "Cuentas por Pagar (Proveedores)", amount: -payable, icon: <Clock3 /> },
          ].map((c) => (
            <div key={c.label}>
              {c.icon}
              <span>{c.label}</span>
              <strong>{money(c.amount)}</strong>
            </div>
          ))}
        </div>
        <div className="capital-total">
          <span>Capital Neto Estimado:</span>
          <strong>{money(available + inventory + receivable - payable)}</strong>
        </div>
      </section>
    </div>
  );
}

export function ReportsView() {
  const { data, money, notify } = useApp();
  const [start, setStart] = useState(new Date().toISOString().slice(0, 8) + "01");
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [range, setRange] = useState({ start, end });
  const [report, setReport] = useState("sales");

  const sales = filterPeriod(data.sales, "custom", range);
  const expenses = filterPeriod(data.expenses, "custom", range);
  const f = financials(sales, expenses);

  const rows: Record<string, unknown>[] =
    report === "sales"
      ? sales.map((s) => ({
          Factura: s.invoiceNumber,
          Control: s.controlNumber,
          Fecha: dateLabel(s.createdAt, true),
          Cliente: s.customerName,
          RIF: s.customerRif,
          Canal: s.channel,
          "Base USD": s.taxableBase,
          "IVA USD": s.ivaAmount,
          "Total USD": s.total,
          "Total Bs.": +(s.total * (s.exchangeRateBcv || 69.5)).toFixed(2),
          Estado: s.status,
        }))
      : report === "accounts"
      ? [
          ...sales.flatMap((s) =>
            s.payments.map((p) => ({
              Fecha: dateLabel(s.createdAt, true),
              Concepto: `Cobro Factura ${s.invoiceNumber}`,
              Cuenta: data.accounts.find((a) => a.id === p.accountId)?.name || "",
              "Monto USD": p.amount,
            }))
          ),
          ...expenses.map((e) => ({
            Fecha: dateLabel(e.createdAt, true),
            Concepto: e.name,
            Cuenta: data.accounts.find((a) => a.id === e.accountId)?.name || "",
            "Monto USD": -e.amount,
          })),
        ]
      : data.products
          .filter((p) => p.kind === "product")
          .map((p) => ({
            SKU: p.sku,
            Producto: p.name,
            Categoría: p.category,
            "Stock Actual": p.stock,
            "Unidades Vendidas": sum(sales.flatMap((s) => s.items).filter((i) => i.productId === p.id), (i) => i.quantity),
            "Costo Unitario USD": p.cost,
            "Valor en Telas/Prendas USD": +(p.cost * p.stock).toFixed(2),
          }));

  const title = report === "sales" ? "Reporte Administrativo de Ventas" : report === "accounts" ? "Reporte de Cuentas Bancarias" : "Reporte de Inventario de Fábrica";

  const generate = (e: FormEvent) => {
    e.preventDefault();
    if (start > end) return notify("La fecha inicial debe ser anterior a la final.", true);
    setRange({ start, end });
    notify("Reporte administrativo generado con éxito.");
  };

  const print = () => {
    try {
      printReport(title, rows, data.settings.businessName, `${range.start} al ${range.end}`);
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  return (
    <div className="module-stack">
      <form className="card report-filters" onSubmit={generate}>
        <div className="report-filter-title">
          <span className="summary-icon purple">
            <CalendarDays size={21} />
          </span>
          <div>
            <h3>Filtro por Fechas de Movimiento</h3>
            <p>Genera informes administrativos consolidados para control interno.</p>
          </div>
        </div>
        <label>
          Fecha inicial
          <input type="date" value={start} required onChange={(e) => setStart(e.target.value)} />
        </label>
        <label>
          Fecha final
          <input type="date" value={end} required onChange={(e) => setEnd(e.target.value)} />
        </label>
        <button className="button primary" type="submit">
          Generar reporte <ArrowRight size={15} />
        </button>
      </form>

      <div className="three-stat-grid">
        <KpiCard title="Facturado en el Período" value={money(f.revenue)} icon={<ShoppingBag size={18} />} detail={`${sales.length} facturas emitidas`} />
        <KpiCard title="Egresos Totales" value={money(f.expenses)} icon={<Receipt size={18} />} color="peach" detail={`${expenses.length} comprobantes`} />
        <KpiCard title="Utilidad Neta" value={money(f.net)} icon={<TrendingUp size={18} />} color="green" detail="Rendimiento del período" />
      </div>

      {/* GRÁFICO DINÁMICO EN REPORTES */}
      <ModernFinanceCharts
        revenue={f.revenue}
        costs={f.costs}
        expenses={f.expenses}
        net={f.net}
        margin={f.margin}
      />

      <section className="card">
        <div className="table-toolbar">
          <div className="segmented-control">
            {[
              { id: "sales", label: "Ventas" },
              { id: "accounts", label: "Cuentas" },
              { id: "inventory", label: "Inventario" },
            ].map((t) => (
              <button className={report === t.id ? "active" : ""} key={t.id} onClick={() => setReport(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="toolbar-spacer" />
          <button className="button secondary" onClick={() => exportExcel(rows, `Tesorio-${report}-${range.start}`)}>
            <Download size={15} /> Excel
          </button>
          <button className="button secondary" onClick={print}>
            <FileText size={15} /> Imprimir / PDF
          </button>
        </div>
        <SectionHead title={title} subtitle={`${rows.length} registros correspondientes al período seleccionado.`} />
        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(rows[0]).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => (
                      <td key={j}>{typeof v === "number" ? v.toLocaleString("es-VE", { maximumFractionDigits: 2 }) : String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sin registros para este rango" />
        )}
      </section>
    </div>
  );
}

export function CustomersView() {
  const { data, money, open, notify } = useApp();
  const [query, setQuery] = useState(""),
    [segment, setSegment] = useState("");
  const withStats = data.customers.map((c) => {
    const orders = data.sales.filter((s) => s.customerId === c.id);
    const total = sum(orders, (s) => s.total),
      last = orders[0]?.createdAt;
    return {
      ...c,
      orders: orders.length,
      total,
      average: orders.length ? total / orders.length : 0,
      last,
      days: last ? Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / 86400000)) : 999,
    };
  });
  const rows = withStats.filter(
    (c) =>
      `${c.name} ${c.email} ${c.phone} ${c.document}`.toLowerCase().includes(query.toLowerCase()) &&
      (!segment || (segment === "frequent" && c.orders >= 5) || (segment === "inactive" && c.days > 15) || (segment === "new" && c.orders === 0))
  );

  return (
    <div className="module-stack">
      <div className="three-stat-grid">
        <KpiCard title="Empresas y Clientes" value={String(data.customers.length)} icon={<Users size={18} />} detail="Clientes registrados en base de datos" />
        <KpiCard title="Clientes Corporativos Frecuentes" value={String(withStats.filter((c) => c.orders >= 5).length)} icon={<Sparkles size={18} />} color="green" detail="Con más de 5 pedidos de uniformes" />
        <KpiCard title="Ticket Promedio" value={money(data.sales.length ? sum(data.sales, (s) => s.total) / data.sales.length : 0)} icon={<ShoppingBag size={18} />} color="blue" detail="Por factura emitida" />
      </div>

      <section className="card">
        <div className="table-toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Buscar por RIF, empresa o contacto..." />
          <select aria-label="Segmento de clientes" value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="">Todos los clientes</option>
            <option value="frequent">Clientes frecuentes (5+ pedidos)</option>
            <option value="inactive">Sin compras en 15 días</option>
            <option value="new">Sin pedidos recientes</option>
          </select>
          <div className="toolbar-spacer" />
          <button className="button secondary" onClick={() => exportExcel(rows.map((c) => ({ RIF: c.document, RazónSocial: c.name, Email: c.email, Teléfono: c.phone, TotalUSD: c.total })), "Tesorio-Clientes")} title="Descargar Excel">
            <Download size={15} /> Excel
          </button>
          <button
            className="button secondary"
            title="Imprimir o guardar como PDF"
            onClick={() => {
              try {
                printReport(
                  "DIRECTORIO FISCAL DE CLIENTES",
                  rows.map((c) => ({
                    Empresa: c.name,
                    RIF: c.document || "V-00000000-0",
                    Contribuyente: c.taxPayerType || "Ordinario",
                    Teléfono: c.phone || "—",
                    Correo: c.email || "—",
                    TotalFacturado: money(c.total),
                  })),
                  data.settings.legalName,
                  `Base de Datos de Clientes y RIF · ${rows.length} registros`
                );
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            <Printer size={15} /> Imprimir / PDF
          </button>
          <button className="button primary" onClick={() => open("customer")}>
            <Plus size={15} /> Nuevo Cliente
          </button>
        </div>

        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Empresa / Cliente</th>
                  <th>RIF SENIAT</th>
                  <th>Tipo Contribuyente</th>
                  <th>Teléfono</th>
                  <th>Facturas</th>
                  <th>Total Facturado</th>
                  <th>Último Pedido</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} onClick={() => open("customer-detail", c)}>
                    <td>
                      <div className="customer-cell">
                        <Avatar name={c.name} />
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.email || "Sin correo"}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong className="font-mono text-purple">{c.document}</strong>
                    </td>
                    <td>
                      <span className="category-tag">{c.taxPayerType || "Ordinario"}</span>
                    </td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.orders}</td>
                    <td className="amount">{money(c.total)}</td>
                    <td>{c.last ? (c.days === 0 ? "Hoy" : `Hace ${c.days} días`) : "Sin compras"}</td>
                    <td>
                      <button
                        className="text-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          open("customer-detail", c);
                        }}
                      >
                        Expediente <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No encontramos clientes con ese filtro" />
        )}
      </section>
    </div>
  );
}

export function MarketingView() {
  const { data, open } = useApp();
  return (
    <div className="module-stack">
      <section className="marketing-hero">
        <span className="marketing-hero-icon">
          <Megaphone size={35} strokeWidth={1.5} />
        </span>
        <div>
          <span className="welcome-eyebrow">PROMOCIÓN Y FIDELIZACIÓN</span>
          <h2>Comunica tus nuevos servicios de Bordado y DTF</h2>
          <p>Envía mensajes segmentados a empresas, colegios e industrias que compran en Fábrica Cristo Rey.</p>
        </div>
        <button className="button primary" onClick={() => open("campaign")}>
          <Plus size={16} /> Crear Campaña
        </button>
      </section>

      <section className="card">
        <SectionHead title="Campañas Comerciales" subtitle="Borradores para difusión por WhatsApp o correo corporativo." />
        {data.campaigns.length ? (
          <div className="campaign-grid">
            {data.campaigns.map((c) => (
              <article className="campaign-card" key={c.id}>
                <div>
                  <span className="campaign-icon">
                    <Megaphone size={21} />
                  </span>
                  <span className="draft-badge">{c.status}</span>
                </div>
                <h3>{c.name}</h3>
                <p>{c.message}</p>
                <div className="campaign-meta">
                  <span>
                    <Users size={13} /> {c.segment}
                  </span>
                  <small>{dateLabel(c.createdAt)}</small>
                </div>
                <div className="campaign-actions">
                  <button className="text-link" onClick={() => open("campaign", c)}>
                    Editar <Pencil size={13} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No hay campañas registradas" />
        )}
      </section>
    </div>
  );
}

export function StatisticsView() {
  const { data, period, customDates, money } = useApp();
  const sales = filterPeriod(data.sales, period, customDates),
    top = topProducts(data, sales),
    total = sum(sales, (s) => s.total);
  const channels = data.settings.channels.map((c) => ({
    name: c.name,
    total: sum(sales.filter((s) => s.channel === c.name), (s) => s.total),
  }));
  const categories = Array.from(new Set(data.products.map((p) => p.category)))
    .map((name) => ({
      name,
      total: sum(sales.flatMap((s) => s.items).filter((i) => data.products.find((p) => p.id === i.productId)?.category === name), (i) => i.price * i.quantity),
    }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="module-stack">
      <div className="three-stat-grid">
        <KpiCard title="Prendas y Servicios Facturados" value={sum(sales.flatMap((s) => s.items), (i) => i.quantity).toLocaleString()} icon={<Package size={18} />} detail="Total de piezas despachadas" />
        <KpiCard title="Ticket Promedio" value={money(sales.length ? total / sales.length : 0)} icon={<ShoppingBag size={18} />} color="green" detail="Valor medio por factura" />
        <KpiCard title="Valor del Inventario en Taller" value={money(sum(data.products.filter((p) => p.kind === "product"), (p) => p.stock * p.cost))} icon={<Wallet size={18} />} color="blue" detail="Inversión al costo en almacén" />
      </div>

      <div className="stats-layout">
        <section className="card product-ranking">
          <SectionHead title="Prendas y Servicios Más Vendidos" subtitle="Artículos líderes de Fábrica Cristo Rey en el período." />
          <div className="ranking-list">
            {top.slice(0, 8).map((p, i) => (
              <div key={p.id}>
                <span className="product-rank">{String(i + 1).padStart(2, "0")}</span>
                <ProductImage product={p} />
                <div className="ranking-name">
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.sold} unidades despachadas</small>
                  </span>
                  <div className="bar-track">
                    <i style={{ width: `${(p.sold / (top[0]?.sold || 1)) * 100}%` }} />
                  </div>
                </div>
                <strong>{money(p.revenue)}</strong>
              </div>
            ))}
          </div>
        </section>

        {/* GRÁFICAS MODERNAS DE ESTADÍSTICAS */}
        <div className="module-stack">
          <ModernSalesAnalyticsCharts
            channels={channels}
            categories={categories}
            total={total}
          />
        </div>
      </div>

      {/* DASHBOARD DE RÉCORD Y PROMEDIOS DE OPERARIOS DE TALLER */}
      <OperatorPerformanceDashboard />

      <RevenueChart />
    </div>
  );
}

export function TeamView() {
  const { data, open } = useApp();
  return (
    <div className="module-stack">
      <div className="team-banner">
        <span className="summary-icon purple">
          <Users size={24} />
        </span>
        <div>
          <h3>Equipo de Trabajo y Usuarios</h3>
          <p>Maneja accesos para vendedores de mostrador, jefes de taller y contadores sin costo por usuario.</p>
        </div>
        <button className="button primary" onClick={() => open("member")}>
          <Plus size={16} /> Agregar Usuario
        </button>
      </div>

      <section className="card">
        <SectionHead title="Usuarios Registrados" subtitle={`${data.members.length} colaboradores activos en Tesorio.`} />
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Módulos Autorizados</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="customer-cell">
                      <Avatar name={m.name} />
                      <span>
                        <strong>{m.name}</strong>
                        <small>{m.email}</small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="role-tag">
                      <ShieldCheck size={13} /> {m.role}
                    </span>
                  </td>
                  <td>
                    <div className="permission-tags">
                      {m.permissions.slice(0, 4).map((p) => (
                        <span key={p}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className="status-badge paid">
                      <i /> Activo
                    </span>
                  </td>
                  <td>
                    <button className="text-link" onClick={() => open("member", m)}>
                      Editar permisos <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// CONFIGURACIÓN DE EMPRESA, LOGO Y DATOS FISCALES SENIAT
export function SettingsView() {
  const { data, mutate, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [logoPreview, setLogoPreview] = useState(data.settings.logoUrl || "");

  const save = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget);
      const values = Object.fromEntries(fd);
      await mutate("settings.save", values, "Configuración de la empresa y logo guardados correctamente.");
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const handleLogoUpload = (file?: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return notify("La imagen no debe pesar más de 2 MB.", true);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setLogoPreview(result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="settings-layout">
      <aside className="card settings-nav">
        <div className="settings-business">
          <div className="company-logo-preview mb-3">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo empresa" className="max-h-16 mx-auto object-contain rounded" />
            ) : (
              <span className="store-icon">
                <Store size={27} />
              </span>
            )}
          </div>
          <h3>{data.settings.businessName}</h3>
          <p className="font-mono text-purple text-xs font-semibold">{data.settings.rif}</p>
        </div>
        <a href="#company" className="active">
          <Building2 size={16} /> Datos de la Empresa y Logo
        </a>
        <a href="#backup">
          <Database size={16} /> Respaldos SENIAT &amp; Correo
        </a>
        <a href="#fiscal">
          <ShieldCheck size={16} /> Facturación SENIAT
        </a>
        <a href="#imprenta">
          <Printer size={16} /> API Imprenta Digital SENIAT
        </a>
        <a href="#currency">
          <Globe size={16} /> Tasa Oficial BCV e Impuestos
        </a>
      </aside>

      <form className="module-stack" onSubmit={save}>
        {/* IDENTIDAD Y LOGO DE LA EMPRESA */}
        <section className="card settings-section" id="company">
          <SectionHead
            title="Identidad Corporativa y Logotipo de la Factura"
            subtitle="El logo seleccionado se estampará en la factura digital, reportes oficiales y en la barra superior."
          />
          <div className="form-grid">
            <div className="full-span p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-wrap items-center gap-5">
              <div className="h-24 w-44 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg flex items-center justify-center p-2 overflow-hidden shadow-xs relative group">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo actual" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs text-slate-400">Sin logo cargado</span>
                )}
              </div>
              <div className="flex-1 min-w-[240px]">
                <label className="text-xs font-semibold block mb-1">Cargar o Cambiar Logotipo (PNG, JPG, SVG):</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                  className="text-xs w-full mb-1"
                />
                <input type="hidden" name="logoUrl" value={logoPreview} />

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {logoPreview && (
                    <button
                      type="button"
                      className="button secondary text-xs py-1 px-2.5 h-7 flex items-center gap-1.5"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = logoPreview;
                        link.download = "Logo_Fabrica_Cristo_Rey.svg";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        notify("Descargando archivo original del logotipo...");
                      }}
                      title="Descargar archivo original del logo"
                    >
                      <Download size={13} />
                      <span>Descargar Logo</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="button secondary text-xs py-1 px-2.5 h-7 text-purple-700 dark:text-purple-300 flex items-center gap-1"
                    onClick={() => {
                      setLogoPreview("/images/cristo-rey-logo.svg");
                      notify("Restablecido logotipo oficial de Fábrica Cristo Rey");
                    }}
                  >
                    <span>Restaurar Cristo Rey</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  El logo se estampa en facturas digitales SENIAT, cotizaciones, libros oficiales y panel superior.
                </p>
              </div>
            </div>

            <label className="full-span">
              Nombre Comercial
              <input name="businessName" required defaultValue={data.settings.businessName} />
            </label>
            <label className="full-span">
              Razón Social Legal (Registrada en SENIAT)
              <input name="legalName" required defaultValue={data.settings.legalName} />
            </label>
            <label>
              Número de RIF de la Empresa
              <input name="rif" required defaultValue={data.settings.rif} placeholder="J-40912384-9" />
            </label>
            <label>
              Teléfono de contacto
              <input name="phone" defaultValue={data.settings.phone} />
            </label>
            <label className="full-span">
              Correo Electrónico de Facturación
              <input name="email" type="email" required defaultValue={data.settings.email} />
            </label>
            <label className="full-span">
              Dirección Fiscal Completa
              <input name="address" defaultValue={data.settings.address} />
            </label>
          </div>
        </section>

        {/* CENTRO DE RESPALDOS SENIAT Y BASE DE DATOS */}
        <section id="backup">
          <BackupManagerCard />
        </section>

        {/* PARÁMETROS FISCALES SENIAT */}
        <section className="card settings-section" id="fiscal">
          <SectionHead
            title="Parámetros de Facturación Digital SENIAT"
            subtitle="Resoluciones aplicables y secuencias correlativas de factura y control."
          />
          <div className="form-grid">
            <label>
              Serie de Factura
              <input name="fiscalSeries" required defaultValue={data.settings.fiscalSeries} placeholder="FAC-2026-" />
            </label>
            <label>
              Serie del Número de Control
              <input name="controlSeries" required defaultValue={data.settings.controlSeries} placeholder="00-" />
            </label>
            <label className="full-span">
              Resolución / Providencia de Facturación Digital
              <input name="seniatResolution" defaultValue={data.settings.seniatResolution} />
            </label>
            <label className="full-span">
              Autorización de Sistema Homologado
              <input name="printerAuthorization" defaultValue={data.settings.printerAuthorization} />
            </label>
          </div>
        </section>

        {/* INTEGRACIÓN API IMPRENTA DIGITAL HOMOLOGADA SENIAT */}
        <section className="card settings-section" id="imprenta">
          <SectionHead
            title="Conexión API · Imprenta Digital Homologada SENIAT"
            subtitle="Configura el WebService para recibir autorización legal, correlativos y transmitir libros fiscales."
          />
          <div className="form-grid">
            <div className="full-span p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg text-xs space-y-1">
              <span className="font-bold text-purple-900 dark:text-purple-200 block">
                Cumplimiento Providencia SNAT/2018/0141, SNAT/2024/000102 y PA 000121
              </span>
              <p className="text-purple-700 dark:text-purple-300 text-[11px]">
                Esta API permite a Tesorio transmitir en tiempo real cada factura digital emitida para su timbrado, código QR legal y validación tributaria ante la Administración Tributaria.
              </p>
            </div>

            <label className="full-span">
              URL del Endpoint de la Imprenta Digital (WebService / REST API)
              <input
                name="digitalPrinterApiUrl"
                defaultValue={data.settings.digitalPrinterApiUrl || "https://api.imprentadigital.seniat.gob.ve/v1/invoices"}
                placeholder="https://api.imprentadigital.seniat.gob.ve/v1/invoices"
              />
            </label>

            <label className="full-span">
              API Key / Token de Autenticación de la Imprenta Digital
              <input
                name="digitalPrinterApiKey"
                defaultValue={data.settings.digitalPrinterApiKey}
                placeholder="sec_live_seniat_98a4f201..."
                className="font-mono text-xs"
              />
            </label>

            <label>
              RIF de la Empresa de Imprenta Digital
              <input
                name="digitalPrinterRif"
                defaultValue={data.settings.digitalPrinterRif || "J-00034567-8"}
                placeholder="J-00034567-8"
              />
            </label>

            <label>
              N° Providencia Autorización Imprenta
              <input
                name="digitalPrinterProvNumber"
                defaultValue={data.settings.digitalPrinterProvNumber || "SNAT/2018/0141/00492"}
                placeholder="SNAT/2018/0141/00492"
              />
            </label>

            <label className="full-span">
              Razón Social de la Imprenta Digital
              <input
                name="digitalPrinterName"
                defaultValue={data.settings.digitalPrinterName || "Soluciones de Imprenta Digital Homologada C.A."}
                placeholder="Soluciones de Imprenta Digital Homologada C.A."
              />
            </label>

            <label>
              Ambiente de Conexión
              <select name="digitalPrinterEnvironment" defaultValue={data.settings.digitalPrinterEnvironment || "sandbox"}>
                <option value="sandbox">Ambiente de Pruebas / Homologación (Sandbox)</option>
                <option value="production">Producción SENIAT en Vivo (Fiscal)</option>
              </select>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                className="button secondary text-xs w-full h-[39px] flex items-center justify-center gap-1.5"
                onClick={async () => {
                  try {
                    notify("Probando conexión con API de la Imprenta Digital...");
                    const res = await fetch("/api/digital-printer", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "test_connection" }),
                    });
                    const r = await res.json();
                    if (r.ok) {
                      notify(r.message);
                    } else {
                      notify(r.error || "Fallo en conexión", true);
                    }
                  } catch (e) {
                    notify("Error al contactar API: " + (e as Error).message, true);
                  }
                }}
              >
                <Globe size={14} className="text-purple-600" />
                <span>Test de Conectividad API</span>
              </button>
            </div>
          </div>
        </section>

        {/* TASA DE CAMBIO BCV E IMPUESTOS */}
        <section className="card settings-section" id="currency">
          <SectionHead title="Tasa Oficial del BCV y Alícuotas de Impuesto" subtitle="Cálculo bimonetario para facturas y libros de IVA." />
          <div className="form-grid">
            <label>
              Tasa Oficial BCV (Bs. por USD)
              <input name="exchangeRate" type="number" step="0.01" min="0.01" required defaultValue={data.settings.exchangeRate} />
            </label>
            <label>
              Alícuota General de IVA (%)
              <input name="defaultIva" type="number" step="0.01" defaultValue={data.settings.defaultIva} />
            </label>
            <label>
              Alícuota IGTF Divisas (%)
              <input name="defaultIgtf" type="number" step="0.01" defaultValue={data.settings.defaultIgtf} />
            </label>
            <label className="flex items-center gap-2 cursor-pointer mt-5">
              <input type="checkbox" name="applyIgtfOnForeignCurrency" defaultChecked={data.settings.applyIgtfOnForeignCurrency} />
              <span className="text-xs">Aplicar IGTF 3% a cobros en divisas / efectivo</span>
            </label>
          </div>
        </section>

        <div className="settings-submit">
          <span>
            <ShieldCheck size={16} /> Los cambios se aplican de inmediato en todos los módulos y documentos fiscales.
          </span>
          <button className="button primary" type="submit" disabled={busy}>
            <Save size={16} /> {busy ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>
      </form>
    </div>
  );
}
