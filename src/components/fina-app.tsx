"use client";
import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Wallet,
  Clock3,
  Receipt,
  ChartNoAxesCombined,
  FileChartColumn,
  Users,
  Megaphone,
  Settings,
  ChevronDown,
  ChevronsUpDown,
  Plus,
  Search,
  Bell,
  CircleHelp,
  ArrowUpRight,
  Headphones,
  PanelLeftClose,
  Menu,
  CalendarDays,
  X,
  Check,
  ChevronRight,
  Store,
  FileCheck2,
  Sparkles,
  ShieldCheck,
  Banknote,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
} from "lucide-react";
import type { AppData, Module, CartItem } from "@/lib/types";
import { AppContext, type Period, type DialogState, type MutationResult, type AppUser } from "./app-context";
import { Avatar } from "./ui";
import { Dashboard } from "./dashboard";
import { InventoryView, AccountsView, PendingView, ExpensesView } from "./operations";
import { SalesView } from "./sales";
import { FinanceView, ReportsView, CustomersView, MarketingView, StatisticsView, TeamView, SettingsView } from "./management";
import { AuditView } from "./audit-view";
import { PayrollPanel } from "./payroll-panel";
import { ProductionView } from "./production-view";
import { Dialogs } from "./dialogs";
import { LoginView } from "./login-view";

const navGroups: { label?: string; items: { id: Module; label: string; icon: ReactNode }[] }[] = [
  { items: [{ id: "inicio", label: "Inicio", icon: <LayoutDashboard /> }] },
  {
    label: "OPERACIÓN",
    items: [
      { id: "ventas", label: "Ventas y Facturación", icon: <ShoppingBag /> },
      { id: "inventario", label: "Inventario", icon: <Package /> },
      { id: "produccion", label: "Taller & Estaciones (DTF/Bordado)", icon: <Sparkles /> },
      { id: "cuentas", label: "Cuentas y Bancos", icon: <Wallet /> },
      { id: "pendientes", label: "Cuentas por Cobrar/Pagar", icon: <Clock3 /> },
    ],
  },
  {
    label: "FINANZAS Y SENIAT",
    items: [
      { id: "gastos", label: "Gastos y Egresos", icon: <Receipt /> },
      { id: "nomina", label: "Gestión de Nómina y Recibos", icon: <Banknote /> },
      { id: "auditoria", label: "Libros Fiscales SENIAT", icon: <FileCheck2 /> },
      { id: "financiero", label: "Resumen Financiero", icon: <ChartNoAxesCombined /> },
      { id: "reportes", label: "Reportes", icon: <FileChartColumn /> },
    ],
  },
  {
    label: "CLIENTES Y CRECIMIENTO",
    items: [
      { id: "clientes", label: "Clientes / RIF", icon: <Users /> },
      { id: "marketing", label: "Campañas", icon: <Megaphone /> },
      { id: "estadisticas", label: "Estadísticas", icon: <ChartNoAxesCombined /> },
    ],
  },
];

const pageInfo: Record<Module, { title: string; subtitle: string }> = {
  inicio: { title: "Panel Principal", subtitle: "Control administrativo y fiscal para Fábrica Cristo Rey C.A." },
  ventas: { title: "Punto de Venta y Facturación", subtitle: "Emisión de facturas fiscales digitales con valor legal y envío por correo." },
  inventario: { title: "Inventario", subtitle: "Control de uniformes, insumos, bordados y servicio DTF." },
  produccion: { title: "Taller & Estaciones Operativas", subtitle: "Terminal de trabajo para Plotter DTF y Bordadora industrial con especificaciones completas." },
  cuentas: { title: "Cuentas Bancarias y Caja", subtitle: "Saldos bimonetarios en bolívares y dólares en tiempo real." },
  pendientes: { title: "Cuentas por Cobrar y por Pagar", subtitle: "Seguimiento de saldos pendientes de clientes y proveedores." },
  gastos: { title: "Control de Gastos y Soportes", subtitle: "Diferenciación entre egresos operativos deducibles, caja chica y retiros personales." },
  nomina: { title: "Gestión de Nómina y Recibos de Pago", subtitle: "Cálculo por LOTTT, IVSS, FAOV, INCES e ISLR con recibos, respaldo y envío automático." },
  auditoria: { title: "Auditoría de Libros Fiscales SENIAT", subtitle: "Libro de Ventas y Compras conforme a la Providencia 0071 y PA 102 en PDF y Excel." },
  financiero: { title: "Resumen Financiero", subtitle: "Estado de resultados y rentabilidad de la fábrica." },
  reportes: { title: "Reportes Consolidados", subtitle: "Información gerencial para toma de decisiones." },
  clientes: { title: "Directorio de Clientes", subtitle: "Expediente fiscal y comercial con RIF y correos de facturación." },
  marketing: { title: "Campañas Comerciales", subtitle: "Difusión de servicios de bordado industrial y DTF." },
  estadisticas: { title: "Estadísticas y Métricas", subtitle: "Líneas de producción más demandadas y rendimiento por canal." },
  equipo: { title: "Equipo de Trabajo", subtitle: "Roles y permisos para administradores, operarios y contadores." },
  configuracion: { title: "Configuración de la Empresa", subtitle: "Datos legales, logotipo, tasa BCV y series de facturación SENIAT." },
};

