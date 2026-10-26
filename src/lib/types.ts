import type * as schema from "@/db/schema";
type Serialized<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] };
export type Product = Serialized<typeof schema.products.$inferSelect>;
export type Account = typeof schema.accounts.$inferSelect;
export type Customer = Serialized<typeof schema.customers.$inferSelect>;
export type Sale = Serialized<typeof schema.sales.$inferSelect>;
export type Expense = Serialized<typeof schema.expenses.$inferSelect>;
export type Pending = Serialized<typeof schema.pending.$inferSelect>;
export type Activity = Serialized<typeof schema.activities.$inferSelect>;
export type Settings = typeof schema.settings.$inferSelect;
export type Member = typeof schema.members.$inferSelect;
export type Campaign = Serialized<typeof schema.campaigns.$inferSelect>;
export type DiningTable = typeof schema.diningTables.$inferSelect;
export type ProductionOrder = Serialized<typeof schema.productionOrders.$inferSelect>;
export type BankStatement = Serialized<typeof schema.bankStatements.$inferSelect>;
export type PayrollEmployee = Serialized<typeof schema.employees.$inferSelect>;
export type PayrollPeriod = Serialized<typeof schema.payrollPeriods.$inferSelect>;
export type PayrollTransaction = Serialized<typeof schema.payrollTransactions.$inferSelect>;
export type PayrollReceipt = Serialized<typeof schema.payrollReceipts.$inferSelect>;
export type PayrollConfig = Serialized<typeof schema.payrollConfig.$inferSelect>;
export type PayrollLine = schema.PayrollLine;
export type BankStatementRow = schema.BankStatementRow;

export type AppData = {
  products: Product[];
  accounts: Account[];
  customers: Customer[];
  sales: Sale[];
  expenses: Expense[];
  pending: Pending[];
  activities: Activity[];
  settings: Settings;
  members: Member[];
  campaigns: Campaign[];
  diningTables: DiningTable[];
  productionOrders: ProductionOrder[];
  bankStatements: BankStatement[];
  payrollEmployees: PayrollEmployee[];
  payrollPeriods: PayrollPeriod[];
  payrollTransactions: PayrollTransaction[];
  payrollReceipts: PayrollReceipt[];
  payrollConfig: PayrollConfig | null;
};

export type Module =
  | "inicio"
  | "ventas"
  | "inventario"
  | "produccion" // Nuevo: Taller y Estaciones Operativas (Plotter DTF, Bordadora)
  | "cuentas"
  | "pendientes"
  | "gastos"
  | "nomina"
  | "financiero"
  | "auditoria" // Libros Fiscales SENIAT (Ventas y Compras)
  | "reportes"
  | "clientes"
  | "marketing"
  | "estadisticas"
  | "equipo"
  | "configuracion";

export type CartItem = {
  productId: number;
  quantity: number;
};
