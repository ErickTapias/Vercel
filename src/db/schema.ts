import { pgTable, serial, text, integer, doublePrecision, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

export type Ingredient = { productId: number; quantity: number };
export type SaleItem = {
  productId: number;
  name: string;
  quantity: number;
  price: number;
  cost: number;
  isExempt?: boolean;
};
export type Payment = {
  accountId: number;
  amount: number;
  paymentType?: string; // 'Pago móvil' | 'Transferencia' | 'Efectivo USD' | 'Efectivo Bs.' | 'Zelle' | 'Punto de Venta'
  bankName?: string; // 'Banesco' | 'Banco de Venezuela' | 'Mercantil' | 'Bank of America' | 'Caja Efectivo' | etc.
  reference?: string; // Número de confirmación o referencia bancaria
  igtfApplied?: boolean;
};

export const products = pgTable("tesorio_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  category: text("category").notNull().default("General"),
  kind: text("kind").notNull().default("product"), // 'product' | 'recipe' | 'service'
  stock: doublePrecision("stock").notNull().default(0),
  cost: doublePrecision("cost").notNull().default(0),
  price: doublePrecision("price").notNull().default(0),
  minStock: integer("min_stock").notNull().default(5),
  unit: text("unit").notNull().default("unidad"),
  location: text("location").notNull().default("Almacén principal"),
  description: text("description").notNull().default(""),
  variation: text("variation").notNull().default(""),
  image: text("image").notNull().default(""),
  ingredients: jsonb("ingredients").$type<Ingredient[]>().notNull().default([]),
  isExempt: boolean("is_exempt").notNull().default(false), // Exento de IVA
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const accounts = pgTable("tesorio_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull().default("USD"),
  balance: doublePrecision("balance").notNull().default(0),
  method: text("method").notNull().default("Transferencia"),
  commission: doublePrecision("commission").notNull().default(0),
  color: text("color").notNull().default("purple"),
});

export const customers = pgTable("tesorio_customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  document: text("document").notNull().default(""), // RIF o Cédula (V-, J-, E-, G-)
  address: text("address").notNull().default(""),
  taxPayerType: text("tax_payer_type").notNull().default("Ordinario"), // Ordinario | Especial | Formal
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sales = pgTable("tesorio_sales", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(), // Ej: FACT-0001
  controlNumber: text("control_number").notNull(), // Ej: 00-000001
  customerId: integer("customer_id").references(() => customers.id),
  customerName: text("customer_name").notNull().default("Cliente general"),
  customerRif: text("customer_rif").notNull().default("V-00000000-0"),
  customerAddress: text("customer_address").notNull().default("Caracas, Venezuela"),
  customerEmail: text("customer_email").notNull().default(""),
  items: jsonb("items").$type<SaleItem[]>().notNull().default([]),
  payments: jsonb("payments").$type<Payment[]>().notNull().default([]),
  // SENIAT / IVA desglosado
  taxableBase: doublePrecision("taxable_base").notNull().default(0),
  exemptAmount: doublePrecision("exempt_amount").notNull().default(0),
  ivaRate: doublePrecision("iva_rate").notNull().default(16),
  ivaAmount: doublePrecision("iva_amount").notNull().default(0),
  igtfRate: doublePrecision("igtf_rate").notNull().default(3),
  igtfAmount: doublePrecision("igtf_amount").notNull().default(0),
  exchangeRateBcv: doublePrecision("exchange_rate_bcv").notNull().default(69.5),
  total: doublePrecision("total").notNull(),
  cost: doublePrecision("cost").notNull().default(0),
  extra: doublePrecision("extra").notNull().default(0),
  status: text("status").notNull().default("paid"), // paid | pending | void
  channel: text("channel").notNull().default("Tienda física"),
  emailSent: boolean("email_sent").notNull().default(false),
  emailSentAt: timestamp("email_sent_at"),
  auditHash: text("audit_hash").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expenses = pgTable("tesorio_expenses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: doublePrecision("amount").notNull(),
  category: text("category").notNull().default("Otros"), // Insumos, Nómina, Alquiler, etc.
  type: text("type").notNull().default("variable"), // 'fixed' | 'variable'
  scope: text("scope").notNull().default("business"), // 'business' (Operativo) | 'internal' (Interno/Caja chica) | 'personal' (Retiro personal socio)
  beneficiary: text("beneficiary").notNull().default(""),
  beneficiaryRif: text("beneficiary_rif").notNull().default(""),
  invoiceNumber: text("invoice_number").notNull().default(""),
  controlNumber: text("control_number").notNull().default(""),
  taxableBase: doublePrecision("taxable_base").notNull().default(0),
  ivaAmount: doublePrecision("iva_amount").notNull().default(0),
  ivaRetained: doublePrecision("iva_retained").notNull().default(0),
  islrRetained: doublePrecision("islr_retained").notNull().default(0),
  accountId: integer("account_id").references(() => accounts.id),
  notes: text("notes").notNull().default(""),
  receiptUrl: text("receipt_url").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pending = pgTable("tesorio_pending", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact").notNull(),
  type: text("type").notNull().default("receivable"),
  amount: doublePrecision("amount").notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("pending"),
  saleId: integer("sale_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const activities = pgTable("tesorio_activities", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull().default(0),
  accountId: integer("account_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("tesorio_settings", {
  id: integer("id").primaryKey().default(1),
  businessName: text("business_name").notNull().default("Fábrica Cristo Rey C.A."),
  legalName: text("legal_name").notNull().default("Fábrica Cristo Rey C.A."),
  rif: text("rif").notNull().default("J-40912384-9"),
  logoUrl: text("logo_url").notNull().default("/images/cristo-rey-logo.svg"),
  ownerName: text("owner_name").notNull().default("Jesús Gómez"),
  email: text("email").notNull().default("contacto@fabricacristorey.com"),
  phone: text("phone").notNull().default("+58 414 123 4567"),
  address: text("address").notNull().default("Av. Principal Los Ruices, Edif. Cristo Rey, Piso 1, Caracas, Venezuela"),
  fiscalSeries: text("fiscal_series").notNull().default("FAC-2026-"),
  controlSeries: text("control_series").notNull().default("00-"),
  nextInvoiceNumber: integer("next_invoice_number").notNull().default(1001),
  nextControlNumber: integer("next_control_number").notNull().default(101),
  seniatResolution: text("seniat_resolution").notNull().default("SENIAT/SNAT/2024/000102 - Providencia Administrativa 0071 / Ley de IVA Art. 54 y 57"),
  printerAuthorization: text("printer_authorization").notNull().default("Imprenta Digital Autorizada SENIAT Prov. SNAT/2018/0141 y PA 000102"),
  // Parámetros de Integración API con Empresa de Imprenta Digital SENIAT
  digitalPrinterApiUrl: text("digital_printer_api_url").notNull().default("https://api.imprentadigital.seniat.gob.ve/v1/invoices"),
  digitalPrinterApiKey: text("digital_printer_api_key").notNull().default(""),
  digitalPrinterRif: text("digital_printer_rif").notNull().default("J-00034567-8"),
  digitalPrinterName: text("digital_printer_name").notNull().default("Soluciones de Imprenta Digital Homologada C.A."),
  digitalPrinterProvNumber: text("digital_printer_prov_number").notNull().default("SNAT/2018/0141/00492"),
  digitalPrinterEnvironment: text("digital_printer_environment").notNull().default("sandbox"), // 'sandbox' | 'production'
  exchangeRate: doublePrecision("exchange_rate").notNull().default(69.5), // Tasa oficial BCV
  defaultIva: doublePrecision("default_iva").notNull().default(16),
  defaultIgtf: doublePrecision("default_igtf").notNull().default(3),
  applyIgtfOnForeignCurrency: boolean("apply_igtf").notNull().default(true),
  channels: jsonb("channels").$type<{ name: string; multiplier: number }[]>().notNull().default([
    { name: "Tienda física", multiplier: 1 },
    { name: "Mayorista corporativo", multiplier: 0.88 },
    { name: "Web / Tienda online", multiplier: 1.05 },
  ]),
  cashOpen: boolean("cash_open").notNull().default(true),
  cashOpening: doublePrecision("cash_opening").notNull().default(100),
});

export const members = pgTable("tesorio_members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("Vendedor"),
  permissions: jsonb("permissions").$type<string[]>().notNull().default([]),
});

export const campaigns = pgTable("tesorio_campaigns", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  message: text("message").notNull(),
  segment: text("segment").notNull().default("Todos los clientes"),
  status: text("status").notNull().default("Borrador"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const diningTables = pgTable("tesorio_dining_tables", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  seats: integer("seats").notNull().default(4),
  items: jsonb("items").$type<{ productId: number; quantity: number }[]>().notNull().default([]),
});

export type ProductionItem = {
  name: string;
  quantity: number;
  details?: string;
};

export type BankStatementRow = {
  id: string;
  date: string;
  description: string;
  reference: string;
  amount: number;
  direction: "ingreso" | "egreso";
  matchType: "sale" | "expense" | "none";
  matchId: number | null;
  matchLabel: string;
  status: "conciliado" | "sin_identificar" | "sobrante" | "ajustado";
  confidence: "alta" | "media" | "baja";
  observation: string;
  suggestedCategory: string;
};

// ===== EXTENSIÓN NO DESTRUCTIVA: MÓDULO DE NÓMINA (LOTTT · IVSS · FAOV · INCES · ISLR) =====
export type PayrollLine = { label: string; amount: number; basis?: string; note?: string };

export const payrollConfig = pgTable("tesorio_payroll_config", {
  id: integer("id").primaryKey().default(1),
  utValue: doublePrecision("ut_value").notNull().default(43), // Unidad Tributaria Bs. 2026
  minimumWage: doublePrecision("minimum_wage").notNull().default(130),
  ivssEmployee: doublePrecision("ivss_employee").notNull().default(0.04),
  ivssCeilingSalaries: integer("ivss_ceiling").notNull().default(5),
  faovEmployee: doublePrecision("faov_employee").notNull().default(0.01),
  incesEmployee: doublePrecision("inces_employee").notNull().default(0.005),
  incesApplicable: boolean("inces_applicable").notNull().default(true),
  cestaticketDay: doublePrecision("cestaticket_day").notNull().default(350),
  provisionDaysMonth: doublePrecision("provision_days_month").notNull().default(2.5),
  vacationDaysMonth: doublePrecision("vacation_days_month").notNull().default(1.25),
  seniorityDaysMonth: doublePrecision("seniority_days_month").notNull().default(0.1667),
  seniorityFromYear: integer("seniority_from_year").notNull().default(3),
  provisionMode: text("provision_mode").notNull().default("mensual"), // 'mensual' | 'fondo'
  islBrackets: jsonb("isl_brackets").$type<Array<{ from: number; to: number; rate: number; discount: number }>>().notNull().default([
    { from: 0, to: 1000, rate: 0.03, discount: 0 },
    { from: 1000, to: 1500, rate: 0.08, discount: 50 },
    { from: 1500, to: 2000, rate: 0.12, discount: 110 },
    { from: 2000, to: 3000, rate: 0.16, discount: 190 },
    { from: 3000, to: 4000, rate: 0.2, discount: 310 },
    { from: 4000, to: 999999, rate: 0.34, discount: 870 },
  ]),
  employerBurden: jsonb("employer_burden").$type<Array<{ label: string; rate: number }>>().notNull().default([
    { label: "IVSS Patronal (9%)", rate: 0.09 },
    { label: "Paro forzoso (1%)", rate: 0.01 },
    { label: "FAOV Patronal (2%)", rate: 0.02 },
    { label: "INCES Patronal (2%)", rate: 0.02 },
    { label: "Parafiscal (3%)", rate: 0.03 },
  ]),
});

export const employees = pgTable("tesorio_employees", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().default(1), // FK lógica a tesorio_settings.id (tabla existente intacta)
  name: text("name").notNull(),
  document: text("document").notNull().default(""),
  email: text("email").notNull().default(""),
  phone: text("phone").notNull().default(""),
  position: text("position").notNull().default(""),
  department: text("department").notNull().default("Taller"),
  hireDate: text("hire_date").notNull().default(""),
  salaryType: text("salary_type").notNull().default("mensual"), // 'mensual' | 'quincenal' | 'por_hora' | 'por_pieza'
  baseSalary: doublePrecision("base_salary").notNull().default(0), // salario base mensual en Bs.
  hourlyRate: doublePrecision("hourly_rate").notNull().default(0),
  pieceRate: doublePrecision("piece_rate").notNull().default(0),
  cestaticketDays: integer("cestaticket_days").notNull().default(30),
  extraHours: doublePrecision("extra_hours").notNull().default(0),
  bonus: doublePrecision("bonus").notNull().default(0),
  bankName: text("bank_name").notNull().default(""),
  bankAccount: text("bank_account").notNull().default(""),
  isIvss: boolean("is_ivss").notNull().default(true),
  isFaov: boolean("is_faov").notNull().default(true),
  isInces: boolean("is_inces").notNull().default(true),
  withholdIslr: boolean("withhold_islr").notNull().default(true),
  provisionMode: text("provision_mode").notNull().default("mensual"),
  status: text("status").notNull().default("activo"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollPeriods = pgTable("tesorio_payroll_periods", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().default(1),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  status: text("status").notNull().default("abierto"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollTransactions = pgTable("tesorio_payroll_transactions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().default(1),
  periodId: integer("period_id").references(() => payrollPeriods.id),
  employeeId: integer("employee_id").references(() => employees.id),
  employeeName: text("employee_name").notNull().default(""),
  assignments: jsonb("assignments").$type<PayrollLine[]>().notNull().default([]),
  deductions: jsonb("deductions").$type<PayrollLine[]>().notNull().default([]),
  provisions: jsonb("provisions").$type<PayrollLine[]>().notNull().default([]),
  gross: doublePrecision("gross").notNull().default(0),
  totalDeductions: doublePrecision("total_deductions").notNull().default(0),
  net: doublePrecision("net").notNull().default(0),
  exchangeRate: doublePrecision("exchange_rate").notNull().default(0),
  status: text("status").notNull().default("pendiente"), // 'pendiente' | 'pagado'
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollReceipts = pgTable("tesorio_payroll_receipts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().default(1),
  transactionId: integer("transaction_id").references(() => payrollTransactions.id),
  employeeId: integer("employee_id").references(() => employees.id),
  employeeName: text("employee_name").notNull().default(""),
  receiptNumber: text("receipt_number").notNull(),
  amount: doublePrecision("amount").notNull().default(0),
  receiptHtml: text("receipt_html").notNull().default(""),
  integrityHash: text("integrity_hash").notNull().default(""),
  emailSent: boolean("email_sent").notNull().default(false),
  emailSentAt: timestamp("email_sent_at"),
  backupPath: text("backup_path").notNull().default(""),
  status: text("status").notNull().default("pendiente"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bankStatements = pgTable("tesorio_bank_statements", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => accounts.id),
  bankName: text("bank_name").notNull().default(""),
  fileName: text("file_name").notNull().default(""),
  periodLabel: text("period_label").notNull().default(""),
  status: text("status").notNull().default("en_revision"),
  rows: jsonb("rows").$type<BankStatementRow[]>().notNull().default([]),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const productionOrders = pgTable("tesorio_production_orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull(), // Ej: OP-DTF-0104, OP-BOR-0205
  station: text("station").notNull(), // 'plotter_dtf' | 'bordadora' | 'corte_confeccion' | 'estampado'
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  items: jsonb("items").$type<ProductionItem[]>().notNull().default([]),
  // Especificaciones técnicas completas
  dimensions: text("dimensions").notNull().default(""), // ej: "30cm x 40cm (A3) / 1.5 metros lineales"
  colors: text("colors").notNull().default(""), // ej: "Full Color CMYK + Base Blanca W2"
  garmentType: text("garment_type").notNull().default(""), // ej: "Chemises Algodón Azul Marino (20 uds)"
  embroideryPlacement: text("embroidery_placement").notNull().default(""), // ej: "Pecho Izquierdo (Frente), Espalda Superior (Atrás) · 10x8 cm"
  embroiderySide: text("embroidery_side").notNull().default("frente"), // 'frente' | 'espalda' | 'ambos' | 'ninguno'
  croquisData: jsonb("croquis_data").$type<{
    garmentType: string;
    points: Array<{
      id: string;
      label: string;
      side: "frente" | "espalda";
      x: number; // porcentaje 0-100
      y: number; // porcentaje 0-100
      size: string;
      logoDescription?: string;
      colors?: string;
      technique?: string; // Bordado / DTF / Estampado
      notes?: string;
    }>;
  }>(),
  deliveryType: text("delivery_type").notNull().default("retiro_oficina"), // 'retiro_oficina' | 'delivery_regional' | 'delivery_nacional'
  deliveryAddress: text("delivery_address").notNull().default(""),
  pendingBalance: doublePrecision("pending_balance").notNull().default(0),
  paymentStatus: text("payment_status").notNull().default("pagado"), // 'pagado' | 'pendiente_saldo'
  fileUrl: text("file_url").notNull().default(""), // Archivo del cliente (.PNG 300dpi, .DST, .AI, .PDF) o base64
  fileName: text("file_name").notNull().default(""),
  fileSize: text("file_size").notNull().default(""),
  notes: text("notes").notNull().default(""), // Instrucciones exactas para el operario sin hablar
  priority: text("priority").notNull().default("normal"), // 'urgente' | 'alta' | 'normal'
  status: text("status").notNull().default("pendiente"), // 'pendiente' | 'en_proceso' | 'listo_para_retirar' | 'entregado'
  operatorName: text("operator_name").notNull().default(""),
  stationIpOrDevice: text("station_device").notNull().default(""),
  readyAt: timestamp("ready_at"),
  notificationSent: boolean("notification_sent").notNull().default(false),
  notificationType: text("notification_type").notNull().default("email_sms"),
  saleId: integer("sale_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
