import { db } from "@/db";
import * as s from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { ensureSeeded } from "@/lib/data";
import { autoMatchRows, normalizeBankRows } from "@/lib/bank-reconcile";

class InputError extends Error {}
function check(value: unknown, message: string): asserts value {
  if (!value) throw new InputError(message);
}
function number(value: unknown, fallback = 0) {
  const n = value === "" || value === undefined || value === null ? fallback : Number(value);
  check(Number.isFinite(n), "Introduce un número válido.");
  return n;
}
function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, 4000);
}

export async function POST(request: Request) {
  try {
    await ensureSeeded();
    const body = await request.json();
    const action = text(body.action);
    const d = body.data || {};

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(4839202)`);
      const [settings] = await tx.select().from(s.settings).where(eq(s.settings.id, 1));
      const rate = settings.exchangeRate;

      const log = async (type: string, description: string, amount = 0, accountId?: number) => {
        await tx.insert(s.activities).values({ type, description, amount, accountId });
      };

      const moveAccount = async (id: number, usd: number, commission = false) => {
        const [a] = await tx.select().from(s.accounts).where(eq(s.accounts.id, id));
        check(a, "Selecciona una cuenta válida.");
        const value = usd * (a.currency === "VES" ? rate : 1) * (commission && usd > 0 ? 1 - a.commission / 100 : 1);
        check(a.balance + value >= -0.005, `Saldo insuficiente en ${a.name}.`);
        await tx.update(s.accounts).set({ balance: sql`${s.accounts.balance} + ${value}` }).where(eq(s.accounts.id, id));
        return a;
      };

      // GUARDAR PRODUCTO / RECETA / SERVICIO
      if (action === "product.save") {
        const name = text(d.name);
        check(name, "El nombre del producto es obligatorio.");
        const kind = ["product", "recipe", "service"].includes(d.kind) ? d.kind : "product";
        const stock = number(d.stock), price = number(d.price), minStock = number(d.minStock, 5);
        let cost = number(d.cost);
        check(stock >= 0 && price >= 0 && cost >= 0 && minStock >= 0, "Los valores no pueden ser negativos.");
        const ingredients: s.Ingredient[] = [];

        if (kind === "recipe") {
          check(Array.isArray(d.ingredients) && d.ingredients.length > 0 && d.ingredients.length <= 30, "Agrega al menos un insumo a la receta.");
          cost = 0;
          for (const raw of d.ingredients) {
            const productId = number(raw.productId), quantity = number(raw.quantity);
            const [p] = await tx.select().from(s.products).where(eq(s.products.id, productId));
            check(p && quantity > 0, "Revisa los insumos de la receta.");
            ingredients.push({ productId, quantity });
            cost += p.cost * quantity;
          }
        }

        const values = {
          name,
          sku: text(d.sku) || `CR-${Date.now().toString().slice(-6)}`,
          category: text(d.category, "General"),
          kind,
          stock: kind === "product" ? stock : 0,
          price,
          cost,
          minStock,
          unit: text(d.unit, "unidad"),
          location: text(d.location, "Taller Principal"),
          description: text(d.description),
          variation: text(d.variation),
          image: text(d.image),
          ingredients,
          isExempt: Boolean(d.isExempt),
        };

        let previousStock = 0;
        if (d.id) {
          const [previous] = await tx.select().from(s.products).where(eq(s.products.id, number(d.id)));
          check(previous, "Producto no encontrado.");
          previousStock = previous.stock;
        }

        const [product] = d.id
          ? await tx.update(s.products).set(values).where(eq(s.products.id, number(d.id))).returning()
          : await tx.insert(s.products).values(values).returning();

        if (d.paymentAccountId && stock > previousStock) {
          const totalPaid = (stock - previousStock) * cost;
          await moveAccount(number(d.paymentAccountId), -totalPaid);
          await log("inventory", `Compra de insumos/mercancía: ${name}`, -totalPaid, number(d.paymentAccountId));
        }

        await log("inventory", `${d.id ? "Actualización" : "Ingreso"} de ${name}`);
        return { product };
      }

      // IMPORTACIÓN MASIVA DESDE EXCEL
      if (action === "products.import") {
        check(Array.isArray(d.rows) && d.rows.length > 0 && d.rows.length <= 5000, "El archivo debe contener entre 1 y 5.000 productos.");
        let count = 0;
        for (const row of d.rows) {
          const name = text(row.Nombre ?? row.nombre ?? row.name);
          if (!name) continue;
          const stock = number(row.Cantidad ?? row.cantidad ?? row.stock);
          const cost = number(row.Costo ?? row.costo ?? row.cost);
          const price = number(row.Precio ?? row.precio ?? row.price);
          check(stock >= 0 && cost >= 0 && price >= 0, `Revisa los valores de ${name}.`);
          const sku = text(row.SKU ?? row.sku) || `CR-IMP-${Date.now()}-${count}`;
          const [existing] = await tx.select().from(s.products).where(eq(s.products.sku, sku));
          const values = {
            name,
            sku,
            stock,
            cost,
            price,
            category: text(row.Categoria ?? row.Categoría ?? row.category, "General"),
          };
          if (existing) await tx.update(s.products).set(values).where(eq(s.products.id, existing.id));
          else await tx.insert(s.products).values(values);
          count++;
        }
        check(count > 0, "No encontramos productos válidos en el archivo.");
        await log("inventory", `Importación de ${count} productos desde Excel`);
        return { count };
      }

      // CREAR VENTA / FACTURA FISCAL SENIAT DIGITAL CON NÚMERO DE CONTROL
      if (action === "sale.create") {
        check(Array.isArray(d.items) && d.items.length > 0 && d.items.length <= 100, "Agrega productos a la factura.");
        const catalog = await tx.select().from(s.products);
        const demand = new Map<number, number>();
        const items: s.SaleItem[] = [];
        const channel = settings.channels.find((c) => c.name === d.channel) || settings.channels[0];

        let taxableBase = 0;
        let exemptAmount = 0;

        for (const row of d.items) {
          const p = catalog.find((cat) => cat.id === number(row.productId));
          const quantity = number(row.quantity);
          check(p && quantity > 0 && quantity <= 100000, "Revisa las cantidades de la venta.");
          let cost = p.cost;

          if (p.kind === "product") demand.set(p.id, (demand.get(p.id) || 0) + quantity);
          if (p.kind === "recipe") {
            cost = 0;
            for (const ingredient of p.ingredients) {
              const raw = catalog.find((r) => r.id === ingredient.productId);
              check(raw, "No se encontró un insumo de la receta.");
              demand.set(raw.id, (demand.get(raw.id) || 0) + ingredient.quantity * quantity);
              cost += raw.cost * ingredient.quantity;
            }
          }

          const itemPrice = Math.round(p.price * channel.multiplier * 100) / 100;
          const itemTotal = itemPrice * quantity;
          if (p.isExempt) {
            exemptAmount += itemTotal;
          } else {
            taxableBase += itemTotal;
          }

          items.push({
            productId: p.id,
            name: p.name,
            quantity,
            price: itemPrice,
            cost,
            isExempt: p.isExempt,
          });
        }

        // Verificar inventario
        for (const [id, qty] of demand) {
          const p = catalog.find((cat) => cat.id === id)!;
          check(p.stock >= qty, `Stock insuficiente de "${p.name}". Disponible: ${p.stock} ${p.unit}.`);
        }

        const extra = number(d.extra);
        check(extra >= 0, "El cargo extra no puede ser negativo.");
        taxableBase = Math.round(taxableBase * 100) / 100;
        exemptAmount = Math.round(exemptAmount * 100) / 100;

        // IVA 16% según ley venezolana
        const ivaRate = settings.defaultIva || 16;
        const ivaAmount = Math.round(taxableBase * (ivaRate / 100) * 100) / 100;

        // Subtotal con IVA
        let invoiceTotal = Math.round((taxableBase + exemptAmount + ivaAmount + extra) * 100) / 100;

        // Pagos
        const payments: s.Payment[] = [];
        check(Array.isArray(d.payments), "Selecciona un método de pago.");
        let foreignCurrencyTotal = 0;

        for (const raw of d.payments) {
          const amount = number(raw.amount);
          check(amount > 0, "El monto de pago debe ser positivo.");
          const [acc] = await tx.select().from(s.accounts).where(eq(s.accounts.id, number(raw.accountId)));
          check(acc, "Cuenta no válida.");
          if (acc.currency === "USD") {
            foreignCurrencyTotal += amount;
          }
          payments.push({
            accountId: acc.id,
            amount,
            paymentType: text(raw.paymentType) || acc.method,
            bankName: text(raw.bankName) || acc.name,
            reference: text(raw.reference) || (acc.method.toLowerCase().includes("efectivo") ? "Efectivo entregado" : `REF-${Date.now().toString().slice(-6)}`),
          });
        }

        // IGTF 3% en pagos con divisas según ley venezolana (si aplica)
        let igtfAmount = 0;
        if (settings.applyIgtfOnForeignCurrency && d.includeIgtf) {
          igtfAmount = Math.round(foreignCurrencyTotal * (settings.defaultIgtf / 100) * 100) / 100;
          invoiceTotal = Math.round((invoiceTotal + igtfAmount) * 100) / 100;
        }

        const paid = Math.round(payments.reduce((sum, p) => sum + p.amount, 0) * 100) / 100;
        check(paid <= invoiceTotal + 0.02, "El pago supera el total de la factura. Registra solo el monto exacto.");
        check(d.credit || Math.abs(invoiceTotal - paid) < 0.05, "El monto pagado debe coincidir con el total de la factura.");

        let customer;
        if (d.customerId) {
          [customer] = await tx.select().from(s.customers).where(eq(s.customers.id, number(d.customerId)));
          check(customer, "Cliente no encontrado.");
        }
        check(!d.credit || customer, "Selecciona un cliente para registrar una venta a crédito.");

        // Numeración correlativa y Número de Control SENIAT
        const invoiceNum = settings.nextInvoiceNumber;
        const controlNum = settings.nextControlNumber;
        const invoiceNumber = `${settings.fiscalSeries}${String(invoiceNum).padStart(6, "0")}`;
        const controlNumber = `${settings.controlSeries}${String(controlNum).padStart(6, "0")}`;
        const auditHash = `SENIAT-${invoiceNumber}-${controlNumber}-${invoiceTotal.toFixed(2)}-${Date.now()}`;

        // Incrementar correlativos de configuración
        await tx
          .update(s.settings)
          .set({
            nextInvoiceNumber: invoiceNum + 1,
            nextControlNumber: controlNum + 1,
          })
          .where(eq(s.settings.id, 1));

        const customerName = customer ? customer.name : text(d.customerName) || "Cliente general";
        const customerRif = customer ? customer.document : text(d.customerRif) || "V-00000000-0";
        const customerAddress = customer ? customer.address : text(d.customerAddress) || "Caracas, Venezuela";
        const customerEmail = customer ? customer.email : text(d.customerEmail) || "";

        const [sale] = await tx
          .insert(s.sales)
          .values({
            invoiceNumber,
            controlNumber,
            customerId: customer?.id,
            customerName,
            customerRif,
            customerAddress,
            customerEmail,
            items,
            payments,
            taxableBase,
            exemptAmount,
            ivaRate,
            ivaAmount,
            igtfRate: settings.defaultIgtf,
            igtfAmount,
            exchangeRateBcv: rate,
            total: invoiceTotal,
            cost: items.reduce((sum, i) => sum + i.cost * i.quantity, 0),
            extra,
            channel: channel.name,
            status: paid + 0.05 < invoiceTotal ? "pending" : "paid",
            emailSent: Boolean(d.sendEmail && customerEmail),
            emailSentAt: d.sendEmail && customerEmail ? new Date() : null,
            auditHash,
          })
          .returning();

        // Descontar inventario
        for (const [id, qty] of demand) {
          await tx.update(s.products).set({ stock: sql`${s.products.stock} - ${qty}` }).where(eq(s.products.id, id));
        }

        // Mover saldos bancarios y comisiones
        for (const payment of payments) {
          const account = await moveAccount(payment.accountId, payment.amount, true);
          await log("sale", `Factura ${invoiceNumber} (Control ${controlNumber}) · ${customerName}`, payment.amount, payment.accountId);
          if (account.commission > 0) {
            const fee = +(payment.amount * (account.commission / 100)).toFixed(4);
            await tx.insert(s.expenses).values({
              name: `Comisión ${account.method} · Factura ${invoiceNumber}`,
              amount: fee,
              category: "Comisiones",
              type: "variable",
              scope: "business",
              beneficiary: account.name,
              accountId: account.id,
            });
            await log("expense", `Comisión de venta #${sale.id}`, -fee, account.id);
          }
        }

        // Cuentas por cobrar si fue a crédito
        if (paid + 0.05 < invoiceTotal) {
          await tx.insert(s.pending).values({
            name: `Factura ${invoiceNumber} · Saldo pendiente`,
            contact: customerName,
            amount: +(invoiceTotal - paid).toFixed(2),
            dueDate: text(d.dueDate) || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
            type: "receivable",
            saleId: sale.id,
          });
        }

        // Liberar mesa si aplica
        if (d.tableId) {
          await tx.update(s.diningTables).set({ items: [] }).where(eq(s.diningTables.id, number(d.tableId)));
        }

        return { sale };
      }

      // ENVIAR / REENVIAR FACTURA POR CORREO AL CLIENTE
      if (action === "sale.sendEmail") {
        const saleId = number(d.saleId);
        const email = text(d.email);
        check(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Introduce un correo electrónico válido.");
        const [sale] = await tx.select().from(s.sales).where(eq(s.sales.id, saleId));
        check(sale, "Factura no encontrada.");

        await tx
          .update(s.sales)
          .set({
            customerEmail: email,
            emailSent: true,
            emailSentAt: new Date(),
          })
          .where(eq(s.sales.id, saleId));

        await log("system", `Factura digital ${sale.invoiceNumber} enviada por correo a ${email}`);
        return { success: true, email };
      }

      // ANULAR FACTURA (SENIAT: Generación de Nota de Anulación y reversión)
      if (action === "sale.void") {
        const saleId = number(d.saleId);
        const [sale] = await tx.select().from(s.sales).where(eq(s.sales.id, saleId));
        check(sale && sale.status !== "void", "Factura no encontrada o ya anulada.");

        // Reintegrar inventario
        for (const item of sale.items) {
          await tx.update(s.products).set({ stock: sql`${s.products.stock} + ${item.quantity}` }).where(eq(s.products.id, item.productId));
        }

        // Revertir pagos
        for (const p of sale.payments) {
          await moveAccount(p.accountId, -p.amount);
        }

        await tx.update(s.sales).set({ status: "void" }).where(eq(s.sales.id, saleId));
        await log("sale", `Factura anulada ${sale.invoiceNumber} (Control ${sale.controlNumber})`, -sale.total);
        return { success: true };
      }

      // REGISTRAR GASTO CON SOPORTE LEGAL / INTERNO / PERSONAL
      if (action === "expense.create") {
        const name = text(d.name), amount = number(d.amount), accountId = number(d.accountId);
        check(name && amount > 0, "Indica el concepto y un monto válido.");
        await moveAccount(accountId, -amount);

        const scope = ["business", "internal", "personal"].includes(d.scope) ? d.scope : "business";
        const taxableBase = number(d.taxableBase, amount / 1.16);
        const ivaAmount = number(d.ivaAmount, amount - taxableBase);
        const ivaRetained = number(d.ivaRetained, 0);
        const islrRetained = number(d.islrRetained, 0);

        const createdAt = d.date ? new Date(`${text(d.date)}T12:00:00`) : new Date();
        check(!Number.isNaN(createdAt.getTime()), "Fecha inválida.");

        const [expense] = await tx
          .insert(s.expenses)
          .values({
            name,
            amount,
            category: text(d.category, "Otros"),
            type: d.type === "fixed" ? "fixed" : "variable",
            scope,
            beneficiary: text(d.beneficiary, "Proveedor / Beneficiario"),
            beneficiaryRif: text(d.beneficiaryRif),
            invoiceNumber: text(d.invoiceNumber),
            controlNumber: text(d.controlNumber),
            taxableBase,
            ivaAmount,
            ivaRetained,
            islrRetained,
            accountId,
            notes: text(d.notes),
            receiptUrl: text(d.receiptUrl),
            createdAt,
          })
          .returning();

        await log("expense", `Gasto (${scope === "personal" ? "Personal" : scope === "internal" ? "Interno" : "Operativo"}): ${name}`, -amount, accountId);
        return { expense };
      }

      // GUARDAR CUENTA
      if (action === "account.save") {
        const name = text(d.name), balance = number(d.balance), commission = number(d.commission);
        check(name && balance >= 0 && commission >= 0 && commission <= 100, "Revisa los datos de la cuenta.");
        const values = {
          name,
          currency: d.currency === "VES" ? "VES" : "USD",
          balance,
          method: text(d.method, "Transferencia"),
          commission,
          color: text(d.color, "purple"),
        };
        if (d.id) await tx.update(s.accounts).set(values).where(eq(s.accounts.id, number(d.id)));
        else await tx.insert(s.accounts).values(values);
        await log("account", `${d.id ? "Actualización" : "Creación"} de cuenta: ${name}`);
        return {};
      }

      // TRANSFERENCIA ENTRE CUENTAS
      if (action === "account.transfer") {
        const from = number(d.from), to = number(d.to), amount = number(d.amount);
        check(from !== to && amount > 0, "Selecciona cuentas distintas y un monto positivo.");
        const source = await moveAccount(from, -amount);
        const target = await moveAccount(to, amount);
        await log("transfer", `Transferencia hacia ${target.name}`, -amount, from);
        await log("transfer", `Transferencia desde ${source.name}`, amount, to);
        return {};
      }

      // CLIENTES CON RIF
      if (action === "customer.save") {
        const name = text(d.name);
        check(name, "El nombre o razón social es obligatorio.");
        const email = text(d.email);
        check(!email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Correo electrónico inválido.");
        const values = {
          name,
          email,
          phone: text(d.phone),
          document: text(d.document) || "V-00000000",
          address: text(d.address),
          taxPayerType: text(d.taxPayerType, "Ordinario"),
        };
        if (d.id) await tx.update(s.customers).set(values).where(eq(s.customers.id, number(d.id)));
        else await tx.insert(s.customers).values(values);
        await log("customer", `Cliente guardado: ${name}`);
        return {};
      }

      // CUENTAS PENDIENTES
      if (action === "pending.create") {
        const amount = number(d.amount), name = text(d.name), contact = text(d.contact), dueDate = text(d.dueDate);
        check(name && contact && amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dueDate), "Completa los campos de la cuenta pendiente.");
        await tx.insert(s.pending).values({
          name,
          contact,
          amount,
          dueDate,
          type: d.type === "payable" ? "payable" : "receivable",
        });
        await log("pending", `Nueva cuenta pendiente: ${name}`, amount);
        return {};
      }

      // SALDAR CUENTA PENDIENTE
      if (action === "pending.settle") {
        const [p] = await tx.select().from(s.pending).where(eq(s.pending.id, number(d.id)));
        check(p && p.status === "pending", "La cuenta ya está saldada o no existe.");
        const accountId = number(d.accountId);
        const amount = p.type === "payable" ? -p.amount : p.amount;
        await moveAccount(accountId, amount);
        await tx.update(s.pending).set({ status: "paid" }).where(eq(s.pending.id, p.id));
        if (p.saleId) {
          const [sale] = await tx.select().from(s.sales).where(eq(s.sales.id, p.saleId));
          if (sale) {
            await tx
              .update(s.sales)
              .set({
                status: "paid",
                payments: [...sale.payments, { accountId, amount: p.amount, reference: `SALDO-${Date.now().toString().slice(-5)}` }],
              })
              .where(eq(s.sales.id, p.saleId));
          }
        }
        await log("settlement", `${p.type === "payable" ? "Pago" : "Cobro"}: ${p.name}`, amount, accountId);
        return {};
      }

      // CONFIGURACIÓN DE EMPRESA Y LOGO
      if (action === "settings.save") {
        const businessName = text(d.businessName, settings.businessName);
        check(businessName, "El nombre de la empresa es obligatorio.");
        const exchangeRate = number(d.exchangeRate, settings.exchangeRate);
        check(exchangeRate > 0, "La tasa de cambio oficial debe ser mayor a cero.");

        await tx
          .update(s.settings)
          .set({
            businessName,
            legalName: text(d.legalName, businessName),
            rif: text(d.rif, settings.rif),
            logoUrl: text(d.logoUrl, settings.logoUrl),
            ownerName: text(d.ownerName, settings.ownerName),
            email: text(d.email, settings.email),
            phone: text(d.phone, settings.phone),
            address: text(d.address, settings.address),
            fiscalSeries: text(d.fiscalSeries, settings.fiscalSeries),
            controlSeries: text(d.controlSeries, settings.controlSeries),
            seniatResolution: text(d.seniatResolution, settings.seniatResolution),
            printerAuthorization: text(d.printerAuthorization, settings.printerAuthorization),
            digitalPrinterApiUrl: text(d.digitalPrinterApiUrl, settings.digitalPrinterApiUrl),
            digitalPrinterApiKey: text(d.digitalPrinterApiKey, settings.digitalPrinterApiKey),
            digitalPrinterRif: text(d.digitalPrinterRif, settings.digitalPrinterRif),
            digitalPrinterName: text(d.digitalPrinterName, settings.digitalPrinterName),
            digitalPrinterProvNumber: text(d.digitalPrinterProvNumber, settings.digitalPrinterProvNumber),
            digitalPrinterEnvironment: text(d.digitalPrinterEnvironment, settings.digitalPrinterEnvironment),
            exchangeRate,
            defaultIva: number(d.defaultIva, settings.defaultIva),
            defaultIgtf: number(d.defaultIgtf, settings.defaultIgtf),
            applyIgtfOnForeignCurrency: Boolean(d.applyIgtfOnForeignCurrency),
          })
          .where(eq(s.settings.id, 1));
        return {};
      }

      // MIEMBROS DEL EQUIPO
      if (action === "member.save") {
        const name = text(d.name), email = text(d.email);
        check(name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Indica nombre y correo válido.");
        const values = {
          name,
          email,
          role: text(d.role, "Vendedor"),
          permissions: Array.isArray(d.permissions) ? d.permissions.map((p: unknown) => text(p)) : [],
        };
        if (d.id) await tx.update(s.members).set(values).where(eq(s.members.id, number(d.id)));
        else await tx.insert(s.members).values(values);
        return {};
      }

      // CAMPAÑAS
      if (action === "campaign.save") {
        const name = text(d.name), message = text(d.message);
        check(name && message, "Completa el nombre y mensaje de la campaña.");
        const values = {
          name,
          message,
          segment: text(d.segment, "Todos los clientes"),
          status: "Borrador",
        };
        if (d.id) await tx.update(s.campaigns).set(values).where(eq(s.campaigns.id, number(d.id)));
        else await tx.insert(s.campaigns).values(values);
        return {};
      }

      // CANALES DE VENTA
      if (action === "channel.save") {
        const name = text(d.name), multiplier = number(d.multiplier, 1);
        check(name && multiplier > 0, "Indica nombre y factor de precio.");
        const channels = settings.channels.filter((c) => c.name !== name);
        channels.push({ name, multiplier });
        await tx.update(s.settings).set({ channels }).where(eq(s.settings.id, 1));
        return {};
      }

      // MESAS / PUESTOS DE ATENCIÓN
      if (action === "table.save") {
        const name = text(d.name, "Puesto de atención"), seats = number(d.seats, 4);
        const items = Array.isArray(d.items) ? d.items.map((i: any) => ({ productId: number(i.productId), quantity: number(i.quantity) })) : [];
        if (d.id) await tx.update(s.diningTables).set({ name, seats, items }).where(eq(s.diningTables.id, number(d.id)));
        else await tx.insert(s.diningTables).values({ name, seats, items });
        return {};
      }

      // CIERRE / APERTURA DE CAJA
      if (action === "cash.toggle") {
        const opening = number(d.cashOpening, settings.cashOpening);
        const counted = number(d.counted);
        await tx.update(s.settings).set({ cashOpen: !settings.cashOpen, cashOpening: opening }).where(eq(s.settings.id, 1));
        await log("cash", settings.cashOpen ? `Cierre de caja · Efectivo contado: $${counted.toFixed(2)}` : `Apertura de caja · Fondo inicial: $${opening.toFixed(2)}`);
        return {};
      }

      // CREAR ORDEN DE PRODUCCIÓN / ASIGNAR TRABAJO A TALLER (DTF, BORDADO, COSTURA)
      if (action === "production.create") {
        const station = text(d.station, "plotter_dtf");
        const customerName = text(d.customerName, "Cliente General");
        const prefix = station === "plotter_dtf" ? "DTF" : station === "bordadora" ? "BOR" : "COST";
        const orderNumber = `OP-${prefix}-${Date.now().toString().slice(-4)}`;

        const defaultDevice =
          station === "plotter_dtf"
            ? "Plotter DTF Industrial I3200"
            : station === "bordadora"
            ? "Bordadora Meistergram 8 Cabezales"
            : "Taller de Costura y Confección Cristo Rey";

        const [order] = await tx
          .insert(s.productionOrders)
          .values({
            orderNumber,
            station,
            customerName,
            customerPhone: text(d.customerPhone),
            customerEmail: text(d.customerEmail),
            items: Array.isArray(d.items) ? d.items : [{ name: text(d.itemName, "Servicio"), quantity: number(d.quantity, 1) }],
            dimensions: text(d.dimensions),
            colors: text(d.colors),
            garmentType: text(d.garmentType),
            embroideryPlacement: text(d.embroideryPlacement),
            embroiderySide: text(d.embroiderySide, "frente"),
            croquisData: d.croquisData || null,
            deliveryType: text(d.deliveryType, "retiro_oficina"),
            deliveryAddress: text(d.deliveryAddress),
            pendingBalance: number(d.pendingBalance, 0),
            paymentStatus: number(d.pendingBalance, 0) > 0 ? "pendiente_saldo" : "pagado",
            fileUrl: text(d.fileUrl),
            fileName: text(d.fileName, "Arte_Cliente.png"),
            fileSize: text(d.fileSize, "Alta definición 300 DPI"),
            notes: text(d.notes),
            priority: text(d.priority, "normal"),
            status: "pendiente",
            operatorName: text(d.operatorName),
            stationIpOrDevice: text(d.stationDevice, defaultDevice),
          })
          .returning();

        await log("system", `Trabajo asignado a taller: ${orderNumber} (${station}) para ${customerName}`);
        return { order };
      }

      // EDITAR ORDEN DE PRODUCCIÓN EXISTENTE (DUEÑO, SUCURSAL 1 Y SUCURSAL 2)
      if (action === "production.update") {
        const orderId = number(d.id);
        const [order] = await tx.select().from(s.productionOrders).where(eq(s.productionOrders.id, orderId));
        check(order, "Orden de trabajo no encontrada.");

        const updateFields: Partial<typeof s.productionOrders.$inferInsert> = {
          customerName: text(d.customerName, order.customerName),
          customerPhone: text(d.customerPhone, order.customerPhone),
          customerEmail: text(d.customerEmail, order.customerEmail),
          station: text(d.station, order.station),
          dimensions: text(d.dimensions, order.dimensions),
          colors: text(d.colors, order.colors),
          garmentType: text(d.garmentType, order.garmentType),
          embroideryPlacement: text(d.embroideryPlacement, order.embroideryPlacement),
          embroiderySide: text(d.embroiderySide, order.embroiderySide),
          croquisData: d.croquisData !== undefined ? d.croquisData : order.croquisData,
          deliveryType: text(d.deliveryType, order.deliveryType),
          deliveryAddress: text(d.deliveryAddress, order.deliveryAddress),
          pendingBalance: d.pendingBalance !== undefined ? number(d.pendingBalance) : order.pendingBalance,
          paymentStatus: (d.pendingBalance !== undefined ? number(d.pendingBalance) : order.pendingBalance) > 0 ? "pendiente_saldo" : "pagado",
          fileName: text(d.fileName, order.fileName),
          fileSize: text(d.fileSize, order.fileSize),
          fileUrl: d.fileUrl ? text(d.fileUrl) : order.fileUrl,
          notes: text(d.notes, order.notes),
          priority: text(d.priority, order.priority),
        };

        if (Array.isArray(d.items)) {
          updateFields.items = d.items;
        }

        const [updated] = await tx
          .update(s.productionOrders)
          .set(updateFields)
          .where(eq(s.productionOrders.id, orderId))
          .returning();

        await log("system", `Orden de producción editada y ajustada: ${order.orderNumber}`);
        return { order: updated };
      }

      // ACTUALIZAR ESTADO DE TRABAJO (OPERARIO O SUPERVISOR)
      if (action === "production.updateStatus") {
        const orderId = number(d.id);
        const newStatus = text(d.status); // 'pendiente' | 'en_proceso' | 'listo_para_retirar' | 'entregado'
        const operatorName = text(d.operatorName);

        const [order] = await tx.select().from(s.productionOrders).where(eq(s.productionOrders.id, orderId));
        check(order, "Orden de trabajo no encontrada.");

        const updateData: Partial<typeof s.productionOrders.$inferInsert> = {
          status: newStatus,
        };

        if (operatorName) {
          updateData.operatorName = operatorName;
        }

        if (newStatus === "listo_para_retirar") {
          updateData.readyAt = new Date();
        }

        const [updated] = await tx
          .update(s.productionOrders)
          .set(updateData)
          .where(eq(s.productionOrders.id, orderId))
          .returning();

        await log("system", `Orden de producción ${order.orderNumber} cambió a estado: ${newStatus}`);
        return { order: updated };
      }

      // CONFIRMAR EN OFICINA / SUCURSAL, REGISTRAR PAGO RESTANTE Y AUTORIZAR NOTIFICACIÓN (RETIRO O DELIVERY)
      if (action === "production.confirmAndNotify") {
        const orderId = number(d.id);
        const deliveryType = text(d.deliveryType, "retiro_oficina");
        const deliveryAddress = text(d.deliveryAddress);
        const pendingPaid = Boolean(d.pendingPaid);

        const [order] = await tx.select().from(s.productionOrders).where(eq(s.productionOrders.id, orderId));
        check(order, "Orden no encontrada.");

        const updateData: Partial<typeof s.productionOrders.$inferInsert> = {
          notificationSent: true,
          status: "listo_para_retirar",
          deliveryType,
          deliveryAddress,
          readyAt: order.readyAt || new Date(),
        };

        if (pendingPaid || order.pendingBalance === 0) {
          updateData.paymentStatus = "pagado";
          updateData.pendingBalance = 0;
        }

        const [updated] = await tx
          .update(s.productionOrders)
          .set(updateData)
          .where(eq(s.productionOrders.id, orderId))
          .returning();

        const dispatchText =
          deliveryType === "delivery_regional"
            ? "despachado por Delivery Regional (Caracas)"
            : deliveryType === "delivery_nacional"
            ? `despachado por Envío Nacional (MRW/Tealca/Zoom) a: ${deliveryAddress}`
            : "listo para retirar en oficina principal";

        await log(
          "system",
          `Aviso al cliente ${order.customerName} (${order.customerEmail || order.customerPhone}): Su trabajo ${order.orderNumber} está ${dispatchText}. Saldo: ${updateData.paymentStatus === "pagado" ? "100% Pagado" : `Pendiente $${order.pendingBalance}`}.`
        );

        return {
          success: true,
          order: updated,
          emailSent: Boolean(order.customerEmail),
          smsSent: Boolean(order.customerPhone),
          customerName: order.customerName,
          orderNumber: order.orderNumber,
        };
      }

      // CONCILIACIÓN BANCARIA: IMPORTAR ESTADO DE CUENTA Y CRUZAR CON FACTURAS Y GASTOS
      if (action === "bankStatement.import") {
        const accountId = number(d.accountId);
        const [account] = await tx.select().from(s.accounts).where(eq(s.accounts.id, accountId));
        check(account, "Selecciona la cuenta contable asociada al banco.");
        const rawRows = Array.isArray(d.rows) ? d.rows : [];
        check(rawRows.length > 0 && rawRows.length <= 3000, "El estado de cuenta debe traer entre 1 y 3.000 movimientos.");

        const normalized = normalizeBankRows(rawRows);
        const [allSales, allExpenses] = await Promise.all([tx.select().from(s.sales), tx.select().from(s.expenses)]);
        const matched = autoMatchRows(normalized, { sales: allSales as never, expenses: allExpenses as never });

        const [statement] = await tx.insert(s.bankStatements).values({
          accountId,
          bankName: text(d.bankName, account.name),
          fileName: text(d.fileName, "estado_de_cuenta"),
          periodLabel: text(d.periodLabel, new Date().toLocaleDateString("es-VE")),
          status: "en_revision",
          rows: matched,
          notes: text(d.notes),
        }).returning();

        const conciliados = matched.filter((r) => r.status === "conciliado").length;
        await log("system", `Estado de cuenta ${statement.fileName} importado desde ${statement.bankName}: ${matched.length} movimientos, ${conciliados} conciliados automáticamente.`);
        return { statement };
      }

      if (action === "bankStatement.updateRow") {
        const statementId = number(d.statementId), rowIndex = number(d.rowIndex);
        const [st] = await tx.select().from(s.bankStatements).where(eq(s.bankStatements.id, statementId));
        check(st, "Estado de cuenta no encontrado.");
        const rows = [...(st.rows || [])];
        check(rowIndex >= 0 && rowIndex < rows.length, "Movimiento no encontrado.");
        const prev = rows[rowIndex];
        rows[rowIndex] = {
          ...prev,
          status: (d.status ? String(d.status) : prev.status) as typeof prev.status,
          matchType: (d.matchType ? String(d.matchType) : prev.matchType) as typeof prev.matchType,
          matchId: d.matchId !== undefined ? number(d.matchId, 0) : prev.matchId,
          matchLabel: text(d.matchLabel, prev.matchLabel),
          observation: text(d.observation, prev.observation),
          suggestedCategory: text(d.suggestedCategory, prev.suggestedCategory),
        };
        const [updated] = await tx.update(s.bankStatements).set({ rows }).where(eq(s.bankStatements.id, statementId)).returning();
        await log("system", `Movimiento del estado de cuenta ${updated.fileName} actualizado en la conciliación bancaria.`);
        return { statement: updated };
      }

      if (action === "bankStatement.complete") {
        const statementId = number(d.statementId);
        const [st] = await tx.select().from(s.bankStatements).where(eq(s.bankStatements.id, statementId));
        check(st, "Estado de cuenta no encontrado.");
        const rows = [...(st.rows || [])];
        const conciliados = rows.filter((r) => r.status === "conciliado").length;
        const pendientes = rows.length - conciliados;
        check(pendientes === 0 || Boolean(d.allowPartial), "Aún hay movimientos sin conciliar. Registra observaciones o marca esta conciliación como parcial.");
        const [updated] = await tx.update(s.bankStatements).set({ status: pendientes === 0 ? "conciliado" : "en_revision", notes: text(d.notes) }).where(eq(s.bankStatements.id, statementId)).returning();
        await log("system", `Conciliación bancaria ${st.fileName} ${pendientes === 0 ? "completada" : "guardada como parcial"}: ${conciliados}/${rows.length} movimientos aplicados.`);
        return { statement: updated };
      }

      throw new InputError("Operación no reconocida.");
    });

    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof InputError) return Response.json({ error: error.message }, { status: 400 });
    console.error(error);
    return Response.json({ error: "No se pudo guardar la operación fiscal." }, { status: 500 });
  }
}
