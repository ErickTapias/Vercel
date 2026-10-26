"use client";
import React, { useState } from "react";
import { TrendingUp, PieChart as PieIcon, BarChart3, ChevronDown } from "lucide-react";
import { useApp } from "./app-context";
import { SectionHead } from "./ui";

export function ModernFinanceCharts({
  revenue,
  costs,
  expenses,
  net,
  margin,
}: {
  revenue: number;
  costs: number;
  expenses: number;
  net: number;
  margin: number;
}) {
  const { money } = useApp();
  const [viewMode, setViewMode] = useState<"waterfall" | "composition">("waterfall");

  // Calcular proporciones sobre el total de ventas
  const safeRev = Math.max(1, revenue);
  const costPct = Math.min(100, Math.round((costs / safeRev) * 100));
  const expPct = Math.min(100, Math.round((expenses / safeRev) * 100));
  const netPct = Math.max(0, Math.min(100, Math.round((net / safeRev) * 100)));

  return (
    <div className="card p-4 space-y-4">
      <SectionHead
        title="Gráfico Financiero Dinámico en Tiempo Real"
        subtitle="Visualización analítica del flujo de ingresos, costos de producción y rentabilidad neta."
      >
        <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("waterfall")}
            className={`px-3 py-1 rounded-md font-bold transition-all ${
              viewMode === "waterfall" ? "bg-purple-600 text-white shadow-2xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Flujo de Cascada
          </button>
          <button
            type="button"
            onClick={() => setViewMode("composition")}
            className={`px-3 py-1 rounded-md font-bold transition-all ${
              viewMode === "composition" ? "bg-purple-600 text-white shadow-2xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Distribución %
          </button>
        </div>
      </SectionHead>

      {viewMode === "waterfall" ? (
        <div className="space-y-3.5 pt-1">
          {/* Barra de Ingresos */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-600 inline-block" /> Ventas Totales Facturadas (100%)
              </span>
              <strong className="font-mono text-purple-700 dark:text-purple-300">{money(revenue)}</strong>
            </div>
            <div className="w-full h-5 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex shadow-inner">
              <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 w-full" />
            </div>
          </div>

          {/* Barra de Costo de Producción */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> (-) Costo de Telas, Insumos y DTF ({costPct}%)
              </span>
              <strong className="font-mono text-blue-600 dark:text-blue-400">-{money(costs)}</strong>
            </div>
            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-lg transition-all duration-500"
                style={{ width: `${costPct}%` }}
              />
            </div>
          </div>

          {/* Barra de Gastos Operativos */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> (-) Gastos Fijos, Nómina y Alquiler ({expPct}%)
              </span>
              <strong className="font-mono text-amber-600 dark:text-amber-400">-{money(expenses)}</strong>
            </div>
            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-lg transition-all duration-500"
                style={{ width: `${expPct}%` }}
              />
            </div>
          </div>

          {/* Barra de Utilidad Neta Real */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-1">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> (=) Utilidad Neta Libre de Fábrica ({margin.toFixed(1)}%)
              </span>
              <strong className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{money(net)}</strong>
            </div>
            <div className="w-full h-5 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden flex shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-lg transition-all duration-500"
                style={{ width: `${Math.max(5, netPct)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Gráfico de composición / donut visual */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center pt-2">
          <div className="flex items-center justify-center">
            <div
              className="w-48 h-48 rounded-full p-4 flex items-center justify-center shadow-lg transition-all"
              style={{
                background: `conic-gradient(
                  #3b82f6 0% ${costPct}%,
                  #f59e0b ${costPct}% ${costPct + expPct}%,
                  #10b981 ${costPct + expPct}% 100%
                )`,
              }}
            >
              <div className="w-32 h-32 rounded-full bg-white dark:bg-slate-900 flex flex-col items-center justify-center text-center shadow-inner">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Margen Neto</span>
                <strong className="text-xl font-black text-purple-700 dark:text-purple-300 font-mono">
                  {margin.toFixed(1)}%
                </strong>
                <small className="text-[9px] text-emerald-600 font-semibold">{money(net)}</small>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex justify-between items-center">
              <div>
                <strong className="block text-blue-950 dark:text-blue-200">Costo Directo de Insumos ({costPct}%)</strong>
                <small className="text-blue-700 dark:text-blue-300">Telas, film DTF, hilos y tintas</small>
              </div>
              <span className="font-mono font-bold text-blue-800 dark:text-blue-200">{money(costs)}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex justify-between items-center">
              <div>
                <strong className="block text-amber-950 dark:text-amber-200">Gastos Operativos ({expPct}%)</strong>
                <small className="text-amber-700 dark:text-amber-300">Alquiler galpón, nómina costureras</small>
              </div>
              <span className="font-mono font-bold text-amber-800 dark:text-amber-200">{money(expenses)}</span>
            </div>

            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex justify-between items-center">
              <div>
                <strong className="block text-emerald-950 dark:text-emerald-200">Ganancia Neta Disponible ({margin.toFixed(1)}%)</strong>
                <small className="text-emerald-700 dark:text-emerald-300">Rentabilidad libre reinvertible</small>
              </div>
              <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200">{money(net)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Gráfica Moderna de Ventas por Canal y Categorías
export function ModernSalesAnalyticsCharts({
  channels,
  categories,
  total,
}: {
  channels: Array<{ name: string; total: number }>;
  categories: Array<{ name: string; total: number }>;
  total: number;
}) {
  const { money } = useApp();
  const safeTotal = Math.max(1, total);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Gráfica por Canales de Venta */}
      <div className="card p-4 space-y-3">
        <SectionHead title="Ventas por Canal de Distribución" subtitle="Mayoristas, Tienda Física y Pedidos Web" />
        <div className="space-y-3 pt-1">
          {channels.map((c, i) => {
            const pct = Math.round((c.total / safeTotal) * 100);
            const colors = [
              "from-purple-500 to-indigo-600",
              "from-blue-500 to-cyan-500",
              "from-emerald-500 to-teal-500",
            ];
            return (
              <div key={c.name} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>{c.name}</span>
                  <span className="font-mono text-purple-700 dark:text-purple-300">
                    {money(c.total)} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${colors[i % colors.length]} rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gráfica por Líneas de Producto / Servicios Cristo Rey */}
      <div className="card p-4 space-y-3">
        <SectionHead title="Rendimiento por Línea de Producto" subtitle="Participación en la facturación total" />
        <div className="space-y-3 pt-1">
          {categories.slice(0, 5).map((cat, i) => {
            const pct = Math.round((cat.total / safeTotal) * 100);
            return (
              <div key={cat.name} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="truncate max-w-[200px]">{cat.name}</span>
                  <span className="font-mono text-indigo-700 dark:text-indigo-300">
                    {money(cat.total)} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
