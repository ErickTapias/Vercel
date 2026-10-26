"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  X,
  Plus,
  Trash2,
  Package,
  ArrowRight,
  ChevronLeft,
  Check,
  ShoppingBag,
  Wallet,
  CircleCheck,
  CircleHelp,
  AlertCircle,
  Download,
  Upload,
  FileSpreadsheet,
  Printer,
  Pencil,
  Mail,
  Phone,
  MapPin,
  Receipt,
  BookOpen,
  Sparkles,
  ArrowUpRight,
  Users,
  ChevronRight,
  ShieldCheck,
  Store,
  Send,
  Building2,
  QrCode,
  FileCheck,
  Info,
} from "lucide-react";
import { useApp, type DialogState } from "./app-context";
import { ProductImage, Avatar, SalesTable, SectionHead, StatusBadge } from "./ui";
import { dateLabel, sum, printReport, exportExcel } from "@/lib/utils";
import { buildSeniatPayload, generateSeniatInvoiceHtml } from "@/lib/seniat-invoice";
import { ImportBankStatement } from "./bank-reconcile-panel";
import type { Product, Account, Customer, Sale, Expense, Pending, Member, Campaign, DiningTable, Module } from "@/lib/types";

function Modal({ title, subtitle, children, wide = false, className = "" }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean; className?: string }) {
  const { close } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea, button");
    first?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const all = ref.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]");
      if (!all?.length) return;
      const first = all[0],
        last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`modal ${wide ? "wide" : ""} ${className}`}>
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button modal-close" onClick={close} aria-label="Cerrar ventana">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function SaveForm({
  action,
  children,
  prepare,
  label = "Guardar cambios",
  message,
}: {
  action: string;
  children: ReactNode;
  prepare?: (values: Record<string, FormDataEntryValue>, fd: FormData) => unknown;
  label?: string;
  message?: string;
}) {
  const { mutate, close } = useApp();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const fd = new FormData(e.currentTarget),
        values = Object.fromEntries(fd);
      await mutate(action, prepare ? prepare(values, fd) : values, message);
      close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        {children}
        {error && (
          <div className="form-error" role="alert">
            <AlertCircle size={17} />
            {error}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="button secondary" onClick={close}>
          Cancelar
        </button>
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? <span className="spinner" /> : <Check size={16} />}
          {busy ? "Guardando..." : label}
        </button>
      </div>
    </form>
  );
}

export function Dialogs({ dialog }: { dialog: NonNullable<DialogState> }) {
  switch (dialog.type) {
    case "product":
      return <ProductForm entity={(dialog.entity || {}) as Partial<Product>} />;
    case "account":
      return <AccountForm entity={(dialog.entity || {}) as Partial<Account>} />;
    case "customer":
      return <CustomerForm entity={(dialog.entity || {}) as Partial<Customer>} />;
    case "customer-detail":
      return <CustomerDetail customer={dialog.entity as Customer} />;
    case "expense":
      return <ExpenseForm />;
    case "expense-detail":
      return <ExpenseDetail expense={dialog.entity as Expense} />;
    case "pending":
      return <PendingForm />;
    case "settle":
      return <SettleForm entity={dialog.entity as Pending} />;
    case "transfer":
      return <TransferForm />;
    case "checkout":
      return <Checkout />;
    case "receipt":
      return <ReceiptView sale={dialog.entity as Sale} />;
    case "dates":
      return <DateForm />;
    case "import":
      return <ImportForm />;
    case "import-statement":
      return <ImportBankStatement />;
    case "campaign":
      return <CampaignForm entity={(dialog.entity || {}) as Partial<Campaign>} />;
    case "member":
      return <MemberForm entity={(dialog.entity || {}) as Partial<Member>} />;
    case "channel":
      return <ChannelForm entity={(dialog.entity || {}) as { name?: string; multiplier?: number }} />;
    case "table":
      return <TableForm entity={(dialog.entity || {}) as Partial<DiningTable>} />;
    default:
      return <HelpView />;
  }
}

