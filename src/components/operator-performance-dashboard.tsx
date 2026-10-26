"use client";
import { useState } from "react";
import {
  Sparkles,
  Printer,
  Award,
  Clock,
  CheckCircle2,
  TrendingUp,
  Percent,
  Layers,
  Scissors,
  Check,
  Flame,
  UserCheck,
} from "lucide-react";
import { useApp } from "./app-context";
import { SectionHead, KpiCard } from "./ui";
import { dateLabel } from "@/lib/utils";

export type OperatorMetrics = {
  name: string;
  role: string;
  station: string;
  stationLabel: string;
  assignedCount: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  completionRate: number; // 0-100%
  avgTurnaroundMinutes: number; // tiempo promedio de entrega
  speedRating: string; // 'Excelente' | 'Muy Rápido' | 'Estándar'
  totalItemsProcessed: number;
  recentOrders: Array<{
    orderNumber: string;
    customer: string;
    status: string;
    date: string;
  }>;
};

export function OperatorPerformanceDashboard({ lockedStation }: { lockedStation?: string | null } = {}) {
  const { data, currentUser } = useApp();
  const isOperator = currentUser?.role?.startsWith("operator_");
  // Los operarios solo ven el récord de SU máquina; el resto ve todas las estaciones
  const forcedStation = lockedStation || (isOperator ? currentUser?.stationAccess || null : null);
  const [stationFilter, setStationFilter] = useState<string>(forcedStation || "all");
  const effectiveFilter = forcedStation || stationFilter;

  const orders = (data.productionOrders || []).filter((o) => !forcedStation || o.station === forcedStation);

  // Operadores conocidos de las 3 estaciones
  const operatorConfigs = [
    {
      name: "Carlos DTF",
      role: "Operario de Plotter DTF",
      station: "plotter_dtf",
      stationLabel: "Terminal Plotter DTF I3200",
      avgMinutesBase: 42,
    },
    {
      name: "Katerin Bordados",
      role: "Operaria de Bordadora Industrial",
      station: "bordadora",
      stationLabel: "Terminal Bordadora Meistergram 8 Cabezales",
      avgMinutesBase: 58,
    },
    {
      name: "Taller Costura y Confección",
      role: "Operario Confección & Ensamble",
      station: "corte_confeccion",
      stationLabel: "Terminal 3 · Costura y Ensamble",
      avgMinutesBase: 85,
    },
  ];

  const metrics: OperatorMetrics[] = operatorConfigs.map((cfg) => {
    // Órdenes asignadas directamente o asociadas a su estación
    const opOrders = orders.filter(
      (o) => o.station === cfg.station || (o.operatorName && o.operatorName.toLowerCase().includes(cfg.name.toLowerCase().split(" ")[0]))
    );

    const completed = opOrders.filter((o) => o.status === "listo_para_retirar" || o.status === "entregado").length;
    const inProgress = opOrders.filter((o) => o.status === "en_proceso").length;
    const pending = opOrders.filter((o) => o.status === "pendiente").length;
    const assigned = opOrders.length;

    const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
    const itemsProcessed = opOrders.reduce(
      (acc, o) => acc + (o.items || []).reduce((sub, it) => sub + (it.quantity || 1), 0),
      0
    );

    return {
      name: cfg.name,
      role: cfg.role,
      station: cfg.station,
      stationLabel: cfg.stationLabel,
      assignedCount: assigned,
      completedCount: completed,
      inProgressCount: inProgress,
      pendingCount: pending,
      completionRate: rate,
      avgTurnaroundMinutes: cfg.avgMinutesBase,
      speedRating: rate >= 70 ? "Excelente" : rate >= 40 ? "Muy Rápido" : "Estándar",
      totalItemsProcessed: itemsProcessed,
      recentOrders: opOrders.slice(-3).map((o) => ({
        orderNumber: o.orderNumber,
        customer: o.customerName,
        status: o.status,
        date: dateLabel(o.createdAt),
      })),
    };
  });

  const filteredMetrics = metrics.filter(
    (m) => effectiveFilter === "all" || m.station === effectiveFilter
  );

  const totalAssigned = metrics.reduce((a, b) => a + b.assignedCount, 0);
  const totalCompleted = metrics.reduce((a, b) => a + b.completedCount, 0);
  const overallRate = totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;
  const bestOperator = [...metrics].sort((a, b) => b.completedCount - a.completedCount)[0];

  return (
    <div className="card p-4 space-y-4">
      <SectionHead
        title="Rendimiento y Récord de Operarios de Taller"
        subtitle="Métricas de efectividad, trabajos completados y promedio de despacho por máquina."
      >
        {forcedStation ? (
          <div className="flex items-center gap-2 bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 px-3 py-1.5 rounded-lg text-[11px] font-bold">
            <UserCheck size={14} /> Récord de mi máquina: {operatorConfigs.find((c) => c.station === forcedStation)?.stationLabel || forcedStation}
          </div>
        ) : (
        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setStationFilter("all")}
            className={`px-2.5 py-1 text-xs rounded-md font-bold transition-all ${
              stationFilter === "all" ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Todos ({metrics.length})
          </button>
          <button
            type="button"
            onClick={() => setStationFilter("plotter_dtf")}
            className={`px-2.5 py-1 text-xs rounded-md font-bold transition-all ${
              stationFilter === "plotter_dtf" ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            DTF I3200
          </button>
          <button
            type="button"
            onClick={() => setStationFilter("bordadora")}
            className={`px-2.5 py-1 text-xs rounded-md font-bold transition-all ${
              stationFilter === "bordadora" ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Meistergram
          </button>
          <button
            type="button"
            onClick={() => setStationFilter("corte_confeccion")}
            className={`px-2.5 py-1 text-xs rounded-md font-bold transition-all ${
              stationFilter === "corte_confeccion" ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-2xs" : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Costura
          </button>
        </div>
        )}
      </SectionHead>

      {/* Tarjetas resumen de rendimiento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl">
          <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold uppercase tracking-wider block">
            Tasa de Cumplimiento Taller
          </span>
          <strong className="text-2xl font-black text-purple-900 dark:text-purple-100 font-mono">
            {overallRate}%
          </strong>
          <small className="text-[10px] text-slate-500 block mt-0.5">
            {totalCompleted} de {totalAssigned} trabajos listos
          </small>
        </div>

        <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider block">
            Operario con Mayor Récord
          </span>
          <strong className="text-base font-extrabold text-emerald-900 dark:text-emerald-100 truncate block">
            {bestOperator ? bestOperator.name : "—"}
          </strong>
          <small className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
            🏆 {bestOperator ? `${bestOperator.completedCount} entregados` : "Sin datos"}
          </small>
        </div>

        <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
          <span className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider block">
            Tiempo Promedio por Orden
          </span>
          <strong className="text-2xl font-black text-blue-900 dark:text-blue-100 font-mono">
            ~55 <span className="text-xs font-normal">min</span>
          </strong>
          <small className="text-[10px] text-slate-500 block mt-0.5">
            Desde asignación hasta terminar
          </small>
        </div>

        <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold uppercase tracking-wider block">
            Prendas y Metros Elaborados
          </span>
          <strong className="text-2xl font-black text-amber-900 dark:text-amber-100 font-mono">
            {metrics.reduce((a, b) => a + b.totalItemsProcessed, 0)}
          </strong>
          <small className="text-[10px] text-slate-500 block mt-0.5">
            Metros DTF, bordados y piezas
          </small>
        </div>
      </div>

      {/* Tarjetas individuales de Operario con Barra de Rendimiento y Récord */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {filteredMetrics.map((op) => (
          <div
            key={op.name}
            className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold block">
                  {op.stationLabel}
                </span>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                  {op.name}
                </h4>
                <small className="text-[10px] text-slate-500">{op.role}</small>
              </div>
              <span
                className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${
                  op.completionRate >= 70
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : op.completionRate >= 40
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {op.speedRating}
              </span>
            </div>

            {/* Barra de progreso de efectividad */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                <span>Efectividad de Despacho:</span>
                <span className="font-mono text-purple-700 dark:text-purple-300 font-bold">
                  {op.completionRate}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, op.completionRate))}%` }}
                />
              </div>
            </div>

            {/* Estadísticas de Tareas */}
            <div className="grid grid-cols-3 gap-1.5 text-center pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div className="p-1.5 bg-slate-50 dark:bg-slate-950 rounded">
                <span className="text-[9px] text-slate-400 block uppercase">Asignados</span>
                <strong className="font-mono text-slate-800 dark:text-slate-200">{op.assignedCount}</strong>
              </div>
              <div className="p-1.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded">
                <span className="text-[9px] text-emerald-700 dark:text-emerald-400 block uppercase">Listos</span>
                <strong className="font-mono text-emerald-700 dark:text-emerald-300">{op.completedCount}</strong>
              </div>
              <div className="p-1.5 bg-amber-50/50 dark:bg-amber-950/30 rounded">
                <span className="text-[9px] text-amber-700 dark:text-amber-400 block uppercase">En Cola</span>
                <strong className="font-mono text-amber-700 dark:text-amber-300">{op.pendingCount + op.inProgressCount}</strong>
              </div>
            </div>

            {/* Historial de últimos trabajos */}
            {op.recentOrders.length > 0 && (
              <div className="space-y-1 text-[10px] pt-1">
                <span className="text-slate-400 font-semibold block">Últimos trabajos procesados:</span>
                {op.recentOrders.map((ro, idx) => (
                  <div key={idx} className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                    <span className="font-mono font-semibold text-purple-700 dark:text-purple-300">{ro.orderNumber}</span>
                    <span className="truncate max-w-[110px]">{ro.customer}</span>
                    <span
                      className={`text-[8.5px] px-1.5 rounded ${
                        ro.status === "listo_para_retirar" || ro.status === "entregado"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {ro.status === "listo_para_retirar" ? "Listo" : ro.status === "en_proceso" ? "En proc." : "Pend."}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
