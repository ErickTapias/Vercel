"use client";
import type { ReactNode } from "react";
import { ArrowUpRight, ArrowDownRight, Search, Package, ChevronRight, ShoppingBag, Wallet, Landmark, MoreHorizontal, FileText, CheckCircle2 } from "lucide-react";
import type { Account, Product, Sale } from "@/lib/types";
import { useApp } from "./app-context";
import { initials, dateLabel } from "@/lib/utils";

export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const colors = ["purple", "peach", "blue", "green"];
  return <span className={`avatar ${colors[name.charCodeAt(0) % 4]} ${small ? "small" : ""}`}>{initials(name)}</span>;
}

export function ProductImage({ product, className = "" }: { product: Pick<Product, "name" | "image">; className?: string }) {
  return (
    <span className={`product-image ${className}`}>
      {product.image ? (
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <Package size={21} />
      )}
    </span>
  );
}

export function AccountIcon({ account }: { account: Pick<Account, "name" | "color" | "method"> }) {
  if (account.name.toLowerCase().includes("america"))
    return (
      <span className="account-logo bofa">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    );
  if (account.name.toLowerCase().includes("banesco"))
    return (
      <span className="account-logo banesco">
        B<span>•</span>
      </span>
    );
  return (
    <span className={`account-logo ${account.color}`}>
      {account.method.toLowerCase().includes("efectivo") ? <Wallet size={20} /> : <Landmark size={20} />}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge ${status === "paid" ? "paid" : status === "overdue" ? "overdue" : status === "void" ? "overdue" : "pending"}`}>
      <i />
      {status === "paid" ? "Factura Pagada" : status === "void" ? "Anulada" : status === "overdue" ? "Vencida" : "A Crédito"}
    </span>
  );
}

export function EmptyState({
  title = "Todavía no hay registros",
  description = "Los movimientos que registres aparecerán aquí.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span>
        <Package size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Buscar...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-field">
      <Search size={17} />
      <input aria-label={placeholder} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button onClick={() => onChange("")} aria-label="Limpiar búsqueda">
          ×
        </button>
      )}
    </div>
  );
}

export function SectionHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function KpiCard({
  title,
  value,
  icon,
  color = "purple",
  change,
  detail = "vs. mes anterior",
  points = "0,20 9,18 17,23 25,13 34,16 43,7 52,10 61,2",
  onClick,
}: {
  title: string;
  value: string;
  icon: ReactNode;
  color?: string;
  change?: number;
  detail?: string;
  points?: string;
  onClick?: () => void;
}) {
  return (
    <button className={`kpi-card ${color}`} onClick={onClick}>
      <div className="kpi-top">
        <span className={`kpi-icon ${color}`}>{icon}</span>
        <span>{title}</span>
        <MoreHorizontal size={17} className="kpi-more" />
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-bottom">
        {change !== undefined ? (
          <>
            <span className={`trend ${change >= 0 ? "positive" : "negative"}`}>
              {change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {Math.abs(change).toFixed(1)}%
            </span>
            <span>{detail}</span>
          </>
        ) : (
          <span>{detail}</span>
        )}
        <svg className="sparkline" viewBox="0 0 64 30">
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  );
}

export function SalesTable({ sales, compact = false }: { sales: Sale[]; compact?: boolean }) {
  const { money, open } = useApp();
  if (!sales.length) return <EmptyState title="No hay facturas en este período" description="Registra una venta para emitir una factura legal." />;

  return (
    <div className="table-scroll">
      <table className={`data-table sales-table ${compact ? "compact" : ""}`}>
        <thead>
          <tr>
            <th>Factura / Control</th>
            <th>Cliente / RIF</th>
            {!compact && <th>Fecha</th>}
            <th>Total Facturado</th>
            <th>IVA (16%)</th>
            <th>Estado</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sales.map((sale) => (
            <tr key={sale.id} onClick={() => open("receipt", sale)}>
              <td>
                <span className="sale-id font-mono font-bold">{sale.invoiceNumber}</span>
                <small className="font-mono text-slate-500">Ctrl: {sale.controlNumber}</small>
              </td>
              <td>
                <span className="customer-cell">
                  <Avatar name={sale.customerName} small />
                  <span>
                    <strong>{sale.customerName}</strong>
                    <small className="font-mono text-purple">{sale.customerRif || "V-00000000-0"}</small>
                  </span>
                </span>
              </td>
              {!compact && <td>{dateLabel(sale.createdAt, true)}</td>}
              <td className="amount font-bold">{money(sale.total)}</td>
              <td className="text-purple font-semibold">{money(sale.ivaAmount)}</td>
              <td>
                <StatusBadge status={sale.status} />
              </td>
              <td>
                <button className="icon-button small-button" aria-label={`Ver factura ${sale.invoiceNumber}`} onClick={(e) => { e.stopPropagation(); open("receipt", sale); }}>
                  <ChevronRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MiniStat({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="mini-stat">
      {icon || <ShoppingBag size={18} />}
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
