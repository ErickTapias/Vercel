"use client";
import { useState } from "react";
import {
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  ArrowRight,
  Download,
  Receipt,
  Store,
  History,
  Utensils,
  Globe,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
  Banknote,
  CircleCheck,
  LockKeyhole,
  CircleHelp,
  Save,
  X,
  FileCheck2,
  Send,
  Building2,
  Printer,
  Sparkles,
} from "lucide-react";
import { useApp } from "./app-context";
import { ProductImage, SearchField, EmptyState, SalesTable, SectionHead, StatusBadge } from "./ui";
import { exportExcel, filterPeriod, sum, printReport, dateLabel } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function SalesView() {
  const { tab, setTab } = useApp();
  const current = ["historial", "mesas", "canales", "caja"].includes(tab) ? tab : "pos";

  return (
    <div className="module-stack">
      <div className="tabs">
        {[
          { id: "pos", label: "Punto de Venta / Facturación", icon: <ShoppingBag size={16} /> },
          { id: "historial", label: "Registro de Facturas Emitidas", icon: <History size={16} /> },
          { id: "mesas", label: "Puestos de Atención / Taller", icon: <Utensils size={16} /> },
          { id: "canales", label: "Canales y Mayoristas", icon: <Globe size={16} /> },
          { id: "caja", label: "Arqueo de Caja", icon: <Wallet size={16} /> },
        ].map((t) => (
          <button key={t.id} className={current === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {current === "pos" && <PointOfSale />}
      {current === "historial" && <SalesHistory />}
      {current === "mesas" && <TablesView />}
      {current === "canales" && <ChannelsView />}
      {current === "caja" && <CashView />}
    </div>
  );
}

function PointOfSale() {
  const { data, cart, setCart, channel, setChannel, money, open, notify, tableId, setTableId, mutate, setTab } = useApp();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [saving, setSaving] = useState(false);

  const multiplier = data.settings.channels.find((c) => c.name === channel)?.multiplier || 1;
  const price = (p: Product) => Math.round(p.price * multiplier * 100) / 100;

  const items = cart
    .map((i) => ({ ...i, product: data.products.find((p) => p.id === i.productId)! }))
    .filter((i) => i.product);

  const subtotalBase = items
    .filter((i) => !i.product.isExempt)
    .reduce((s, i) => s + price(i.product) * i.quantity, 0);
  const subtotalExempt = items
    .filter((i) => i.product.isExempt)
    .reduce((s, i) => s + price(i.product) * i.quantity, 0);
  const ivaEstimated = +(subtotalBase * (data.settings.defaultIva / 100)).toFixed(2);
  const total = +(subtotalBase + subtotalExempt + ivaEstimated).toFixed(2);

  const catalog = data.products.filter((p) => p.category !== "Materia prima");
  const filtered = catalog.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (!category || p.category === category)
  );

  const update = (productId: number, quantity: number) => {
    const p = data.products.find((item) => item.id === productId)!;
    if (quantity <= 0) return setCart(cart.filter((i) => i.productId !== productId));
    if (p.kind === "product" && quantity > p.stock) {
      return notify(`Existencia insuficiente: solo quedan ${p.stock} unidades de ${p.name}.`, true);
    }
    setCart(
      cart.some((i) => i.productId === productId)
        ? cart.map((i) => (i.productId === productId ? { ...i, quantity } : i))
        : [...cart, { productId, quantity }]
    );
  };

  const quote = () => {
    try {
      const bcv = data.settings.exchangeRate;
      printReport(
        "Presupuesto / Cotización Formal",
        [
          ...items.map((i) => ({
            Artículo: i.product.name,
            Cantidad: i.quantity,
            "Precio USD": money(price(i.product)),
            "Total USD": money(price(i.product) * i.quantity),
            "Total Bs.": `Bs. ${(price(i.product) * i.quantity * bcv).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
          })),
          { Artículo: "SUBTOTAL", Cantidad: "", "Precio USD": "", "Total USD": money(subtotalBase + subtotalExempt), "Total Bs.": `Bs. ${((subtotalBase + subtotalExempt) * bcv).toLocaleString("es-VE", { minimumFractionDigits: 2 })}` },
          { Artículo: "IVA (16%)", Cantidad: "", "Precio USD": "", "Total USD": money(ivaEstimated), "Total Bs.": `Bs. ${(ivaEstimated * bcv).toLocaleString("es-VE", { minimumFractionDigits: 2 })}` },
          { Artículo: "TOTAL COTIZACIÓN", Cantidad: "", "Precio USD": "", "Total USD": money(total), "Total Bs.": `Bs. ${(total * bcv).toLocaleString("es-VE", { minimumFractionDigits: 2 })}` },
        ],
        data.settings.legalName,
        `RIF: ${data.settings.rif} · Válido por 7 días · Tasa BCV: Bs. ${bcv.toFixed(2)}`
      );
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  const saveTable = async () => {
    const table = data.diningTables.find((t) => t.id === tableId);
    if (!table) return;
    setSaving(true);
    try {
      await mutate("table.save", { ...table, items: cart }, "Pedido guardado en módulo de atención.");
      setCart([]);
      setTableId(null);
      setTab("mesas");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pos-layout">
      <section className="pos-catalog">
        <div className="pos-toolbar">
          <SearchField value={query} onChange={setQuery} placeholder="Buscar uniforme, bordado o DTF..." />
          <select aria-label="Canal de venta" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {data.settings.channels.map((c) => (
              <option key={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="category-pills">
          <button className={!category ? "active" : ""} onClick={() => setCategory("")}>
            Todo el Catálogo
          </button>
          {Array.from(new Set(catalog.map((p) => p.category))).map((c) => (
            <button className={category === c ? "active" : ""} key={c} onClick={() => setCategory(c)}>
              {c === "Servicio DTF" && "✨ "}
              {c}
            </button>
          ))}
        </div>

        {filtered.length ? (
          <div className="pos-products">
            {filtered.map((p) => {
              const qty = cart.find((i) => i.productId === p.id)?.quantity || 0;
              return (
                <button
                  className={`pos-product ${qty ? "in-cart" : ""}`}
                  key={p.id}
                  onClick={() => update(p.id, qty + 1)}
                  disabled={p.kind === "product" && p.stock <= 0}
                >
                  <ProductImage product={p} />
                  {qty > 0 && <span className="in-cart-count">{qty} en pedido</span>}
                  <div className="pos-product-details">
                    <span>{p.category}</span>
                    <h3>{p.name}</h3>
                    <small>
                      {p.kind === "product"
                        ? `${p.stock} disponibles en taller`
                        : p.category.includes("DTF")
                        ? "Impresión y planchado textil"
                        : "Servicio industrial"}
                    </small>
                    <div>
                      <strong>{money(price(p))}</strong>
                      <span className="add-product">
                        <Plus size={17} />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No encontramos ese producto en catálogo" />
        )}
      </section>

      {/* CARRITO Y FACTURADOR */}
      <aside className="card cart-card">
        <div className="cart-heading">
          <span>
            <ShoppingCart size={20} />
            <h2>{tableId ? data.diningTables.find((t) => t.id === tableId)?.name : "Factura en Curso"}</h2>
            <span className="count-pill">{sum(cart, (i) => i.quantity)}</span>
          </span>
          {cart.length > 0 && (
            <button className="icon-button" aria-label="Vaciar carrito" onClick={() => setCart([])}>
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {!items.length ? (
          <div className="empty-cart">
            <span>
              <ShoppingBag size={35} strokeWidth={1.4} />
            </span>
            <h3>Listo para facturar</h3>
            <p>Selecciona uniformes o servicios de DTF para generar la factura fiscal digital.</p>
          </div>
        ) : (
          <div className="cart-items">
            {items.map((i) => (
              <div className="cart-item" key={i.productId}>
                <ProductImage product={i.product} />
                <div>
                  <strong>{i.product.name}</strong>
                  <span>{money(price(i.product))} c/u</span>
                  <div className="quantity-control">
                    <button onClick={() => update(i.productId, i.quantity - 1)} aria-label="Menos">
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      aria-label="Cantidad"
                      value={i.quantity}
                      onChange={(e) => update(i.productId, Number(e.target.value))}
                    />
                    <button onClick={() => update(i.productId, i.quantity + 1)} aria-label="Más">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
                <div className="cart-item-right">
                  <button className="icon-button" aria-label="Eliminar" onClick={() => update(i.productId, 0)}>
                    <X size={14} />
                  </button>
                  <strong>{money(price(i.product) * i.quantity)}</strong>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="cart-totals">
          <div>
            <span>Base Imponible (Gravable)</span>
            <strong>{money(subtotalBase)}</strong>
          </div>
          {subtotalExempt > 0 && (
            <div>
              <span>Monto Exento</span>
              <strong>{money(subtotalExempt)}</strong>
            </div>
          )}
          <div>
            <span>IVA (16% SENIAT)</span>
            <strong className="text-purple">+{money(ivaEstimated)}</strong>
          </div>
          <div className="cart-total">
            <strong>Total a Facturar</strong>
            <div className="text-right">
              <strong>{money(total)}</strong>
              <small className="block text-[10px] font-mono text-slate-500">
                Bs. {(total * data.settings.exchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
              </small>
            </div>
          </div>

          <button className="button primary full-width checkout-button" disabled={!items.length} onClick={() => open("checkout")}>
            Emitir Factura Digital <ArrowRight size={17} />
          </button>
          {tableId && (
            <button className="button secondary full-width" disabled={saving} onClick={saveTable}>
              <Save size={16} /> {saving ? "Guardando..." : "Guardar Pedido en Módulo"}
            </button>
          )}
          <button className="button ghost full-width" disabled={!items.length} onClick={quote}>
            <Download size={15} /> Generar Cotización Formal
          </button>
          <p>
            <CircleCheck size={12} /> Descuento de inventario y registro en Libro de Ventas
          </p>
        </div>
      </aside>
    </div>
  );
}

function SalesHistory() {
  const { data, period, customDates, money, open, notify } = useApp();
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [page, setPage] = useState(1);

  const rows = filterPeriod(data.sales, period, customDates).filter(
    (s) =>
      `${s.invoiceNumber} ${s.controlNumber} ${s.customerName} ${s.customerRif}`.toLowerCase().includes(query.toLowerCase()) &&
      (!status || s.status === status)
  );
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / 12)));

  return (
    <section className="card">
      <SectionHead
        title="Historial de Facturas Emitidas (SENIAT)"
        subtitle={`${rows.length} facturas registradas · Total facturado: ${money(sum(rows, (s) => s.total))}`}
      />
      <div className="table-toolbar">
        <SearchField value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="Buscar por N° Factura, Control o RIF..." />
        <select aria-label="Estado" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Todos los estados</option>
          <option value="paid">Pagadas / Completadas</option>
          <option value="pending">A Crédito / Pendientes</option>
          <option value="void">Anuladas</option>
        </select>
        <div className="toolbar-spacer" />
        <button
          className="button secondary"
          title="Descargar archivo Excel"
          onClick={() =>
            exportExcel(
              rows.map((s) => ({
                Factura: s.invoiceNumber,
                Control: s.controlNumber,
                Fecha: dateLabel(s.createdAt, true),
                Cliente: s.customerName,
                RIF: s.customerRif,
                BaseUSD: s.taxableBase,
                IVAUSD: s.ivaAmount,
                TotalUSD: s.total,
                TotalBs: +(s.total * (s.exchangeRateBcv || 69.5)).toFixed(2),
                Estado: s.status,
                CorreoEnviado: s.emailSent ? "Sí" : "No",
              })),
              "Tesorio-Facturas-Emitidas"
            )
          }
        >
          <Download size={15} /> Excel
        </button>
        <button
          className="button secondary"
          title="Imprimir o guardar en PDF"
          onClick={() => {
            try {
              printReport(
                "HISTORIAL DE FACTURAS FISCALES DIGITALES EMITIDAS",
                rows.map((s) => ({
                  Factura: s.invoiceNumber,
                  Control: s.controlNumber,
                  Fecha: dateLabel(s.createdAt, true),
                  Cliente: s.customerName,
                  RIF: s.customerRif,
                  TotalUSD: money(s.total),
                  TotalBs: `Bs. ${(s.total * (s.exchangeRateBcv || 69.5)).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
                  Estado: s.status,
                })),
                data.settings.legalName,
                `Control de Facturación SENIAT · ${rows.length} facturas emitidas`
              );
            } catch (err) {
              notify((err as Error).message, true);
            }
          }}
        >
          <Printer size={15} /> Imprimir / PDF
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>N° Factura</th>
              <th>N° Control</th>
              <th>Cliente / Razón Social</th>
              <th>RIF / C.I.</th>
              <th>Fecha</th>
              <th>Base USD</th>
              <th>IVA (16%)</th>
              <th>Total USD</th>
              <th>Total Bs.</th>
              <th>Envío Email</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.slice((current - 1) * 12, current * 12).map((s) => (
              <tr key={s.id} onClick={() => open("receipt", s)} className="cursor-pointer">
                <td>
                  <strong className="text-purple font-mono">{s.invoiceNumber}</strong>
                </td>
                <td className="font-mono text-slate-500">{s.controlNumber}</td>
                <td>
                  <strong>{s.customerName}</strong>
                </td>
                <td className="font-mono text-xs">{s.customerRif}</td>
                <td>{dateLabel(s.createdAt, true)}</td>
                <td>{money(s.taxableBase)}</td>
                <td className="text-purple font-semibold">{money(s.ivaAmount)}</td>
                <td className="amount font-bold">{money(s.total)}</td>
                <td className="text-xs font-mono">
                  Bs. {(s.total * (s.exchangeRateBcv || 69.5)).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </td>
                <td>
                  <span className={`text-[10px] font-semibold ${s.emailSent ? "text-green-600" : "text-slate-400"}`}>
                    {s.emailSent ? "✓ Enviado" : "Pendiente"}
                  </span>
                </td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td>
                  <button className="icon-button small-button" aria-label="Ver factura">
                    <ChevronRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-footer">
        <span>
          Mostrando {rows.length ? (current - 1) * 12 + 1 : 0}–{Math.min(current * 12, rows.length)} de {rows.length} facturas
        </span>
        <div className="pagination">
          <button disabled={current <= 1} onClick={() => setPage(current - 1)} aria-label="Anterior">
            <ChevronLeft size={15} />
          </button>
          <span>
            Página {current} de {Math.max(1, Math.ceil(rows.length / 12))}
          </span>
          <button disabled={current >= Math.ceil(rows.length / 12)} onClick={() => setPage(current + 1)} aria-label="Siguiente">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}

function TablesView() {
  const { data, setCart, setTableId, setTab, open, money } = useApp();
  return (
    <section className="card">
      <SectionHead
        title="Módulos de Atención y Mostrador"
        subtitle="Organiza pedidos abiertos de confección, bordados y DTF antes de facturar."
      >
        <button className="button secondary" onClick={() => open("table")}>
          <Plus size={15} /> Agregar puesto
        </button>
      </SectionHead>
      <div className="tables-grid">
        {data.diningTables.map((t) => (
          <button
            className={`dining-table ${t.items.length ? "occupied" : ""}`}
            key={t.id}
            onClick={() => {
              setCart(t.items);
              setTableId(t.id);
              setTab("pos");
            }}
          >
            <span className="table-status">
              <i />
              {t.items.length ? "Con Pedido en Curso" : "Disponible"}
            </span>
            <div className="table-illustration">
              <Utensils size={27} strokeWidth={1.5} />
            </div>
            <h3>{t.name}</h3>
            <span className="table-seats">
              <Users size={13} /> Capacidad {t.seats}
            </span>
            <strong>
              {t.items.length
                ? money(sum(t.items, (i) => (data.products.find((p) => p.id === i.productId)?.price || 0) * i.quantity))
                : "Atender pedido"}
              <ArrowRight size={14} />
            </strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function ChannelsView() {
  const { data, open, money } = useApp();
  return (
    <section className="card">
      <SectionHead
        title="Listas de Precios por Canal"
        subtitle="Precios adaptados para distribuidores mayoristas, colegios o venta al detal."
      >
        <button className="button secondary" onClick={() => open("channel")}>
          <Plus size={15} /> Nuevo Canal
        </button>
      </SectionHead>
      <div className="info-banner">
        <CircleHelp size={18} />
        <span>
          El multiplicador ajusta automáticamente el catálogo. Por ejemplo, 0.88 otorga un 12% de descuento para pedidos corporativos.
        </span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Canal de Distribución</th>
              <th>Factor Multiplicador</th>
              <th>Ejemplo: Pantalón Táctico ($36)</th>
              <th>Artículos Afectados</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.settings.channels.map((c) => (
              <tr key={c.name}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>× {c.multiplier.toFixed(2)}</td>
                <td className="amount">{money(Math.round(36 * c.multiplier * 100) / 100)}</td>
                <td>{data.products.length} artículos</td>
                <td>
                  <button className="text-link" onClick={() => open("channel", c)}>
                    Editar factor
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CashView() {
  const { data, money, mutate, notify } = useApp();
  const [counted, setCounted] = useState(""),
    [opening, setOpening] = useState(data.settings.cashOpening.toString()),
    [busy, setBusy] = useState(false);

  const cashAccounts = data.accounts.filter((a) => a.method.toLowerCase().includes("efectivo"));
  const cashBalance = sum(cashAccounts, (a) => a.balance / (a.currency === "VES" ? data.settings.exchangeRate : 1));

  const submit = async () => {
    setBusy(true);
    try {
      await mutate(
        "cash.toggle",
        { counted: Number(counted), cashOpening: Number(opening) },
        data.settings.cashOpen ? "Arqueo completado y caja cerrada." : "Caja abierta para ventas del día."
      );
      setCounted("");
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cash-layout">
      <section className="card cash-main">
        <SectionHead title="Arqueo y Cierre de Caja Fábrica">
          <span className={`status-badge ${data.settings.cashOpen ? "paid" : "pending"}`}>
            <i /> Caja {data.settings.cashOpen ? "Abierta" : "Cerrada"}
          </span>
        </SectionHead>
        <div className="cash-hero">
          <span>
            <Banknote size={35} />
          </span>
          <p>Efectivo disponible en cajas de Fábrica Cristo Rey</p>
          <h2>{money(cashBalance)}</h2>
        </div>
        <div className="cash-breakdown">
          <div>
            <span>Fondo de apertura</span>
            <strong>{money(data.settings.cashOpening)}</strong>
          </div>
          <div>
            <span>Tasa BCV del día</span>
            <strong>Bs. {data.settings.exchangeRate.toFixed(2)} / $</strong>
          </div>
        </div>
        <div className="cash-form">
          {data.settings.cashOpen ? (
            <>
              <label>
                Efectivo total contado en caja (USD):
                <input type="number" min="0" step="0.01" placeholder="0.00" value={counted} onChange={(e) => setCounted(e.target.value)} />
              </label>
              {counted !== "" && (
                <div className={`reconciliation ${Math.abs(Number(counted) - cashBalance) < 0.05 ? "green" : "peach"}`}>
                  <span>Diferencia de arqueo:</span>
                  <strong>{money(Number(counted) - cashBalance)}</strong>
                </div>
              )}
              <button className="button primary full-width" disabled={busy || counted === ""} onClick={submit}>
                <LockKeyhole size={16} /> {busy ? "Guardando..." : "Confirmar Cierre de Caja"}
              </button>
            </>
          ) : (
            <>
              <label>
                Fondo de apertura (USD):
                <input type="number" min="0" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} />
              </label>
              <button className="button primary full-width" disabled={busy} onClick={submit}>
                <Plus size={16} /> Abrir Caja
              </button>
            </>
          )}
        </div>
      </section>

      <section className="card">
        <SectionHead title="Historial de Arqueos" subtitle="Trazabilidad de aperturas y cierres de caja." />
        {data.activities.filter((a) => a.type === "cash").length ? (
          <div className="activity-list">
            {data.activities
              .filter((a) => a.type === "cash")
              .map((a) => (
                <div key={a.id}>
                  <span className="movement-icon purple">
                    <Wallet size={18} />
                  </span>
                  <div>
                    <strong>{a.description}</strong>
                    <small>{dateLabel(a.createdAt, true)}</small>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <EmptyState title="Sin cierres registrados aún" />
        )}
      </section>
    </div>
  );
}
