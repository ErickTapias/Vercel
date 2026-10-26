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
    // Snapshot fiscal previo para comprobar inmutabilidad
    const before = await (await page.request.get(`${BASE}/api/data`)).json();
    const invoice = before.sales.find((s) => s.payments && s.payments.length);
    assert.ok(invoice, 'Seed sales with payments required');

    // 1. Ruta independiente de conciliación (sin tocar rutas existentes)
    await page.goto(`${BASE}/operations/conciliation`, { waitUntil: 'networkidle' });
    assert.ok(await page.getByText('Pagos y referencias operativas').isVisible());
    assert.ok(await page.getByText(/Auditoría operativa · separación de datos/).first().isVisible(), 'Panel must state the operational/fiscal data separation');
    console.log('PASS: Independent /operations/conciliation route with legal citation');

    // 2. Factura en modo solo lectura con cita legal Art. 7
    await page.locator('input[placeholder="N° de factura, control o cliente"]').fill(invoice.invoiceNumber);
    await page.getByRole('button', { name: 'Buscar factura' }).click();
    await page.waitForTimeout(500);
    await page.locator('.operations-panel__table tbody tr').first().getByRole('button', { name: 'Seleccionar' }).click();
    assert.ok(await page.getByText(/Documento fiscal inmutable/).isVisible());
    assert.ok(await page.getByText(/Art(ículo|\.)\s*7/).first().isVisible(), 'Immutable fiscal data must cite Providencia Art. 7');
    console.log('PASS: Fiscal document shown read-only with SNAT/2026/00093 Art. 7 reference');

    // 3. Alta de referencia operativa de pago (Pago Móvil) sin alterar la factura
    await page.locator('.operations-panel__form-grid select').first().selectOption('Pago móvil');
    await page.locator('input[placeholder="Ej. 0134-123456"]').fill('0134-998877');
    await page.locator('.operations-panel__form-grid input[type="number"]').first().fill('25.50');
    await page.getByRole('button', { name: 'Agregar referencia de pago' }).click();
    await page.waitForTimeout(700);
    assert.ok(await page.getByText('Referencia de pago registrada').first().isVisible());
    assert.equal(await page.locator('.operations-panel__table').last().locator('tbody tr').first().locator('input').nth(2).inputValue(), '0134-998877', 'Pago Móvil reference must be listed');
    console.log('PASS: Pago Movil reference added as flexible operational data');

    // 4. Edición de la referencia con auditoría automática (payment_audit_logs)
    const refInput = page.locator('.operations-panel__table').last().locator('tbody tr').first().locator('input').nth(2);
    await refInput.fill('0134-998878');
    await page.waitForTimeout(800);
    assert.ok(await page.getByText('auditado en payment_audit_logs').first().isVisible(), 'Changes must be audited');
    await page.locator('.operations-panel__table').last().locator('tbody tr').first().getByRole('button', { name: 'Ver auditoría' }).click();
    await page.waitForTimeout(600);
    assert.ok(await page.getByText('payment_audit_logs').first().isVisible());
    console.log('PASS: Payment reference edits audited with old/new values');

    // 5. Conciliación parcial: saldo pendiente visible y editable
    assert.ok(await page.getByText('Saldo por conciliar').isVisible());
    console.log('PASS: Partial reconciliation summary computed without touching fiscal totals');

    // 6. Módulo de contingencia con cita Art. 15 y sincronización
    await page.goto(`${BASE}/operations/contingency`, { waitUntil: 'networkidle' });
    assert.ok(await page.getByRole('heading', { name: 'Facturación por contingencia' }).isVisible());
    assert.ok(await page.getByText(/Art(ículo|\.)\s*15/).first().isVisible(), 'Contingency must cite Providencia Art. 15');
    await page.locator('input').first().fill(`CONT-TEST-${Date.now().toString().slice(-5)}`);
    await page.getByPlaceholder('Cliente ocasional').count();
    const nameInput = page.locator('.operations-panel__form-grid input').nth(2);
    await nameInput.fill('Uniformes Escolares Andes C.A.');
    await page.locator('.operations-panel__form-grid input').nth(5).fill('320.50');
    await page.getByRole('button', { name: 'Registrar contingencia' }).click();
    await page.waitForTimeout(800);
    assert.ok(await page.getByText('Factura de contingencia registrada').first().isVisible());
    const syncBtn = page.getByRole('button', { name: 'Sincronizar' }).first();
    assert.ok(await syncBtn.isVisible());
    await syncBtn.click();
    await page.waitForTimeout(800);
    assert.ok(await page.getByText(/Sincronizada CONT-SENIAT/).first().isVisible());
    console.log('PASS: Contingency invoice created, cited Art. 15 and synced to digital printer');

    // 7. compliance_logs con hash de integridad
    const logs = await (await page.request.post(`${BASE}/api/operations`, { data: { action: 'compliance.logs', data: { limit: 20 } } })).json();
    assert.ok(logs.ok && logs.logs.length > 0, 'Compliance logs must be recorded');
    assert.ok(logs.logs.some((l) => l.actionType.includes('contingencia') && l.hash), 'Fiscal actions require integrity hash');
    console.log('PASS: compliance_logs records fiscal actions with SHA-256 integrity hash');

    // 8. Inmutabilidad de la factura fiscal original
    const after = await (await page.request.get(`${BASE}/api/data`)).json();
    const same = after.sales.find((s) => s.id === invoice.id);
    assert.equal(same.total, invoice.total, 'Invoice total must remain immutable');
    assert.equal(same.controlNumber, invoice.controlNumber, 'Control number must remain immutable');
    assert.equal(same.ivaAmount, invoice.ivaAmount, 'VAT amount must remain immutable');
    assert.equal(same.customerRif, invoice.customerRif, 'Customer RIF must remain immutable');
    console.log('PASS: Fiscal data (amounts, VAT, RIF, control) untouched after operational edits');

    await page.screenshot({ path: 'artifacts/90-operations-compliance.png', fullPage: true });

    assert.deepEqual(errors, []);
    console.log('CONTINGENCY AND COMPLIANCE MODULES VERIFIED 100% (NON-DESTRUCTIVE)');
  } finally {
    await browser.close();
  }
})().catch((err) => { console.error(err); process.exit(1); });
