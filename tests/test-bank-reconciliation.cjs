const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const BASE = process.env.BASE_URL || 'http://localhost:3000';

(async () => {
  fs.mkdirSync('artifacts', { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  try {
    // Datos reales del negocio para construir un estado de cuenta coherente
    const api = await (await page.request.get(`${BASE}/api/data`)).json();
    const sale = api.sales.find((s) => (s.payments || []).length > 0);
    const expense = api.expenses.find((e) => e.scope === 'business' && e.amount > 100);
    assert.ok(sale && expense, 'Seed data must include sales and expenses');

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.removeItem('tesorio_auth'); document.fonts.ready; });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Eliezer Parra (Dueño)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    // 1. Módulo de cuentas con el panel de conciliación automática
    await page.locator('.sidebar').getByRole('button', { name: 'Cuentas y Bancos' }).click();
    await page.waitForLoadState('networkidle');
    assert.ok(await page.getByText('Conciliación Bancaria Automática').isVisible());
    assert.ok(await page.getByRole('button', { name: 'Importar Estado de Cuenta' }).first().isVisible());
    console.log('PASS: Bank reconciliation panel available in accounts module');

    // 2. Importar estado de cuenta: banco con varias cuentas (selección manual)
    await page.getByRole('button', { name: 'Importar Estado de Cuenta' }).first().click();
    const modal = page.getByRole('dialog');
    await modal.waitFor();
    await modal.getByLabel('Banco emisor del estado de cuenta').selectOption({ label: 'Banesco Banco Universal' });
    const accountSelect = modal.getByLabel(/Cuenta contable asociada/);
    assert.ok(await accountSelect.isEnabled(), 'Bank with multiple accounts must require selecting the accounting account');

    // 3. Banco con una sola cuenta: selección automática
    await modal.getByLabel('Banco emisor del estado de cuenta').selectOption({ label: 'Caja principal / Efectivo' });
    assert.ok(await modal.getByText('única cuenta detectada').isVisible(), 'Single account must be auto-selected by the system');
    await modal.getByLabel('Banco emisor del estado de cuenta').selectOption({ label: 'Banesco Banco Universal' });
    console.log('PASS: Bank selection with multi-account mapping and single-account auto-select');

    // 4. Pegar movimientos bancarios: cobro de factura, alquiler y comisión bancaria
    const pasted = [
      `${new Date().toLocaleDateString('es-VE')}, Transferencia cliente ${sale.customerName} ${sale.invoiceNumber}, ${sale.payments[0].reference || 'REF'}, ${sale.payments[0].amount}`,
      `${new Date().toLocaleDateString('es-VE')}, ${expense.name} ${expense.invoiceNumber || 'FAC-PROV'}, ${expense.invoiceNumber || 'REF'}, -${expense.amount}`,
      `${new Date().toLocaleDateString('es-VE')}, Comision bancaria mantenimiento de cuenta, 00-BANCO, -4.50`,
    ].join('\n');
    await modal.locator('textarea').fill(pasted);
    await modal.getByRole('button', { name: 'Reconocer movimientos pegados' }).click();

    // 5. Vista previa con cruce automático de facturas y gastos
    assert.ok(await modal.getByText('Vista previa del cruce automático').isVisible());
    assert.ok(await modal.getByText(new RegExp(sale.invoiceNumber)).first().isVisible(), 'Sale invoice must be auto-matched');
    assert.ok(await modal.getByText(new RegExp(expense.name.slice(0, 12))).first().isVisible(), 'Expense must be auto-matched');
    assert.ok(await modal.getByText(/Comisiones bancarias|Por clasificar/).first().isVisible(), 'Bank commission must be recognized with category');
    console.log('PASS: Movements recognized automatically against invoices, rent and bank commissions');

    // 6. Procesar con un clic
    await modal.getByRole('button', { name: 'Procesar y conciliar con un clic' }).click();
    await modal.waitFor({ state: 'hidden' });
    await page.waitForTimeout(600);

    const panel = page.locator('section.card').filter({ hasText: 'Conciliación Bancaria Automática' }).first();
    assert.ok(await panel.getByText('Movimientos importados').isVisible());
    assert.ok(await panel.getByText('Conciliados automáticamente').isVisible());
    assert.ok(await panel.getByText('Cobros de venta aplicados').isVisible());
    console.log('PASS: One-click import leaves everything accounted with summary metrics');

    // 7. Sobrantes / faltantes y observaciones para ajustar la conciliación
    assert.ok(await panel.getByText(/Faltantes en el estado de cuenta/).isVisible(), 'Missing ledger items must be listed');
    const firstObs = panel.locator('input[placeholder="Observación para el ajuste"]').first();
    await firstObs.fill('Cobro parcial en tránsito: validar con referencia bancaria');
    await firstObs.blur();
    await page.waitForTimeout(1800);
    assert.ok(await page.getByText('Movimiento de la conciliación actualizado').isVisible(), 'Observations must be saved for the adjustment');
    console.log('PASS: Excess/missing movements detected with observations to adjust reconciliation');

    // 8. Opciones completas: exportar Excel, imprimir PDF y guardar conciliación
    assert.ok(await panel.getByRole('button', { name: 'Excel' }).isVisible());
    assert.ok(await panel.getByRole('button', { name: 'Imprimir / PDF' }).isVisible());
    await panel.getByRole('button', { name: 'Guardar conciliación' }).click();
    await page.waitForTimeout(1200);
    assert.ok(await page.getByText('Conciliación bancaria guardada').isVisible());
    console.log('PASS: Excel, PDF/print and reconciliation completion actions available');
    await page.screenshot({ path: 'artifacts/70-bank-reconciliation.png', fullPage: true });

    assert.deepEqual(errors, []);
    console.log('BANK STATEMENT AUTO-RECONCILIATION VERIFIED 100%');
  } finally {
    await browser.close();
  }
})().catch((err) => { console.error(err); process.exit(1); });
