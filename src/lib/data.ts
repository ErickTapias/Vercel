import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { AppData } from "./types";

export async function ensureSeeded() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(4839201)`);
    const existing = await tx.select().from(schema.settings).limit(1);
    if (existing.length) return;

    // Configuración inicial de Fábrica Cristo Rey C.A.
    await tx.insert(schema.settings).values({
      id: 1,
      businessName: "Fábrica Cristo Rey C.A.",
      legalName: "Fábrica Cristo Rey C.A.",
      rif: "J-40912384-9",
      logoUrl: "/images/cristo-rey-logo.svg",
      ownerName: "Jesús Gómez",
      email: "contacto@fabricacristorey.com",
      phone: "+58 414 123 4567",
      address: "Av. Principal Los Ruices, Edif. Cristo Rey, Piso 1, Caracas, Venezuela",
      fiscalSeries: "FAC-2026-",
      controlSeries: "00-",
      nextInvoiceNumber: 1045,
      nextControlNumber: 520,
      seniatResolution: "SENIAT/SNAT/2024/000102 - Providencia 0071 / Art. 54 y 57 Ley de IVA (Formato Digital Homologado)",
      printerAuthorization: "Sistema Informático Homologado de Facturación Digital SENIAT Prov. 0121/0102",
      exchangeRate: 69.5,
      defaultIva: 16,
      defaultIgtf: 3,
      applyIgtfOnForeignCurrency: true,
      channels: [
        { name: "Tienda física", multiplier: 1 },
        { name: "Mayorista corporativo", multiplier: 0.88 },
        { name: "Web / Pedidos online", multiplier: 1.05 },
      ],
      cashOpen: true,
      cashOpening: 150,
    });

    // Catálogo real de Fábrica Cristo Rey (http://fabricacristorey.com/)
    // Con categorías: Tácticos, Industriales, Corporativos, Escolares, Accesorios, Bordado Industrial y el nuevo SERVICIO DTF
    const catalog = await tx.insert(schema.products).values([
      // Materia prima para bordado y DTF
      { name: "Film DTF Premium (rollo 60cm)", sku: "MAT-DTF-001", category: "Materia prima", stock: 120, cost: 0.85, price: 1.5, unit: "m", minStock: 20 },
      { name: "Poliamida adhesiva DTF", sku: "MAT-DTF-002", category: "Materia prima", stock: 45, cost: 12, price: 20, unit: "kg", minStock: 10 },
      { name: "Hilos de bordar Madeira (conos)", sku: "MAT-BOR-001", category: "Materia prima", stock: 85, cost: 3.5, price: 6, unit: "unidad", minStock: 15 },
      { name: "Tela Gabardina Mil Rayas", sku: "MAT-TEL-001", category: "Materia prima", stock: 350, cost: 4.2, price: 7.5, unit: "m", minStock: 50 },

      // Líneas de Uniformes Cristo Rey
      {
        name: "Pantalón Táctico Ripstop Operativo",
        sku: "TAC-001",
        category: "Tácticos",
        kind: "product",
        stock: 45,
        cost: 16.5,
        price: 36,
        variation: "Negro / Verde Oliva · Tallas 28-40",
        description: "Pantalón táctico de alta resistencia, 6 bolsillos funcionales, refuerzo en rodillas y tiro.",
        image: "/images/pantalon.jpg",
        minStock: 10,
      },
      {
        name: "Camisa Táctica Manga Larga con charreteras",
        sku: "TAC-002",
        category: "Tácticos",
        kind: "product",
        stock: 38,
        cost: 13.8,
        price: 32,
        variation: "Negro / Azul Noche · S-XL",
        image: "/images/camisa.jpg",
        minStock: 8,
      },
      {
        name: "Mono Industrial / Overol de Trabajo",
        sku: "IND-001",
        category: "Industria y Obra",
        kind: "product",
        stock: 62,
        cost: 18.0,
        price: 39,
        variation: "Azul Marino / Naranja Reflectivo",
        description: "Overol industrial de alta resistencia para talleres, minería, construcción y manufactura.",
        image: "/images/sudadera.jpg",
        minStock: 15,
      },
      {
        name: "Chaleco de Seguridad Reflectivo",
        sku: "IND-002",
        category: "Industria y Obra",
        kind: "product",
        stock: 90,
        cost: 4.5,
        price: 11,
        variation: "Verde Neón con cintas 3M",
        minStock: 20,
      },
      {
        name: "Chemise Corporativa Tipo Polo con cuello tejido",
        sku: "CORP-001",
        category: "Corporativos",
        kind: "product",
        stock: 140,
        cost: 7.2,
        price: 17.5,
        variation: "Piqué 100% Algodón · Variedad de colores",
        image: "/images/camiseta.jpg",
        minStock: 25,
      },
      {
        name: "Camisa Oxford Ejecutiva Manga Corta/Larga",
        sku: "CORP-002",
        category: "Corporativos",
        kind: "product",
        stock: 55,
        cost: 12.0,
        price: 28,
        variation: "Celeste / Blanco / Rayas finas",
        image: "/images/camisa.jpg",
        minStock: 12,
      },
      {
        name: "Conjunto Deportivo Escolar (Mono + Chaqueta)",
        sku: "ESC-001",
        category: "Escolares",
        kind: "product",
        stock: 48,
        cost: 15.0,
        price: 34,
        variation: "Azul Marino / Blanco · Tallas 4 a 16",
        minStock: 15,
      },
      {
        name: "Gorra Corporativa 6 Paneles con cierre ajustable",
        sku: "ACC-001",
        category: "Accesorios",
        kind: "product",
        stock: 110,
        cost: 3.2,
        price: 8.5,
        image: "/images/gorra.jpg",
        minStock: 20,
      },
    ]).returning();

    // SERVICIOS ESPECIALES: SERVICIO DTF y BORDADO INDUSTRIAL
    await tx.insert(schema.products).values([
      // Servicio DTF Directo al Film (Impresión y planchado textil por metro o pieza)
      {
        name: "Servicio de Impresión DTF Textil (Metro lineal 60cm)",
        sku: "SRV-DTF-001",
        kind: "recipe",
        category: "Servicio DTF",
        stock: 0,
        cost: 2.1,
        price: 9.5,
        description: "Impresión Direct-to-Film de alta resolución con tintas textiles y poliamida elástica para estampados de ultra durabilidad.",
        ingredients: [
          { productId: catalog[0].id, quantity: 1 }, // 1m de Film
          { productId: catalog[1].id, quantity: 0.1 }, // 100g de poliamida
        ],
      },
      {
        name: "Estampado DTF Pecho/Espalda por Unidad",
        sku: "SRV-DTF-002",
        kind: "service",
        category: "Servicio DTF",
        stock: 0,
        cost: 0.8,
        price: 3.5,
        description: "Aplicación y planchado térmico industrial de transfer DTF en prenda terminada.",
      },
      {
        name: "Bordado Industrial de Logotipo (hasta 8.000 puntadas)",
        sku: "SRV-BOR-001",
        kind: "service",
        category: "Bordado Industrial",
        stock: 0,
        cost: 0.6,
        price: 2.8,
        description: "Bordado directo sobre chemises, camisas, chaquetas y gorras con maquinaria computarizada.",
      },
      {
        name: "Ponchado y Digitalización de Matriz de Bordado",
        sku: "SRV-BOR-002",
        kind: "service",
        category: "Bordado Industrial",
        stock: 0,
        cost: 2.0,
        price: 15.0,
        description: "Conversión de arte vectorial a archivo matriz DST/EMB para bordadora industrial.",
      },
    ]);

    // Cuentas bancarias y cajas
    const bankAccounts = await tx.insert(schema.accounts).values([
      { name: "Banesco Banco Universal (Cuenta Corriente)", currency: "VES", balance: 245000, method: "Pago móvil / Transferencia", color: "green" },
      { name: "Banesco Moneda Extranjera ($)", currency: "USD", balance: 4250, method: "Transferencia Banesco Verde", color: "green" },
      { name: "Bank of America (Zelle)", currency: "USD", balance: 5800, method: "Zelle", color: "red" },
      { name: "Caja Principal Fábrica (Efectivo $)", currency: "USD", balance: 1420, method: "Efectivo USD", color: "purple" },
    ]).returning();

    // Clientes con RIF venezolano
    const people = await tx.insert(schema.customers).values([
      { name: "Distribuidora Los Andes C.A.", document: "J-30894123-5", email: "compras@losandesca.com", phone: "+58 414 901 2345", address: "Av. Francisco de Miranda, Edif. Centro Seguros, Chacao", taxPayerType: "Especial" },
      { name: "Colegio San Ignacio de Loyola", document: "J-00129384-2", email: "administracion@sanignacio.edu.ve", phone: "+58 412 888 1122", address: "Calle Santa Teresa, La Castellana, Caracas", taxPayerType: "Formal" },
      { name: "Grupo Seguridad Integral C.A.", document: "J-40128934-8", email: "logistica@seguridadintegral.ve", phone: "+58 424 555 6789", address: "Zona Industrial La Trinidad, Galpón 4", taxPayerType: "Ordinario" },
      { name: "Dra. Valentina Mendoza", document: "V-18765432-1", email: "vmendoza.odonto@gmail.com", phone: "+58 416 333 4455", address: "Clínica El Ávila, Consultorio 3B, Altamira", taxPayerType: "Ordinario" },
      { name: "Carlos Rodríguez (Taller Mecánico El Prado)", document: "V-15890234-4", email: "carlos.prado@gmail.com", phone: "+58 412 555 0123", address: "Calle Los Talleres, Boleíta Sur", taxPayerType: "Ordinario" },
    ]).returning();

    // Ventas iniciales con numeración fiscal y número de control auditable SENIAT
    const now = new Date();
    const saleValues: (typeof schema.sales.$inferInsert)[] = [];
    let invoiceSeq = 1001;
    let controlSeq = 101;

    for (let period = 1; period >= 0; period--) {
      const count = period ? 24 : 32;
      const days = period ? 28 : now.getDate();
      for (let i = 0; i < count; i++) {
        const p1 = catalog[i % catalog.length];
        const p2 = catalog[(i * 3 + 2) % catalog.length];
        const qty1 = (i % 4) + 2;
        const qty2 = i % 2 === 0 ? 3 : 1;

        const items: schema.SaleItem[] = [
          { productId: p1.id, name: p1.name, quantity: qty1, price: p1.price, cost: p1.cost, isExempt: p1.isExempt },
          { productId: p2.id, name: p2.name, quantity: qty2, price: p2.price, cost: p2.cost, isExempt: p2.isExempt },
        ];

        const subtotal = items.reduce((s, x) => s + x.quantity * x.price, 0);
        const cost = items.reduce((s, x) => s + x.quantity * x.cost, 0);
        const taxableBase = subtotal;
        const ivaAmount = +(taxableBase * 0.16).toFixed(2);
        const total = +(taxableBase + ivaAmount).toFixed(2);

        const customer = people[i % people.length];
        const account = bankAccounts[i % bankAccounts.length];
        const createdAt = new Date(now.getFullYear(), now.getMonth() - period, 1 + (i % days), 9 + (i % 8), (i * 11) % 60);

        const invoiceNumber = `FAC-2026-${String(invoiceSeq++).padStart(6, "0")}`;
        const controlNumber = `00-${String(controlSeq++).padStart(6, "0")}`;
        const auditHash = `SENIAT-${invoiceNumber}-${controlNumber}-${total.toFixed(2)}`;

        saleValues.push({
          invoiceNumber,
          controlNumber,
          customerId: customer.id,
          customerName: customer.name,
          customerRif: customer.document,
          customerAddress: customer.address,
          customerEmail: customer.email,
          items,
          payments: [{ accountId: account.id, amount: total, reference: `REF-${100000 + i}` }],
          taxableBase,
          exemptAmount: 0,
          ivaRate: 16,
          ivaAmount,
          igtfRate: account.currency === "USD" ? 3 : 0,
          igtfAmount: 0,
          exchangeRateBcv: 69.5,
          total,
          cost,
          extra: 0,
          status: "paid",
          channel: i % 4 === 0 ? "Mayorista corporativo" : "Tienda física",
          emailSent: true,
          emailSentAt: createdAt,
          auditHash,
          createdAt,
        });
      }
    }
    await tx.insert(schema.sales).values(saleValues);

    // Gastos con soporte SENIAT, internos y personales
    const expenseValues: (typeof schema.expenses.$inferInsert)[] = [
      {
        name: "Compra de Tintas Textiles Dupont y Film DTF",
        amount: 850,
        category: "Insumos DTF",
        type: "variable",
        scope: "business",
        beneficiary: "Suministros Gráficos Digitales C.A.",
        beneficiaryRif: "J-31456789-0",
        invoiceNumber: "FAC-88912",
        controlNumber: "00-459102",
        taxableBase: 732.76,
        ivaAmount: 117.24,
        ivaRetained: 87.93,
        accountId: bankAccounts[1].id,
        notes: "Insumos para producción de servicio DTF y bordados.",
      },
      {
        name: "Alquiler Galpón y Taller Industrial Los Ruices",
        amount: 1400,
        category: "Alquiler",
        type: "fixed",
        scope: "business",
        beneficiary: "Inversiones Inmobiliarias Ruices C.A.",
        beneficiaryRif: "J-29876123-4",
        invoiceNumber: "FAC-1240",
        controlNumber: "00-019284",
        taxableBase: 1206.9,
        ivaAmount: 193.1,
        accountId: bankAccounts[1].id,
        notes: "Canon de arrendamiento mensual galpón de confección.",
      },
      {
        name: "Nómina Operarios de Corte y Costura (Quincena)",
        amount: 1850,
        category: "Nómina",
        type: "fixed",
        scope: "business",
        beneficiary: "Nómina 12 Costureras y Bordadores",
        beneficiaryRif: "V-Varios",
        invoiceNumber: "REC-NOM-026",
        controlNumber: "INT-026",
        accountId: bankAccounts[0].id,
        notes: "Pago directo quincenal por Banesco Pago Móvil.",
      },
      {
        name: "Caja Chica: Refrigerio y café para operarios",
        amount: 65,
        category: "Caja chica",
        type: "variable",
        scope: "internal",
        beneficiary: "Panadería y Delicateses La Ruiceña",
        beneficiaryRif: "J-40192834-1",
        invoiceNumber: "TKT-55410",
        controlNumber: "00-88123",
        accountId: bankAccounts[3].id,
        notes: "Soporte de caja chica con ticket y recibo interno.",
      },
      {
        name: "Mantenimiento Preventivo de Bordadora Meistergram 8 Cabezales",
        amount: 220,
        category: "Mantenimiento",
        type: "variable",
        scope: "business",
        beneficiary: "Servicios Técnicos Industriales C.A.",
        beneficiaryRif: "J-30918273-6",
        invoiceNumber: "FAC-3490",
        controlNumber: "00-22194",
        taxableBase: 189.66,
        ivaAmount: 30.34,
        accountId: bankAccounts[2].id,
        notes: "Engrase de bielas, ajuste de lanzaderas y sincronización.",
      },
      {
        name: "Retiro personal del socio (Gastos personales)",
        amount: 450,
        category: "Retiro personal",
        type: "variable",
        scope: "personal",
        beneficiary: "Jesús Gómez (Socio / Administrador)",
        beneficiaryRif: "V-14908123-5",
        invoiceNumber: "COMP-INT-008",
        controlNumber: "SOC-008",
        accountId: bankAccounts[2].id,
        notes: "Retiro a cuenta personal no imputable al costo fiscal de la empresa.",
      },
    ];
    await tx.insert(schema.expenses).values(expenseValues);

    // Cuentas por cobrar y pagar
    const date = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset).toISOString().slice(0, 10);
    await tx.insert(schema.pending).values([
      { name: "Dotación 120 Uniformes Tácticos", contact: "Grupo Seguridad Integral C.A.", type: "receivable", amount: 1840, dueDate: date(5) },
      { name: "Factura Proveedor Tela Gabardina", contact: "Textiles del Centro C.A.", type: "payable", amount: 920, dueDate: date(7) },
      { name: "Lote de 80 Chemises Colegio San Ignacio", contact: "Colegio San Ignacio de Loyola", type: "receivable", amount: 680, dueDate: date(-2) },
    ]);

    // Equipo de trabajo
    await tx.insert(schema.members).values([
      { name: "Jesús Gómez", email: "contacto@fabricacristorey.com", role: "Director General", permissions: ["ventas", "inventario", "cuentas", "gastos", "financiero", "auditoria", "clientes", "marketing", "configuracion"] },
      { name: "Katerin Rodríguez", email: "katerin@fabricacristorey.com", role: "Jefa de Taller y DTF", permissions: ["inventario", "ventas"] },
      { name: "Lic. Marcos Alvarado", email: "contabilidad@fabricacristorey.com", role: "Contador Auditor", permissions: ["auditoria", "financiero", "cuentas", "gastos"] },
    ]);

    // Campañas
    await tx.insert(schema.campaigns).values([
      {
        name: "Lanzamiento Servicio DTF Textil para Empresas",
        message: "¡Hola! En Fábrica Cristo Rey estrenamos el nuevo Servicio de Impresión DTF por metro y estampado textil con la máxima resolución y durabilidad. Cotiza tus uniformes corporativos con nosotros.",
        segment: "Todos los clientes",
        status: "Borrador",
      },
    ]);

    // Mesas / Puestos de atención al cliente
    await tx.insert(schema.diningTables).values([
      { name: "Módulo 1 · Mostrador Principal", seats: 2 },
      { name: "Módulo 2 · Asesoría DTF y Bordados", seats: 3 },
      { name: "Módulo 3 · Sala de Muestras y Telas", seats: 4 },
      { name: "Módulo 4 · Atención Mayoristas", seats: 4 },
    ]);

    // Órdenes iniciales para taller (Plotter DTF y Bordadora)
    await tx.insert(schema.productionOrders).values([
      {
        orderNumber: "OP-DTF-0101",
        station: "plotter_dtf",
        customerName: "Distribuidora Los Andes C.A.",
        customerPhone: "+58 414 901 2345",
        customerEmail: "compras@losandesca.com",
        items: [{ name: "Impresión Film DTF Textil", quantity: 12, details: "12 metros lineales a 60cm" }],
        dimensions: "60cm ancho x 12m largo continuo",
        colors: "CMYK + Doble capa blanca W2 alta opacidad (100%)",
        garmentType: "Transfer textil para estampado en chemises azul marino",
        fileName: "Logo_LosAndes_Pecho_Espalda_300dpi.png",
        fileSize: "28.4 MB (Vectorizado 300 DPI CMYK)",
        fileUrl: "https://fabricacristorey.com/artes/los-andes-dtf.png",
        notes: "ORDEN POR LLEGADA: Imprimir espejo (Mirror Mode). Curado de poliamida a 130°C por 120 seg. Planchado posterior a 155°C por 15 segundos en taller.",
        priority: "alta",
        status: "pendiente",
        operatorName: "Carlos DTF",
        stationIpOrDevice: "Plotter DTF Industrial I3200 - Terminal 1",
      },
      {
        orderNumber: "OP-DTF-0102",
        station: "plotter_dtf",
        customerName: "Grupo Seguridad Integral C.A.",
        customerPhone: "+58 424 555 6789",
        customerEmail: "logistica@seguridadintegral.ve",
        items: [{ name: "DTF Escudos de Seguridad Pecho", quantity: 60, details: "10x8 cm cada escudo" }],
        dimensions: "10cm x 8cm (60 unidades dispuestas en 3 metros)",
        colors: "Dorado metalizado + Blanco + Negro alta definición",
        garmentType: "Overoles y pantalones tácticos Ripstop",
        fileName: "Escudo_Seguridad_Integral_DTF.pdf",
        fileSize: "14.2 MB (PDF Curvas)",
        fileUrl: "https://fabricacristorey.com/artes/seguridad-escudo.pdf",
        notes: "Verificar calibración de blanco en cabezal I3200. Entregar con recorte individual listo para plancha.",
        priority: "normal",
        status: "en_proceso",
        operatorName: "Carlos DTF",
        stationIpOrDevice: "Plotter DTF Industrial I3200 - Terminal 1",
      },
      {
        orderNumber: "OP-BOR-0201",
        station: "bordadora",
        customerName: "Colegio San Ignacio de Loyola",
        customerPhone: "+58 412 888 1122",
        customerEmail: "administracion@sanignacio.edu.ve",
        items: [{ name: "Bordado Escudo Institucional", quantity: 80, details: "Bordado pecho izquierdo chemises escolares" }],
        dimensions: "7.5cm ancho x 8.0cm alto",
        colors: "Hilos Madeira: Azul Marino #1042, Blanco #1001, Dorado #1083",
        garmentType: "Chemises Piqué Blancas y Chaquetas Deportivas (80 piezas)",
        fileName: "Escudo_SanIgnacio_Matriz.dst",
        fileSize: "18.500 puntadas · Archivo Tajima DST",
        fileUrl: "https://fabricacristorey.com/artes/san-ignacio-escudo.dst",
        notes: "Matriz DST cargada en cabezal 1 a 8. Usar entretela hidrosoluble para que no marque el piqué. Tensión de hilo media.",
        priority: "urgente",
        status: "pendiente",
        operatorName: "Katerin Bordados",
        stationIpOrDevice: "Bordadora Meistergram 8 Cabezales - Terminal 2",
      },
    ]);

    await tx.insert(schema.activities).values([
      { type: "system", description: "Bienvenido a Tesorio · Sistema administrativo y fiscal homologado para Fábrica Cristo Rey C.A.", amount: 0 },
    ]);
  });
}

export async function getData(): Promise<AppData> {
  await ensureSeeded();
  const [products, accounts, customers, sales, expenses, pending, activities, settings, members, campaigns, diningTables, productionOrders, bankStatements, payrollEmployees, payrollPeriods, payrollTransactions, payrollReceipts, payrollConfig] = await Promise.all([
    db.select().from(schema.products).orderBy(schema.products.id),
    db.select().from(schema.accounts).orderBy(schema.accounts.id),
    db.select().from(schema.customers).orderBy(schema.customers.name),
    db.select().from(schema.sales).orderBy(desc(schema.sales.createdAt)),
    db.select().from(schema.expenses).orderBy(desc(schema.expenses.createdAt)),
    db.select().from(schema.pending).orderBy(schema.pending.dueDate),
    db.select().from(schema.activities).orderBy(desc(schema.activities.createdAt)).limit(100),
    db.select().from(schema.settings).limit(1),
    db.select().from(schema.members).orderBy(schema.members.id),
    db.select().from(schema.campaigns).orderBy(desc(schema.campaigns.createdAt)),
    db.select().from(schema.diningTables).orderBy(schema.diningTables.id),
    db.select().from(schema.productionOrders).orderBy(schema.productionOrders.id),
    db.select().from(schema.bankStatements).orderBy(desc(schema.bankStatements.createdAt)),
    db.select().from(schema.employees).orderBy(schema.employees.id),
    db.select().from(schema.payrollPeriods).orderBy(desc(schema.payrollPeriods.createdAt)),
    db.select().from(schema.payrollTransactions).orderBy(desc(schema.payrollTransactions.createdAt)),
    db.select().from(schema.payrollReceipts).orderBy(desc(schema.payrollReceipts.createdAt)),
    db.select().from(schema.payrollConfig).limit(1),
  ]);
  return JSON.parse(JSON.stringify({ products, accounts, customers, sales, expenses, pending, activities, settings: settings[0], members, campaigns, diningTables, productionOrders, bankStatements, payrollEmployees, payrollPeriods, payrollTransactions, payrollReceipts, payrollConfig: payrollConfig[0] || null }));
}