const periods: { id: Period; label: string }[] = [
  { id: "today", label: "Hoy" },
  { id: "week", label: "Últimos 7 días" },
  { id: "month", label: "Este mes" },
  { id: "all", label: "Todo el historial" },
  { id: "custom", label: "Personalizado" },
];

export default function TesorioApp({ initialData }: { initialData: AppData }) {
  const [data, setData] = useState(initialData),
    [module, setModule] = useState<Module>("inicio"),
    [tab, setTab] = useState("");
  const [period, setPeriod] = useState<Period>("month"),
    [currency, setCurrency] = useState<"USD" | "VES">("USD");
  const [customDates, setCustomDates] = useState({
    start: new Date().toISOString().slice(0, 8) + "01",
    end: new Date().toISOString().slice(0, 10),
  });
  const [dialog, setDialog] = useState<DialogState>(null),
    [cart, setCart] = useState<CartItem[]>([]),
    [channel, setChannel] = useState("Tienda física"),
    [tableId, setTableId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null),
    [menu, setMenu] = useState<string | null>(null),
    [mobileNav, setMobileNav] = useState(false),
    [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modo Noche / Día
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Autenticación / Login
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  useEffect(() => {
    // Sincronizar tema persistido
    const savedTheme = localStorage.getItem("tesorio_theme") as "light" | "dark" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setTheme("dark");
    }

    // Sincronizar auth
    const savedAuth = localStorage.getItem("tesorio_auth");
    if (savedAuth) {
      try {
        const parsed = JSON.parse(savedAuth);
        if (parsed && parsed.email) {
          setCurrentUser(parsed);
          setIsAuthenticated(true);
        }
      } catch {
        // use default
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("tesorio_theme", next);
      return next;
    });
  }, []);

  const loginUser = useCallback((user: AppUser) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    // Si el usuario es un operador de máquina, llevarlo de inmediato y exclusivamente a su terminal de producción
    if (user.role === "operator_dtf" || user.role === "operator_bordadora") {
      setModule("produccion");
    } else {
      setModule("inicio");
    }
    localStorage.setItem("tesorio_auth", JSON.stringify(user));
  }, []);

  const logoutUser = useCallback(() => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem("tesorio_auth");
  }, []);

  const notify = useCallback((message: string, error = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, error });
    toastTimer.current = setTimeout(() => setToast(null), 4800);
  }, []);

  const isOperator = currentUser?.role === "operator_dtf" || currentUser?.role === "operator_bordadora" || currentUser?.role === "operator_corte_confeccion";

  const navigate = useCallback((next: Module, nextTab = "") => {
    // Si es operador de máquina, blindar para que NUNCA pueda salir de su módulo de producción de taller
    if (isOperator && next !== "produccion") {
      setModule("produccion");
      return;
    }
    setModule(next);
    setTab(nextTab);
    setMobileNav(false);
    setMenu(null);
    setQuery("");
    window.history.pushState({}, "", next === "inicio" ? "/" : `/?modulo=${next}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [isOperator]);

  useEffect(() => {
    const sync = () => {
      const value = new URLSearchParams(window.location.search).get("modulo") as Module;
      if (value && pageInfo[value]) {
        setModule(value);
        setTab("");
      } else setModule("inicio");
    };
    sync();
    window.addEventListener("popstate", sync);
    const keyboard = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setMenu(null);
        setDialog(null);
        setMobileNav(false);
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      window.removeEventListener("popstate", sync);
      document.removeEventListener("keydown", keyboard);
    };
  }, []);

  const mutate = async (action: string, values: unknown, message = "Operación guardada correctamente") => {
    const response = await fetch("/api/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, data: values }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "No se pudo guardar la operación.");
    const updated = await fetch("/api/data", { cache: "no-store" });
    if (updated.ok) setData(await updated.json());
    if (message) notify(message);
    return result as MutationResult;
  };

  const money = (amount: number) =>
    currency === "VES"
      ? `Bs. ${(amount * data.settings.exchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const refresh = useCallback(async () => {
    const updated = await fetch("/api/data", { cache: "no-store" });
    if (updated.ok) setData(await updated.json());
  }, []);

  const open = (type: string, entity?: unknown) => {
    setDialog({ type, entity });
    setMenu(null);
    setQuery("");
  };

  const pendingCount = data.pending.filter((p) => p.status === "pending").length;
  const lowStock = data.products.filter((p) => p.kind === "product" && p.stock <= p.minStock);
  const overdue = data.pending.filter((p) => p.status === "pending" && p.dueDate < new Date().toISOString().slice(0, 10));

  const matches =
    query.trim().length > 1
      ? [
          ...data.products
            .filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3)
            .map((p) => ({ label: p.name, sub: `Artículo · ${p.sku}`, icon: <Package size={17} />, click: () => open("product", p) })),
          ...data.customers
            .filter((c) => `${c.name} ${c.document} ${c.email}`.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3)
            .map((c) => ({ label: c.name, sub: `Cliente · ${c.document}`, icon: <Users size={17} />, click: () => open("customer-detail", c) })),
          ...data.sales
            .filter((s) => `${s.invoiceNumber} ${s.controlNumber} ${s.customerName}`.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 3)
            .map((s) => ({ label: `Factura ${s.invoiceNumber}`, sub: `${s.customerName} (${s.controlNumber})`, icon: <Receipt size={17} />, click: () => open("receipt", s) })),
        ]
      : [];

  const primaryAction = () => {
    if (module === "inventario") return open("product", { kind: tab === "recetas" ? "recipe" : tab === "servicios" ? "service" : "product" });
    const map: Partial<Record<Module, string>> = {
      cuentas: "account",
      pendientes: "pending",
      gastos: "expense",
      clientes: "customer",
      marketing: "campaign",
      equipo: "member",
    };
    if (map[module]) return open(map[module]!);
    navigate("ventas", "pos");
  };

  const primaryLabel: Partial<Record<Module, string>> = {
    inventario: tab === "recetas" ? "Agregar receta/DTF" : tab === "servicios" ? "Agregar servicio" : "Nuevo artículo",
    produccion: "Asignar Trabajo a Taller",
    cuentas: "Nueva cuenta",
    pendientes: "Nueva cuenta pendiente",
    gastos: "Registrar egreso",
    clientes: "Nuevo cliente",
    marketing: "Crear campaña",
    equipo: "Agregar usuario",
  };

  const showDate = (module === "ventas" && tab === "historial") || !["inventario", "clientes", "marketing", "equipo", "configuracion", "ventas", "pendientes", "nomina", "produccion"].includes(module);

  const context = {
    data,
    module,
    navigate,
    tab,
    setTab,
    period,
    setPeriod,
    customDates,
    setCustomDates,
    currency,
    setCurrency,
    money,
    open,
    close: () => setDialog(null),
    mutate,
    refresh,
    notify,
    cart,
    setCart,
    channel,
    setChannel,
    tableId,
    setTableId,
    theme,
    toggleTheme,
    isAuthenticated,
    currentUser,
    loginUser,
    logoutUser,
  };

  if (!isAuthenticated) {
    return <LoginView data={data} theme={theme} toggleTheme={toggleTheme} onLogin={loginUser} />;
  }

  return (
    <AppContext.Provider value={context}>
      <div
        className={`app-shell ${theme === "dark" ? "theme-dark" : "theme-light"} ${
          collapsed ? "sidebar-collapsed" : ""
        } ${currency === "VES" ? "currency-ves" : ""}`}
      >
        {mobileNav && <button className="mobile-scrim" aria-label="Cerrar navegación" onClick={() => setMobileNav(false)} />}

        {/* BARRA LATERAL MODERNA CON MARCA TESORIO */}
        <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
          <div className="brand-row">
            <button className="brand" onClick={() => navigate("inicio")} aria-label="Tesorio inicio">
              tesorio<span>.</span>
            </button>
            <button
              className="icon-button collapse-button"
              aria-label={collapsed ? "Expandir menú completo" : "Contraer menú a solo iconos"}
              title={collapsed ? "Expandir menú" : "Contraer menú"}
              onClick={() => setCollapsed(!collapsed)}
            >
              <PanelLeftClose size={17} className={collapsed ? "rotate-180" : ""} />
            </button>
            <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Cerrar menú">
              <X size={20} />
            </button>
          </div>

          <div className="sidebar-tagline">
            Gestión &amp; Facturación Legal · SENIAT
          </div>

          {/* INSIGNIA PERMANENTE DE LA EMPRESA ACTIVA */}
          <div className="company-active-badge" onClick={() => navigate("configuracion")}>
            <div className="company-logo-slot">
              {data.settings.logoUrl ? (
                <img src={data.settings.logoUrl} alt={data.settings.businessName} className="company-mini-logo" />
              ) : (
                <Store size={18} />
              )}
            </div>
            <div className="company-text">
              <strong title={data.settings.businessName}>{data.settings.businessName}</strong>
              <small title={data.settings.rif}>{data.settings.rif}</small>
            </div>
          </div>

          <nav className="main-nav">
            {/* Si es operario de terminal (plotter o bordadora), blindaje total de interfaz */}
            {isOperator ? (
              <div className="space-y-3">
                <div className="p-3 bg-purple-100/90 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-700 rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 font-extrabold text-purple-900 dark:text-purple-100 text-xs">
                    <span>🔒 Estación de Taller Blindada</span>
                  </div>
                  <strong className="block text-slate-800 dark:text-slate-200 mt-1 text-[11px]">
                    {currentUser?.branchName}
                  </strong>
                  <span className="text-[10px] text-purple-700 dark:text-purple-300 block mt-0.5">
                    Operador: {currentUser?.name}
                  </span>
                </div>

                <div className="nav-group">
                  <div className="nav-label">TAREAS DE PRODUCCIÓN</div>
                  <button
                    className="nav-item active font-bold text-purple-700 bg-purple-50 dark:bg-purple-900/50"
                    onClick={() => setModule("produccion")}
                  >
                    <span className="nav-icon"><Sparkles /></span>
                    <span className="nav-text">Órdenes de mi Máquina</span>
                    <span className="nav-count-fiscal bg-amber-500 text-white">EN COLA</span>
                  </button>
                </div>
              </div>
            ) : (
              navGroups.map((group, i) => (
                <div className="nav-group" key={i}>
                  {group.label && <div className="nav-label">{group.label}</div>}
                  {group.items.map((item) => (
                    <button
                      title={item.label}
                      className={`nav-item ${module === item.id ? "active" : ""}`}
                      key={item.id}
                      onClick={() => navigate(item.id)}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-text">{item.label}</span>
                      {item.id === "produccion" && (
                        <span className="nav-count-fiscal bg-amber-500 text-white">TALLER</span>
                      )}
                      {item.id === "pendientes" && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}
                      {item.id === "auditoria" && <span className="nav-count-fiscal">SENIAT</span>}
                      {item.id === "inicio" && module === "inicio" && <span className="active-dot" />}
                    </button>
                  ))}
                </div>
              ))
            )}
          </nav>

          <div className="sidebar-bottom">
            {!isOperator && (
              <>
                <div className="help-card">
                  <span className="help-card-icon">
                    <ShieldCheck size={20} />
                  </span>
                  <h4>Cumplimiento SENIAT</h4>
                  <p>Facturación y Libros sin máquinas fiscales.</p>
                  <button onClick={() => navigate("auditoria")}>
                    Ver auditoría fiscal <ArrowUpRight size={14} />
                  </button>
                </div>
                <button
                  className={`nav-item ${module === "configuracion" ? "active" : ""}`}
                  onClick={() => navigate("configuracion")}
                  title="Configuración"
                >
                  <Settings size={19} />
                  <span className="nav-text">Configuración &amp; Logo</span>
                </button>
              </>
            )}

            <div className="sidebar-profile-box">
              <button
                className="sidebar-profile"
                onClick={() => !isOperator && navigate("equipo")}
                title={isOperator ? "Operador de Máquina" : "Mi equipo"}
              >
                <Avatar name={currentUser?.name || data.settings.ownerName} />
                <span>
                  <strong>{currentUser?.name || data.settings.ownerName}</strong>
                  <small>{currentUser?.title || currentUser?.role || "Director General"}</small>
                </span>
                {!isOperator && <ChevronsUpDown size={14} />}
              </button>
              <button
                className="sidebar-logout-btn"
                onClick={logoutUser}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* WORKSPACE PRINCIPAL */}
        <div className="workspace">
          <header className="topbar">
            <div className="business-area">
              <button className="icon-button mobile-menu" aria-label="Abrir menú" onClick={() => setMobileNav(true)}>
                <Menu size={22} />
              </button>
              <div className="business-switcher">
                <div className="header-logo-container">
                  {data.settings.logoUrl ? (
                    <img src={data.settings.logoUrl} alt={data.settings.businessName} className="header-company-logo" />
                  ) : (
                    <span className="store-icon">
                      <Store size={20} />
                    </span>
                  )}
                </div>
                <div className="header-company-info truncate max-w-[170px] sm:max-w-none">
                  <strong className="truncate block">{data.settings.businessName}</strong>
                  <small className="font-mono text-purple font-semibold truncate block">
                    {currentUser?.branchName || `${data.settings.rif} · Caracas`}
                  </small>
                </div>
              </div>
            </div>

            <div className="topbar-right">
              {/* Tasa Oficial BCV Conectada y Sincronizada en vivo */}
              <button
                className="bcv-rate-pill cursor-pointer"
                title="Tasa oficial del Banco Central de Venezuela (bcv.org.ve) · Clic para consultar en vivo"
                onClick={async () => {
                  try {
                    notify("Consultando tasa oficial del BCV en vivo...");
                    const res = await fetch("/api/bcv?sync=true");
                    const json = await res.json();
                    if (json.ok && json.rate) {
                      await mutate("settings.save", { exchangeRate: json.rate }, `Tasa BCV actualizada a Bs. ${json.rate.toFixed(2)} por dólar (Fuente: ${json.source === "live" ? "BCV oficial en vivo" : "Verificada"})`);
                    }
                  } catch (e) {
                    notify("Error al conectar con BCV: " + (e as Error).message, true);
                  }
                }}
              >
                <span className="bcv-dot animate-pulse" />
                <span>BCV: <strong>Bs. {data.settings.exchangeRate.toFixed(2)}</strong></span>
                <RefreshCw size={11} className="text-emerald-700 dark:text-emerald-300 ml-0.5" />
              </button>

              <div className="global-search">
                <Search size={17} />
                <input
                  ref={searchRef}
                  aria-label="Buscar factura, cliente o artículo"
                  placeholder="Buscar factura, RIF o artículo..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd>⌘ K</kbd>
                {query.trim().length > 1 && (
                  <div className="search-results">
                    <div className="dropdown-label">RESULTADOS DE BÚSQUEDA</div>
                    {matches.length ? (
                      matches.map((m, i) => (
                        <button key={i} onClick={m.click}>
                          {m.icon}
                          <span>
                            <strong>{m.label}</strong>
                            <small>{m.sub}</small>
                          </span>
                          <ChevronRight size={14} />
                        </button>
                      ))
                    ) : (
                      <p>No encontramos resultados para “{query}”.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Selector de Tema Noche / Día */}
              <button
                className="icon-button theme-toggle-btn"
                onClick={toggleTheme}
                title={theme === "dark" ? "Cambiar a modo Día" : "Cambiar a modo Noche"}
                aria-label={theme === "dark" ? "Cambiar a modo Día" : "Cambiar a modo Noche"}
              >
                {theme === "dark" ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-purple-600" />}
              </button>

              <select
                className="currency-select"
                aria-label="Moneda de visualización"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "USD" | "VES")}
              >
                <option value="USD">USD ($)</option>
                <option value="VES">VES (Bs.)</option>
              </select>

              <span className="topbar-divider" />

              {/* Notificaciones de Stock y Cobros */}
              <div className="popover-anchor">
                <button
                  className={`icon-button notification-button ${menu === "notifications" ? "selected" : ""}`}
                  onClick={() => setMenu(menu === "notifications" ? null : "notifications")}
                  aria-label="Notificaciones"
                >
                  <Bell size={20} />
                  {lowStock.length + overdue.length > 0 && <i />}
                </button>
                {menu === "notifications" && (
                  <>
                    <button className="dismiss-layer" onClick={() => setMenu(null)} aria-label="Cerrar notificaciones" />
                    <div className="dropdown notifications">
                      <div className="dropdown-heading">
                        <strong>Notificaciones de Almacén y Cobros</strong>
                        <span className="count-pill">{lowStock.length + overdue.length}</span>
                      </div>
                      {lowStock.map((p) => (
                        <button
                          key={`p${p.id}`}
                          onClick={() => {
                            navigate("inventario");
                            open("product", p);
                          }}
                        >
                          <span className="notification-icon peach">
                            <Package size={18} />
                          </span>
                          <span>
                            <strong>Reponer existencia</strong>
                            <small>
                              {p.name}: quedan {p.stock} {p.unit}.
                            </small>
                          </span>
                          <ChevronRight size={14} />
                        </button>
                      ))}
                      {overdue.map((p) => (
                        <button key={`d${p.id}`} onClick={() => navigate("pendientes")}>
                          <span className="notification-icon purple">
                            <Clock3 size={18} />
                          </span>
                          <span>
                            <strong>Cuenta por cobrar vencida</strong>
                            <small>
                              {p.contact} · {money(p.amount)}
                            </small>
                          </span>
                        </button>
                      ))}
                      {!lowStock.length && !overdue.length && <p>¡Todo al día! No tienes alertas pendientes.</p>}
                      <div className="notification-footer">
                        <span className="live-dot" /> Base de datos conciliada al instante
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button className="icon-button help-top" onClick={() => open("help")} aria-label="Ayuda">
                <CircleHelp size={20} />
              </button>

              <button className="profile-top" onClick={() => navigate("equipo")} aria-label="Ver mi equipo">
                <Avatar name={data.settings.ownerName} />
              </button>
            </div>
          </header>

          <main className={`main-content module-${module}`}>
            <div className="page-heading">
              <div>
                <div className="breadcrumb">
                  {data.settings.businessName} <ChevronRight size={11} /> <span>{pageInfo[module].title}</span>
                </div>
                <h1>{pageInfo[module].title}</h1>
                <p>{pageInfo[module].subtitle}</p>
              </div>

              <div className="page-actions">
                {!isOperator && showDate && (
                  <div className="popover-anchor">
                    <button className="button secondary date-button" onClick={() => setMenu(menu === "period" ? null : "period")}>
                      <CalendarDays size={16} />
                      <span>{periods.find((p) => p.id === period)?.label}</span>
                      <ChevronDown size={13} />
                    </button>
                    {menu === "period" && (
                      <>
                        <button className="dismiss-layer" aria-label="Cerrar filtro" onClick={() => setMenu(null)} />
                        <div className="dropdown period-dropdown">
                          {periods.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                if (p.id === "custom") open("dates");
                                else setPeriod(p.id);
                                setMenu(null);
                              }}
                            >
                              {p.label}
                              {period === p.id && <Check size={15} />}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                {!isOperator && module !== "configuracion" && module !== "auditoria" && module !== "nomina" && module !== "produccion" && (
                  <button className="button primary" onClick={primaryAction}>
                    <Plus size={17} />
                    {primaryLabel[module] || "Nueva Factura Fiscal"}
                  </button>
                )}
              </div>
            </div>

            {module === "inicio" && <Dashboard />}
            {module === "inventario" && <InventoryView />}
            {module === "produccion" && <ProductionView />}
            {module === "ventas" && <SalesView />}
            {module === "cuentas" && <AccountsView />}
            {module === "pendientes" && <PendingView />}
            {module === "gastos" && <ExpensesView />}
            {module === "nomina" && <PayrollPanel />}
            {module === "auditoria" && <AuditView />}
            {module === "financiero" && <FinanceView />}
            {module === "reportes" && <ReportsView />}
            {module === "clientes" && <CustomersView />}
            {module === "marketing" && <MarketingView />}
            {module === "estadisticas" && <StatisticsView />}
            {module === "equipo" && <TeamView />}
            {module === "configuracion" && <SettingsView />}

            <footer className="workspace-footer">
              <span>
                <span className="live-dot" /> Sistema de control administrativo y fiscal para Venezuela
              </span>
              <span>
                Desarrollado con <span className="footer-brand">tesorio.</span>
              </span>
            </footer>
          </main>
        </div>

        {dialog && <Dialogs dialog={dialog} />}
        {toast && (
          <div className={`toast ${toast.error ? "error" : ""}`} role="status">
            {toast.error ? <CircleHelp size={20} /> : <span className="toast-check"><Check size={15} /></span>}
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} aria-label="Cerrar aviso">
              <X size={15} />
            </button>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
