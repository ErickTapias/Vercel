"use client";
import React, { useState } from "react";
import {
  ShieldCheck,
  Download,
  Mail,
  Send,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  FileSpreadsheet,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { useApp } from "./app-context";
import { SectionHead } from "./ui";

export function BackupManagerCard() {
  const { data, notify } = useApp();
  const [busy, setBusy] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState(data.settings.email || "eliezer.parra@fabricacristorey.com");
  const [autoDaily, setAutoDaily] = useState(true);
  const [autoWeekly, setAutoWeekly] = useState(true);
  const [autoMonthly, setAutoMonthly] = useState(true);
  const [lastBackupInfo, setLastBackupInfo] = useState<string | null>(null);

  const handleGenerateBackup = async (type: "daily" | "weekly" | "monthly" | "inventory" | "manual") => {
    setBusy(true);
    try {
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, email: ownerEmail }),
      });
      const result = await res.json();
      if (result.ok) {
        setLastBackupInfo(`Último respaldo (${type.toUpperCase()}): ${result.generatedAt} enviado a ${result.recipient}`);
        notify(result.message);

        // Disparar descarga local en JSON para tener copia inmediata
        const blob = new Blob([JSON.stringify(result.downloadPayload, null, 2)], {
          type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `RESPALDO_TESORIO_SENIAT_${type.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        notify(result.error || "Error generando respaldo", true);
      }
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card p-4 space-y-4 border-2 border-purple-200 dark:border-purple-800">
      <SectionHead
        title="Centro de Respaldos Automáticos SENIAT & Base de Datos"
        subtitle="Copia de seguridad cifrada de libros fiscales, facturas, clientes e inventario enviada por correo al Dueño."
      >
        <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
          <ShieldCheck size={13} /> Sistema de Respaldo Activo
        </span>
      </SectionHead>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Respaldo Diario */}
        <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <strong className="text-xs font-bold text-purple-950 dark:text-purple-100 flex items-center gap-1.5">
              <Clock size={14} className="text-purple-600" /> Cierre Diario (23:59)
            </strong>
            <span className="text-[9px] bg-purple-200/80 dark:bg-purple-900 px-1.5 py-0.5 rounded font-mono font-bold text-purple-900 dark:text-purple-200">
              Diario
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Respalda las facturas emitidas del día, compras, cobranzas e ingresos de inventario.
          </p>
          <button
            type="button"
            className="button secondary text-xs w-full py-1.5 h-auto flex items-center justify-center gap-1.5"
            disabled={busy}
            onClick={() => handleGenerateBackup("daily")}
          >
            <Send size={13} /> Enviar Respaldo del Día
          </button>
        </div>

        {/* Respaldo Semanal */}
        <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <strong className="text-xs font-bold text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" /> Cierre Semanal (Domingos)
            </strong>
            <span className="text-[9px] bg-blue-200/80 dark:bg-blue-900 px-1.5 py-0.5 rounded font-mono font-bold text-blue-900 dark:text-blue-200">
              Semanal
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Consolidado semanal de movimientos, libros fiscales de ambas sucursales y clientes nuevos.
          </p>
          <button
            type="button"
            className="button secondary text-xs w-full py-1.5 h-auto flex items-center justify-center gap-1.5"
            disabled={busy}
            onClick={() => handleGenerateBackup("weekly")}
          >
            <Send size={13} /> Enviar Respaldo Semanal
          </button>
        </div>

        {/* Respaldo Mensual Fiscal SENIAT */}
        <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <strong className="text-xs font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
              <Database size={14} className="text-emerald-600" /> Cierre Mensual Fiscal
            </strong>
            <span className="text-[9px] bg-emerald-200/80 dark:bg-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold text-emerald-900 dark:text-emerald-200">
              Mensual
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">
            Libro de Ventas y Compras completo del mes para declaraciones de IVA e ISLR ante el SENIAT.
          </p>
          <button
            type="button"
            className="button secondary text-xs w-full py-1.5 h-auto flex items-center justify-center gap-1.5"
            disabled={busy}
            onClick={() => handleGenerateBackup("monthly")}
          >
            <Send size={13} /> Enviar Respaldo Mensual
          </button>
        </div>
      </div>

      {/* Configuración de Destinatario y Disparo Inmediato */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          <label className="text-xs">
            Correo Electrónico del Dueño (Destinatario del Respaldo):
            <input
              type="email"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              placeholder="eliezer.parra@fabricacristorey.com"
              className="mt-1"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-4">
            <button
              type="button"
              className="button primary text-xs py-2 px-3 h-auto flex-1 flex items-center justify-center gap-1.5"
              disabled={busy}
              onClick={() => handleGenerateBackup("manual")}
            >
              <Download size={14} /> Descargar y Enviar Copia Completa Ahora
            </button>
            <button
              type="button"
              className="button secondary text-xs py-2 px-3 h-auto flex items-center justify-center gap-1.5"
              disabled={busy}
              onClick={() => handleGenerateBackup("inventory")}
              title="Respaldo específico del inventario de telas y uniformes"
            >
              <FileSpreadsheet size={14} /> Respaldo Inventario
            </button>
          </div>
        </div>

        {lastBackupInfo && (
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{lastBackupInfo}</span>
          </div>
        )}
      </div>
    </section>
  );
}