// FORMULARIO DE PRODUCTO / RECETA / SERVICIO DTF / BORDADO
function ProductForm({ entity: e }: { entity: Partial<Product> }) {
  const { data, money } = useApp();
  const kind = e.kind || "product",
    noun = kind === "recipe" ? "receta / DTF" : kind === "service" ? "servicio" : "producto";
  const [cost, setCost] = useState(String(e.cost ?? "")),
    [price, setPrice] = useState(String(e.price ?? ""));
  const raw = data.products.filter((p) => p.kind === "product" && p.id !== e.id);
  const [ingredients, setIngredients] = useState(e.ingredients?.length ? e.ingredients : [{ productId: raw[0]?.id || 0, quantity: 1 }]);
  const [isExempt, setIsExempt] = useState(Boolean(e.isExempt));

  // Manejo de carga de múltiples imágenes y videos
  const [mediaList, setMediaList] = useState<string[]>(e.image ? [e.image] : []);
  const [videoPreview, setVideoPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const handleImagesUpload = (files: FileList | null) => {
    if (!files || !files.length) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          setMediaList((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setVideoPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeMedia = (index: number) => {
    setMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  const actualCost = kind === "recipe" ? sum(ingredients, (i) => (data.products.find((p) => p.id === i.productId)?.cost || 0) * i.quantity) : Number(cost);

  return (
    <Modal
      title={`${e.id ? "Editar" : "Agregar"} ${noun}`}
      subtitle="Define especificaciones, precios y relación de insumos para Fábrica Cristo Rey."
      wide
    >
      <SaveForm
        action="product.save"
        label={e.id ? "Guardar cambios" : `Crear ${noun}`}
        message={`${noun[0].toUpperCase() + noun.slice(1)} ${e.id ? "actualizado" : "guardado"} con éxito`}
        prepare={(v) => ({
          ...v,
          id: e.id,
          kind,
          ingredients,
          isExempt,
          image: mediaList[0] || (v.image as string) || "",
        })}
      >
        <div className="form-section-label">
          <Package size={16} /> Información del artículo / servicio
        </div>
        <div className="form-grid">
          <label className="full-span">
            Nombre del artículo o servicio
            <input
              name="name"
              required
              placeholder="Ej. Servicio de Impresión DTF Textil (Metro 60cm)"
              defaultValue={e.name}
              maxLength={150}
            />
          </label>

          {kind === "product" && (
            <>
              <label>
                Cantidad en existencia
                <input name="stock" type="number" required step="any" min="0" placeholder="0" defaultValue={e.stock ?? ""} />
              </label>
              <label>
                Unidad de medida
                <select name="unit" defaultValue={e.unit || "unidad"}>
                  <option value="unidad">Unidades (uds.)</option>
                  <option value="m">Metros lineales (m)</option>
                  <option value="kg">Kilogramos (kg)</option>
                  <option value="rollo">Rollos</option>
                  <option value="cono">Conos de hilo</option>
                </select>
              </label>
            </>
          )}

          {kind !== "recipe" && (
            <label>
              Costo unitario (USD)
              <div className="input-prefix">
                <span>$</span>
                <input name="cost" type="number" min="0" step="any" required value={cost} onChange={(ev) => setCost(ev.target.value)} placeholder="0.00" />
              </div>
            </label>
          )}

          <label>
            Precio de venta (USD)
            <div className="input-prefix">
              <span>$</span>
              <input name="price" type="number" min="0" step="any" required value={price} onChange={(ev) => setPrice(ev.target.value)} placeholder="0.00" />
            </div>
          </label>

          <label>
            Categoría
            <input name="category" list="product-categories" defaultValue={e.category || "Uniformes"} placeholder="Selecciona o escribe" />
            <datalist id="product-categories">
              <option value="Tácticos" />
              <option value="Industria y Obra" />
              <option value="Corporativos" />
              <option value="Escolares" />
              <option value="Accesorios" />
              <option value="Servicio DTF" />
              <option value="Bordado Industrial" />
              <option value="Materia prima" />
            </datalist>
          </label>

          <label>
            Referencia / SKU
            <input name="sku" defaultValue={e.sku} placeholder="Ej. CR-DTF-001" />
          </label>
        </div>

        {/* SUBIDA DE MÚLTIPLES FOTOS Y VIDEO DEL PRODUCTO */}
        <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Upload size={14} className="text-purple-600" /> Galería de Imágenes del Producto (Múltiples Fotos)
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {mediaList.length} imagen(es) cargada(s)
            </span>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {mediaList.map((src, idx) => (
              <div key={idx} className="relative w-16 h-16 rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden group shadow-2xs bg-white dark:bg-slate-800">
                <img src={src} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeMedia(idx)}
                  className="absolute top-1 right-1 w-4 h-4 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] opacity-80 hover:opacity-100"
                  title="Eliminar foto"
                >
                  ✕
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 flex flex-col items-center justify-center text-[9.5px] font-semibold hover:border-purple-500 hover:bg-purple-50 transition-all"
            >
              <Plus size={16} />
              <span>+ Fotos</span>
            </button>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            multiple
            accept="image/*"
            className="hidden"
            onChange={(ev) => handleImagesUpload(ev.target.files)}
          />

          {/* Subida de Video Demostrativo del Producto */}
          <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                🎬 Video de Demostración del Producto / Prenda (Opcional)
              </span>
              {videoPreview && (
                <button
                  type="button"
                  onClick={() => setVideoPreview("")}
                  className="text-[10px] text-red-600 hover:underline"
                >
                  Quitar video
                </button>
              )}
            </div>

            <input
              type="file"
              ref={videoInputRef}
              accept="video/*"
              className="text-xs w-full text-slate-600 dark:text-slate-300"
              onChange={(ev) => handleVideoUpload(ev.target.files?.[0])}
            />

            {videoPreview && (
              <div className="mt-2 p-2 bg-black/5 dark:bg-black/40 rounded-lg">
                <video src={videoPreview} controls className="max-h-36 mx-auto rounded" />
                <small className="text-[10px] text-emerald-600 font-semibold block text-center mt-1">
                  ✓ Video cargado listo para exhibición en catálogo
                </small>
              </div>
            )}
          </div>
        </div>

        {/* Exención de IVA según ley venezolana */}
        <div className="mt-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input type="checkbox" checked={isExempt} onChange={(ev) => setIsExempt(ev.target.checked)} />
            <span>
              <strong>Producto / Servicio Exento de IVA</strong> (Según Art. 17 y 18 Ley de IVA SENIAT)
            </span>
          </label>
        </div>

        {/* Insumos para DTF o Recetas */}
        {kind === "recipe" && (
          <div className="recipe-ingredients">
            <div className="form-section-label">
              <ShoppingBag size={16} /> Insumos necesarios por cada unidad producida
            </div>
            {ingredients.map((i, index) => (
              <div className="ingredient-row" key={index}>
                <select
                  aria-label={`Insumo ${index + 1}`}
                  value={i.productId}
                  onChange={(event) =>
                    setIngredients(ingredients.map((r, n) => (n === index ? { ...r, productId: Number(event.target.value) } : r)))
                  }
                >
                  {raw.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit}) · Costo: ${p.cost}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Cantidad ${index + 1}`}
                  type="number"
                  min="0.001"
                  step="any"
                  required
                  value={i.quantity}
                  onChange={(event) =>
                    setIngredients(ingredients.map((r, n) => (n === index ? { ...r, quantity: Number(event.target.value) } : r)))
                  }
                />
                <span>{money((data.products.find((p) => p.id === i.productId)?.cost || 0) * i.quantity)}</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Eliminar insumo"
                  onClick={() => setIngredients(ingredients.filter((_, n) => n !== index))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              className="text-link"
              type="button"
              onClick={() => setIngredients([...ingredients, { productId: raw[0]?.id || 0, quantity: 1 }])}
            >
              <Plus size={15} /> Agregar insumo a la fórmula
            </button>
          </div>
        )}

        <div className="product-profit-preview">
          <div>
            <span>Costo de producción</span>
            <strong>{money(actualCost || 0)}</strong>
          </div>
          <div>
            <span>Margen de ganancia</span>
            <strong className="positive">{money((Number(price) || 0) - (actualCost || 0))}</strong>
          </div>
          <div>
            <span>Rentabilidad neta</span>
            <strong>{Number(price) ? (((Number(price) - actualCost) / Number(price)) * 100).toFixed(1) : "0.0"}%</strong>
          </div>
        </div>

        <details className="advanced-fields">
          <summary>
            Campos avanzados y variaciones <ChevronRight size={15} />
          </summary>
          <div className="form-grid">
            <label>
              Tallas, colores o especificación técnica
              <input name="variation" defaultValue={e.variation} placeholder="Ej. Tallas S a XXL · Colores varios" />
            </label>
            <label>
              Stock de seguridad para alerta
              <input name="minStock" type="number" min="0" step="1" defaultValue={e.minStock ?? 5} />
            </label>
            <label className="full-span">
              Ubicación en Fábrica
              <input name="location" defaultValue={e.location || "Taller Principal Los Ruices"} />
            </label>
            <label className="full-span">
              URL externa alternativa (Opcional)
              <input name="image" defaultValue={e.image} placeholder="/images/... o https://..." />
            </label>
            <label className="full-span">
              Descripción detallada
              <textarea name="description" rows={3} defaultValue={e.description} placeholder="Detalles de tela, confección o acabados." />
            </label>
          </div>
        </details>
      </SaveForm>
    </Modal>
  );
}

// FORMULARIO DE CUENTAS
function AccountForm({ entity: e }: { entity: Partial<Account> }) {
  const [currency, setCurrency] = useState(e.currency || "USD");
  return (
    <Modal title={e.id ? "Editar cuenta" : "Nueva cuenta bancaria o caja"} subtitle="Maneja cuentas en bolívares y dólares con saldo en tiempo real.">
      <SaveForm action="account.save" label={e.id ? "Guardar cuenta" : "Crear cuenta"} prepare={(v) => ({ ...v, id: e.id })}>
        <div className="form-grid">
          <label className="full-span">
            Nombre de la cuenta
            <input name="name" required placeholder="Ej. Banesco Banco Universal (Corriente)" defaultValue={e.name} />
          </label>
          <label>
            Moneda
            <select name="currency" value={currency} onChange={(ev) => setCurrency(ev.target.value)}>
              <option value="USD">Dólares (USD)</option>
              <option value="VES">Bolívares (VES)</option>
            </select>
          </label>
          <label>
            {e.id ? "Saldo actual" : "Saldo inicial"} ({currency})
            <input name="balance" type="number" min="0" step="0.01" required defaultValue={e.balance ?? 0} />
          </label>
          <label className="full-span">
            Método de pago asociado
            <input name="method" placeholder="Ej. Pago móvil, Transferencia, Zelle, Efectivo..." required defaultValue={e.method} />
          </label>
          <label>
            Comisión bancaria (%)
            <input name="commission" type="number" min="0" max="100" step="0.01" defaultValue={e.commission || 0} />
          </label>
          <label>
            Color distintivo
            <select name="color" defaultValue={e.color || "purple"}>
              <option value="purple">Violeta</option>
              <option value="green">Verde</option>
              <option value="blue">Azul</option>
              <option value="red">Rojo</option>
            </select>
          </label>
        </div>
      </SaveForm>
    </Modal>
  );
}

// FORMULARIO DE CLIENTE CON RIF VENEZOLANO
function CustomerForm({ entity: e }: { entity: Partial<Customer> }) {
  return (
    <Modal title={e.id ? "Editar cliente" : "Registrar nuevo cliente"} subtitle="Datos fiscales requeridos por el SENIAT para emitir factura digital.">
      <SaveForm action="customer.save" label={e.id ? "Guardar cliente" : "Registrar cliente"} prepare={(v) => ({ ...v, id: e.id })}>
        <div className="form-grid">
          <label className="full-span">
            Nombre o Razón Social
            <input name="name" required defaultValue={e.name} placeholder="Ej. Inversiones Cristo Rey C.A." />
          </label>
          <label>
            RIF o Cédula de Identidad (SENIAT)
            <input name="document" required defaultValue={e.document} placeholder="Ej. J-40912384-9 o V-18902123" />
          </label>
          <label>
            Condición Tributaria
            <select name="taxPayerType" defaultValue={e.taxPayerType || "Ordinario"}>
              <option value="Ordinario">Contribuyente Ordinario</option>
              <option value="Especial">Contribuyente Especial (Retiene IVA)</option>
              <option value="Formal">Contribuyente Formal</option>
              <option value="Persona Natural">Persona Natural / Consumidor Final</option>
            </select>
          </label>
          <label className="full-span">
            Correo Electrónico (Para envío automático de factura)
            <input name="email" type="email" defaultValue={e.email} placeholder="facturacion@empresa.com" />
          </label>
          <label>
            Teléfono de contacto
            <input name="phone" type="tel" defaultValue={e.phone} placeholder="+58 414 000 0000" />
          </label>
          <label className="full-span">
            Dirección Fiscal Completa
            <input name="address" defaultValue={e.address} placeholder="Ciudad, Municipio, Calle, Edificio o Local" />
          </label>
        </div>
      </SaveForm>
    </Modal>
  );
}

// DETALLE DE CLIENTE
function CustomerDetail({ customer: c }: { customer: Customer }) {
  const { data, money, open } = useApp();
  const sales = data.sales.filter((s) => s.customerId === c.id);
  const total = sum(sales, (s) => s.total);
  const days = sales.length ? Math.max(0, Math.floor((Date.now() - new Date(sales[0].createdAt).getTime()) / 86400000)) : null;

  // Órdenes de producción / taller asociadas a este cliente
  const clientWorkshopOrders = (data.productionOrders || []).filter(
    (o) => o.customerName.toLowerCase() === c.name.toLowerCase() || (c.phone && o.customerPhone === c.phone) || (c.email && o.customerEmail === c.email)
  );

  // Análisis de productos más comprados por el cliente
  const productFrequency: Record<string, { name: string; qty: number; totalSpent: number }> = {};
  sales.forEach((s) => {
    (s.items || []).forEach((it) => {
      if (!productFrequency[it.name]) {
        productFrequency[it.name] = { name: it.name, qty: 0, totalSpent: 0 };
      }
      productFrequency[it.name].qty += it.quantity || 1;
      productFrequency[it.name].totalSpent += (it.quantity || 1) * (it.price || 0);
    });
  });
  const topClientProducts = Object.values(productFrequency).sort((a, b) => b.qty - a.qty).slice(0, 5);

  // Comportamiento de pago y crédito
  const clientPending = data.pending.filter((p) => p.contact.toLowerCase() === c.name.toLowerCase() && p.status === "pending");
  const pendingTotal = sum(clientPending, (p) => p.amount);

  return (
    <Modal title="Expediente Fiscal y Comportamiento Integral de Cliente" subtitle="Historial de compras, órdenes de taller, productos favoritos y estado de solvencia." wide>
      <div className="modal-body space-y-4">
        <div className="customer-profile-heading">
          <Avatar name={c.name} />
          <div>
            <h3>{c.name}</h3>
            <span className="font-mono text-purple font-semibold">{c.document || "V-00000000-0"}</span>
            <span className="status-badge paid ml-2">{c.taxPayerType || "Ordinario"}</span>
            <span className={`status-badge ml-1.5 ${pendingTotal > 0 ? "pending" : "paid"}`}>
              {pendingTotal > 0 ? `Saldo Pendiente: ${money(pendingTotal)}` : "Solvente (0 Deudas)"}
            </span>
          </div>
          <button className="button secondary text-xs" onClick={() => open("customer", c)}>
            <Pencil size={14} /> Editar Datos
          </button>
        </div>

        <div className="customer-contact">
          <span>
            <Mail size={15} /> {c.email || "Sin correo"}
          </span>
          <span>
            <Phone size={15} /> {c.phone || "Sin teléfono"}
          </span>
          {c.address && (
            <span>
              <MapPin size={15} /> {c.address}
            </span>
          )}
        </div>

        <div className="customer-detail-stats">
          <div>
            <span>Total Comprado Histórico</span>
            <strong>{money(total)}</strong>
          </div>
          <div>
            <span>Facturas Registradas</span>
            <strong>{sales.length} facturas</strong>
          </div>
          <div>
            <span>Ticket Promedio</span>
            <strong>{money(sales.length ? total / sales.length : 0)}</strong>
          </div>
          <div>
            <span>Frecuencia de Compra</span>
            <strong>{days === null ? "Sin compras" : days === 0 ? "Compró Hoy" : `Hace ${days} días`}</strong>
          </div>
        </div>

        {/* Productos y Uniformes más solicitados por el cliente */}
        {topClientProducts.length > 0 && (
          <div className="p-3 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-xl">
            <span className="text-xs font-bold text-purple-950 dark:text-purple-200 block mb-2">
              🏆 Prendas y Servicios Más Comprados por este Cliente:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {topClientProducts.map((p, idx) => (
                <div key={idx} className="p-2 bg-white dark:bg-slate-900 rounded-lg border flex justify-between items-center">
                  <span className="truncate max-w-[190px] font-semibold text-slate-800 dark:text-slate-200">
                    {idx + 1}. {p.name}
                  </span>
                  <span className="text-purple-700 dark:text-purple-300 font-mono font-bold text-[11px]">
                    {p.qty} uds. ({money(p.totalSpent)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trabajos de taller (DTF, Bordados, Costura) de este cliente */}
        {clientWorkshopOrders.length > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200 block mb-1">
              🧵 Trabajos Activos en Taller &amp; Producción ({clientWorkshopOrders.length}):
            </span>
            {clientWorkshopOrders.map((wo) => (
              <div key={wo.id} className="p-2 bg-white dark:bg-slate-950 rounded border flex items-center justify-between text-xs">
                <div>
                  <strong className="text-purple-700 dark:text-purple-300 font-mono">{wo.orderNumber}</strong> · <span>{wo.station === "plotter_dtf" ? "DTF I3200" : wo.station === "bordadora" ? "Bordado" : "Costura"}</span>
                  <div className="text-[10px] text-slate-500 mt-0.5">{wo.dimensions} · {wo.fileName}</div>
                </div>
                <span className={`status-badge ${wo.status === "listo_para_retirar" ? "paid" : wo.status === "en_proceso" ? "pending" : "overdue"}`}>
                  <i /> {wo.status === "listo_para_retirar" ? "Listo en Oficina" : wo.status === "en_proceso" ? "En Producción" : "En Espera"}
                </span>
              </div>
            ))}
          </div>
        )}

        <SectionHead title="Historial Completo de Facturas Emitidas" subtitle="Correlativo SENIAT, fecha, monto y estado" />
        <SalesTable sales={sales} compact />
      </div>
    </Modal>
  );
}

// GASTOS CON SOPORTE LEGAL / INTERNO / PERSONAL
function ExpenseForm() {
  const { data } = useApp();
  const [scope, setScope] = useState<"business" | "internal" | "personal">("business");
  const [amount, setAmount] = useState("");
  const [taxableBase, setTaxableBase] = useState("");
  const [ivaAmount, setIvaAmount] = useState("");
  const [receiptPhoto, setReceiptPhoto] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = Number(val) || 0;
    if (scope === "business") {
      const base = +(num / 1.16).toFixed(2);
      const iva = +(num - base).toFixed(2);
      setTaxableBase(String(base));
      setIvaAmount(String(iva));
    } else {
      setTaxableBase(val);
      setIvaAmount("0");
    }
  };

  const handlePhotoUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal
      title="Registrar Egreso con Soporte Fiscal / Interno"
      subtitle="Clasifica tus gastos para mantener el Libro de Compras SENIAT auditable y adjunta foto de respaldo."
      wide
    >
      <SaveForm
        action="expense.create"
        label="Confirmar egreso"
        message="Egreso registrado y conciliado en la cuenta seleccionada"
        prepare={(v) => ({
          ...v,
          scope,
          taxableBase: Number(taxableBase),
          ivaAmount: Number(ivaAmount),
          receiptUrl: receiptPhoto,
        })}
      >
        {/* Selector de Ámbito */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mb-4">
          <label className="text-xs font-semibold mb-2 block">Ámbito del gasto:</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className={`p-2 rounded text-xs font-medium border text-left ${scope === "business" ? "bg-purple-50 border-purple-400 text-purple-700" : "bg-white border-slate-200"}`}
              onClick={() => {
                setScope("business");
                handleAmountChange(amount);
              }}
            >
              <strong>1. Operativo (Fiscal)</strong>
              <small className="block text-slate-500">Factura proveedor con IVA deducible</small>
            </button>
            <button
              type="button"
              className={`p-2 rounded text-xs font-medium border text-left ${scope === "internal" ? "bg-purple-50 border-purple-400 text-purple-700" : "bg-white border-slate-200"}`}
              onClick={() => {
                setScope("internal");
                handleAmountChange(amount);
              }}
            >
              <strong>2. Interno / Caja Chica</strong>
              <small className="block text-slate-500">Recibo interno, refrigerios, pasajes</small>
            </button>
            <button
              type="button"
              className={`p-2 rounded text-xs font-medium border text-left ${scope === "personal" ? "bg-purple-50 border-purple-400 text-purple-700" : "bg-white border-slate-200"}`}
              onClick={() => {
                setScope("personal");
                handleAmountChange(amount);
              }}
            >
              <strong>3. Retiro Personal Socio</strong>
              <small className="block text-slate-500">No imputable al costo de la empresa</small>
            </button>
          </div>
        </div>

        <div className="form-grid">
          <label className="full-span">
            Concepto del gasto
            <input name="name" required placeholder="Ej. Compra de rollos de tela gabardina para uniformes" />
          </label>
          <label>
            Tipo de gasto
            <select name="type">
              <option value="variable">Gasto Variable / Insumos</option>
              <option value="fixed">Gasto Fijo Mensual</option>
            </select>
          </label>
          <label>
            Categoría
            <select name="category">
              <option>Insumos DTF</option>
              <option>Telas e Hilos</option>
              <option>Alquiler</option>
              <option>Nómina</option>
              <option>Servicios Públicos / Internet</option>
              <option>Mantenimiento de Maquinaria</option>
              <option>Caja Chica</option>
              <option>Retiro Personal</option>
              <option>Otros</option>
            </select>
          </label>
          <label>
            Monto total (USD)
            <div className="input-prefix">
              <span>$</span>
              <input
                name="amount"
                required
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(ev) => handleAmountChange(ev.target.value)}
              />
            </div>
          </label>
          <label>
            Fecha del comprobante
            <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>
          <label className="full-span">
            Cuenta de egreso
            <select name="accountId" required>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency}) · Saldo: ${a.balance}
                </option>
              ))}
            </select>
          </label>

          {/* Soportes fiscales SENIAT si es operativo */}
          {scope === "business" && (
            <>
              <div className="full-span text-xs font-semibold text-purple-700 pt-2 border-t">
                Soporte de Factura del Proveedor (Libro de Compras SENIAT):
              </div>
              <label>
                Proveedor o Razón Social
                <input name="beneficiary" placeholder="Ej. Textiles del Centro C.A." />
              </label>
              <label>
                RIF del Proveedor
                <input name="beneficiaryRif" placeholder="J-30912834-1" />
              </label>
              <label>
                N° de Factura Proveedor
                <input name="invoiceNumber" placeholder="FAC-001293" />
              </label>
              <label>
                N° de Control
                <input name="controlNumber" placeholder="00-091823" />
              </label>
              <label>
                Base Imponible ($)
                <input
                  name="taxableBase"
                  type="number"
                  step="0.01"
                  value={taxableBase}
                  onChange={(ev) => setTaxableBase(ev.target.value)}
                />
              </label>
              <label>
                IVA Crédito Fiscal 16% ($)
                <input name="ivaAmount" type="number" step="0.01" value={ivaAmount} onChange={(ev) => setIvaAmount(ev.target.value)} />
              </label>
            </>
          )}

          {scope !== "business" && (
            <label className="full-span">
              Beneficiario / Responsable
              <input
                name="beneficiary"
                defaultValue={scope === "personal" ? data.settings.ownerName : "Responsable de Caja Chica"}
              />
            </label>
          )}

          {/* SUBIR FOTO DE LA FACTURA / TICKET DE RESPALDO */}
          <div className="full-span p-3 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-xs font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                <Upload size={14} className="text-purple-600" /> Foto o Comprobante Digital del Gasto (Respaldo)
              </span>
              {receiptPhoto && (
                <button
                  type="button"
                  onClick={() => setReceiptPhoto("")}
                  className="text-[10px] text-red-600 hover:underline flex items-center gap-0.5"
                >
                  <X size={12} /> Quitar foto
                </button>
              )}
            </div>
            
            <input
              type="file"
              ref={photoInputRef}
              accept="image/*,.pdf"
              className="text-xs w-full mb-2"
              onChange={(ev) => handlePhotoUpload(ev.target.files?.[0])}
            />

            {receiptPhoto ? (
              <div className="mt-2 text-center p-2 bg-white dark:bg-slate-900 border rounded-lg">
                <img
                  src={receiptPhoto}
                  alt="Vista previa factura soporte"
                  className="max-h-40 mx-auto object-contain rounded border shadow-sm"
                />
                <small className="text-[10px] text-emerald-600 font-semibold block mt-1">
                  ✓ Foto de comprobante cargada correctamente
                </small>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Puedes tomar una foto con tu teléfono o seleccionar la imagen/PDF de la factura física o recibo para auditorías.
              </p>
            )}
          </div>

          <label className="full-span">
            Observaciones o justificación
            <textarea name="notes" rows={2} placeholder="Número de comprobante, observaciones de auditoría o justificación." />
          </label>
        </div>
      </SaveForm>
    </Modal>
  );
}

// DETALLE DE GASTO
function ExpenseDetail({ expense: e }: { expense: Expense }) {
  const { data, money, close } = useApp();
  return (
    <Modal title="Soporte y Detalle del Gasto" subtitle={dateLabel(e.createdAt, true)} wide>
      <div className="modal-body">
        <div className="settlement-summary">
          <span>{e.name}</span>
          <h3>{money(e.amount)}</h3>
          <small>
            {e.category} ·{" "}
            <span className="font-semibold text-purple">
              {e.scope === "personal" ? "Retiro Personal Socio" : e.scope === "internal" ? "Caja Chica / Interno" : "Operativo Fiscal SENIAT"}
            </span>
          </small>
        </div>
        {[
          { label: "Beneficiario", value: e.beneficiary || "—" },
          { label: "RIF Beneficiario", value: e.beneficiaryRif || "—" },
          { label: "N° Factura / Soporte", value: e.invoiceNumber || "REC-INT" },
          { label: "N° de Control", value: e.controlNumber || "00-INT" },
          { label: "Base Imponible", value: money(e.taxableBase) },
          { label: "IVA Crédito Fiscal", value: money(e.ivaAmount) },
          { label: "Cuenta de Origen", value: data.accounts.find((a) => a.id === e.accountId)?.name || "—" },
          { label: "Fecha de Registro", value: dateLabel(e.createdAt, true) },
        ].map((r) => (
          <div className="confirm-detail" key={r.label}>
            <span>{r.label}</span>
            <strong>{r.value}</strong>
          </div>
        ))}

        {/* FOTO DEL COMPROBANTE ADJUNTO */}
        {e.receiptUrl ? (
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block mb-2 flex items-center gap-1.5">
              <FileCheck size={16} className="text-purple-600" /> Foto / Documento de Respaldo Adjunto:
            </span>
            <div className="text-center p-2 bg-white dark:bg-slate-950 rounded border">
              <img
                src={e.receiptUrl}
                alt={`Comprobante ${e.name}`}
                className="max-h-72 mx-auto object-contain rounded shadow-sm"
              />
            </div>
          </div>
        ) : (
          <div className="info-banner mt-3">
            <Info size={16} />
            <span>Sin archivo de foto adjunto. Se respalda mediante los datos de factura y control indicados.</span>
          </div>
        )}

        {e.notes && (
          <div className="info-banner mt-3">
            <Info size={16} />
            <span>
              <strong>Notas:</strong> {e.notes}
            </span>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="button primary" onClick={close}>
          Entendido <Check size={16} />
        </button>
      </div>
    </Modal>
  );
}

// CUENTA PENDIENTE
function PendingForm() {
  return (
    <Modal title="Registrar Cuenta Pendiente" subtitle="Control de cuentas por cobrar a clientes o cuentas por pagar a proveedores.">
      <SaveForm action="pending.create" label="Registrar cuenta">
        <div className="form-grid">
          <label className="full-span">
            Tipo de cuenta
            <select name="type">
              <option value="receivable">Cuenta por Cobrar · Cliente nos debe</option>
              <option value="payable">Cuenta por Pagar · Debemos a proveedor</option>
            </select>
          </label>
          <label className="full-span">
            Concepto
            <input name="name" required placeholder="Ej. Saldo lote uniformes Fábrica Cristo Rey" />
          </label>
          <label className="full-span">
            Cliente o Proveedor
            <input name="contact" required placeholder="Nombre de la empresa o persona" />
          </label>
          <label>
            Monto pendiente (USD)
            <input name="amount" type="number" required min="0.01" step="0.01" placeholder="0.00" />
          </label>
          <label>
            Fecha de vencimiento
            <input name="dueDate" required type="date" defaultValue={new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)} />
          </label>
        </div>
      </SaveForm>
    </Modal>
  );
}

// SALDAR CUENTA PENDIENTE
function SettleForm({ entity: e }: { entity: Pending }) {
  const { data, money } = useApp();
  return (
    <Modal title={e.type === "receivable" ? "Cobro de Cuenta Pendiente" : "Pago a Proveedor"} subtitle="Registra el ingreso o egreso en la cuenta correspondiente.">
      <SaveForm action="pending.settle" label={e.type === "receivable" ? "Confirmar cobro" : "Confirmar pago"} prepare={(v) => ({ ...v, id: e.id })}>
        <div className="settlement-summary">
          <span>{e.name}</span>
          <h3>{money(e.amount)}</h3>
          <small>
            {e.contact} · Vence: {dateLabel(e.dueDate + "T12:00:00")}
          </small>
        </div>
        <label>
          {e.type === "receivable" ? "¿En qué cuenta ingresó el dinero?" : "¿Desde qué cuenta se pagó?"}
          <select name="accountId" required>
            {data.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency}) · {a.method}
              </option>
            ))}
          </select>
        </label>
      </SaveForm>
    </Modal>
  );
}

// TRANSFERENCIA ENTRE CUENTAS
function TransferForm() {
  const { data } = useApp();
  return (
    <Modal title="Transferencia entre Cuentas" subtitle="Mueve fondos entre bancos en dólares, bolívares y caja chica.">
      <SaveForm action="account.transfer" label="Confirmar transferencia">
        <div className="form-grid">
          <label className="full-span">
            Cuenta de Origen
            <select name="from" required>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency}) · Saldo: ${a.balance}
                </option>
              ))}
            </select>
          </label>
          <label className="full-span">
            Cuenta de Destino
            <select name="to" required defaultValue={data.accounts[1]?.id}>
              {data.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency}) · Saldo: ${a.balance}
                </option>
              ))}
            </select>
          </label>
          <label className="full-span">
            Monto a transferir (USD)
            <input name="amount" type="number" required min="0.01" step="0.01" placeholder="0.00" />
          </label>
        </div>
        <div className="info-banner">
          <CircleHelp size={17} />
          <span>Para cuentas en bolívares se aplicará automáticamente la tasa de referencia oficial BCV de Bs. {data.settings.exchangeRate.toFixed(2)}.</span>
        </div>
      </SaveForm>
    </Modal>
  );
}

// CHECKOUT FISCAL SENIAT DIGITAL CON ENVÍO DE CORREO AUTOMÁTICO
function Checkout() {
  const { data, cart, setCart, channel, tableId, setTableId, money, mutate, open, close } = useApp();
  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerRif, setCustomerRif] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [includeIgtf, setIncludeIgtf] = useState(false);
  const [extra, setExtra] = useState("");
  const [credit, setCredit] = useState(false);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const [cashGiven, setCashGiven] = useState("");

  const multiplier = data.settings.channels.find((c) => c.name === channel)?.multiplier || 1;
  const items = cart
    .map((i) => ({ ...i, product: data.products.find((p) => p.id === i.productId)! }))
    .filter((i) => i.product);

  // Desglose de base imponible e IVA
  const subtotalBase = items
    .filter((i) => !i.product.isExempt)
    .reduce((s, i) => s + Math.round(i.product.price * multiplier * 100) / 100 * i.quantity, 0);
  const subtotalExempt = items
    .filter((i) => i.product.isExempt)
    .reduce((s, i) => s + Math.round(i.product.price * multiplier * 100) / 100 * i.quantity, 0);

  const ivaAmount = Math.round(subtotalBase * (data.settings.defaultIva / 100) * 100) / 100;
  const baseTotal = Math.round((subtotalBase + subtotalExempt + ivaAmount) * 100) / 100;
  const total = Math.round((baseTotal + Number(extra || 0)) * 100) / 100;

  const [payments, setPayments] = useState([
    {
      accountId: data.accounts[0]?.id || 0,
      amount: total,
      paymentType: data.accounts[0]?.method || "Pago móvil",
      bankName: data.accounts[0]?.name || "Banesco Banco Universal",
      reference: "",
    },
  ]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const paid = Math.round(sum(payments, (p) => p.amount) * 100) / 100;
  const customer = data.customers.find((c) => c.id === Number(customerId));

  const handleCustomerSelect = (idStr: string) => {
    setCustomerId(idStr);
    const selected = data.customers.find((c) => c.id === Number(idStr));
    if (selected) {
      setCustomerName(selected.name);
      setCustomerRif(selected.document);
      setCustomerEmail(selected.email);
      setCustomerAddress(selected.address);
    }
  };

  const next = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (step === 1) {
      if (credit && !customerId && !customerRif) {
        return setError("Para ventas a crédito se requiere RIF o datos del cliente.");
      }
      return setStep(2);
    }
    if (step === 2) {
      if (paid > total + 0.02) {
        return setError("El pago supera el total de la factura. Registra el monto neto sin el vuelto.");
      }
      if (!credit && Math.abs(total - paid) > 0.05) {
        return setError("Los pagos deben cubrir exactamente el total de la factura.");
      }
      return setStep(3);
    }

    setBusy(true);
    try {
      const result = await mutate(
        "sale.create",
        {
          items: cart,
          customerId: customerId || null,
          customerName: customerName || (customer?.name ?? "Cliente general"),
          customerRif: customerRif || (customer?.document ?? "V-00000000-0"),
          customerEmail: customerEmail || (customer?.email ?? ""),
          customerAddress: customerAddress || (customer?.address ?? "Caracas, Venezuela"),
          sendEmail,
          includeIgtf,
          channel,
          payments: payments.filter((p) => p.amount > 0),
          extra: Number(extra || 0),
          credit,
          dueDate,
          tableId,
        },
        sendEmail && (customerEmail || customer?.email)
          ? `Factura legal emitida y enviada por correo a ${customerEmail || customer?.email}`
          : "Factura fiscal emitida y registrada en libros auditables"
      );
      setCart([]);
      setTableId(null);
      open("receipt", result.sale);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Emisión de Factura Fiscal Digital (SENIAT)"
      subtitle="Genera una factura con valor legal, número de control y envío automático por correo."
      wide
      className="checkout-modal"
    >
      <div className="checkout-steps">
        {["Datos Fiscales", "Forma de Pago", "Confirmación y Envío"].map((label, i) => (
          <div className={step > i + 1 ? "done" : step === i + 1 ? "current" : ""} key={label}>
            <span>{step > i + 1 ? <Check size={14} /> : i + 1}</span>
            {label}
            {i < 2 && <i />}
          </div>
        ))}
      </div>

      <form onSubmit={next}>
        <div className="modal-body">
          {/* PASO 1: DATOS FISCALES DEL CLIENTE */}
          {step === 1 && (
            <div className="checkout-customer">
              <span className="checkout-section-icon">
                <Building2 size={28} />
              </span>
              <h3>Identificación Fiscal del Comprador</h3>
              <p>Requisitos según Providencia 0071 / PA 102 del SENIAT para que la factura sirva legalmente.</p>

              <label className="text-left mt-4">
                Seleccionar de la base de clientes:
                <select value={customerId} onChange={(e) => handleCustomerSelect(e.target.value)}>
                  <option value="">Cliente Ocasional / Ingresar manualmente</option>
                  {data.customers.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name} · {c.document} ({c.taxPayerType})
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-grid mt-3 text-left">
                <label className="full-span">
                  Nombre o Razón Social
                  <input
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ej. Distribuidora Los Andes C.A."
                  />
                </label>
                <label>
                  RIF o Cédula de Identidad
                  <input
                    required
                    value={customerRif}
                    onChange={(e) => setCustomerRif(e.target.value)}
                    placeholder="J-30894123-5 o V-18902345"
                  />
                </label>
                <label>
                  Correo Electrónico (Factura Digital)
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="facturacion@cliente.com"
                  />
                </label>
                <label className="full-span">
                  Dirección Fiscal
                  <input
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Av., Calle, Edificio o Local"
                  />
                </label>
              </div>

              {/* Opción de envío por correo */}
              <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg text-left flex items-start gap-3">
                <input
                  type="checkbox"
                  id="sendEmailCheck"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="mt-1"
                />
                <label htmlFor="sendEmailCheck" className="text-xs text-purple-900 cursor-pointer">
                  <strong>Enviar factura digital en formato PDF por correo electrónico al cliente</strong>
                  <p className="text-purple-700 text-[10px] mt-0.5">
                    Evita el uso de papel y cumple con la Providencia 102 de entrega electrónica inmediata.
                  </p>
                </label>
              </div>

              <div className="checkout-order-mini">
                <span>
                  {sum(cart, (i) => i.quantity)} artículos · Base: {money(subtotalBase)} + IVA: {money(ivaAmount)}
                </span>
                <strong>{money(total)}</strong>
              </div>
            </div>
          )}

          {/* PASO 2: FORMAS DE PAGO */}
          {step === 2 && (
            <>
              <div className="payment-total">
                <span>Total Factura con IVA (16%)</span>
                <strong>{money(total)}</strong>
                <small>
                  Equivalente oficial BCV: Bs. {(total * data.settings.exchangeRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </small>
              </div>

              <div className="payment-rows space-y-4">
                {payments.map((p, i) => (
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg relative" key={i}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                        Forma de Pago #{i + 1}
                      </span>
                      {payments.length > 1 && (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline flex items-center gap-1"
                          onClick={() => setPayments(payments.filter((_, n) => n !== i))}
                        >
                          <Trash2 size={13} /> Eliminar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                      <label>
                        Tipo de Pago
                        <select
                          value={p.paymentType || "Pago móvil"}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPayments(
                              payments.map((r, n) =>
                                n === i
                                  ? {
                                      ...r,
                                      paymentType: val,
                                      reference: val.includes("Efectivo") ? "Efectivo entregado en caja" : r.reference,
                                    }
                                  : r
                              )
                            );
                          }}
                        >
                          <option value="Pago móvil">Pago móvil</option>
                          <option value="Transferencia bancaria">Transferencia bancaria</option>
                          <option value="Efectivo USD">Efectivo USD</option>
                          <option value="Efectivo Bolívares (VES)">Efectivo Bolívares (VES)</option>
                          <option value="Zelle">Zelle</option>
                          <option value="Punto de Venta / Tarjeta">Punto de Venta / Tarjeta</option>
                        </select>
                      </label>

                      <label>
                        Banco / Origen
                        <input
                          list={`banks-list-${i}`}
                          value={p.bankName || ""}
                          placeholder="Ej. Banesco, Banco de Venezuela, Mercantil..."
                          onChange={(e) =>
                            setPayments(payments.map((r, n) => (n === i ? { ...r, bankName: e.target.value } : r)))
                          }
                        />
                        <datalist id={`banks-list-${i}`}>
                          <option value="Banesco Banco Universal" />
                          <option value="Banco de Venezuela" />
                          <option value="Mercantil Banco" />
                          <option value="Bancaribe" />
                          <option value="BBVA Banco Provincial" />
                          <option value="Banco Nacional de Crédito (BNC)" />
                          <option value="Bank of America (Zelle)" />
                          <option value="Caja Principal (Efectivo)" />
                        </datalist>
                      </label>

                      <label>
                        N° de Referencia / Código de Aprobación
                        <input
                          type="text"
                          placeholder={p.paymentType?.includes("Efectivo") ? "Efectivo entregado" : "Ej. Ref. 849201"}
                          value={p.reference}
                          onChange={(e) =>
                            setPayments(payments.map((r, n) => (n === i ? { ...r, reference: e.target.value } : r)))
                          }
                        />
                      </label>

                      <label>
                        Monto Cubierto (USD)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={p.amount}
                          required
                          onChange={(e) =>
                            setPayments(payments.map((r, n) => (n === i ? { ...r, amount: Number(e.target.value) } : r)))
                          }
                        />
                      </label>

                      <label className="full-span">
                        Cuenta destino de Tesorio
                        <select
                          required
                          value={p.accountId}
                          onChange={(e) => {
                            const accId = Number(e.target.value);
                            const acc = data.accounts.find((a) => a.id === accId);
                            setPayments(
                              payments.map((r, n) =>
                                n === i
                                  ? {
                                      ...r,
                                      accountId: accId,
                                      bankName: acc ? acc.name : r.bankName,
                                      paymentType: acc ? acc.method : r.paymentType,
                                    }
                                  : r
                              )
                            );
                          }}
                        >
                          {data.accounts.map((a) => (
                            <option value={a.id} key={a.id}>
                              {a.name} ({a.currency}) · {a.method} · Saldo: ${a.balance}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="text-link mt-2"
                onClick={() =>
                  setPayments([
                    ...payments,
                    {
                      accountId: data.accounts[0]?.id || 0,
                      amount: Math.max(0, +(total - paid).toFixed(2)),
                      paymentType: "Pago móvil",
                      bankName: "Banesco Banco Universal",
                      reference: "",
                    },
                  ])
                }
              >
                <Plus size={15} /> Dividir pago entre varios métodos (Pago móvil, Transferencia, Efectivo, Zelle)
              </button>

              <div className="form-grid mt-4">
                <label className="credit-checkbox full-span">
                  <input type="checkbox" checked={credit} onChange={(e) => setCredit(e.target.checked)} />
                  <span>
                    <strong>Venta a Crédito / Factura por Cobrar</strong>
                    <small>Se registrará en cuentas por cobrar del cliente con fecha límite de pago.</small>
                  </span>
                </label>
              </div>

              {credit && (
                <label className="mt-2">
                  Fecha de vencimiento del crédito
                  <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </label>
              )}

              <div className="payment-balance">
                <span>{total - paid > 0.02 ? "Saldo pendiente" : "Total cubierto"}</span>
                <strong>{money(total - paid > 0.02 ? total - paid : paid)}</strong>
              </div>
            </>
          )}

          {/* PASO 3: CONFIRMACIÓN FISCAL */}
          {step === 3 && (
            <>
              <div className="confirmation-heading">
                <span>
                  <FileCheck size={32} />
                </span>
                <h3>Factura Lista para Emisión</h3>
                <p>Se generará el número correlativo fiscal y se registrará en el Libro de Ventas.</p>
              </div>

              <div className="confirm-detail">
                <span>Emisor (Nosotros)</span>
                <strong>
                  {data.settings.legalName} · {data.settings.rif}
                </strong>
              </div>
              <div className="confirm-detail">
                <span>Cliente / Receptor</span>
                <strong>
                  {customerName} · {customerRif}
                </strong>
              </div>
              <div className="confirm-detail">
                <span>Envío Electrónico</span>
                <strong>{sendEmail && customerEmail ? `Enviar a: ${customerEmail}` : "Solo emisión local"}</strong>
              </div>
              <div className="confirm-detail">
                <span>Base Imponible Gravable</span>
                <strong>{money(subtotalBase)}</strong>
              </div>
              <div className="confirm-detail">
                <span>IVA 16% (SENIAT)</span>
                <strong className="text-purple">+{money(ivaAmount)}</strong>
              </div>
              {subtotalExempt > 0 && (
                <div className="confirm-detail">
                  <span>Monto Exento</span>
                  <strong>{money(subtotalExempt)}</strong>
                </div>
              )}
              <div className="confirm-total">
                <strong>Total de la Factura</strong>
                <strong className="text-purple">{money(total)}</strong>
              </div>
            </>
          )}

          {error && (
            <div className="form-error mt-4" role="alert">
              <AlertCircle size={17} />
              {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => (step === 1 ? close() : setStep(step - 1))}
          >
            {step > 1 && <ChevronLeft size={15} />}
            {step === 1 ? "Cancelar" : "Volver"}
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? <span className="spinner" /> : step === 3 ? <Check size={16} /> : <ArrowRight size={16} />}
            {busy ? "Emitiendo factura..." : step === 1 ? "Continuar al pago" : step === 2 ? "Revisar factura fiscal" : "Emitir Factura Legal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// RECIBO / FACTURA FISCAL DIGITAL SENIAT AUDITABLE
function ReceiptView({ sale }: { sale: Sale }) {
  const { data, money, notify, close, navigate, mutate } = useApp();
  const [emailInput, setEmailInput] = useState(sale.customerEmail || "");
  const [sendingEmail, setSendingEmail] = useState(false);

  if (!sale) return null;

  const bcvRate = sale.exchangeRateBcv || data.settings.exchangeRate || 69.5;
  const totalBs = sale.total * bcvRate;
  const baseBs = sale.taxableBase * bcvRate;
  const ivaBs = sale.ivaAmount * bcvRate;

  const handleSendEmail = async () => {
    if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
      return notify("Introduce un correo electrónico válido.", true);
    }
    setSendingEmail(true);
    try {
      await mutate("sale.sendEmail", { saleId: sale.id, email: emailInput }, `Factura digital enviada con éxito a ${emailInput}`);
    } catch (err) {
      notify((err as Error).message, true);
    } finally {
      setSendingEmail(false);
    }
  };

  const print = () => {
    try {
      const payload = buildSeniatPayload(sale, data.settings);
      const invoiceHtml = generateSeniatInvoiceHtml(payload, data.settings.logoUrl);
      const w = window.open("", "_blank", "width=850,height=950");
      if (!w) throw new Error("Permite ventanas emergentes para imprimir o guardar la Factura Digital en PDF.");
      w.document.open();
      w.document.write(invoiceHtml);
      w.document.close();
    } catch (e) {
      notify((e as Error).message, true);
    }
  };

  return (
    <Modal title="Factura Fiscal Digital Emitida" subtitle="Documento con plena validez tributaria para Fábrica Cristo Rey C.A." wide>
      <div className="modal-body receipt-body">
        {/* Cabecera Fiscal con Logo de la Empresa */}
        <div className="fiscal-header-card">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {data.settings.logoUrl ? (
                <img src={data.settings.logoUrl} alt={data.settings.businessName} className="h-12 w-auto max-w-[180px] object-contain" />
              ) : (
                <div className="brand">
                  tesorio<span>.</span>
                </div>
              )}
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">{data.settings.legalName}</h3>
                <p className="text-xs text-purple-700 font-mono font-bold">RIF: {data.settings.rif}</p>
                <p className="text-[10px] text-slate-500 max-w-sm">{data.settings.address}</p>
              </div>
            </div>

            <div className="text-right border-l pl-4 border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DOCUMENTO FISCAL</span>
              <div className="text-base font-extrabold text-purple-700">{sale.invoiceNumber}</div>
              <div className="text-xs text-slate-700 font-mono">N° Control: {sale.controlNumber}</div>
              <small className="text-[10px] text-slate-500 block">{dateLabel(sale.createdAt, true)}</small>
            </div>
          </div>
        </div>

        {/* Datos del Cliente y Tasa BCV */}
        <div className="receipt-customer-box">
          <div>
            <span className="tiny-label">CLIENTE / RAZÓN SOCIAL</span>
            <strong>{sale.customerName}</strong>
            <p className="text-xs font-mono font-semibold text-purple-800">RIF / C.I.: {sale.customerRif}</p>
            <p className="text-[10px] text-slate-600">{sale.customerAddress}</p>
          </div>
          <div className="text-right">
            <span className="tiny-label">TASA OFICIAL BCV</span>
            <strong className="text-slate-800 font-mono text-xs block">Bs. {bcvRate.toFixed(2)} / USD</strong>
            <span className="tiny-label mt-1">ESTADO FISCAL</span>
            <StatusBadge status={sale.status} />
          </div>
        </div>

        {/* SECCIÓN 1: ÍTEMS Y CONCEPTOS VENDIDOS (DISEÑO CLEAN TICKET FISCAL) */}
        <div className="invoice-items-section mb-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Package size={14} className="text-purple-600" /> RENGLONES FACTURADOS (BIENES Y SERVICIOS)
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {sale.items.length} ítem(s) en factura
            </span>
          </div>

          <div className="table-scroll rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <table className="data-table receipt-items-table">
              <thead>
                <tr>
                  <th className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold">Renglón / Descripción</th>
                  <th className="bg-slate-100/80 dark:bg-slate-800/80 text-center font-bold">Cant.</th>
                  <th className="bg-slate-100/80 dark:bg-slate-800/80 text-right font-bold">Precio Unit.</th>
                  <th className="bg-slate-100/80 dark:bg-slate-800/80 text-right font-bold">Total USD</th>
                  <th className="bg-slate-100/80 dark:bg-slate-800/80 text-right font-bold">Total Bs. (BCV)</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((i, n) => (
                  <tr key={n} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {n + 1}
                        </span>
                        <div>
                          <strong className="text-slate-900 dark:text-slate-100 text-xs block">{i.name}</strong>
                          {i.isExempt ? (
                            <span className="text-[9px] text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 inline-block mt-0.5">
                              Exento de IVA Art. 18
                            </span>
                          ) : (
                            <span className="text-[9px] text-purple-700 font-medium inline-block mt-0.5">
                              Gravable Alícuota General 16%
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-center font-mono font-bold text-xs">{i.quantity}</td>
                    <td className="text-right font-mono text-xs">{money(i.price)}</td>
                    <td className="amount text-right font-mono font-bold text-xs text-slate-900 dark:text-slate-100">
                      {money(i.price * i.quantity)}
                    </td>
                    <td className="text-right font-mono text-[11px] text-slate-600 dark:text-slate-400 font-semibold">
                      Bs. {(i.price * i.quantity * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SEPARADOR Y DESGLOSE TRIBUTARIO SENIAT TOTALMENTE DIFERENCIADO */}
        <div className="receipt-totals-panel mt-4 p-4 bg-slate-50 dark:bg-slate-900/90 border-2 border-purple-200 dark:border-purple-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 dark:border-slate-800">
            <span className="text-[11px] font-extrabold tracking-wider text-purple-900 dark:text-purple-300 uppercase flex items-center gap-1.5">
              <FileCheck size={14} className="text-purple-600" /> LIQUIDACIÓN TRIBUTARIA & TOTALES (SENIAT)
            </span>
            <span className="text-[10px] bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 font-mono px-2 py-0.5 rounded font-bold">
              TASA BCV: Bs. {bcvRate.toFixed(2)} / USD
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center py-1 text-slate-700 dark:text-slate-300 border-b border-slate-200/70 dark:border-slate-800">
              <span className="font-semibold">SUBTOTAL BASE IMPONIBLE (GRAVABLE 16%):</span>
              <div className="text-right">
                <strong className="font-mono text-slate-900 dark:text-white text-sm">{money(sale.taxableBase)}</strong>
                <small className="block text-[10px] text-slate-500 font-mono">
                  Bs. {baseBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </small>
              </div>
            </div>

            <div className="flex justify-between items-center py-1 text-purple-700 dark:text-purple-400 border-b border-slate-200/70 dark:border-slate-800">
              <span className="font-bold">IVA 16% (PROV. SNAT/2011/00071 / ART. 54 LEY DE IVA):</span>
              <div className="text-right">
                <strong className="font-mono text-sm">+{money(sale.ivaAmount)}</strong>
                <small className="block text-[10px] font-mono">
                  Bs. {ivaBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </small>
              </div>
            </div>

            {sale.exemptAmount > 0 && (
              <div className="flex justify-between items-center py-1 text-slate-600 dark:text-slate-400 border-b border-slate-200/70 dark:border-slate-800">
                <span className="font-medium">MONTO EXENTO / EXONERADO (ART. 18):</span>
                <div className="text-right font-mono font-semibold">{money(sale.exemptAmount)}</div>
              </div>
            )}

            {sale.igtfAmount > 0 && (
              <div className="flex justify-between items-center py-1 text-amber-700 dark:text-amber-400 border-b border-slate-200/70 dark:border-slate-800">
                <span className="font-bold">IGTF 3% (PAGO CON MONEDA EXTRANJERA):</span>
                <div className="text-right font-mono font-bold">+{money(sale.igtfAmount)}</div>
              </div>
            )}

            {/* TOTAL FACTURA DESTACADO EN CAJA DOBLE MONEDA */}
            <div className="mt-3 p-3.5 bg-gradient-to-r from-purple-800 via-purple-900 to-indigo-950 text-white rounded-lg shadow-md flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-purple-200 block font-bold">TOTAL FACTURA FISCAL DIGITAL</span>
                <span className="text-2xl font-black font-mono tracking-tight text-white">{money(sale.total)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-purple-200 block font-bold uppercase">EQUIVALENTE EN BOLÍVARES (BCV)</span>
                <span className="text-lg font-black font-mono text-emerald-300">
                  Bs. {totalBs.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* FORMAS DE PAGO DETALLADAS CON TIPO, BANCO Y NÚMERO DE REFERENCIA */}
        <div className="receipt-payments-panel mt-4 p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Wallet size={15} className="text-purple-600" /> FORMAS DE PAGO &amp; CONCILIACIÓN BANCARIA AUDITABLE:
            </span>
            <span className="text-[10px] text-slate-500 font-mono">{sale.payments.length} transacción(es)</span>
          </div>

          <div className="space-y-2">
            {sale.payments.map((p, i) => {
              const acc = data.accounts.find((a) => a.id === p.accountId);
              const paymentTypeName = p.paymentType || acc?.method || "Pago móvil";
              const bankName = p.bankName || acc?.name || "Banesco Banco Universal";
              const refCode = p.reference || (paymentTypeName.toLowerCase().includes("efectivo") ? "Efectivo entregado en caja" : "Ref. Nro. Registrado");
              return (
                <div key={i} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      <span>{paymentTypeName}</span> · <span className="text-purple-700 dark:text-purple-400 font-bold">{bankName}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                      Código / Nro. de Transacción: <strong className="text-slate-900 dark:text-slate-100 font-bold font-mono">{refCode}</strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <strong className="text-sm font-bold text-slate-900 dark:text-white font-mono">{money(p.amount)}</strong>
                    <small className="block text-[10px] text-slate-500 font-mono">
                      Bs. {(p.amount * bcvRate).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sección de Envío por Correo Electrónico */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Mail size={18} className="text-purple-600" />
            <div className="flex-1">
              <span className="text-xs font-semibold block text-slate-800">
                Factura Digital al Correo del Cliente {sale.emailSent && <span className="text-green-600 ml-1">✓ Enviada</span>}
              </span>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="correo@cliente.com"
                className="text-xs py-1 px-2 border rounded w-full max-w-xs mt-1"
              />
            </div>
          </div>
          <button className="button secondary text-xs" onClick={handleSendEmail} disabled={sendingEmail}>
            <Send size={13} /> {sendingEmail ? "Enviando..." : sale.emailSent ? "Reenviar Factura" : "Enviar Factura"}
          </button>
        </div>

        {/* Pie Legal SENIAT */}
        <div className="text-[9px] text-slate-500 text-center mt-4 border-t pt-2 space-y-0.5">
          <p>
            <strong>{data.settings.seniatResolution}</strong>
          </p>
          <p>{data.settings.printerAuthorization}</p>
          <p className="font-mono text-[8px] text-slate-400">Hash de Verificación Fiscal: {sale.auditHash}</p>
        </div>
      </div>

      <div className="modal-footer">
        <button className="button secondary" onClick={print}>
          <Printer size={16} /> Imprimir / Descargar PDF Oficial
        </button>
        <button
          className="button primary"
          onClick={() => {
            close();
            navigate("ventas", "pos");
          }}
        >
          <Plus size={16} /> Nueva Venta
        </button>
      </div>
    </Modal>
  );
}

// RESTO DE MODALES
function DateForm() {
  const { customDates, setCustomDates, setPeriod, close } = useApp();
  const [start, setStart] = useState(customDates.start),
    [end, setEnd] = useState(customDates.end),
    [error, setError] = useState("");
  return (
    <Modal title="Período Personalizado" subtitle="Filtra el dashboard y las vistas por fecha.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (start > end) return setError("La fecha inicial debe ser anterior a la final.");
          setCustomDates({ start, end });
          setPeriod("custom");
          close();
        }}
      >
        <div className="modal-body">
          <div className="form-grid">
            <label>
              Desde
              <input required type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              Hasta
              <input required type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>
          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={close}>
            Cancelar
          </button>
          <button className="button primary" type="submit">
            Aplicar período <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImportForm() {
  const { mutate, close } = useApp();
  const [fileName, setFileName] = useState(""),
    [rows, setRows] = useState<Record<string, unknown>[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const read = async (file?: File) => {
    if (!file) return;
    setError("");
    if (file.size > 10 * 1024 * 1024) return setError("El archivo debe pesar menos de 10 MB.");
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]]);
      if (!parsed.length) throw new Error("El archivo está vacío.");
      if (parsed.length > 5000) throw new Error("Puedes importar hasta 5.000 filas por archivo.");
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      setRows([]);
      setError((e as Error).message || "No pudimos leer el archivo.");
    }
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await mutate("products.import", { rows }, `${rows.length} productos procesados correctamente.`);
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Importar Inventario desde Excel" subtitle="Actualiza o carga masivamente tu catálogo de uniformes e insumos." wide>
      <div className="modal-body">
        <div className="import-instructions">
          <span>
            <FileSpreadsheet size={24} />
          </span>
          <div>
            <h3>Estructura del archivo Excel</h3>
            <p>Columnas requeridas: Nombre, SKU, Categoría, Cantidad, Costo y Precio.</p>
          </div>
          <button
            className="button secondary"
            onClick={() =>
              exportExcel(
                [
                  {
                    Nombre: "Pantalón Táctico Ripstop",
                    SKU: "TAC-001",
                    Categoría: "Tácticos",
                    Cantidad: 50,
                    Costo: 16.5,
                    Precio: 36,
                  },
                ],
                "Plantilla-Inventario-Cristo-Rey"
              )
            }
          >
            <Download size={15} /> Plantilla
          </button>
        </div>
        <input hidden type="file" ref={fileRef} accept=".xlsx,.xls,.csv" onChange={(e) => read(e.target.files?.[0])} />
        <button
          className="import-dropzone"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            read(e.dataTransfer.files[0]);
          }}
        >
          <span>
            <Upload size={27} />
          </span>
          <strong>{fileName || "Selecciona o arrastra el archivo Excel"}</strong>
          <small>{rows.length ? `${rows.length} productos detectados` : "Excel (.xlsx, .xls) o CSV · Máximo 5.000 productos"}</small>
        </button>

        {rows.length > 0 && (
          <div className="import-preview">
            <h4>Vista previa</h4>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    {Object.keys(rows[0]).slice(0, 6).map((k) => (
                      <th key={k}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 4).map((row, i) => (
                    <tr key={i}>
                      {Object.keys(rows[0]).slice(0, 6).map((k) => (
                        <td key={k}>{String(row[k] ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
      </div>
      <div className="modal-footer">
        <button className="button secondary" onClick={close}>
          Cancelar
        </button>
        <button className="button primary" disabled={!rows.length || busy} onClick={submit}>
          {busy ? "Importando..." : `Importar ${rows.length || ""} productos`} <Upload size={16} />
        </button>
      </div>
    </Modal>
  );
}

function CampaignForm({ entity: e }: { entity: Partial<Campaign> }) {
  const [message, setMessage] = useState(e.message || "");
  return (
    <Modal title={e.id ? "Editar Campaña" : "Nueva Campaña Comercial"} subtitle="Prepara promociones para tus clientes de uniformes y bordados.">
      <SaveForm action="campaign.save" label="Guardar borrador" prepare={(v) => ({ ...v, id: e.id })}>
        <div className="form-grid">
          <label className="full-span">
            Nombre de la campaña
            <input name="name" required placeholder="Ej. Lanzamiento Servicio DTF para Colegios" defaultValue={e.name} />
          </label>
          <label className="full-span">
            Segmento de destinatarios
            <select name="segment" defaultValue={e.segment || "Todos los clientes"}>
              <option>Todos los clientes</option>
              <option>Clientes frecuentes</option>
              <option>Colegios e Instituciones</option>
              <option>Empresas de Seguridad</option>
            </select>
          </label>
          <label className="full-span">
            Mensaje
            <textarea
              name="message"
              required
              maxLength={960}
              rows={4}
              placeholder="¡Hola! En Fábrica Cristo Rey tenemos disponibles..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <span className="textarea-count">{message.length}/960 caracteres</span>
          </label>
        </div>
      </SaveForm>
    </Modal>
  );
}

function MemberForm({ entity: e }: { entity: Partial<Member> }) {
  const permissions = [
    { id: "ventas", label: "Punto de Venta y Facturación" },
    { id: "inventario", label: "Inventario, Recetas y DTF" },
    { id: "cuentas", label: "Cuentas Bancarias y Caja" },
    { id: "gastos", label: "Gastos y Soportes" },
    { id: "auditoria", label: "Libros Fiscales SENIAT" },
    { id: "financiero", label: "Estados Financieros" },
    { id: "clientes", label: "Clientes y Marketing" },
    { id: "configuracion", label: "Configuración y Logo" },
  ];
  return (
    <Modal title={e.id ? "Editar Usuario del Sistema" : "Agregar Miembro al Equipo"} subtitle="Asigna roles y permisos específicos sin límite de usuarios.">
      <SaveForm action="member.save" label={e.id ? "Guardar permisos" : "Registrar usuario"} prepare={(v, fd) => ({ ...v, id: e.id, permissions: fd.getAll("permissions") })}>
        <div className="form-grid">
          <label className="full-span">
            Nombre y Apellido
            <input name="name" required defaultValue={e.name} placeholder="Ej. Katerin Rodríguez" />
          </label>
          <label className="full-span">
            Correo Electrónico
            <input name="email" type="email" required defaultValue={e.email} placeholder="katerin@fabricacristorey.com" />
          </label>
          <label className="full-span">
            Rol en la Empresa
            <select name="role" defaultValue={e.role || "Vendedor"}>
              <option>Director General</option>
              <option>Jefa de Taller y DTF</option>
              <option>Contador Auditor</option>
              <option>Vendedor Mostrador</option>
              <option>Almacenista</option>
            </select>
          </label>
        </div>
        <div className="form-section-label">
          <ShieldCheck size={16} /> Módulos autorizados
        </div>
        <div className="permissions-grid">
          {permissions.map((p) => (
            <label className="permission-check" key={p.id}>
              <input type="checkbox" name="permissions" value={p.id} defaultChecked={e.permissions?.includes(p.id) || false} />
              <span>{p.label}</span>
            </label>
          ))}
        </div>
      </SaveForm>
    </Modal>
  );
}

function ChannelForm({ entity: e }: { entity: { name?: string; multiplier?: number } }) {
  return (
    <Modal title={e.name ? "Editar Canal de Precios" : "Nuevo Canal de Venta"} subtitle="Aplica listas de precios diferenciadas (ej. Mayoristas o Tienda Web).">
      <SaveForm action="channel.save" label="Guardar canal">
        <div className="form-grid">
          <label className="full-span">
            Nombre del canal
            <input name="name" required defaultValue={e.name} readOnly={!!e.name} placeholder="Ej. Mayorista Corporativo" />
          </label>
          <label className="full-span">
            Factor multiplicador sobre precio base
            <input name="multiplier" type="number" min="0.01" step="0.01" required defaultValue={e.multiplier || 1} />
          </label>
        </div>
        <div className="info-banner">
          <CircleHelp size={17} />
          <span>Ejemplo: 0.88 aplica un 12% de descuento para clientes mayoristas de Cristo Rey.</span>
        </div>
      </SaveForm>
    </Modal>
  );
}

function TableForm({ entity: e }: { entity: Partial<DiningTable> }) {
  const { data } = useApp();
  return (
    <Modal title="Agregar Módulo o Puesto de Atención" subtitle="Organiza pedidos abiertos en mostrador o sala de muestras.">
      <SaveForm action="table.save" label="Crear puesto" prepare={(v) => ({ ...v, id: e.id })}>
        <div className="form-grid">
          <label>
            Nombre del puesto
            <input name="name" required defaultValue={e.name || `Puesto ${data.diningTables.length + 1}`} />
          </label>
          <label>
            Capacidad
            <input name="seats" required type="number" min="1" max="50" defaultValue={e.seats || 4} />
          </label>
        </div>
      </SaveForm>
    </Modal>
  );
}

function HelpView() {
  const { module, navigate, close } = useApp();
  const [topic, setTopic] = useState<Module>(["ventas", "inventario", "cuentas", "gastos", "auditoria"].includes(module) ? module : "inicio");

  const topics: { id: Module; title: string; description: string; steps: string[] }[] = [
    {
      id: "inicio",
      title: "Bienvenido a Tesorio",
      description: "Sistema administrativo y fiscal diseñado para empresas venezolanas.",
      steps: [
        "Configura los datos fiscales y el logo de tu empresa en Configuración.",
        "Registra tus cuentas bancarias en bolívares (Banesco, etc.) y divisas con su tasa BCV.",
        "Carga tu inventario, recetas y servicios como el Servicio DTF y bordados.",
      ],
    },
    {
      id: "ventas",
      title: "Facturación Legal SENIAT",
      description: "Emisión de facturas digitales conforme a la Providencia 0071 y PA 102.",
      steps: [
        "Agrega uniformes o servicios de DTF al carrito desde el Punto de Venta.",
        "Selecciona el cliente para asociar su RIF o cédula legal.",
        "Elige si enviarás la factura en PDF por correo electrónico al cliente para ahorrar papel.",
        "Al confirmar, el sistema descuenta el stock, asigna número de control correlativo y genera el recibo fiscal.",
      ],
    },
    {
      id: "auditoria",
      title: "Libros Fiscales y Auditoría",
      description: "Libro de Ventas y Libro de Compras auditables ante fiscalizaciones del SENIAT.",
      steps: [
        "Entra al módulo Auditoría SENIAT y selecciona la quincena o mes a declarar.",
        "Revisa el desglose de Base Imponible, Débito Fiscal IVA 16% y crédito soportado.",
        "Exporta en Excel oficial o imprime directamente en PDF con el formato reglamentario.",
      ],
    },
    {
      id: "gastos",
      title: "Soporte de Gastos e Internos",
      description: "Diferenciación entre compras deducibles, caja chica y retiros personales.",
      steps: [
        "Registra cada egreso seleccionando si es Operativo, Caja Chica o Retiro Personal.",
        "Para gastos operativos, incluye RIF del proveedor y número de factura para aprovechar el crédito fiscal.",
        "Los retiros de socios quedan aislados para no distorsionar el balance de la empresa.",
      ],
    },
  ];

  const selected = topics.find((t) => t.id === topic) || topics[0];

  return (
    <Modal title="Centro de Ayuda y Normativa Fiscal" subtitle="Guías rápidas para operar Tesorio en Fábrica Cristo Rey." wide className="help-modal">
      <div className="help-content">
        <nav>
          {topics.map((t) => (
            <button key={t.id} className={topic === t.id ? "active" : ""} onClick={() => setTopic(t.id)}>
              <BookOpen size={15} />
              {t.title}
              <ChevronRight size={13} />
            </button>
          ))}
        </nav>
        <div className="help-article">
          <span className="checkout-section-icon">
            <Sparkles size={25} />
          </span>
          <h3>{selected.title}</h3>
          <p>{selected.description}</p>
          <ol>
            {selected.steps.map((step, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
          <button
            className="button primary"
            onClick={() => {
              close();
              navigate(topic === "inicio" ? "configuracion" : topic);
            }}
          >
            Ir al módulo <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
