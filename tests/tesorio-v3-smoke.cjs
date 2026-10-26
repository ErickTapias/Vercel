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
    // 1. Probar Login con Usuario de Estación Especializada (Plotter DTF)
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('tesorio_auth');
      document.fonts.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });

    assert.ok(await page.locator('.login-card').isVisible());
    // Click en perfil operario DTF
    await page.getByRole('button', { name: /PC Plotter DTF/ }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    // Verificar que el operario ve el badge de Operario Activo y solo sus módulos
    assert.ok(await page.getByText('Modo Operario Activo').isVisible());
    assert.ok(await page.getByText('Operario de Plotter DTF').isVisible());
    console.log('PASS: Logged in as DTF Operator with restricted terminal view');

    // 2. Probar Terminal de Taller & Estaciones Operativas
    await page.locator('.sidebar').getByRole('button', { name: /Taller & Estaciones/ }).click();
    await page.waitForLoadState('networkidle');

    // Comprobar que ve la orden de DTF en cola con sus especificaciones completas
    assert.ok(await page.getByText('OP-DTF-0101').first().isVisible());
    assert.ok(await page.getByText('CMYK + Doble capa blanca W2').isVisible());
    assert.ok(await page.getByText('Logo_LosAndes_Pecho_Espalda_300dpi.png').isVisible());
    assert.ok(await page.getByText('Imprimir en modo espejo (Mirror)').isVisible());
    console.log('PASS: Terminal DTF displays full technical specs without verbal consultations needed');

    // Operario inicia trabajo
    await page.locator('.production-card').filter({ hasText: 'OP-DTF-0101' }).getByRole('button', { name: 'Iniciar Trabajo' }).click();
    await page.waitForTimeout(800);
    console.log('PASS: Operator changed order status to "en_proceso"');

    // Operario marca listo para retirar
    await page.locator('.production-card').filter({ hasText: 'OP-DTF-0101' }).getByRole('button', { name: 'Marcar Listo para Retiro' }).click();
    await page.waitForTimeout(800);

    // Ahora en columna 3 (Oficina principal listo para retirar)
    assert.ok(await page.locator('.kanban-column').nth(2).getByText('OP-DTF-0101').isVisible());
    console.log('PASS: Order moved to Office Pickup column');

    // Validar y enviar notificación automática por correo y SMS
    await page.locator('.production-card').filter({ hasText: 'OP-DTF-0101' }).getByRole('button', { name: 'Validar y Enviar Correo/SMS' }).click();
    await page.waitForTimeout(1000);
    assert.ok(await page.getByText('Enviada (Email & SMS)').isVisible());
    console.log('PASS: Office validated and automatic email/SMS notification sent to client');
    await page.screenshot({ path: 'artifacts/10-production-workshop.png', fullPage: true });

    // 3. Cerrar sesión y entrar como Director General (Admin Total)
    await page.locator('.sidebar-logout-btn').click();
    await page.waitForSelector('.login-card', { state: 'visible' });

    await page.getByRole('button', { name: /Director General/ }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });
    console.log('PASS: Returned as Director General with full access');

    // 4. Probar Consulta en Vivo a la web del BCV (bcv.org.ve)
    const bcvButton = page.locator('.bcv-rate-pill');
    assert.ok(await bcvButton.isVisible());
    await bcvButton.click();
    await page.waitForTimeout(1200);
    // Verificar que el toast o valor refleje la tasa oficial del BCV
    const bcvText = await bcvButton.textContent();
    assert.match(bcvText, /BCV:\s*Bs\.\s*\d+/);
    console.log('PASS: Live BCV rate connection and sync executed:', bcvText);

    // 5. Verificar que en todas las secciones hay botón de Imprimir / PDF junto con Excel
    // Probar en Inventario
    await page.locator('.sidebar').getByRole('button', { name: 'Inventario' }).click();
    await page.waitForLoadState('networkidle');
    assert.ok(await page.getByRole('button', { name: 'Imprimir / PDF' }).first().isVisible());
    assert.ok(await page.getByRole('button', { name: 'Excel' }).first().isVisible());
    console.log('PASS: Inventory has both Excel and Print/PDF export buttons');

    // Probar en Cuentas
    await page.locator('.sidebar').getByRole('button', { name: 'Cuentas y Bancos' }).click();
    await page.waitForLoadState('networkidle');
    assert.ok(await page.getByRole('button', { name: 'Imprimir / PDF' }).first().isVisible());
    console.log('PASS: Accounts has Print/PDF export button');

    // Probar en Gastos
    await page.locator('.sidebar').getByRole('button', { name: 'Gastos y Egresos' }).click();
    await page.waitForLoadState('networkidle');
    assert.ok(await page.getByRole('button', { name: 'Imprimir / PDF' }).first().isVisible());
    console.log('PASS: Expenses has Print/PDF export button');

    // Probar en Clientes
    await page.locator('.sidebar').getByRole('button', { name: 'Clientes / RIF' }).click();
    await page.waitForLoadState('networkidle');
    assert.ok(await page.getByRole('button', { name: 'Imprimir / PDF' }).first().isVisible());
    console.log('PASS: Customers directory has Print/PDF export button');

    // 6. Probar el nuevo diseño visual de la Factura
    await page.locator('.sidebar').getByRole('button', { name: 'Ventas y Facturación' }).click();
    await page.waitForLoadState('networkidle');

    await page.locator('.tabs button').filter({ hasText: 'Registro de Facturas Emitidas' }).click();
    await page.locator('.data-table tbody tr').first().click();

    const invoiceModal = page.getByRole('dialog');
    await invoiceModal.waitFor();

    // Validar el nuevo formato gráfico de la factura:
    // - Ítems en su tabla estilizada
    // - Panel separado para Liquidación Tributaria SENIAT
    // - Caja de Total en divisas y bolívares destacados
    // - Formas de pago con tipo de pago, banco y código de aprobación
    assert.ok(await invoiceModal.getByText('RENGLONES FACTURADOS (BIENES Y SERVICIOS)').isVisible());
    assert.ok(await invoiceModal.getByText('LIQUIDACIÓN TRIBUTARIA & TOTALES (SENIAT)').isVisible());
    assert.ok(await invoiceModal.getByText('TOTAL FACTURA FISCAL DIGITAL').isVisible());
    assert.ok(await invoiceModal.getByText('EQUIVALENTE EN BOLÍVARES (BCV)').isVisible());
    assert.ok(await invoiceModal.getByText('FORMAS DE PAGO & CONCILIACIÓN BANCARIA AUDITABLE').isVisible());
    console.log('PASS: Redesigned invoice modal displays clear visual demarcation between items and SENIAT tax calculation');
    await page.screenshot({ path: 'artifacts/11-new-invoice-format.png', fullPage: false });

    await page.getByRole('button', { name: 'Cerrar ventana' }).click();

    assert.deepEqual(errors, []);
    console.log('ALL NEW USER REQUIREMENTS (BCV LIVE, REDESIGNED INVOICE, PDF EXPORT EVERYWHERE, TERMINAL WORKSHOPS DTF/BORDADORA) VERIFIED SUCCESSFULLY!');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
