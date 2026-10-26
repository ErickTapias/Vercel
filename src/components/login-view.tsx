"use client";
import { useState, type FormEvent } from "react";
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Moon,
  Sun,
  KeyRound,
  Eye,
  EyeOff,
  Building,
  Printer,
  Sparkles,
  Crown,
  AlertTriangle,
} from "lucide-react";
import type { AppData } from "@/lib/types";
import type { AppUser } from "./app-context";
import { SYSTEM_USERS, authenticate } from "@/lib/auth-config";

export function LoginView({
  data,
  theme,
  toggleTheme,
  onLogin,
}: {
  data: AppData;
  theme: "light" | "dark";
  toggleTheme: () => void;
  onLogin: (user: AppUser) => void;
}) {
  const [email, setEmail] = useState("eliezer.parra@fabricacristorey.com");
  const [password, setPassword] = useState("Eliezer#CristoRey2026$Total");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      const user = authenticate(email, password);
      if (user) {
        onLogin({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          title: user.title,
          branchName: user.branchName,
          stationAccess: user.stationAccess,
          allowedModules: user.allowedModules,
        });
      } else {
        setError("Contraseña o correo incorrecto. Verifica o usa una de las cuentas autorizadas.");
        setLoading(false);
      }
    }, 350);
  };

  const handleSelectAccount = (user: (typeof SYSTEM_USERS)[number]) => {
    setEmail(user.email);
    setPassword(user.passwordHash);
    setError("");
  };

  return (
    <div className={`login-page-container ${theme === "dark" ? "theme-dark" : "theme-light"}`}>
      {/* Botón flotante para alternar tema Noche / Día */}
      <div className="login-top-bar">
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Cambiar a modo Día" : "Cambiar a modo Noche"}
          title={theme === "dark" ? "Modo Día" : "Modo Noche"}
        >
          {theme === "dark" ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-purple-600" />}
          <span>{theme === "dark" ? "Modo Día" : "Modo Noche"}</span>
        </button>
      </div>

      <div className="login-card-wrapper max-w-xl">
        <div className="login-card">
          {/* Cabecera del Login */}
          <div className="login-header">
            <div className="login-brand-line">
              <span className="brand">
                tesorio<span>.</span>
              </span>
              <span className="login-brand-tag">Acceso Seguro v3.0</span>
            </div>
            <p className="login-subtitle">Gestión Multi-Sucursal y Terminales de Taller Seguras</p>

            {/* Insignia de Fábrica Cristo Rey */}
            <div className="login-company-badge">
              <div className="company-logo-slot">
                {data.settings.logoUrl ? (
                  <img src={data.settings.logoUrl} alt={data.settings.businessName} className="company-mini-logo" />
                ) : (
                  <ShieldCheck size={20} className="text-purple-600" />
                )}
              </div>
              <div className="company-text text-left">
                <strong>{data.settings.businessName}</strong>
                <small className="font-mono">{data.settings.rif} · Dos Sucursales Activas</small>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <label>
              Correo Electrónico Autorizado
              <div className="input-with-icon">
                <Mail size={16} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@fabricacristorey.com"
                />
              </div>
            </label>

            <label>
              Contraseña de Alta Seguridad
              <div className="input-with-icon relative">
                <Lock size={16} />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={0}
                  className="password-toggle-eye-btn"
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    setShowPassword((prev) => !prev);
                  }}
                  aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && (
              <div className="form-error text-xs flex items-center gap-1.5 p-2.5 rounded bg-red-50 text-red-700 border border-red-200">
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="button primary full-width login-submit-btn" disabled={loading}>
              {loading ? (
                <span>Verificando credenciales seguras...</span>
              ) : (
                <>
                  Entrar al Sistema <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* SELECCIÓN RÁPIDA DE CUENTAS ASIGNADAS (DUEÑO, SUCURSALES Y OPERADORES) */}
            <div className="demo-credentials-box">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5 uppercase tracking-wide">
                  <KeyRound size={14} className="text-purple-600" /> Cuentas Configuradas con Claves Seguras
                </span>
                <span className="text-[9px] bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 px-2 py-0.5 rounded font-mono font-bold">
                  5 Accesos
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                Haz clic en cualquier cuenta para cargar sus credenciales de alta seguridad:
              </p>

              <div className="space-y-1.5">
                {/* 1. DUEÑO TOTAL: Eliezer Parra */}
                <button
                  type="button"
                  onClick={() => handleSelectAccount(SYSTEM_USERS[0])}
                  className={`w-full p-2 rounded-lg text-left border transition-all text-xs flex items-center justify-between ${
                    email === SYSTEM_USERS[0].email
                      ? "border-purple-600 bg-purple-50 dark:bg-purple-950/60 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                      <Crown size={14} />
                    </span>
                    <div>
                      <strong className="block text-slate-900 dark:text-white text-[11px]">
                        Eliezer Parra (Dueño)
                      </strong>
                      <small className="text-slate-500 text-[9.5px]">
                        Acceso Total &amp; Monitoreo Omnisciente
                      </small>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 rounded">
                    Todo Acceso
                  </span>
                </button>

                {/* 2. SUCURSAL 1: Fábrica Bordados */}
                <button
                  type="button"
                  onClick={() => handleSelectAccount(SYSTEM_USERS[1])}
                  className={`w-full p-2 rounded-lg text-left border transition-all text-xs flex items-center justify-between ${
                    email === SYSTEM_USERS[1].email
                      ? "border-purple-600 bg-purple-50 dark:bg-purple-950/60 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                      <Building size={14} />
                    </span>
                    <div>
                      <strong className="block text-slate-900 dark:text-white text-[11px]">
                        Gerente Sucursal 1 (Fábrica / Bordadora)
                      </strong>
                      <small className="text-slate-500 text-[9.5px]">
                        Sede Industrial Galpón Confección
                      </small>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    Sucursal 1
                  </span>
                </button>

                {/* 3. SUCURSAL 2: Tienda Plotter DTF */}
                <button
                  type="button"
                  onClick={() => handleSelectAccount(SYSTEM_USERS[2])}
                  className={`w-full p-2 rounded-lg text-left border transition-all text-xs flex items-center justify-between ${
                    email === SYSTEM_USERS[2].email
                      ? "border-purple-600 bg-purple-50 dark:bg-purple-950/60 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                      <Sparkles size={14} />
                    </span>
                    <div>
                      <strong className="block text-slate-900 dark:text-white text-[11px]">
                        Gerente Sucursal 2 (DTF Textil)
                      </strong>
                      <small className="text-slate-500 text-[9.5px]">
                        Sede Comercial &amp; Estampado DTF
                      </small>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    Sucursal 2
                  </span>
                </button>

                {/* 4. OPERADOR DTF (PC PLOTTER DTF - AISLADO) */}
                <button
                  type="button"
                  onClick={() => handleSelectAccount(SYSTEM_USERS[3])}
                  className={`w-full p-2 rounded-lg text-left border transition-all text-xs flex items-center justify-between ${
                    email === SYSTEM_USERS[3].email
                      ? "border-purple-600 bg-purple-50 dark:bg-purple-950/60 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-purple-700 text-white flex items-center justify-center flex-shrink-0">
                      <Sparkles size={14} />
                    </span>
                    <div>
                      <strong className="block text-slate-900 dark:text-white text-[11px]">
                        PC Plotter DTF I3200 (Operario Taller)
                      </strong>
                      <small className="text-purple-700 dark:text-purple-400 font-medium text-[9.5px]">
                        🔒 SOLO ve sus órdenes DTF I3200. Sin facturas ni finanzas.
                      </small>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded font-bold">
                    Terminal DTF I3200
                  </span>
                </button>

                {/* 5. OPERADOR BORDADORA (PC BORDADORA - AISLADO) */}
                <button
                  type="button"
                  onClick={() => handleSelectAccount(SYSTEM_USERS[4])}
                  className={`w-full p-2 rounded-lg text-left border transition-all text-xs flex items-center justify-between ${
                    email === SYSTEM_USERS[4].email
                      ? "border-purple-600 bg-purple-50 dark:bg-purple-950/60 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-indigo-700 text-white flex items-center justify-center flex-shrink-0">
                      <Printer size={14} />
                    </span>
                    <div>
                      <strong className="block text-slate-900 dark:text-white text-[11px]">
                        PC Bordadora (Operario Taller)
                      </strong>
                      <small className="text-indigo-700 dark:text-indigo-400 font-medium text-[9.5px]">
                        🔒 SOLO ve órdenes de bordado. Sin facturas ni finanzas.
                      </small>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded font-bold">
                    Terminal Bordado
                  </span>
                </button>

                {/* 6. OPERADOR DE TALLER DE COSTURA (PC COSTURA - AISLADO) */}
                <button
                  type="button"
                  onClick={() => handleSelectAccount(SYSTEM_USERS[5])}
                  className={`w-full p-2 rounded-lg text-left border transition-all text-xs flex items-center justify-between ${
                    email === SYSTEM_USERS[5].email
                      ? "border-purple-600 bg-purple-50 dark:bg-purple-950/60 shadow-xs"
                      : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-teal-700 text-white flex items-center justify-center flex-shrink-0">
                      <Printer size={14} />
                    </span>
                    <div>
                      <strong className="block text-slate-900 dark:text-white text-[11px]">
                        PC Taller de Costura (Operario Confección)
                      </strong>
                      <small className="text-teal-700 dark:text-teal-400 font-medium text-[9.5px]">
                        🔒 SOLO ve órdenes de costura y confección. Sin facturas ni finanzas.
                      </small>
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded font-bold">
                    Terminal Costura
                  </span>
                </button>
              </div>
            </div>
          </form>

          <div className="login-footer">
            <span className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
              <ShieldCheck size={13} className="text-emerald-500" /> Cifrado de Roles y Control de Acceso Estricto
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
