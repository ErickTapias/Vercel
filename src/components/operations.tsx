"use client";
import { useState } from "react";
import {
  Package,
  Upload,
  Download,
  List,
  LayoutGrid,
  Pencil,
  Plus,
  ArrowDownUp,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  Clock3,
  AlertCircle,
  FlaskConical,
  Scissors,
  History,
  Layers,
  Sparkles,
  ShieldCheck,
  Printer,
  FileText,
} from "lucide-react";
import { useApp } from "./app-context";
import { SearchField, ProductImage, EmptyState, AccountIcon, StatusBadge, SectionHead, KpiCard } from "./ui";
import { exportExcel, printReport, filterPeriod, sum, dateLabel } from "@/lib/utils";
import { BankReconcilePanel } from "./bank-reconcile-panel";
import type { Product } from "@/lib/types";

export function InventoryView() {
  const { data, tab, setTab, money, open, notify } = useApp();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [grid, setGrid] = useState(true), // Por defecto vista de tarjeta moderna compacta
    [sort, setSort] = useState("name"),
    [onlyLow, setOnlyLow] = useState(tab === "bajo");

  const current = ["recetas", "servicios", "dtf", "historial"].includes(tab) ? tab : "productos";
  const isDtfTab = current === "dtf";

  const catalog = data.products.filter((p) => {
    if (isDtfTab) return p.category === "Servicio DTF" || p.category === "Bordado Industrial";
    if (current === "recetas") return p.kind === "recipe";
    if (current === "servicios") return p.kind === "service";
    return p.kind === "product";
  });

  const low = data.products.filter((p) => p.kind === "product" && p.stock <= p.minStock);

  const rows = catalog
    .filter(
      (p) =>
        `${p.name} ${p.sku}`.toLowerCase().includes(query.toLowerCase()) &&
        (!category || p.category === category) &&
        (!onlyLow || p.stock <= p.minStock)
    )
    .sort((a, b) =>
      sort === "stock"
        ? a.stock - b.stock
        : sort === "recent"
        ? b.id - a.id
        : a.name.localeCompare(b.name)
    );

  const stockFor = (p: Product) =>
    p.kind === "service"
      ? "Servicio activo"
      : p.kind === "recipe"
      ? `${Math.floor(
          Math.min(
            ...p.ingredients.map((i) => {
              const matched = data.products.find((prod) => prod.id === i.productId);
              return (matched?.stock || 0) / i.quantity;
            })
          )
        )} capacidades`
      : `${p.stock.toLocaleString()} ${p.unit === "unidad" ? "uds." : p.unit}`;

  const getExportData = () =>
    rows.map((p) => ({
      SKU: p.sku,
      Nombre: p.name,
      Categoría: p.category,
      Tipo: p.kind === "recipe" ? "Receta / DTF" : p.kind === "service" ? "Servicio" : "Prenda terminada",
      Cantidad: p.stock,
      Unidad: p.unit,
      CostoUSD: p.cost,
      PrecioUSD: p.price,
      ExentoIVA: p.isExempt ? "Sí" : "No",
      Ubicación: p.location,
    }));

  const download = () =>
    exportExcel(getExportData(), "Tesorio-Inventario-Cristo-Rey").catch(() => notify("No se pudo exportar el archivo.", true));

  const printPdf = () => {
    try {
      printReport(
        "REPORTE OFICIAL DE INVENTARIO Y TELAS",
        getExportData(),
        data.settings.legalName,
        `Taller Los Ruices · ${rows.length} registros listados`
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  return (
    <div className="module-stack">
      {/* Pestañas de inventario adaptadas a Fábrica Cristo Rey */}
      <div className="tabs">
        {[
          { id: "productos", label: "Prendas e Insumos", icon: <Package size={16} />, count: data.products.filter((p) => p.kind === "product").length },
          { id: "dtf", label: "Servicios (Bordado, DTF, etc.)", icon: <Sparkles size={16} />, count: data.products.filter((p) => p.category === "Servicio DTF" || p.category === "Bordado Industrial").length },
          { id: "recetas", label: "Fórmulas y Recetas", icon: <FlaskConical size={16} />, count: data.products.filter((p) => p.kind === "recipe").length },
          { id: "servicios", label: "Otros Servicios", icon: <Scissors size={16} />, count: data.products.filter((p) => p.kind === "service").length },
          { id: "historial", label: "Historial de Movimientos", icon: <History size={16} /> },
        ].map((t) => (
          <button
            className={current === t.id ? "active" : ""}
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setCategory("");
              setOnlyLow(false);
            }}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && <span>{t.count}</span>}
          </button>
        ))}
      </div>

      {current === "historial" ? (
        <section className="card">
          <SectionHead title="Movimientos de Almacén y Producción" subtitle="Trazabilidad de entradas, compras de rollos de tela y ajustes." />
          {data.activities.filter((a) => a.type === "inventory").length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Movimiento</th>
                  <th>Fecha</th>
                  <th>Monto USD</th>
                </tr>
              </thead>
              <tbody>
                {data.activities
                  .filter((a) => a.type === "inventory")
                  .map((a) => (
                    <tr key={a.id}>
                      <td>{a.description}</td>
                      <td>{dateLabel(a.createdAt, true)}</td>
                      <td>{money(a.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <EmptyState title="Sin movimientos de almacén" />
          )}
        </section>
      ) : (
        <>
          <div className="inventory-summary">
            <div>
              <span className="summary-icon purple">
                <Package size={21} />
              </span>
              <span>
                <small>Artículos / Servicios en catálogo</small>
                <strong>{catalog.length}</strong>
              </span>
            </div>
            <div>
              <span className="summary-icon green">
                <Wallet size={21} />
              </span>
              <span>
                <small>Valoración del inventario en taller</small>
                <strong>{money(sum(catalog.filter((p) => p.kind === "product"), (p) => p.stock * p.cost))}</strong>
              </span>
            </div>
            <button
              onClick={() => {
                setOnlyLow(!onlyLow);
                setTab("productos");
              }}
            >
              <span className="summary-icon peach">
                <AlertCircle size={21} />
              </span>
              <span>
                <small>Prendas e insumos con stock bajo</small>
                <strong>
                  {low.length}
                  <span className="subtle-tag">Revisar</span>
                </strong>
              </span>
            </button>
          </div>

          <section className="card inventory-card">
            <div className="table-toolbar">
              <SearchField value={query} onChange={setQuery} placeholder="Buscar por nombre o código SKU..." />
              <select aria-label="Filtrar categoría" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Todas las líneas</option>
                {Array.from(new Set(catalog.map((p) => p.category))).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <div className="toolbar-spacer" />
              <button
                className="button primary text-xs py-1.5 px-3 h-auto flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                onClick={() => open("import")}
                title="Cargar lista masiva de productos desde archivo Excel (.xlsx / .csv)"
              >
                <Upload size={14} /> Cargar Lista con Excel
              </button>
              <button className="button secondary" onClick={download} title="Descargar archivo Excel">
                <Download size={15} /> Excel
              </button>
              <button className="button secondary" onClick={printPdf} title="Imprimir o guardar en PDF">
                <Printer size={15} /> Imprimir / PDF
              </button>
              <div className="view-toggle">
                <button className={!grid ? "active" : ""} onClick={() => setGrid(false)} aria-label="Lista">
                  <List size={17} />
                </button>
                <button className={grid ? "active" : ""} onClick={() => setGrid(true)} aria-label="Cuadrícula">
                  <LayoutGrid size={17} />
                </button>
              </div>
            </div>

            <div className="filter-bar">
              <span>
                {rows.length} registros {onlyLow ? "con stock bajo" : "encontrados"}
              </span>
              <div>
                {onlyLow && (
                  <button className="filter-chip" onClick={() => setOnlyLow(false)}>
                    Stock bajo <span>×</span>
                  </button>
                )}
                <select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="name">Por nombre</option>
                  <option value="recent">Más recientes</option>
                  <option value="stock">Menor existencia</option>
                </select>
              </div>
            </div>

            {!rows.length ? (
              <EmptyState
                title="No hay artículos con ese filtro"
                action={
                  <button className="button primary" onClick={() => open("product", { kind: current === "recetas" ? "recipe" : current === "servicios" ? "service" : "product" })}>
                    <Plus size={16} /> Agregar nuevo
                  </button>
                }
              />
            ) : grid ? (
              <div className="inventory-grid">
                {rows.map((p) => (
                  <button className="inventory-product-card" key={p.id} onClick={() => open("product", p)}>
                    <ProductImage product={p} />
                    <div>
                      <span className="tiny-label">{p.category}</span>
                      <h3>{p.name}</h3>
                      <span className="inventory-grid-stock">{stockFor(p)}</span>
                      <strong>{money(p.price)}</strong>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="table-scroll">
                <table className="data-table inventory-table">
                  <thead>
                    <tr>
                      <th>Artículo / Servicio</th>
                      <th>Línea / Categoría</th>
                      <th>Existencia en Taller</th>
                      <th>Costo USD</th>
                      <th>Precio de Venta</th>
                      <th>Rentabilidad</th>
                      <th>IVA</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p) => (
                      <tr key={p.id} onClick={() => open("product", p)}>
                        <td>
                          <div className="product-cell">
                            <ProductImage product={p} />
                            <span>
                              <strong>{p.name}</strong>
                              <small>
                                {p.sku} {p.variation ? `· ${p.variation}` : ""}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="category-tag">{p.category}</span>
                        </td>
                        <td>
                          <span className={p.kind === "product" && p.stock <= p.minStock ? "stock-warning" : ""}>
                            {p.kind === "product" && p.stock <= p.minStock && <i />}
                            {stockFor(p)}
                          </span>
                        </td>
                        <td>{money(p.cost)}</td>
                        <td className="amount">{money(p.price)}</td>
                        <td>
                          <span className="margin-tag">{p.price ? (((p.price - p.cost) / p.price) * 100).toFixed(0) : 0}%</span>
                        </td>
                        <td>
                          <span className={`status-badge ${p.isExempt ? "pending" : "paid"}`}>{p.isExempt ? "Exento" : "Gravable 16%"}</span>
                        </td>
                        <td>
                          <button className="icon-button small-button" aria-label={`Editar ${p.name}`}>
                            <Pencil size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="table-footer">
              <span>
                Mostrando {rows.length} de {catalog.length} registros en Fábrica Cristo Rey
              </span>
              <span>
                Trazabilidad digital activa <span className="live-dot" />
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export function AccountsView() {
  const { data, money, period, customDates, open, notify } = useApp();
  const [selected, setSelected] = useState(0),
    [query, setQuery] = useState("");
  const accountRows = data.accounts;

  const movements = [
    ...data.sales.flatMap((s) =>
      s.payments.map((p, i) => ({
        key: `s${s.id}-${i}`,
        description: `Factura ${s.invoiceNumber} (Control ${s.controlNumber}) · ${s.customerName}`,
        amount: p.amount,
        accountId: p.accountId,
        createdAt: s.createdAt,
        type: "Ingreso por Factura",
      }))
    ),
    ...data.expenses.map((e) => ({
      key: `e${e.id}`,
      description: `${e.name} ${e.beneficiary ? `· ${e.beneficiary}` : ""}`,
      amount: -e.amount,
      accountId: e.accountId,
      createdAt: e.createdAt,
      type: e.scope === "personal" ? "Retiro Personal" : e.scope === "internal" ? "Caja Chica" : "Gasto Operativo",
    })),
    ...data.activities
      .filter((a) => ["transfer", "inventory", "settlement"].includes(a.type) && a.amount !== 0)
      .map((a) => ({
        key: `a${a.id}`,
        description: a.description,
        amount: a.amount,
        accountId: a.accountId,
        createdAt: a.createdAt,
        type: a.type === "transfer" ? "Transferencia" : a.type === "inventory" ? "Insumos" : "Cuenta por Cobrar",
      })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const rows = filterPeriod(movements, period, customDates).filter(
    (m) => (!selected || m.accountId === selected) && m.description.toLowerCase().includes(query.toLowerCase())
  );

  // Cálculo de fondos en bolívares para alerta de riesgo cambiario
  const bcvRate = data.settings.exchangeRate || 69.5;
  const vesAccounts = accountRows.filter((a) => a.currency === "VES");
  const totalBalanceVes = sum(vesAccounts, (a) => a.balance);
  const totalEquivalentUsdInVes = totalBalanceVes / bcvRate;

  return (
    <div className="module-stack">
      {/* ALERTA CRÍTICA DE RIESGO Y PÉRDIDA CAMBIARIA EN BOLÍVARES */}
      {totalBalanceVes > 0 && (
        <section className="p-4 bg-gradient-to-r from-amber-500 via-orange-600 to-red-600 text-white rounded-2xl shadow-lg border-2 border-amber-300 space-y-2 relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white text-orange-600 flex items-center justify-center font-black shadow-md flex-shrink-0">
                <AlertCircle size={26} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-black tracking-widest text-amber-100 bg-black/20 px-2 py-0.5 rounded-full inline-block">
                  ALERTA FINANCIERA VENEZUELA · RIESGO CAMBIARIO BCV
                </span>
                <h3 className="text-base font-extrabold m-0 text-white">
                  Tienes Bs. {totalBalanceVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })} retenidos en cuentas nacionales (${totalEquivalentUsdInVes.toFixed(2)} USD)
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="button secondary text-xs font-bold bg-white text-orange-950 border-none shadow-md py-2 px-3.5 h-auto flex items-center gap-1.5 hover:bg-amber-50"
                onClick={() => open("transfer")}
              >
                <ArrowDownUp size={14} /> Pasar Fondos a Dólares ($)
              </button>
            </div>
          </div>

          <p className="text-xs text-amber-50 leading-relaxed max-w-4xl m-0 relative z-10">
            <strong>Recomendación Urgente:</strong> La devaluación constante y el diferencial cambiario deprecian rápidamente los saldos en Bolívares. Se recomienda mantener en Banesco o cuentas en Bs. únicamente el flujo de caja necesario para la operación diaria inmediata y transferir el excedente a cuentas en <strong>Dólares ($), Zelle o Banesco Verde</strong> para proteger el patrimonio y evitar pérdidas de capital.
          </p>
        </section>
      )}

      <div className="account-cards">
        {accountRows.map((a) => (
          <div className={`card bank-account-card ${selected === a.id ? "selected" : ""}`} key={a.id}>
            <div className="bank-card-top">
              <button onClick={() => setSelected(selected === a.id ? 0 : a.id)}>
                <AccountIcon account={a} />
                <span>
                  <strong>{a.name}</strong>
                  <small>{a.currency === "USD" ? "Dólares ($)" : "Bolívares (VES)"}</small>
                </span>
              </button>
              <button className="icon-button" onClick={() => open("account", a)} aria-label="Editar">
                <Pencil size={15} />
              </button>
            </div>
            <span className="tiny-label">SALDO DISPONIBLE EN CUENTA</span>
            <button className="bank-balance" onClick={() => setSelected(selected === a.id ? 0 : a.id)}>
              {a.currency === "VES"
                ? `Bs. ${a.balance.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`
                : `$ ${a.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
            </button>
            <div className="bank-card-bottom">
              <span>{a.method}</span>
              <small>{a.commission ? `${a.commission}% comisión` : "Sin comisión"}</small>
            </div>
          </div>
        ))}
      </div>

      <BankReconcilePanel />

      <section className="card">
        <SectionHead title="Conciliación de Movimientos Bancarios" subtitle="Registro auditable de cada entrada y salida de fondos.">
          <button className="button secondary" onClick={() => open("transfer")}>
            <ArrowDownUp size={15} /> Transferir entre cuentas
          </button>
        </SectionHead>
        <div className="table-toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Buscar movimiento..." />
          <select aria-label="Filtrar cuenta" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
            <option value={0}>Todas las cuentas</option>
            {accountRows.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className="toolbar-spacer" />
          <button
            className="button secondary"
            title="Descargar Excel"
            onClick={() =>
              exportExcel(
                rows.map((m) => ({
                  Movimiento: m.description,
                  Tipo: m.type,
                  Cuenta: accountRows.find((a) => a.id === m.accountId)?.name,
                  MontoUSD: m.amount,
                  Fecha: dateLabel(m.createdAt, true),
                })),
                "Tesorio-Conciliacion-Bancaria"
              )
            }
          >
            <Download size={15} /> Excel
          </button>
          <button
            className="button secondary"
            title="Imprimir o guardar como PDF"
            onClick={() => {
              try {
                printReport(
                  "REPORTE DE MOVIMIENTOS BANCARIOS Y CONCILIACIÓN",
                  rows.map((m) => ({
                    Documento: m.description,
                    Tipo: m.type,
                    Cuenta: accountRows.find((a) => a.id === m.accountId)?.name || "—",
                    MontoUSD: money(m.amount),
                    Fecha: dateLabel(m.createdAt, true),
                  })),
                  data.settings.legalName,
                  `Conciliación de Cuentas · ${rows.length} movimientos`
                );
              } catch (e) {
                notify((e as Error).message, true);
              }
            }}
          >
            <Printer size={15} /> Imprimir / PDF
          </button>
        </div>

        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Concepto / Documento</th>
                  <th>Cuenta</th>
                  <th>Fecha</th>
                  <th>Tipo Operación</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((m) => (
                  <tr key={m.key}>
                    <td>
                      <div className="movement-cell">
                        <span className={`movement-icon ${m.amount > 0 ? "green" : "peach"}`}>
                          {m.amount > 0 ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                        </span>
                        {m.description}
                      </div>
                    </td>
                    <td>{accountRows.find((a) => a.id === m.accountId)?.name || "—"}</td>
                    <td>{dateLabel(m.createdAt, true)}</td>
                    <td>
                      <span className="category-tag">{m.type}</span>
                    </td>
                    <td className={`amount ${m.amount > 0 ? "positive" : ""}`}>
                      {m.amount > 0 ? "+" : "−"}
                      {money(Math.abs(m.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sin movimientos bancarios en este período" />
        )}
      </section>
    </div>
  );
}

export function PendingView() {
  const { data, money, open } = useApp();
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [showPaid, setShowPaid] = useState(false);
  const active = data.pending.filter((p) => p.status === "pending"),
    date = new Date().toISOString().slice(0, 10);
  const rows = data.pending.filter(
    (p) =>
      (showPaid || p.status === "pending") &&
      (filter === "all" || p.type === filter) &&
      `${p.name} ${p.contact}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="module-stack">
      <div className="three-stat-grid">
        <KpiCard title="Cuentas por Cobrar" value={money(sum(active.filter((p) => p.type === "receivable"), (p) => p.amount))} icon={<ArrowDownLeft size={18} />} color="green" detail={`${active.filter((p) => p.type === "receivable").length} saldos de clientes`} onClick={() => setFilter("receivable")} />
        <KpiCard title="Cuentas por Pagar" value={money(sum(active.filter((p) => p.type === "payable"), (p) => p.amount))} icon={<ArrowUpRight size={18} />} color="purple" detail={`${active.filter((p) => p.type === "payable").length} facturas de proveedores`} onClick={() => setFilter("payable")} />
        <KpiCard title="Vencidas" value={money(sum(active.filter((p) => p.dueDate < date), (p) => p.amount))} icon={<Clock3 size={18} />} color="peach" detail={`${active.filter((p) => p.dueDate < date).length} requieren gestión de cobranza`} onClick={() => setFilter("all")} />
      </div>

      <section className="card">
        <div className="table-toolbar">
          <div className="segmented-control">
            {[
              { id: "all", label: "Todas" },
              { id: "receivable", label: "Por cobrar (Clientes)" },
              { id: "payable", label: "Por pagar (Proveedores)" },
            ].map((f) => (
              <button key={f.id} className={filter === f.id ? "active" : ""} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="toolbar-spacer" />
          <SearchField value={query} onChange={setQuery} placeholder="Buscar cuenta o empresa..." />
          <label className="check-label">
            <input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} />
            Mostrar saldadas
          </label>
        </div>

        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Empresa / Contacto</th>
                  <th>Tipo</th>
                  <th>Vencimiento</th>
                  <th>Monto USD</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                    </td>
                    <td>{p.contact}</td>
                    <td>
                      <span className={`direction-tag ${p.type === "receivable" ? "green" : "purple"}`}>
                        {p.type === "receivable" ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                        {p.type === "receivable" ? "Por cobrar" : "Por pagar"}
                      </span>
                    </td>
                    <td>{dateLabel(p.dueDate + "T12:00:00")}</td>
                    <td className="amount">{money(p.amount)}</td>
                    <td>
                      <StatusBadge status={p.status === "paid" ? "paid" : p.dueDate < date ? "overdue" : "pending"} />
                    </td>
                    <td>
                      {p.status !== "paid" && (
                        <button className="text-link" onClick={() => open("settle", p)}>
                          {p.type === "receivable" ? "Registrar cobro" : "Registrar pago"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No hay cuentas pendientes" />
        )}
      </section>
    </div>
  );
}

export function ExpensesView() {
  const { data, money, period, customDates, open, notify } = useApp();
  const [query, setQuery] = useState(""),
    [scopeFilter, setScopeFilter] = useState("");
  const filtered = filterPeriod(data.expenses, period, customDates),
    rows = filtered.filter(
      (e) =>
        e.name.toLowerCase().includes(query.toLowerCase()) &&
        (!scopeFilter || e.scope === scopeFilter)
    );

  return (
    <div className="module-stack">
      <div className="three-stat-grid">
        <KpiCard title="Egresos Totales" value={money(sum(filtered, (e) => e.amount))} icon={<Receipt size={18} />} detail={`${filtered.length} egresos en el período`} color="purple" onClick={() => setScopeFilter("")} />
        <KpiCard title="Operativos (Fiscales)" value={money(sum(filtered.filter((e) => e.scope === "business"), (e) => e.amount))} icon={<ShieldCheck size={18} />} detail="Con soporte para Libro de Compras" color="blue" onClick={() => setScopeFilter("business")} />
        <KpiCard title="Caja Chica & Retiros" value={money(sum(filtered.filter((e) => e.scope !== "business"), (e) => e.amount))} icon={<Clock3 size={18} />} detail="Gastos internos y retiros de socios" color="peach" onClick={() => setScopeFilter("internal")} />
      </div>

      <section className="card">
        <SectionHead title="Registro de Comprobantes de Egreso" subtitle="Auditoría interna con diferenciación legal de gastos operativos y personales." />
        <div className="table-toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Buscar egreso..." />
          <select aria-label="Ámbito del egreso" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
            <option value="">Todos los ámbitos</option>
            <option value="business">Operativo (Factura deducible SENIAT)</option>
            <option value="internal">Caja Chica / Interno</option>
            <option value="personal">Retiro Personal Socio</option>
          </select>
          <div className="toolbar-spacer" />
          <button
            className="button secondary"
            title="Descargar archivo Excel"
            onClick={() =>
              exportExcel(
                rows.map((e) => ({
                  Concepto: e.name,
                  Ámbito: e.scope,
                  Beneficiario: e.beneficiary,
                  RIF: e.beneficiaryRif,
                  FacturaProveedor: e.invoiceNumber,
                  BaseUSD: e.taxableBase,
                  IVAUSD: e.ivaAmount,
                  TotalUSD: e.amount,
                  Fecha: dateLabel(e.createdAt),
                })),
                "Tesorio-Egresos"
              )
            }
          >
            <Download size={15} /> Excel
          </button>
          <button
            className="button secondary"
            title="Imprimir o descargar en PDF"
            onClick={() => {
              try {
                printReport(
                  "REPORTE OFICIAL DE EGRESOS Y GASTOS",
                  rows.map((e) => ({
                    Concepto: e.name,
                    Ámbito: e.scope === "personal" ? "Retiro Socio" : e.scope === "internal" ? "Caja Chica" : "Operativo Fiscal",
                    Beneficiario: e.beneficiary || "—",
                    RIF: e.beneficiaryRif || "—",
                    Comprobante: e.invoiceNumber || "REC-INT",
                    TotalUSD: money(e.amount),
                    Fecha: dateLabel(e.createdAt),
                  })),
                  data.settings.legalName,
                  `Gastos Registrados · ${rows.length} comprobantes`
                );
              } catch (err) {
                notify((err as Error).message, true);
              }
            }}
          >
            <Printer size={15} /> Imprimir / PDF
          </button>
        </div>

        {rows.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Ámbito</th>
                  <th>Beneficiario / Proveedor</th>
                  <th>N° Factura</th>
                  <th>Cuenta</th>
                  <th>Fecha</th>
                  <th>Total USD</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} onClick={() => open("expense-detail", e)}>
                    <td>
                      <strong>{e.name}</strong>
                    </td>
                    <td>
                      <span className={`status-badge ${e.scope === "personal" ? "overdue" : e.scope === "internal" ? "pending" : "paid"}`}>
                        <i />
                        {e.scope === "personal" ? "Retiro Socio" : e.scope === "internal" ? "Caja Chica" : "Operativo"}
                      </span>
                    </td>
                    <td>
                      {e.beneficiary || "—"} {e.beneficiaryRif && <small className="block text-[9px] font-mono">{e.beneficiaryRif}</small>}
                    </td>
                    <td>{e.invoiceNumber || "REC-INT"}</td>
                    <td>{data.accounts.find((a) => a.id === e.accountId)?.name}</td>
                    <td>{dateLabel(e.createdAt)}</td>
                    <td className="amount">{money(e.amount)}</td>
                    <td>
                      <button className="text-link" onClick={() => open("expense-detail", e)}>
                        Soporte
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sin egresos para mostrar" />
        )}
      </section>
    </div>
  );
}
