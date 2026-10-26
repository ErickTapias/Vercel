const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const XLSX = require('xlsx');
const BASE = process.env.BASE_URL || 'http://localhost:3000';

(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const getData = async () => (await page.request.get(`${BASE}/api/data`)).json();
  const post = async (action, data, status = 200) => {
    const response = await page.request.post(`${BASE}/api/manage`, { data: { action, data } });
    const value = await response.json();
    assert.equal(response.status(), status, JSON.stringify(value));
    return value;
  };
  const waitForDialogClose = () => page.getByRole('dialog').waitFor({ state: 'hidden' });
  const nav = async name => { await page.locator('.sidebar').getByTitle(name, { exact: true }).click(); };
  const checkWidth = async label => {
    const sizes = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
    assert.equal(sizes.width, sizes.viewport, `${label}: horizontal page overflow`);
  };
  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    assert.match(await page.title(), /Fina/);
    await checkWidth('Desktop dashboard');
    await page.screenshot({ path: 'artifacts/dashboard-final.png', fullPage: true });
    for (const name of ['Cuentas', 'Cuentas pendientes', 'Gastos', 'Resumen financiero', 'Reportes', 'Clientes', 'Marketing', 'Estadísticas']) {
      await nav(name);
      assert.ok(await page.locator('main h1').isVisible(), `${name} did not render`);
      await checkWidth(name);
    }
    console.log('PASS: navigation through every business module');

    let data = await getData();
    await nav('Inventario');
    if (!data.products.some(p => p.sku === 'DEMO-PLT-001')) {
      await page.getByRole('button', { name: 'Agregar producto', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Nombre del producto').fill('Camisa Plátanos');
      await dialog.getByLabel('Cantidad disponible').fill('30');
      await dialog.getByLabel('Costo unitario (USD)').fill('8');
      await dialog.getByLabel('Precio de venta (USD)').fill('25');
      await dialog.getByLabel('Categoría', { exact: true }).fill('Camisas');
      await dialog.getByLabel('Referencia / SKU').fill('DEMO-PLT-001');
      await dialog.getByRole('button', { name: 'Crear producto', exact: true }).click();
      await waitForDialogClose();
    }
    data = await getData();
    const product = data.products.find(p => p.sku === 'DEMO-PLT-001');
    assert.ok(product);
    await page.getByRole('textbox', { name: 'Buscar producto o SKU...' }).fill('Plátanos');
    assert.ok(await page.locator('.inventory-table').getByText('Camisa Plátanos', { exact: true }).isVisible());
    console.log('PASS: product creation, persistence and search');

    const bank = data.accounts[0], cash = data.accounts.find(a => a.method === 'Efectivo');
    const customer = data.customers.find(c => c.name === 'Carlos Rodríguez');
    await nav('Ventas');
    await page.getByRole('textbox', { name: 'Buscar un producto...' }).fill('Plátanos');
    await page.locator('.pos-product').filter({ hasText: 'Camisa Plátanos' }).click();
    await page.locator('.pos-product').filter({ hasText: 'Camisa Plátanos' }).click();
    await page.getByRole('button', { name: 'Continuar al pago', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Seleccionar cliente').selectOption(String(customer.id));
    await dialog.getByRole('button', { name: 'Continuar al pago', exact: true }).click();
    await dialog.getByRole('combobox', { name: /^Método de pago/ }).selectOption(String(bank.id));
    await dialog.getByLabel('Monto (USD)', { exact: true }).fill('30');
    await dialog.getByRole('button', { name: 'Dividir pago entre varios métodos' }).click();
    await dialog.getByRole('combobox', { name: /^Método de pago/ }).nth(1).selectOption(String(cash.id));
    await dialog.getByRole('button', { name: 'Revisar venta', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirmar venta', exact: true }).click();
    await dialog.getByRole('heading', { name: 'El detalle de tu venta' }).waitFor();
    let after = await getData();
    assert.equal(after.products.find(p => p.id === product.id).stock, product.stock - 2);
    assert.ok(Math.abs(after.accounts.find(a => a.id === bank.id).balance - bank.balance - 30) < 0.001);
    assert.ok(Math.abs(after.accounts.find(a => a.id === cash.id).balance - cash.balance - 20) < 0.001);
    const popupEvent = page.waitForEvent('popup');
    await dialog.getByRole('button', { name: 'Imprimir / Guardar PDF' }).click();
    const receipt = await popupEvent;
    await receipt.waitForLoadState('load');
    await receipt.pdf({ path: 'artifacts/receipt-test.pdf', format: 'A4' });
    await receipt.close();
    await dialog.getByRole('button', { name: 'Cerrar ventana' }).click();
    console.log('PASS: split-payment sale updates stock and both accounts; receipt PDF generated');

    const saleCount = after.sales.length, stock = after.products.find(p => p.id === product.id).stock;
    await post('sale.create', { items: [{ productId: product.id, quantity: 100000 }], payments: [{ accountId: bank.id, amount: 2500000 }] }, 400);
    data = await getData();
    assert.equal(data.sales.length, saleCount);
    assert.equal(data.products.find(p => p.id === product.id).stock, stock);
    console.log('PASS: insufficient stock is rejected without partial database changes');

    const balanceBeforeExpense = data.accounts.find(a => a.id === bank.id).balance;
    await nav('Gastos');
    await page.getByRole('button', { name: 'Agregar gasto', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Concepto', { exact: true }).fill('Compra de bolsas');
    await dialog.getByLabel('Monto en dólares (USD)').fill('20');
    await dialog.getByLabel('Cuenta / método de pago').selectOption(String(bank.id));
    await dialog.getByRole('button', { name: 'Confirmar gasto', exact: true }).click();
    await waitForDialogClose();
    data = await getData();
    assert.ok(Math.abs(data.accounts.find(a => a.id === bank.id).balance - (balanceBeforeExpense - 20)) < 0.001);
    assert.ok(data.expenses.some(e => e.name === 'Compra de bolsas' && e.amount === 20));
    console.log('PASS: expense registration deducts its account balance');

    await nav('Inventario');
    await page.getByRole('button', { name: 'Importar Excel', exact: true }).click();
    dialog = page.getByRole('dialog');
    const downloadEvent = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Plantilla', exact: true }).click();
    const download = await downloadEvent;
    await download.saveAs('artifacts/inventory-template.xlsx');
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ Nombre: 'Pulsera artesanal', SKU: 'DEMO-ACC-001', Categoría: 'Accesorios', Cantidad: 12, Costo: 3, Precio: 10 }]), 'Productos');
    XLSX.writeFile(workbook, 'artifacts/import-test.xlsx');
    await dialog.locator('input[type=file]').setInputFiles('artifacts/import-test.xlsx');
    await dialog.getByText('Pulsera artesanal', { exact: true }).waitFor();
    await dialog.getByRole('button', { name: /Importar 1 productos/ }).click();
    await waitForDialogClose();
    data = await getData();
    assert.equal(data.products.find(p => p.sku === 'DEMO-ACC-001').stock, 12);
    console.log('PASS: Excel template download, file preview and database import');

    const recipe = data.products.find(p => p.kind === 'recipe');
    const rawBefore = recipe.ingredients.map(i => ({ ...i, stock: data.products.find(p => p.id === i.productId).stock }));
    await post('sale.create', { items: [{ productId: recipe.id, quantity: 1 }], customerId: customer.id, channel: 'Tienda física', payments: [{ accountId: bank.id, amount: recipe.price }] });
    after = await getData();
    for (const ingredient of rawBefore) assert.ok(Math.abs(after.products.find(p => p.id === ingredient.productId).stock - (ingredient.stock - ingredient.quantity)) < 0.0001);
    console.log('PASS: recipe sale deducts exact ingredient quantities');

    const service = data.products.find(p => p.kind === 'service');
    const credit = await post('sale.create', { items: [{ productId: service.id, quantity: 1 }], customerId: customer.id, credit: true, payments: [{ accountId: cash.id, amount: 5 }], channel: 'Tienda física' });
    after = await getData();
    const pending = after.pending.find(p => p.saleId === credit.sale.id);
    assert.equal(pending.amount, service.price - 5);
    await post('pending.settle', { id: pending.id, accountId: cash.id });
    after = await getData();
    const settled = after.sales.find(s => s.id === credit.sale.id);
    assert.equal(settled.status, 'paid');
    assert.equal(settled.payments.reduce((n, p) => n + p.amount, 0), service.price);
    assert.equal(after.pending.find(p => p.id === pending.id).status, 'paid');
    console.log('PASS: credit sale, pending collection and updated receipt payments');

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Notificaciones', exact: true }).click();
    assert.ok(await page.getByText('Es momento de reponer', { exact: true }).first().isVisible());
    await page.getByRole('button', { name: 'Cerrar notificaciones', exact: true }).click();
    await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
    assert.ok(await page.getByRole('heading', { name: 'Estamos contigo en cada paso' }).isVisible());
    await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
    await page.locator('.page-actions').getByRole('button', { name: 'Este mes', exact: true }).click();
    await page.getByRole('button', { name: 'Hoy', exact: true }).click();
    assert.ok(await page.locator('.page-actions').getByRole('button', { name: 'Hoy', exact: true }).isVisible());
    await page.locator('.page-actions').getByRole('button', { name: 'Hoy', exact: true }).click();
    await page.getByRole('button', { name: 'Este mes', exact: true }).click();
    await page.screenshot({ path: 'artifacts/dashboard-final.png', fullPage: true });
    await nav('Inventario');
    await page.screenshot({ path: 'artifacts/inventory-final.png', fullPage: true });
    await nav('Ventas');
    await page.screenshot({ path: 'artifacts/sales-final.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await checkWidth('Mobile dashboard');
    await page.screenshot({ path: 'artifacts/mobile-final.png', fullPage: false });
    await page.getByLabel('Moneda de visualización').selectOption('VES');
    const clipped = await page.locator('.kpi-value').evaluateAll(elements => elements.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
    assert.deepEqual(clipped, [], 'Bolívar values are clipped on mobile');
    await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
    await nav('Inventario');
    await checkWidth('Mobile inventory');
    assert.ok(!(await page.locator('.sidebar').evaluate(el => el.classList.contains('mobile-open'))));
    assert.deepEqual(errors, []);
    console.log('PASS: help, notifications, date filters, mobile navigation and both currencies');
    console.log('ALL FULLSTACK SMOKE TESTS PASSED');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
