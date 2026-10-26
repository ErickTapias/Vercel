"use client";
import { useMemo, useState } from "react";
import { ShoppingBag, TrendingUp, Receipt, Wallet, ArrowRight, ArrowUpRight, ChevronDown, Sparkles, Package, ShieldCheck, FileCheck } from "lucide-react";
import { useApp } from "./app-context";
import { KpiCard, SectionHead, AccountIcon, ProductImage, SalesTable } from "./ui";
import { filterPeriod, financials, sum, topProducts, getBounds } from "@/lib/utils";

function smoothPath(points: [number, number][]) {
  return points.map((p, i, all) => {
    if (!i) return `M${p[0]},${p[1]}`;
    const prev = all[i - 1], before = all[i - 2] || prev, next = all[i + 1] || p;
    const clamp = (y: number) => Math.max(Math.min(prev[1], p[1]), Math.min(Math.max(prev[1], p[1]), y));
    const c1 = [prev[0] + (p[0] - before[0]) / 6, clamp(prev[1] + (p[1] - before[1]) / 6)];
    const c2 = [p[0] - (next[0] - prev[0]) / 6, clamp(p[1] - (next[1] - prev[1]) / 6)];
    return `C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p[0]},${p[1]}`;
  }).join(" ");
}

export function RevenueChart() {
  const { data, period, customDates, money, currency } = useApp();
  const [hover, setHover] = useState<number | null>(null), [weekly, setWeekly] = useState(false);
  const chart = useMemo(() => {
    let { start, end } = getBounds(period, customDates);
    if (period === "all") start = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const raw: { label: string; income: number; expense: number }[] = [];
    const days = Math.min(180, Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000)));
    const interval = weekly ? 7 : days > 65 ? Math.ceil(days / 30) : 1;
    for (let i = 0; i < days; i += interval) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const next = new Date(date);
      next.setDate(date.getDate() + interval);
      raw.push({
        label: date.toLocaleDateString("es-VE", { day: "2-digit", month: "short" }),
        income: sum(data.sales.filter((s) => s.status !== "void" && new Date(s.createdAt) >= date && new Date(s.createdAt) < next && new Date(s.createdAt) <= end), (s) => s.total),
        expense: sum(data.expenses.filter((e) => new Date(e.createdAt) >= date && new Date(e.createdAt) < next && new Date(e.createdAt) <= end), (e) => e.amount),
      });
    }
    if (raw.length === 1) raw.unshift({ ...raw[0], income: 0, expense: 0 });
    return raw;
  }, [data, period, customDates, weekly]);

  const max = Math.max(100, ...chart.map((c) => Math.max(c.income, c.expense))) * 1.2;
  const width = 760, left = 57, right = 746, top = 18, bottom = 185;
  const points = chart.map((c, i) => [left + (i / Math.max(1, chart.length - 1)) * (right - left), bottom - (c.income / max) * (bottom - top)] as [number, number]);
  const expensePoints = chart.map((c, i) => [points[i][0], bottom - (c.expense / max) * (bottom - top)] as [number, number]);
  const path = smoothPath(points), expensePath = smoothPath(expensePoints);
  const sales = filterPeriod(data.sales, period, customDates);

  return (
    <section className="card revenue-card">
      <SectionHead title="Facturación y Egresos Operativos" subtitle="Seguimiento bimonetario para Fábrica Cristo Rey">
        <button className="chart-period" onClick={() => { setWeekly(!weekly); setHover(null); }}>
          {weekly ? "Por semana" : "Por día"}
          <ChevronDown size={13} />
        </button>
      </SectionHead>
      <div className="chart-summary">
        <strong>{money(sum(sales, (s) => s.total))}</strong>
        <span>Facturado en el período</span>
        <div className="chart-legend">
          <span><i />Ventas Netas</span>
          <span><i className="expense-dot" />Egresos / Insumos</span>
        </div>
      </div>
      <div className="revenue-chart" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${width} 220`} preserveAspectRatio="none" role="img" aria-label="Gráfico de facturación y egresos">
          <defs>
            <linearGradient id="income-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity=".18" />
              <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((i) => {
            const y = top + (i * (bottom - top)) / 4;
            const amount = max * (1 - i / 4) * (currency === "VES" ? data.settings.exchangeRate : 1);
            const prefix = currency === "VES" ? "Bs." : "$";
            return (
              <g key={i}>
                <line x1={left} y1={y} x2={right} y2={y} stroke="#f1f5f9" strokeDasharray="4 5" />
                <text x={44} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">
                  {amount >= 1000 ? `${prefix}${(amount / 1000).toFixed(1)}k` : `${prefix}${Math.round(amount)}`}
                </text>
              </g>
            );
          })}
          <path d={`${path} L${right},${bottom} L${left},${bottom} Z`} fill="url(#income-fill)" />
          <path d={expensePath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeDasharray="5 5" />
          <path d={path} fill="none" stroke="#7c3aed" strokeWidth="2.8" strokeLinecap="round" />
          {chart.map(
            (c, i) =>
              (i === 0 || i === chart.length - 1 || i % Math.max(1, Math.floor(chart.length / 5)) === 0) && (
                <text key={i} x={points[i][0]} y="211" textAnchor={i === 0 ? "start" : i === chart.length - 1 ? "end" : "middle"} fill="#94a3b8" fontSize="10">
                  {c.label}
                </text>
              )
          )}
        </svg>
      </div>
    </section>
  );
}

export function Dashboard() {
  const { data, money, period, customDates, navigate, open, currentUser } = useApp();
  const sales = filterPeriod(data.sales, period, customDates),
    expenses = filterPeriod(data.expenses, period, customDates),
    f = financials(sales, expenses);

  const available = sum(data.accounts, (a) => a.balance / (a.currency === "VES" ? data.settings.exchangeRate : 1));
  const top = topProducts(data, sales).slice(0, 4);
  const low = data.products.filter((p) => p.kind === "product" && p.stock <= p.minStock);

  const displayName = currentUser?.name ? currentUser.name.split(" ")[0] : (data.settings.ownerName ? data.settings.ownerName.split(" ")[0] : "Eliezer");

  return (
    <div className="dashboard">
      <section className="welcome-banner">
        <div className="welcome-copy">
          <span className="welcome-eyebrow">
            <Sparkles size={13} /> GESTIÓN INTEGRAL · FÁBRICA CRISTO REY C.A.
          </span>
          <h2>
            Bienvenido al panel, {displayName} <span className="wave">✦</span>
          </h2>
          <p>
            Control de confección de uniformes, servicio de DTF, facturación legal SENIAT y libros auditables en una sola plataforma.
          </p>
          <div className="flex gap-3 mt-3">
            <button className="button primary text-xs" onClick={() => navigate("ventas", "pos")}>
              Emitir Factura Digital <ArrowRight size={14} />
            </button>
            <button className="button secondary text-xs" onClick={() => navigate("auditoria")}>
              Libros Fiscales SENIAT
            </button>
          </div>
        </div>
        <img className="welcome-art" src="/images/growth.png" alt="Tesorio finanzas" />
      </section>

      <div className="kpi-grid">
        <KpiCard title="Facturado en el Período" value={money(f.revenue)} icon={<ShoppingBag size={18} />} detail={`${sales.length} facturas emitidas`} onClick={() => navigate("ventas", "historial")} />
        <KpiCard title="Utilidad Neta Real" value={money(f.net)} icon={<TrendingUp size={18} />} color="green" detail={`${f.margin.toFixed(1)}% de rentabilidad`} points="0,24 8,21 17,22 27,15 35,18 44,8 53,11 62,3" onClick={() => navigate("financiero")} />
        <KpiCard title="Débito Fiscal IVA 16%" value={money(f.ivaCollected)} icon={<Receipt size={18} />} color="peach" detail="IVA recaudado para SENIAT" points="0,21 9,21 18,15 27,18 36,10 45,15 54,9 63,11" onClick={() => navigate("auditoria")} />
        <KpiCard title="Saldo Disponible en Bancos" value={money(available)} icon={<Wallet size={18} />} color="blue" detail={`En ${data.accounts.length} cuentas activas`} points="0,25 9,20 18,23 27,13 36,16 45,9 54,12 63,4" onClick={() => navigate("cuentas")} />
      </div>

      <div className="dashboard-grid">
        <RevenueChart />
        <section className="card accounts-overview">
          <SectionHead title="Cuentas Bancarias y Caja">
            <button className="text-link" onClick={() => navigate("cuentas")}>
              Ver todas <ArrowUpRight size={13} />
            </button>
          </SectionHead>
          <div className="account-total">
            <span>DISPONIBILIDAD TOTAL</span>
            <strong>
              {money(available)}
              <small>{data.accounts.length} cuentas</small>
            </strong>
          </div>
          <div className="account-overview-list">
            {data.accounts.slice(0, 3).map((a) => (
              <button key={a.id} onClick={() => navigate("cuentas")}>
                <AccountIcon account={a} />
                <span className="account-name">
                  <strong>{a.name}</strong>
                  <small>{a.currency === "USD" ? "Dólares ($)" : "Bolívares (VES)"} · {a.method}</small>
                </span>
                <span className="account-amount">
                  {a.currency === "VES" ? `Bs. ${a.balance.toLocaleString("es-VE", { minimumFractionDigits: 2 })}` : `$ ${a.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                </span>
              </button>
            ))}
          </div>
          <button className="accounts-footer" onClick={() => navigate("cuentas")}>
            Movimientos y transferencias <ArrowRight size={14} />
          </button>
        </section>
      </div>

      <div className="dashboard-grid dashboard-bottom">
        <section className="card recent-sales">
          <SectionHead title="Últimas Facturas Fiscales Emitidas" subtitle="Correlatividad y número de control asignado.">
            <button className="text-link" onClick={() => navigate("ventas", "historial")}>
              Ver historial <ArrowRight size={13} />
            </button>
          </SectionHead>
          <SalesTable sales={sales.slice(0, 4)} compact />
        </section>

        <section className="card top-products">
          <SectionHead title="Líneas y Servicios Más Vendidos">
            <span className="tiny-label">Fábrica Cristo Rey</span>
          </SectionHead>
          <div className="top-product-list">
            {top.length ? (
              top.map((p, i) => (
                <button key={p.id} onClick={() => open("product", p)}>
                  <span className="product-rank">{String(i + 1).padStart(2, "0")}</span>
                  <ProductImage product={p} />
                  <span className="top-product-name">
                    <strong>{p.name}</strong>
                    <small>{p.sold} unidades despachadas</small>
                  </span>
                  <span className="top-product-revenue">{money(p.revenue)}</span>
                </button>
              ))
            ) : (
              <p className="muted padded">No hay ventas registradas.</p>
            )}
          </div>
          <button className={`stock-alert ${low.length ? "" : "all-good"}`} onClick={() => navigate("inventario", "bajo")}>
            <span>
              <Package size={15} />
              {low.length ? `${low.length} artículos por debajo del stock mínimo` : "Existencias de telas y prendas al día"}
            </span>
            <ArrowRight size={14} />
          </button>
        </section>
      </div>
    </div>
  );
}
