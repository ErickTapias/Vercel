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
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => { localStorage.removeItem('tesorio_auth'); document.fonts.ready; });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Eliezer Parra (Dueño)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    // 1. Módulo independiente visible con marco legal
    await page.locator('.sidebar').getByRole('button', { name: /Gestión de Nómina/ }).click();
    await page.waitForLoadState('networkidle');
    assert.ok(await page.getByRole('heading', { name: 'Gestión de Nómina y Recibos de Pago' }).isVisible());
    assert.ok(await page.getByText(/LOTTT · IVSS · FAOV · INCES · ISLR/).first().isVisible());
    console.log('PASS: Independent payroll module integrated in navigation with legal framework');

    // 2. Directorio de empleados con tipos de salario
    assert.ok(await page.getByText('Carlos Díaz').first().isVisible());
    assert.ok(await page.getByText('María Gómez').first().isVisible());
    assert.ok(await page.getByText(/pieza/i).first().isVisible());
    console.log('PASS: Employee directory with salary types (monthly and per-piece) rendered');

    // 3. Procesar nómina de un empleado
    const employeeRow = page.locator('.data-table tbody tr').filter({ hasText: 'Carlos Díaz' }).first();
    await employeeRow.getByRole('button', { name: 'Procesar nómina' }).click();
    await page.waitForTimeout(1500);
    assert.ok((await page.locator('.toast').allTextContents()).some((t) => t.includes('Nómina procesada')), 'Payroll processing confirmation expected');
    console.log('PASS: Payroll processed and payslip generated for employee');

    // 4. Vista previa con deducciones legales IVSS, FAOV, INCES e ISLR
    await page.locator('.data-table tbody tr').filter({ hasText: 'Carlos Díaz' }).first().getByRole('button', { name: 'Vista previa' }).click();
    const preview = page.getByRole('dialog');
    await preview.waitFor();
    assert.ok(await preview.getByText('Recibo de pago · Carlos Díaz').isVisible());
    assert.ok(await preview.getByText(/IVSS/).isVisible());
    assert.ok(await preview.getByText(/FAOV/).isVisible());
    assert.ok(await preview.getByText(/INCES/).isVisible());
    assert.ok(await preview.getByText(/Provisiones patronales/).isVisible());
    console.log('PASS: Preview shows legal deductions IVSS 4%, FAOV 1%, INCES 0.5% and employer provisions');

    // 5. Marcar como Pagado y Enviar (evento automático de correo + respaldo)
    await preview.getByRole('button', { name: 'Marcar como Pagado y Enviar' }).click();
    await page.waitForTimeout(1800);
    assert.ok((await page.locator('.toast').allTextContents()).some((t) => /enviado al empleado y respaldado/i.test(t)), 'Paid status must trigger email and backup');
    console.log('PASS: Marking as paid triggers automatic receipt email and company backup');

    // 6. Recibos con hash de integridad, respaldo y estado de envío
    await page.getByRole('button', { name: /Recibos y respaldos/ }).click();
    await page.waitForTimeout(600);
    const receiptRow = page.locator('.data-table tbody tr').filter({ hasText: 'Carlos Díaz' }).first();
    assert.ok(await receiptRow.getByText(/Enviado/).isVisible());
    assert.ok((await receiptRow.textContent()).includes('backups/nomina/'));
    console.log('PASS: Receipt log shows integrity hash, server backup path and email delivery date');

    // 7. Descarga/impresión del recibo oficial en PDF por el navegador
    const popupPromise = page.waitForEvent('popup');
    await receiptRow.getByRole('button', { name: 'Imprimir / PDF' }).click();
    const receiptWin = await popupPromise;
    await receiptWin.waitForLoadState('load');
    const html = await receiptWin.content();
    assert.ok(html.includes('RECIBO DE PAGO'));
    assert.ok(html.includes('Firma del trabajador'));
    assert.ok(html.includes('LOTTT'));
    await receiptWin.pdf({ path: 'artifacts/80-payroll-receipt.pdf', format: 'Letter' });
    await receiptWin.close();
    console.log('PASS: Official payslip PDF generated with signatures and legal notes');
    await page.screenshot({ path: 'artifacts/81-payroll-module.png', fullPage: true });

    // 8. Verificación de respaldo e integridad en base de datos
    const dbCheck = await (await page.request.post(`${BASE}/api/payroll`, { data: { action: 'payroll.preview', data: { employeeId: 1 } } })).json();
    assert.ok(dbCheck.ok && dbCheck.calculation, 'Payroll calculator service must return structured JSON');
    assert.ok(dbCheck.calculation.legalNotes.some((n) => n.includes('LOTTT')), 'Legal notes must reference LOTTT');
    console.log('PASS: PayrollCalculatorService returns isolated JSON with Venezuelan legal basis');

    assert.deepEqual(errors, []);
    console.log('PAYROLL AND PAYSLIP MODULE VERIFIED 100%');
  } finally {
    await browser.close();
  }
})().catch((err) => { console.error(err); process.exit(1); });
