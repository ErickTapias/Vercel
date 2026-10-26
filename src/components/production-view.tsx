"use client";
import { useState, useRef } from "react";
import {
  Sparkles,
  Printer,
  CheckCircle2,
  Clock,
  Play,
  Send,
  Download,
  Plus,
  Layers,
  Phone,
  Mail,
  Palette,
  Maximize2,
  Shirt,
  MonitorCheck,
  Scissors,
  FileCheck,
  Upload,
  Eye,
  X,
  FileText,
  Pencil,
  Truck,
  MapPin,
  CreditCard,
  AlertCircle,
  BellRing,
} from "lucide-react";
import { useApp } from "./app-context";
import { SectionHead, KpiCard, EmptyState } from "./ui";
import { dateLabel, printReport } from "@/lib/utils";
import type { ProductionOrder } from "@/lib/types";
import {
  InteractiveGarmentSelector,
  GarmentCroquisViewer,
  type GarmentType,
  type CroquisData,
} from "./garment-embroidery-selector";
import { OperatorPerformanceDashboard } from "./operator-performance-dashboard";

function LegacyProductionView() {
  const { data, mutate, notify, currentUser, money } = useApp();

  const isOperator = currentUser?.role === "operator_dtf" || currentUser?.role === "operator_bordadora";
  const canEditAndAssign =
    currentUser?.role === "owner" ||
    currentUser?.role === "admin_fabrica" ||
    currentUser?.role === "admin_sucursal_dtf" ||
    !currentUser?.role;

  // Solo los operarios de máquina arrancan filtrados a su terminal; Dueño y Gerentes de Sucursal ven Vista General
  const initialStation = isOperator
    ? currentUser?.stationAccess === "plotter_dtf"
      ? "plotter_dtf"
      : "bordadora"
    : "all";

  const [activeStation, setActiveStation] = useState<"all" | "plotter_dtf" | "bordadora" | "corte_confeccion">(
    initialStation as any
  );
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState<"create" | "edit" | null>(null);
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<ProductionOrder | null>(null);
  const [croquisViewerOrder, setCroquisViewerOrder] = useState<ProductionOrder | null>(null);

  // Filtrado de órdenes de producción por estación (DTF, Bordadora o Taller de Costura)
  const orders = data.productionOrders.filter((o) => {
    if (activeStation === "all") return true;
    return o.station === activeStation;
  });

  const pendingOrders = orders.filter((o) => o.status === "pendiente");
  const inProgressOrders = orders.filter((o) => o.status === "en_proceso");
  const readyOrders = orders.filter((o) => o.status === "listo_para_retirar");

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    setBusyId(orderId);
    try {
      await mutate(
        "production.updateStatus",
        {
          id: orderId,
          status: newStatus,
          operatorName: currentUser?.name || "Operario",
        },
        newStatus === "listo_para_retirar"
          ? "¡Trabajo marcado como LISTO! Alerta enviada a Dueño y Sucursales para autorizar entrega o delivery."
          : "Estado de orden de trabajo actualizado"
      );
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadFile = (order: ProductionOrder) => {
    const filename = order.fileName || `Arte_${order.orderNumber}.png`;
    if (order.fileUrl && order.fileUrl.startsWith("data:")) {
      const link = document.createElement("a");
      link.href = order.fileUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notify(`Descargando archivo: ${filename}`);
    } else if (order.fileUrl && order.fileUrl.startsWith("http")) {
      window.open(order.fileUrl, "_blank");
    } else {
      const blob = new Blob(
        [
          `FÁBRICA CRISTO REY C.A. - FICHA TÉCNICA DE PRODUCCIÓN\n` +
            `Orden: ${order.orderNumber}\n` +
            `Estación: ${order.station}\n` +
            `Cliente: ${order.customerName}\n` +
            `Medidas: ${order.dimensions}\n` +
            `Colores: ${order.colors}\n` +
            `Ubicación: ${order.embroideryPlacement || "Estándar"}\n` +
            `Prenda: ${order.garmentType}\n` +
            `Instrucciones: ${order.notes}\n`
        ],
        { type: "text/plain;charset=utf-8" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FICHA_${order.orderNumber}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notify(`Descargando especificaciones: ${order.orderNumber}`);
    }
  };

  const handlePrintOrderSheet = (order: ProductionOrder) => {
    try {
      const rows = [
        { Parámetro: "N° Orden de Producción", Especificación: order.orderNumber },
        {
          Parámetro: "Estación de Taller",
          Especificación:
            order.station === "plotter_dtf"
              ? "PLOTTER DTF INDUSTRIAL I3200"
              : order.station === "bordadora"
              ? "BORDADORA INDUSTRIAL BARUDAN"
              : "TALLER DE COSTURA Y CONFECCIÓN",
        },
        { Parámetro: "Cliente / Empresa", Especificación: order.customerName },
        { Parámetro: "Teléfono Celular", Especificación: order.customerPhone || "—" },
        { Parámetro: "Correo de Notificación", Especificación: order.customerEmail || "—" },
        { Parámetro: "Dimensiones y Medidas", Especificación: order.dimensions || "Según archivo" },
        { Parámetro: "Colores y Tintas / Hilos", Especificación: order.colors || "CMYK + Base Blanca" },
        { Parámetro: "Prenda / Sustrato", Especificación: order.garmentType || "Transfer textil" },
        { Parámetro: "Ubicación de Bordado / Estampado", Especificación: order.embroideryPlacement || "Frente Pecho" },
        { Parámetro: "Archivo de Arte Adjunto", Especificación: `${order.fileName} (${order.fileSize})` },
        { Parámetro: "Instrucciones de Taller", Especificación: order.notes || "Procesar según especificaciones técnicas" },
        { Parámetro: "Prioridad", Especificación: order.priority.toUpperCase() },
        { Parámetro: "Fecha de Recepción", Especificación: dateLabel(order.createdAt, true) },
      ];

      printReport(
        `HOJA TÉCNICA DE PRODUCCIÓN · ${order.orderNumber}`,
        rows,
        data.settings.legalName,
        `Taller Fábrica Cristo Rey · Terminal: ${order.stationIpOrDevice || "Taller Principal"}`
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  return (
    <div className="module-stack">
      {/* ALERTA VISUAL PARA DUEÑO Y SUCURSALES CUANDO HAY TRABAJOS LISTOS PARA AUTORIZAR ENTREGA/DELIVERY */}
      {canEditAndAssign && readyOrders.length > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-emerald-500 to-teal-700 text-white rounded-xl shadow-md flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-2.5">
            <BellRing size={20} className="text-emerald-100" />
            <div>
              <strong className="block text-sm font-extrabold">
                ¡{readyOrders.length} Trabajo(s) terminado(s) por los Operadores en Taller!
              </strong>
              <p className="text-xs text-emerald-100 m-0">
                El Dueño y las Sucursales pueden autorizar el retiro en oficina o despacho con Delivery Regional / Nacional tras validar el pago restante.
              </p>
            </div>
          </div>
          <button
            className="button secondary text-xs bg-white text-emerald-900 border-none font-bold shadow-xs py-1.5 px-3 h-auto"
            onClick={() => setActiveStation("all")}
          >
            Ver Trabajos Listos
          </button>
        </div>
      )}

      {/* Banner de Estaciones de Taller */}
      <section className="production-header-banner">
        <div className="flex items-center gap-3">
          <div className="production-icon-badge">
            <MonitorCheck size={26} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              TERMINAL DE TALLER &amp; PRODUCCIÓN EN LÍNEA
            </span>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Cola de Trabajo por Orden de Llegada (DTF, Bordados y Costura)
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {isOperator
                ? "Terminal de operario: Visualiza el croquis exacto en la prenda, descarga artes y ejecuta sin dudas técnicas."
                : "Dueño, Sucursal 1 y Sucursal 2 pueden asignar, editar tareas, revisar croquis y autorizar entregas o delivery."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEditAndAssign ? (
            <button
              className="button primary text-xs"
              onClick={() => {
                setEditingOrder(null);
                setShowModal("create");
              }}
            >
              <Plus size={14} /> Asignar Nuevo Trabajo a Taller
            </button>
          ) : (
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-3 py-1.5 rounded-lg border border-purple-300">
              ⚡ PC Operario Conectado a Máquina
            </span>
          )}
        </div>
      </section>

      {/* KPI de Producción */}
      <div className="kpi-grid">
        <KpiCard
          title="Trabajos en Cola (Pendientes)"
          value={String(pendingOrders.length)}
          icon={<Clock size={18} />}
          color="peach"
          detail="Por orden de llegada al taller"
        />
        <KpiCard
          title="En Producción Ahora Mismo"
          value={String(inProgressOrders.length)}
          icon={<Play size={18} />}
          color="purple"
          detail="Máquinas operando activamente"
        />
        <KpiCard
          title="Listos para Retiro / Delivery"
          value={String(readyOrders.length)}
          icon={<CheckCircle2 size={18} />}
          color="green"
          detail="Esperando validación de sucursal"
        />
        <KpiCard
          title="Total Asignados a Taller"
          value={String(orders.length)}
          icon={<Layers size={18} />}
          color="blue"
          detail="Historial de la estación"
        />
      </div>

      {/* DASHBOARD DE RÉCORD, PROMEDIOS Y MÉTRICAS DE OPERARIOS */}
      <OperatorPerformanceDashboard />

      {/* Selector de Estación de Trabajo (DTF I3200, Bordadora y Taller de Costura) */}
      <div className="tabs">
        <button
          className={activeStation === "all" ? "active" : ""}
          onClick={() => setActiveStation("all")}
          disabled={Boolean(currentUser?.stationAccess && currentUser.stationAccess !== "all")}
        >
          <Layers size={16} /> Vista General ({data.productionOrders.length})
        </button>
        <button
          className={activeStation === "plotter_dtf" ? "active" : ""}
          onClick={() => setActiveStation("plotter_dtf")}
        >
          <Sparkles size={16} /> Terminal 1 · Plotter DTF I3200 (
          {data.productionOrders.filter((o) => o.station === "plotter_dtf").length})
        </button>
        <button
          className={activeStation === "bordadora" ? "active" : ""}
          onClick={() => setActiveStation("bordadora")}
        >
          <Printer size={16} /> Terminal 2 · Bordadora Meistergram 8 Cabezales (
          {data.productionOrders.filter((o) => o.station === "bordadora").length})
        </button>
        <button
          className={activeStation === "corte_confeccion" ? "active" : ""}
          onClick={() => setActiveStation("corte_confeccion")}
        >
          <Scissors size={16} /> Terminal 3 · Taller de Costura &amp; Confección (
          {data.productionOrders.filter((o) => o.station === "corte_confeccion").length})
        </button>
      </div>

      {/* Tablero Kanban Operativo por Orden de Llegada */}
      <div className="production-kanban-board">
        {/* COLUMNA 1: PENDIENTES POR ORDEN DE LLEGADA */}
        <div className="kanban-column">
          <div className="kanban-col-header bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200">
            <span className="flex items-center gap-1.5 font-bold text-xs">
              <Clock size={14} className="text-amber-600" /> 1. Pendientes (Orden de Llegada)
            </span>
            <span className="count-pill bg-amber-200/60 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-bold">
              {pendingOrders.length}
            </span>
          </div>

          <div className="space-y-3 mt-3">
            {pendingOrders.length === 0 ? (
              <div className="empty-kanban-slot">No hay trabajos en espera en esta estación.</div>
            ) : (
              pendingOrders.map((o) => (
                <div key={o.id} className="production-card border-l-4 border-l-amber-500 shadow-sm relative">
                  <div className="flex items-start justify-between gap-2">
                    <span className="order-tag font-mono font-bold">{o.orderNumber}</span>
                    <div className="flex items-center gap-1">
                      {canEditAndAssign && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrder(o);
                            setShowModal("edit");
                          }}
                          className="text-[10px] text-purple-700 hover:text-purple-900 font-semibold p-1 rounded hover:bg-purple-100 flex items-center gap-0.5"
                          title="Editar orden"
                        >
                          <Pencil size={11} /> Editar
                        </button>
                      )}
                      <span
                        className={`priority-pill ${
                          o.priority === "urgente"
                            ? "bg-red-100 text-red-700"
                            : o.priority === "alta"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {o.priority.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-1.5">{o.customerName}</h4>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    {o.items.map((it, idx) => (
                      <span key={idx}>
                        • {it.quantity} {it.name} {it.details ? `(${it.details})` : ""}
                      </span>
                    ))}
                  </div>

                  {/* Ficha técnica resumida para el operario */}
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs space-y-1 mt-2 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Maximize2 size={13} className="text-purple-600 flex-shrink-0" />
                      <span><strong>Medidas:</strong> {o.dimensions || "Estándar"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Palette size={13} className="text-purple-600 flex-shrink-0" />
                      <span><strong>Colores:</strong> {o.colors || "CMYK + Blanco"}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Shirt size={13} className="text-purple-600 flex-shrink-0" />
                      <span><strong>Prenda / Tela:</strong> {o.garmentType || "Prenda textil"}</span>
                    </div>
                    {o.embroideryPlacement && (
                      <div className="flex items-start justify-between gap-1 text-purple-700 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/40 p-1.5 rounded border border-purple-200 dark:border-purple-800">
                        <span className="flex items-center gap-1">
                          <Shirt size={13} className="text-purple-600 flex-shrink-0" />
                          <span><strong>Ubicación:</strong> {o.embroideryPlacement}</span>
                        </span>
                        {/* Botón para abrir el Croquis Visual en Grande */}
                        <button
                          type="button"
                          onClick={() => setCroquisViewerOrder(o)}
                          className="text-[10px] text-purple-700 underline font-bold flex items-center gap-0.5 ml-1"
                        >
                          <Eye size={11} /> Ver Croquis
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Saldo de pago */}
                  {o.pendingBalance > 0 && (
                    <div className="mt-1.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-1 rounded border border-amber-200">
                      Saldo restante por cobrar: <strong>{money(o.pendingBalance)}</strong>
                    </div>
                  )}

                  {/* Descarga fácil del archivo de arte para el operario */}
                  <div className="mt-2.5 p-2 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded flex items-center justify-between text-xs gap-2">
                    <div className="truncate flex-1">
                      <span className="font-semibold text-purple-900 dark:text-purple-200 block truncate text-[11px]">
                        📁 {o.fileName || "Arte_Cliente_Vector.png"}
                      </span>
                      <small className="text-purple-700 dark:text-purple-400 text-[9px]">{o.fileSize}</small>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        className="button primary py-1 px-2 text-[10px] h-7 bg-purple-600 hover:bg-purple-700 flex items-center gap-1"
                        onClick={() => handleDownloadFile(o)}
                        title="Descargar archivo del cliente al PC de la máquina"
                      >
                        <Download size={12} /> Bajar
                      </button>
                      <button
                        className="button secondary py-1 px-1.5 text-[10px] h-7"
                        onClick={() => handlePrintOrderSheet(o)}
                        title="Imprimir Ficha de Taller"
                      >
                        <Printer size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Instrucciones exactas */}
                  {o.notes && (
                    <div className="mt-2 text-[10px] text-slate-600 dark:text-slate-400 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded border border-amber-200/60">
                      <strong>Observación Operario:</strong> {o.notes}
                    </div>
                  )}

                  {/* Acción del operario */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <span className="text-[10px] text-slate-400">{dateLabel(o.createdAt, true)}</span>
                    <button
                      className="button primary text-xs py-1 px-3 h-8"
                      disabled={busyId === o.id}
                      onClick={() => handleUpdateStatus(o.id, "en_proceso")}
                    >
                      <Play size={13} /> {busyId === o.id ? "Iniciando..." : "Iniciar Trabajo"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMNA 2: EN PROCESO EN MÁQUINA */}
        <div className="kanban-column">
          <div className="kanban-col-header bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-900 dark:text-purple-200">
            <span className="flex items-center gap-1.5 font-bold text-xs">
              <Play size={14} className="text-purple-600" /> 2. En Proceso en Máquina
            </span>
            <span className="count-pill bg-purple-200/60 dark:bg-purple-800 text-purple-900 dark:text-purple-100 font-bold">
              {inProgressOrders.length}
            </span>
          </div>

          <div className="space-y-3 mt-3">
            {inProgressOrders.length === 0 ? (
              <div className="empty-kanban-slot">Ningún trabajo activo en máquina ahora mismo.</div>
            ) : (
              inProgressOrders.map((o) => (
                <div key={o.id} className="production-card border-l-4 border-l-purple-600 shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <span className="order-tag font-mono font-bold text-purple-700 dark:text-purple-300">
                      {o.orderNumber}
                    </span>
                    <div className="flex items-center gap-1">
                      {canEditAndAssign && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrder(o);
                            setShowModal("edit");
                          }}
                          className="text-[10px] text-purple-700 hover:text-purple-900 font-semibold p-1 rounded hover:bg-purple-100 flex items-center gap-0.5"
                        >
                          <Pencil size={11} />
                        </button>
                      )}
                      <span className="animate-pulse flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-600 inline-block" /> En Producción Activa
                      </span>
                    </div>
                  </div>

                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-1.5">{o.customerName}</h4>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    {o.items.map((it, idx) => (
                      <span key={idx}>
                        • {it.quantity} {it.name} {it.details ? `(${it.details})` : ""}
                      </span>
                    ))}
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs space-y-1 mt-2 border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Maximize2 size={13} className="text-purple-600 flex-shrink-0" />
                      <span><strong>Medidas:</strong> {o.dimensions}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Palette size={13} className="text-purple-600 flex-shrink-0" />
                      <span><strong>Colores:</strong> {o.colors}</span>
                    </div>
                    {o.embroideryPlacement && (
                      <div className="flex items-start justify-between gap-1 text-purple-700 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/40 p-1.5 rounded border border-purple-200 dark:border-purple-800">
                        <span className="flex items-center gap-1">
                          <Shirt size={13} className="text-purple-600 flex-shrink-0" />
                          <span><strong>Ubicación:</strong> {o.embroideryPlacement}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setCroquisViewerOrder(o)}
                          className="text-[10px] text-purple-700 underline font-bold flex items-center gap-0.5 ml-1"
                        >
                          <Eye size={11} /> Ver Croquis
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 p-2 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded flex items-center justify-between text-xs gap-2">
                    <div className="truncate flex-1">
                      <span className="font-semibold text-purple-900 dark:text-purple-200 block truncate text-[11px]">
                        📁 {o.fileName}
                      </span>
                    </div>
                    <button
                      className="button primary py-1 px-2 text-[10px] h-7 bg-purple-600 hover:bg-purple-700 flex items-center gap-1"
                      onClick={() => handleDownloadFile(o)}
                    >
                      <Download size={12} /> Bajar
                    </button>
                    <button
                      className="button secondary py-1 px-1.5 text-[10px] h-7"
                      onClick={() => handlePrintOrderSheet(o)}
                    >
                      <Printer size={12} />
                    </button>
                  </div>

                  {o.notes && (
                    <div className="mt-2 text-[10px] text-slate-600 dark:text-slate-400 bg-amber-50/50 p-2 rounded border border-amber-200/60">
                      <strong>Observación:</strong> {o.notes}
                    </div>
                  )}

                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <button
                      className="button secondary text-xs py-1 px-2.5 h-8"
                      disabled={busyId === o.id}
                      onClick={() => handleUpdateStatus(o.id, "pendiente")}
                    >
                      Pausar
                    </button>
                    <button
                      className="button primary text-xs py-1 px-3 h-8 bg-emerald-600 hover:bg-emerald-700 border-none"
                      disabled={busyId === o.id}
                      onClick={() => handleUpdateStatus(o.id, "listo_para_retirar")}
                    >
                      <CheckCircle2 size={13} /> {busyId === o.id ? "Guardando..." : "Marcar Terminado / Listo"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* COLUMNA 3: LISTOS PARA RETIRAR EN OFICINA O DESPACHO POR DELIVERY */}
        <div className="kanban-column">
          <div className="kanban-col-header bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200">
            <span className="flex items-center gap-1.5 font-bold text-xs">
              <CheckCircle2 size={14} className="text-emerald-600" /> 3. Oficina (Listo para Entrega / Delivery)
            </span>
            <span className="count-pill bg-emerald-200/60 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 font-bold">
              {readyOrders.length}
            </span>
          </div>

          <div className="space-y-3 mt-3">
            {readyOrders.length === 0 ? (
              <div className="empty-kanban-slot">No hay pedidos pendientes de entrega al cliente.</div>
            ) : (
              readyOrders.map((o) => (
                <div key={o.id} className="production-card border-l-4 border-l-emerald-600 shadow-sm bg-emerald-50/20 dark:bg-emerald-950/10">
                  <div className="flex items-start justify-between gap-2">
                    <span className="order-tag font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      {o.orderNumber}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                      Listo en Recepción
                    </span>
                  </div>

                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-1.5">{o.customerName}</h4>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    {o.items.map((it, idx) => (
                      <span key={idx}>
                        • {it.quantity} {it.name}
                      </span>
                    ))}
                  </div>

                  <div className="mt-2 text-xs space-y-1 text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Phone size={13} className="text-emerald-600" />
                      <span>{o.customerPhone || "Sin teléfono registrado"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail size={13} className="text-emerald-600" />
                      <span>{o.customerEmail || "Sin correo"}</span>
                    </div>
                  </div>

                  {/* Estado de pago del pedido */}
                  <div className="mt-2 p-2 bg-white dark:bg-slate-900 border rounded-lg text-xs flex items-center justify-between">
                    <span>Estado del Pago:</span>
                    <strong className={o.pendingBalance > 0 ? "text-amber-700 font-bold" : "text-emerald-600 font-bold"}>
                      {o.pendingBalance > 0 ? `Pendiente ${money(o.pendingBalance)}` : "✓ 100% Pagado"}
                    </strong>
                  </div>

                  {/* Modalidad de entrega */}
                  <div className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Truck size={13} className="text-purple-600" />
                    <span>
                      <strong>Modalidad:</strong>{" "}
                      {o.deliveryType === "delivery_regional"
                        ? "Delivery Regional (Caracas)"
                        : o.deliveryType === "delivery_nacional"
                        ? "Envío Nacional (Encomienda)"
                        : "Retiro en Oficina Principal"}
                    </span>
                  </div>

                  {/* Estado de Notificación al cliente */}
                  <div className="mt-2.5 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <Send size={13} className="text-emerald-600" /> Notificación:
                      </span>
                      {o.notificationSent ? (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Enviada (Email &amp; SMS)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600">Pendiente de autorizar</span>
                      )}
                    </div>
                  </div>

                  {/* Validación de Dueño y Sucursales para Autorizar Notificación / Delivery */}
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2">
                    {canEditAndAssign ? (
                      <>
                        <button
                          className="button primary text-xs py-1.5 px-3 h-auto flex-1 bg-purple-700 hover:bg-purple-800 text-white flex items-center justify-center gap-1.5"
                          onClick={() => setDeliveryModalOrder(o)}
                        >
                          <Truck size={13} /> Autorizar Retiro / Delivery
                        </button>
                        <button
                          className="button secondary text-xs py-1 px-2.5 h-8 bg-slate-800 text-white hover:bg-slate-900 border-none"
                          disabled={busyId === o.id}
                          onClick={() => handleUpdateStatus(o.id, "entregado")}
                        >
                          Entregado
                        </button>
                      </>
                    ) : (
                      <div className="w-full text-center py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/40 rounded">
                        ✓ Trabajo finalizado por la máquina. Alerta enviada a Sucursal.
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL PARA CREAR O EDITAR ORDEN DE TRABAJO */}
      {showModal && (
        <ProductionOrderFormModal
          data={data}
          order={editingOrder}
          onClose={() => {
            setShowModal(null);
            setEditingOrder(null);
          }}
          onSuccess={() => {
            setShowModal(null);
            setEditingOrder(null);
          }}
        />
      )}

      {/* MODAL DE AUTORIZACIÓN DE RETIRO / DELIVERY Y PAGO RESTANTE */}
      {deliveryModalOrder && (
        <DeliveryNotificationModal
          order={deliveryModalOrder}
          data={data}
          money={money}
          onClose={() => setDeliveryModalOrder(null)}
          onSuccess={() => setDeliveryModalOrder(null)}
        />
      )}

      {/* MODAL VISUALIZADOR DE CROQUIS PARA EL OPERADOR */}
      {croquisViewerOrder && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => e.target === e.currentTarget && setCroquisViewerOrder(null)}
        >
          <div className="modal wide" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>Croquis Técnico y Ubicación Exacta del Logo</h2>
                <p>
                  Orden: <strong className="text-purple-600">{croquisViewerOrder.orderNumber}</strong> · Cliente:{" "}
                  {croquisViewerOrder.customerName}
                </p>
              </div>
              <button className="icon-button modal-close" onClick={() => setCroquisViewerOrder(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <GarmentCroquisViewer
                croquisData={croquisViewerOrder.croquisData}
                defaultGarment={croquisViewerOrder.garmentType}
                placementText={croquisViewerOrder.embroideryPlacement}
              />
            </div>
            <div className="modal-footer">
              <button className="button primary" onClick={() => setCroquisViewerOrder(null)}>
                Cerrar Visor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== LISTA PLEGABLE DE TRABAJO POR ORDEN DE LLEGADA (SOLO LECTURA PARA OPERARIOS) =====
function ProductionOrderCard({ order, variant, expanded, onToggle, canEdit, busyId, money, handlers }: {
  order: ProductionOrder; variant: "pending" | "inprogress" | "ready"; expanded: boolean; onToggle: () => void;
  canEdit: boolean; busyId: number | null; money: (v: number) => string;
  handlers: {
    onEdit: (o: ProductionOrder) => void; onCroquis: (o: ProductionOrder) => void;
    onDownload: (o: ProductionOrder) => void; onPrint: (o: ProductionOrder) => void;
    onStatus: (id: number, status: string) => void; onDelivery: (o: ProductionOrder) => void;
  };
}) {
  const o = order;
  const accent = variant === "pending" ? "border-l-amber-500" : variant === "inprogress" ? "border-l-purple-600" : "border-l-emerald-600";
  const title = o.items.map((it) => `${it.quantity} ${it.name}`).join(" · ") || "Trabajo de taller";
  return (
    <div
      className={`production-card border-l-4 ${accent} shadow-sm`}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onToggle(); } }}
        className="flex items-start justify-between gap-2 cursor-pointer select-none"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="order-tag font-mono font-bold">{o.orderNumber}</span>
            <span className={`priority-pill ${o.priority === "urgente" ? "bg-red-100 text-red-700" : o.priority === "alta" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{o.priority.toUpperCase()}</span>
          </div>
          <h4 className="font-extrabold text-[13px] text-slate-900 dark:text-white mt-1.5 truncate">{o.customerName}</h4>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{title}</p>
        </div>
        <span className="text-slate-400 text-lg leading-none pt-1">{expanded ? "▴" : "▾"}</span>
      </div>

      {expanded && (
        <div className="order-card-details mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg text-xs space-y-1.5 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"><Maximize2 size={13} className="text-purple-600 flex-shrink-0" /><span><strong>Medidas:</strong> {o.dimensions || "Estándar"}</span></div>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"><Palette size={13} className="text-purple-600 flex-shrink-0" /><span><strong>Colores/Hilos:</strong> {o.colors || "CMYK + Blanco"}</span></div>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300"><Shirt size={13} className="text-purple-600 flex-shrink-0" /><span><strong>Prenda/Tela:</strong> {o.garmentType || "Prenda textil"}</span></div>
            {o.embroideryPlacement && (
              <div className="flex items-start justify-between gap-1 text-purple-700 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/40 p-1.5 rounded border border-purple-200 dark:border-purple-800">
                <span className="flex items-center gap-1"><Shirt size={13} className="flex-shrink-0" /><span><strong>Ubicación:</strong> {o.embroideryPlacement}</span></span>
                <button type="button" onClick={(e) => { e.stopPropagation(); handlers.onCroquis(o); }} className="text-[10px] text-purple-700 underline font-bold flex items-center gap-0.5 ml-1"><Eye size={11} /> Ver Croquis</button>
              </div>
            )}
          </div>

          {o.pendingBalance > 0 && (
            <div className="text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-1.5 rounded border border-amber-200">
              Saldo restante por cobrar: <strong>{money(o.pendingBalance)}</strong>
            </div>
          )}

          <div className="p-2 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded flex items-center justify-between text-xs gap-2">
            <div className="truncate flex-1">
              <span className="font-semibold text-purple-900 dark:text-purple-200 block truncate text-[11px]">📁 {o.fileName || "Arte_Cliente.png"}</span>
              <small className="text-purple-700 dark:text-purple-400 text-[9px]">{o.fileSize}</small>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button type="button" className="button primary py-1 px-2 text-[10px] h-7 bg-purple-600 hover:bg-purple-700 flex items-center gap-1" onClick={(e) => { e.stopPropagation(); handlers.onDownload(o); }}><Download size={12} /> Bajar</button>
              <button type="button" className="button secondary py-1 px-1.5 text-[10px] h-7" onClick={(e) => { e.stopPropagation(); handlers.onPrint(o); }}><Printer size={12} /></button>
            </div>
          </div>

          {o.notes && (
            <div className="text-[10px] text-slate-600 dark:text-slate-400 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded border border-amber-200/60"><strong>Instrucción operario:</strong> {o.notes}</div>
          )}

          {variant === "ready" && (
            <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5"><Truck size={13} className="text-purple-600" /><span><strong>Modalidad:</strong> {o.deliveryType === "delivery_regional" ? "Delivery Regional" : o.deliveryType === "delivery_nacional" ? "Envío Nacional" : "Retiro en Oficina"}</span></div>
              <div className="flex items-center gap-1.5"><Phone size={13} className="text-emerald-600" /><span>{o.customerPhone || "Sin teléfono"}</span></div>
              <div className="flex items-center gap-1.5"><Mail size={13} className="text-emerald-600" /><span>{o.customerEmail || "Sin correo"}</span></div>
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-2">
            <span className="text-[10px] text-slate-400">{dateLabel(o.createdAt, true)}</span>
            <div className="flex items-center gap-1.5">
              {canEdit && variant === "pending" && (
                <button type="button" className="button secondary text-[10px] py-1 px-2 h-8" onClick={(e) => { e.stopPropagation(); handlers.onEdit(o); }}><Pencil size={12} /> Editar</button>
              )}
              {variant === "pending" && (
                <button type="button" className="button primary text-[11px] py-1 px-3 h-8" disabled={busyId === o.id} onClick={(e) => { e.stopPropagation(); handlers.onStatus(o.id, "en_proceso"); }}><Play size={12} /> {busyId === o.id ? "..." : "Iniciar"}</button>
              )}
              {variant === "inprogress" && (
                <>
                  <button type="button" className="button secondary text-[11px] py-1 px-2.5 h-8" disabled={busyId === o.id} onClick={(e) => { e.stopPropagation(); handlers.onStatus(o.id, "pendiente"); }}>Pausar</button>
                  <button type="button" className="button primary text-[11px] py-1 px-3 h-8 bg-emerald-600 hover:bg-emerald-700 border-none" disabled={busyId === o.id} onClick={(e) => { e.stopPropagation(); handlers.onStatus(o.id, "listo_para_retirar"); }}><CheckCircle2 size={12} /> {busyId === o.id ? "..." : "Terminar"}</button>
                </>
              )}
              {variant === "ready" && canEdit && (
                <>
                  <button type="button" className="button primary text-[11px] py-1 px-3 h-8 bg-purple-700 hover:bg-purple-800 text-white" onClick={(e) => { e.stopPropagation(); handlers.onDelivery(o); }}><Truck size={12} /> Autorizar Entrega</button>
                  <button type="button" className="button secondary text-[11px] py-1 px-2.5 h-8 bg-slate-800 text-white border-none" disabled={busyId === o.id} onClick={(e) => { e.stopPropagation(); handlers.onStatus(o.id, "entregado"); }}>Entregado</button>
                </>
              )}
              {variant === "ready" && !canEdit && (
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/40 px-2 py-1 rounded">✓ Listo para retirar en oficina</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== VISTA PRINCIPAL DE TALLER Y ESTACIONES (SEMI-AISLADA POR OPERARIO) =====
export function ProductionView() {
  const { data, mutate, notify, currentUser, money } = useApp();
  const isOperator = ["operator_dtf", "operator_bordadora", "operator_corte_confeccion"].includes(currentUser?.role || "");
  const operatorStation = isOperator ? (currentUser?.stationAccess as string) : null;
  const canEditAndAssign = !isOperator;
  const initialStation = operatorStation || "all";
  const [activeStation, setActiveStation] = useState<"all" | "plotter_dtf" | "bordadora" | "corte_confeccion">(initialStation as any);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState<"create" | "edit" | null>(null);
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null);
  const [deliveryModalOrder, setDeliveryModalOrder] = useState<ProductionOrder | null>(null);
  const [croquisViewerOrder, setCroquisViewerOrder] = useState<ProductionOrder | null>(null);

  // AISLAMIENTO: el operario solo ve sus trabajos asignados a su máquina
  const orders = (data.productionOrders || []).filter((o) =>
    operatorStation ? o.station === operatorStation : activeStation === "all" || o.station === activeStation
  );
  const pendingOrders = orders.filter((o) => o.status === "pendiente");
  const inProgressOrders = orders.filter((o) => o.status === "en_proceso");
  const readyOrders = orders.filter((o) => o.status === "listo_para_retirar");

  const handleUpdateStatus = async (orderId: number, newStatus: string) => {
    setBusyId(orderId);
    try {
      await mutate("production.updateStatus", { id: orderId, status: newStatus, operatorName: currentUser?.name || "Operario" },
        newStatus === "listo_para_retirar" ? "Trabajo terminado. Alerta enviada a la oficina para entrega o delivery." : "Estado de la orden actualizado");
    } catch (err) { notify((err as Error).message, true); } finally { setBusyId(null); }
  };

  const handleDownloadFile = (order: ProductionOrder) => {
    const filename = order.fileName || `Arte_${order.orderNumber}.png`;
    if (order.fileUrl && order.fileUrl.startsWith("data:")) {
      const link = document.createElement("a");
      link.href = order.fileUrl; link.download = filename;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      notify(`Descargando archivo: ${filename}`);
    } else if (order.fileUrl && order.fileUrl.startsWith("http")) {
      window.open(order.fileUrl, "_blank");
    } else {
      const blob = new Blob([`FICHA ${order.orderNumber}\nCliente: ${order.customerName}\nMedidas: ${order.dimensions}\nColores: ${order.colors}\nUbicación: ${order.embroideryPlacement || "Estándar"}\nInstrucciones: ${order.notes}`], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = `FICHA_${order.orderNumber}.txt`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      notify(`Descargando ficha técnica: ${order.orderNumber}`);
    }
  };

  const handlePrintOrderSheet = (order: ProductionOrder) => {
    try {
      printReport(`HOJA TÉCNICA DE PRODUCCIÓN · ${order.orderNumber}`, [
        { Parámetro: "N° Orden", Especificación: order.orderNumber },
        { Parámetro: "Estación", Especificación: order.station === "plotter_dtf" ? "PLOTTER DTF INDUSTRIAL I3200" : order.station === "bordadora" ? "BORDADORA MEISTERGRAM 8 CABEZALES" : "TALLER DE COSTURA Y CONFECCIÓN" },
        { Parámetro: "Cliente", Especificación: order.customerName },
        { Parámetro: "Teléfono", Especificación: order.customerPhone || "—" },
        { Parámetro: "Medidas", Especificación: order.dimensions || "Según archivo" },
        { Parámetro: "Colores / Hilos", Especificación: order.colors || "—" },
        { Parámetro: "Prenda / Tela", Especificación: order.garmentType || "—" },
        { Parámetro: "Ubicación", Especificación: order.embroideryPlacement || "Frente" },
        { Parámetro: "Archivo de arte", Especificación: `${order.fileName} (${order.fileSize})` },
        { Parámetro: "Instrucciones", Especificación: order.notes || "Según especificaciones técnicas" },
      ], data.settings.legalName, `Terminal: ${order.stationIpOrDevice || "Taller Principal"}`);
    } catch (e) { notify((e as Error).message, true); }
  };

  const handlers = {
    onEdit: (o: ProductionOrder) => { if (!canEditAndAssign) return; setEditingOrder(o); setShowModal("edit"); },
    onCroquis: (o: ProductionOrder) => setCroquisViewerOrder(o),
    onDownload: handleDownloadFile,
    onPrint: handlePrintOrderSheet,
    onStatus: handleUpdateStatus,
    onDelivery: (o: ProductionOrder) => { if (!canEditAndAssign) return; setDeliveryModalOrder(o); },
  };

  return (
    <div className="module-stack">
      {canEditAndAssign && readyOrders.length > 0 && (
        <div className="p-3.5 bg-gradient-to-r from-emerald-500 to-teal-700 text-white rounded-xl shadow-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <BellRing size={20} className="text-emerald-100" />
            <div>
              <strong className="block text-sm font-extrabold">¡{readyOrders.length} trabajo(s) terminado(s) por los operarios!</strong>
              <p className="text-xs text-emerald-100 m-0">Autoriza el retiro en oficina o el despacho por Delivery Regional / Nacional.</p>
            </div>
          </div>
          <button className="button secondary text-xs bg-white text-emerald-900 border-none font-bold shadow-xs py-1.5 px-3 h-auto" onClick={() => setActiveStation("all")}>Ver trabajos listos</button>
        </div>
      )}

      <section className="production-header-banner">
        <div className="flex items-center gap-3">
          <div className="production-icon-badge"><MonitorCheck size={26} /></div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 dark:text-purple-300">TERMINAL DE TALLER &amp; PRODUCCIÓN</span>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">{isOperator ? `Mi cola de trabajo · ${currentUser?.stationAccess === "plotter_dtf" ? "Plotter DTF I3200" : currentUser?.stationAccess === "bordadora" ? "Bordadora Meistergram 8 Cabezales" : "Taller de Costura"}` : "Cola de trabajo por orden de llegada (DTF, Bordados y Costura)"}</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">{isOperator ? "Solo ves tus trabajos asignados. El croquis y la orden son de solo lectura: toca el título para ver los detalles." : "Dueño y Sucursales asignan, editan, revisan croquis y autorizan entregas o delivery."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEditAndAssign ? (
            <button className="button primary text-xs" onClick={() => { setEditingOrder(null); setShowModal("create"); }}><Plus size={14} /> Asignar Nuevo Trabajo a Taller</button>
          ) : (
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-3 py-1.5 rounded-lg border border-purple-300">🔒 Vista de solo lectura · Operario</span>
          )}
        </div>
      </section>

      <div className="kpi-grid">
        <KpiCard title="Trabajos en Cola" value={String(pendingOrders.length)} icon={<Clock size={18} />} color="peach" detail="Por orden de llegada" />
        <KpiCard title="En Producción" value={String(inProgressOrders.length)} icon={<Play size={18} />} color="purple" detail="Máquina operando" />
        <KpiCard title="Listos para Entrega" value={String(readyOrders.length)} icon={<CheckCircle2 size={18} />} color="green" detail="Esperando validación" />
        <KpiCard title="Total de mi Estación" value={String(orders.length)} icon={<Layers size={18} />} color="blue" detail={isOperator ? "Solo tus trabajos asignados" : "Historial de la estación"} />
      </div>

      {/* RÉCORD Y ESTADÍSTICAS: los operarios solo ven el rendimiento de SU máquina */}
      <OperatorPerformanceDashboard lockedStation={operatorStation} />

      {!operatorStation && (
        <div className="tabs">
          <button className={activeStation === "all" ? "active" : ""} onClick={() => setActiveStation("all")}><Layers size={16} /> Vista General ({data.productionOrders.length})</button>
          <button className={activeStation === "plotter_dtf" ? "active" : ""} onClick={() => setActiveStation("plotter_dtf")}><Sparkles size={16} /> Terminal 1 · Plotter DTF I3200 ({data.productionOrders.filter((o) => o.station === "plotter_dtf").length})</button>
          <button className={activeStation === "bordadora" ? "active" : ""} onClick={() => setActiveStation("bordadora")}><Printer size={16} /> Terminal 2 · Bordadora Meistergram 8 Cabezales ({data.productionOrders.filter((o) => o.station === "bordadora").length})</button>
          <button className={activeStation === "corte_confeccion" ? "active" : ""} onClick={() => setActiveStation("corte_confeccion")}><Scissors size={16} /> Terminal 3 · Taller de Costura ({data.productionOrders.filter((o) => o.station === "corte_confeccion").length})</button>
        </div>
      )}

      <div className="production-kanban-board">
        <div className="kanban-column">
          <div className="kanban-col-header bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200">
            <span className="flex items-center gap-1.5 font-bold text-xs"><Clock size={14} className="text-amber-600" /> 1. Pendientes (Orden de llegada)</span>
            <span className="count-pill bg-amber-200/60 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-bold">{pendingOrders.length}</span>
          </div>
          <div className="space-y-2.5 mt-3">
            {pendingOrders.length === 0 ? <div className="empty-kanban-slot">Sin trabajos en espera.</div> : pendingOrders.map((o) => (
              <ProductionOrderCard key={o.id} order={o} variant="pending" expanded={expandedId === o.id} onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)} canEdit={canEditAndAssign} busyId={busyId} money={money} handlers={handlers} />
            ))}
          </div>
        </div>

        <div className="kanban-column">
          <div className="kanban-col-header bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-900 dark:text-purple-200">
            <span className="flex items-center gap-1.5 font-bold text-xs"><Play size={14} className="text-purple-600" /> 2. En Proceso</span>
            <span className="count-pill bg-purple-200/60 dark:bg-purple-800 text-purple-900 dark:text-purple-100 font-bold">{inProgressOrders.length}</span>
          </div>
          <div className="space-y-2.5 mt-3">
            {inProgressOrders.length === 0 ? <div className="empty-kanban-slot">Sin trabajos activos.</div> : inProgressOrders.map((o) => (
              <ProductionOrderCard key={o.id} order={o} variant="inprogress" expanded={expandedId === o.id} onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)} canEdit={canEditAndAssign} busyId={busyId} money={money} handlers={handlers} />
            ))}
          </div>
        </div>

        <div className="kanban-column">
          <div className="kanban-col-header bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200">
            <span className="flex items-center gap-1.5 font-bold text-xs"><CheckCircle2 size={14} className="text-emerald-600" /> 3. Listos para Entrega</span>
            <span className="count-pill bg-emerald-200/60 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 font-bold">{readyOrders.length}</span>
          </div>
          <div className="space-y-2.5 mt-3">
            {readyOrders.length === 0 ? <div className="empty-kanban-slot">Sin pedidos para entregar.</div> : readyOrders.map((o) => (
              <ProductionOrderCard key={o.id} order={o} variant="ready" expanded={expandedId === o.id} onToggle={() => setExpandedId(expandedId === o.id ? null : o.id)} canEdit={canEditAndAssign} busyId={busyId} money={money} handlers={handlers} />
            ))}
          </div>
        </div>
      </div>

      {showModal && (
        <ProductionOrderFormModal data={data} order={editingOrder} onClose={() => { setShowModal(null); setEditingOrder(null); }} onSuccess={() => { setShowModal(null); setEditingOrder(null); }} />
      )}

      {deliveryModalOrder && (
        <DeliveryNotificationModal order={deliveryModalOrder} data={data} money={money} onClose={() => setDeliveryModalOrder(null)} onSuccess={() => setDeliveryModalOrder(null)} />
      )}

      {croquisViewerOrder && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setCroquisViewerOrder(null)}>
          <div className="modal wide" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h2>Croquis Técnico · Solo Lectura</h2>
                <p>Orden: <strong className="text-purple-600">{croquisViewerOrder.orderNumber}</strong> · {croquisViewerOrder.customerName}</p>
              </div>
              <button className="icon-button modal-close" onClick={() => setCroquisViewerOrder(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="p-2.5 mb-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-300">
                🔒 <strong>Modo solo lectura:</strong> el operario puede ver el croquis para cumplir el trabajo, pero no modificar la orden ni las ubicaciones del logo.
              </div>
              <GarmentCroquisViewer croquisData={croquisViewerOrder.croquisData} defaultGarment={croquisViewerOrder.garmentType} placementText={croquisViewerOrder.embroideryPlacement} />
            </div>
            <div className="modal-footer">
              <button className="button primary" onClick={() => setCroquisViewerOrder(null)}>Entendido</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// FORMULARIO MODAL PARA CREAR O EDITAR ORDENES (DUEÑO, SUCURSAL 1 Y SUCURSAL 2)
function ProductionOrderFormModal({
  data,
  order,
  onClose,
  onSuccess,
}: {
  data: any;
  order: ProductionOrder | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { mutate, notify } = useApp();
  const [busy, setBusy] = useState(false);

  const [station, setStation] = useState<"plotter_dtf" | "bordadora" | "corte_confeccion">(
    (order?.station as any) || "plotter_dtf"
  );
  const [customerName, setCustomerName] = useState(order?.customerName || "");
  const [customerPhone, setCustomerPhone] = useState(order?.customerPhone || "");
  const [customerEmail, setCustomerEmail] = useState(order?.customerEmail || "");
  const [itemName, setItemName] = useState(order?.items?.[0]?.name || "Impresión Film DTF Textil");
  const [quantity, setQuantity] = useState(String(order?.items?.[0]?.quantity || 5));
  const [dimensions, setDimensions] = useState(order?.dimensions || "60cm x 5 metros lineales");
  const [colors, setColors] = useState(order?.colors || "CMYK + Blanco W2 100%");
  const [garmentType, setGarmentType] = useState(order?.garmentType || "Transfer para chemises");
  const [notes, setNotes] = useState(order?.notes || "Impresión en espejo. Calibrar temperatura a 130°C.");
  const [priority, setPriority] = useState(order?.priority || "normal");
  const [pendingBalance, setPendingBalance] = useState(String(order?.pendingBalance || 0));

  // Croquis data
  const [croquisResult, setCroquisResult] = useState<{
    croquisData: CroquisData;
    placementText: string;
    dimensionsText: string;
    noEmbroidery: boolean;
  }>({
    croquisData: (order?.croquisData as any) || {
      garmentType: "franela",
      noEmbroidery: false,
      markers: [],
    },
    placementText: order?.embroideryPlacement || "Pecho Izquierdo (Frente)",
    dimensionsText: order?.dimensions || "10x10 cm",
    noEmbroidery: false,
  });

  // Archivo
  const [fileName, setFileName] = useState(order?.fileName || "Arte_Cliente.png");
  const [fileSize, setFileSize] = useState(order?.fileSize || "300 DPI CMYK");
  const [fileDataUrl, setFileDataUrl] = useState<string>(order?.fileUrl || "");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setFileDataUrl(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCustomerSelect = (idStr: string) => {
    const cust = data.customers.find((c: any) => c.id === Number(idStr));
    if (cust) {
      setCustomerName(cust.name);
      setCustomerPhone(cust.phone || "");
      setCustomerEmail(cust.email || "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: any = {
        station,
        customerName,
        customerPhone,
        customerEmail,
        items: [{ name: itemName, quantity: Number(quantity) }],
        dimensions,
        colors,
        garmentType,
        embroideryPlacement: croquisResult?.placementText || order?.embroideryPlacement || "",
        embroiderySide: croquisResult?.croquisData?.markers?.[0]?.side || order?.embroiderySide || "frente",
        croquisData: croquisResult?.croquisData
          ? {
              garmentType: croquisResult.croquisData.garmentType || "franela",
              points: croquisResult.croquisData.markers || [],
            }
          : order?.croquisData || null,
        fileName,
        fileSize,
        fileUrl: fileDataUrl,
        notes,
        priority,
        pendingBalance: Number(pendingBalance) || 0,
      };

      if (order) {
        payload.id = order.id;
        await mutate("production.update", payload, `Orden de producción ${order.orderNumber} editada correctamente`);
      } else {
        await mutate("production.create", payload, "Trabajo asignado exitosamente al taller");
      }
      onClose();
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal wide" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h2>{order ? `Editar Orden ${order.orderNumber}` : "Asignar Trabajo a Taller"}</h2>
            <p>Define especificaciones, croquis con arrastre libre y monto restante para entrega o delivery.</p>
          </div>
          <button className="icon-button modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body space-y-4">
            {/* SELECCIÓN DE ESTACIÓN */}
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl">
              <label className="text-xs font-bold text-purple-900 dark:text-purple-200 block mb-2">
                Estación de Fábrica Cristo Rey:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setStation("plotter_dtf")}
                  className={`p-3 rounded-xl border-2 text-left text-xs transition-all relative overflow-hidden ${
                    station === "plotter_dtf"
                      ? "station-selected-btn bg-purple-700 text-white border-purple-900 shadow-md ring-2 ring-purple-400"
                      : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Sparkles size={18} className={station === "plotter_dtf" ? "text-amber-300" : "text-purple-600"} />
                    {station === "plotter_dtf" && (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-white text-purple-900 px-1.5 py-0.5 rounded shadow-2xs">
                        ✓ ACTIVO
                      </span>
                    )}
                  </div>
                  <strong className="block text-xs font-black">1. Plotter DTF I3200</strong>
                  <small className={`block text-[10.5px] mt-0.5 ${station === "plotter_dtf" ? "text-purple-100" : "text-slate-500"}`}>
                    Impresión transfer en film
                  </small>
                </button>

                <button
                  type="button"
                  onClick={() => setStation("bordadora")}
                  className={`p-3 rounded-xl border-2 text-left text-xs transition-all relative overflow-hidden ${
                    station === "bordadora"
                      ? "station-selected-btn bg-purple-700 text-white border-purple-900 shadow-md ring-2 ring-purple-400"
                      : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Printer size={18} className={station === "bordadora" ? "text-amber-300" : "text-purple-600"} />
                    {station === "bordadora" && (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-white text-purple-900 px-1.5 py-0.5 rounded shadow-2xs">
                        ✓ ACTIVO
                      </span>
                    )}
                  </div>
                  <strong className="block text-xs font-black">2. Bordadora Meistergram</strong>
                  <small className={`block text-[10.5px] mt-0.5 ${station === "bordadora" ? "text-purple-100" : "text-slate-500"}`}>
                    Bordados 8 cabezales
                  </small>
                </button>

                <button
                  type="button"
                  onClick={() => setStation("corte_confeccion")}
                  className={`p-3 rounded-xl border-2 text-left text-xs transition-all relative overflow-hidden ${
                    station === "corte_confeccion"
                      ? "station-selected-btn bg-purple-700 text-white border-purple-900 shadow-md ring-2 ring-purple-400"
                      : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-purple-400"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Scissors size={18} className={station === "corte_confeccion" ? "text-amber-300" : "text-purple-600"} />
                    {station === "corte_confeccion" && (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-white text-purple-900 px-1.5 py-0.5 rounded shadow-2xs">
                        ✓ ACTIVO
                      </span>
                    )}
                  </div>
                  <strong className="block text-xs font-black">3. Taller de Costura</strong>
                  <small className={`block text-[10.5px] mt-0.5 ${station === "corte_confeccion" ? "text-purple-100" : "text-slate-500"}`}>
                    Corte y confección
                  </small>
                </button>
              </div>
            </div>

            {/* CROQUIS INTERACTIVO CON ARRASTRE LIBRE Y ESPECIFICACIÓN POR CADA LOGO */}
            <InteractiveGarmentSelector
              initialData={{
                garmentType: (order?.croquisData?.garmentType as any) || "franela",
                noEmbroidery: order?.embroideryPlacement?.includes("SIN BORDADO") || false,
                markers: (order?.croquisData?.points as any) || [],
              }}
              onChange={(res) => {
                setCroquisResult(res);
                if (res.dimensionsText) setDimensions(res.dimensionsText);
              }}
            />

            {/* SUBIDA FÁCIL DEL ARCHIVO */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Upload size={14} className="text-purple-600" /> Archivo de Arte del Cliente
                </span>
                <span className="text-[10px] text-slate-500 font-mono">PNG, PDF, DST, AI, SVG</span>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,.pdf,.dst,.emb,.ai,.svg"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="button secondary text-xs flex items-center gap-1.5 py-2 px-3 h-auto"
                >
                  <Upload size={14} /> Seleccionar Archivo
                </button>

                <div className="flex-1 truncate text-xs bg-white dark:bg-slate-950 p-2 border rounded-lg">
                  <strong className="text-slate-800 dark:text-slate-200 block truncate">📁 {fileName}</strong>
                  <small className="text-purple-700 dark:text-purple-300 font-mono text-[10px]">{fileSize}</small>
                </div>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Prioridad de Entrega
                <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option value="normal">Normal (Orden de llegada estándar)</option>
                  <option value="alta">Alta (Prioritaria)</option>
                  <option value="urgente">Urgente (Cliente esperando en taller)</option>
                </select>
              </label>

              <label>
                Seleccionar Cliente Registrado
                <select onChange={(e) => handleCustomerSelect(e.target.value)}>
                  <option value="">Cliente Ocasional / Manual</option>
                  {data.customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone || c.email})
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Nombre del Cliente o Empresa
                <input
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej. Uniformes Caracas C.A."
                />
              </label>

              <label>
                Teléfono Celular (Para SMS)
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+58 414 000 0000"
                />
              </label>

              <label className="full-span">
                Correo Electrónico (Para Aviso de Retiro)
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="cliente@correo.com"
                />
              </label>

              <label>
                Descripción del Trabajo
                <input
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Ej. Bordado Pecho o Impresión DTF"
                />
              </label>

              <label>
                Cantidad
                <input
                  type="number"
                  step="any"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>

              <label>
                Medidas y Dimensiones
                <input
                  required
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  placeholder="Ej. 10x10 cm pecho"
                />
              </label>

              <label>
                Colores / Hilos / Tintas
                <input
                  required
                  value={colors}
                  onChange={(e) => setColors(e.target.value)}
                  placeholder="Ej. CMYK + Blanco o Hilos Madeira"
                />
              </label>

              <label>
                Saldo Pendiente por Cobrar ($)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pendingBalance}
                  onChange={(e) => setPendingBalance(e.target.value)}
                  placeholder="0.00 si pagó el 100%"
                />
              </label>

              <label>
                Tipo de Prenda / Tela
                <input
                  value={garmentType}
                  onChange={(e) => setGarmentType(e.target.value)}
                  placeholder="Ej. Chemises piqué azul marino"
                />
              </label>

              <label className="full-span">
                Instrucciones Completas para el Operario
                <textarea
                  rows={3}
                  required
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detalles técnicos para evitar dudas en máquina."
                />
              </label>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={handleSubmit}
            >
              {busy ? "Guardando..." : order ? "Guardar Cambios de Orden" : "Asignar a Taller"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// MODAL PARA QUE DUEÑO Y SUCURSALES AUTORICEN RETIRO O DELIVERY TRAS VALIDAR PAGO RESTANTE
function DeliveryNotificationModal({
  order,
  data,
  money,
  onClose,
  onSuccess,
}: {
  order: ProductionOrder;
  data: any;
  money: (val: number) => string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { mutate, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [deliveryType, setDeliveryType] = useState<"retiro_oficina" | "delivery_regional" | "delivery_nacional">(
    (order.deliveryType as any) || "retiro_oficina"
  );
  const [deliveryAddress, setDeliveryAddress] = useState(order.deliveryAddress || "");
  const [pendingPaid, setPendingPaid] = useState(order.pendingBalance === 0);

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await mutate(
        "production.confirmAndNotify",
        {
          id: order.id,
          deliveryType,
          deliveryAddress,
          pendingPaid,
        },
        `¡Autorización completada! Mensaje enviado al cliente ${order.customerName} indicando modalidad: ${
          deliveryType === "delivery_regional"
            ? "Delivery Regional"
            : deliveryType === "delivery_nacional"
            ? "Envío Nacional"
            : "Retiro en Oficina"
        }`
      );
      onSuccess();
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div>
            <h2>Autorizar Entrega / Despacho de Pedido</h2>
            <p>
              Orden: <strong>{order.orderNumber}</strong> · Cliente: {order.customerName}
            </p>
          </div>
          <button className="icon-button modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleAuthorize}>
          <div className="modal-body space-y-3.5">
            {/* Validación del pago restante */}
            <div
              className={`p-3.5 rounded-xl border ${
                order.pendingBalance > 0 && !pendingPaid
                  ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800"
                  : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <CreditCard size={15} /> Estado de Pago del Cliente:
                </span>
                <strong className={order.pendingBalance > 0 && !pendingPaid ? "text-amber-700 font-bold" : "text-emerald-700 font-bold"}>
                  {order.pendingBalance > 0 ? `Saldo Pendiente: ${money(order.pendingBalance)}` : "✓ 100% Pagado"}
                </strong>
              </div>

              {order.pendingBalance > 0 && (
                <label className="flex items-center gap-2 mt-2 pt-2 border-t border-amber-200 dark:border-amber-900 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={pendingPaid}
                    onChange={(e) => setPendingPaid(e.target.checked)}
                  />
                  <span>
                    <strong>El cliente ya canceló el saldo restante de {money(order.pendingBalance)}</strong> (Marcar como 100% Pagado)
                  </span>
                </label>
              )}
            </div>

            {/* Selección de Modalidad de Despacho */}
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1.5">
                Modalidad de Entrega al Cliente:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType("retiro_oficina")}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    deliveryType === "retiro_oficina"
                      ? "bg-purple-600 text-white border-purple-600 font-bold shadow-xs"
                      : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <MapPin size={15} className="mb-1" />
                  <strong>Retiro en Oficina</strong>
                  <small className="block opacity-80 text-[10px]">Pasa por Los Ruices</small>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType("delivery_regional")}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    deliveryType === "delivery_regional"
                      ? "bg-purple-600 text-white border-purple-600 font-bold shadow-xs"
                      : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Truck size={15} className="mb-1" />
                  <strong>Delivery Regional</strong>
                  <small className="block opacity-80 text-[10px]">Moto / Flete Caracas</small>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType("delivery_nacional")}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    deliveryType === "delivery_nacional"
                      ? "bg-purple-600 text-white border-purple-600 font-bold shadow-xs"
                      : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <Truck size={15} className="mb-1" />
                  <strong>Envío Nacional</strong>
                  <small className="block opacity-80 text-[10px]">MRW / Zoom / Tealca</small>
                </button>
              </div>
            </div>

            {deliveryType !== "retiro_oficina" && (
              <label className="text-xs">
                Dirección de Destino o Agencia de Encomienda:
                <textarea
                  rows={2}
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Ej. Oficina MRW Las Mercedes o Dirección empresa en Valencia..."
                  className="mt-1"
                />
              </label>
            )}

            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-lg text-xs space-y-1 text-purple-900 dark:text-purple-200">
              <span className="font-bold flex items-center gap-1">
                <Send size={13} /> Mensaje Automático a Disparar:
              </span>
              <p className="text-[11px] text-purple-800 dark:text-purple-300 m-0">
                Se enviará un correo a <strong>{order.customerEmail || "No especificado"}</strong> y un SMS a{" "}
                <strong>{order.customerPhone || "No especificado"}</strong> notificando que el pedido #{order.orderNumber} está listo para{" "}
                {deliveryType === "retiro_oficina" ? "retirar en oficina" : "su despacho por delivery"}.
              </p>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? "Enviando..." : "Autorizar y Notificar al Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
