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
    // 1. Verificar pantalla de Login
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('tesorio_auth'); // Forzar pantalla de login
      document.fonts.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });

    assert.ok(await page.locator('.login-card').isVisible(), 'Login card should be visible when logged out');
    assert.ok(await page.getByText('Fábrica Cristo Rey C.A.').isVisible());
    assert.match(await page.title(), /Tesorio/);
    console.log('PASS: Login view rendered with branding and company badge');
    await page.screenshot({ path: 'artifacts/01-login-light.png' });

    // 2. Probar cambio de modo Noche en el Login
    await page.locator('.theme-toggle-btn').click();
    assert.ok(await page.locator('.theme-dark').isVisible(), 'Dark mode should be applied');
    console.log('PASS: Night mode toggle works on Login');
    await page.screenshot({ path: 'artifacts/02-login-dark.png' });

    // Volver a modo día o mantener noche
    await page.locator('.theme-toggle-btn').click();

    // 3. Probar Inicio de Sesión (usando el botón de 1-Click Demo o enviando formulario)
    await page.getByRole('button', { name: /Ingresar directamente|Entrar al Sistema/ }).first().click();
    await page.waitForSelector('.workspace', { state: 'visible' });
    console.log('PASS: Authentication successful into Dashboard');

    // 4. Probar cambio de Modo Noche / Día en el Dashboard
    await page.locator('.topbar-right .theme-toggle-btn').click();
    assert.ok(await page.locator('.theme-dark').isVisible(), 'Dark mode applied to dashboard');
    console.log('PASS: Dashboard switches to Night mode smoothly');
    await page.screenshot({ path: 'artifacts/03-dashboard-dark.png', fullPage: true });

    // Cambiar de nuevo a modo día
    await page.locator('.topbar-right .theme-toggle-btn').click();
    assert.ok(await page.locator('.theme-light').isVisible(), 'Light mode restored');

    // 5. Verificar que el título de navegación es solo "Inventario"
    const navItems = await page.locator('.sidebar .nav-item').allTextContents();
    assert.ok(navItems.some((text) => text.trim() === 'Inventario'), 'Sidebar must have exact "Inventario" title');
    assert.ok(!navItems.some((text) => text.includes('Inventario y DTF')), '"Inventario y DTF" must NOT be in sidebar');
    console.log('PASS: Nav label is strictly "Inventario"');

    // 6. Verificar Gastos: Debe haber UN SOLO botón de registro y debe soportar foto de factura
    await page.locator('.sidebar').getByRole('button', { name: 'Gastos y Egresos' }).click();
    await page.waitForLoadState('networkidle');

    // Comprobar que en SectionHead no hay botón duplicado
    const registerButtons = await page.getByRole('button', { name: 'Registrar egreso', exact: true }).count();
    console.log(`Found ${registerButtons} "Registrar egreso" button(s) in view`);
    assert.equal(registerButtons, 1, 'There should be only ONE "Registrar egreso" button on screen');

    // Abrir formulario de gastos y subir foto de factura
    await page.getByRole('button', { name: 'Registrar egreso', exact: true }).click();
    const expenseModal = page.getByRole('dialog');
    await expenseModal.waitFor();

    await expenseModal.locator('input[name="name"]').fill('Compra de bobina de hilo y agujas industriales');
    await expenseModal.locator('input[name="amount"]').fill('45.00');
    await expenseModal.locator('input[placeholder*="Textiles del Centro"]').fill('Hilos y Agujas Los Cortijos C.A.');

    // Crear una imagen de prueba dummy base64 para subir
    const dummyImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const dummyFilePath = '/tmp/factura-soporte-test.png';
    fs.writeFileSync(dummyFilePath, Buffer.from(dummyImageBase64.split(',')[1], 'base64'));

    // Subir la imagen de la factura
    await expenseModal.locator('input[type="file"]').setInputFiles(dummyFilePath);
    assert.ok(await expenseModal.getByText('Foto de comprobante cargada correctamente').isVisible());
    console.log('PASS: Expense receipt photo upload and preview functional');

    await expenseModal.getByRole('button', { name: 'Confirmar egreso' }).click();
    await expenseModal.waitFor({ state: 'hidden' });

    // Ver el gasto recién creado y revisar que la foto esté en el soporte
    await page.locator('.data-table tbody tr').filter({ hasText: 'Compra de bobina de hilo' }).click();
    const detailModal = page.getByRole('dialog');
    await detailModal.waitFor();
    assert.ok(await detailModal.getByText('Foto / Documento de Respaldo Adjunto:').isVisible());
    console.log('PASS: Attached expense invoice photo is visible in expense detail');
    await detailModal.getByRole('button', { name: 'Entendido' }).click();

    // 7. Emitir Factura con detalle de Pago Móvil / Banco / Código de Referencia
    await page.locator('.sidebar').getByRole('button', { name: 'Ventas y Facturación' }).click();
    await page.waitForLoadState('networkidle');

    await page.locator('.pos-product').first().click();
    await page.getByRole('button', { name: 'Emitir Factura Digital' }).click();

    const checkoutModal = page.getByRole('dialog');
    await checkoutModal.waitFor();

    // Datos del cliente
    await checkoutModal.locator('input[placeholder*="Distribuidora"]').fill('Uniformes Corporativos Caracas C.A.');
    await checkoutModal.locator('input[placeholder*="J-30894123"]').fill('J-40891234-9');
    await checkoutModal.locator('input[placeholder*="facturacion@cliente.com"]').fill('cliente@uniformescaracas.com');
    await checkoutModal.getByRole('button', { name: 'Continuar al pago' }).click();

    // Paso 2: Configurar Forma de Pago con Tipo, Banco y Código
    await checkoutModal.locator('select').first().selectOption('Pago móvil');
    await checkoutModal.locator('input[placeholder*="Banesco"]').fill('Banesco Banco Universal');
    await checkoutModal.locator('input[placeholder*="Ref. 849201"]').fill('Ref Nro. 984123');

    await checkoutModal.getByRole('button', { name: 'Revisar factura fiscal' }).click();
    await checkoutModal.getByRole('button', { name: 'Emitir Factura Legal' }).click();

    // 8. Verificar la factura emitida con la clara diferenciación y los detalles de pago
    const receiptDialog = page.getByRole('heading', { name: 'Factura Fiscal Digital Emitida' });
    await receiptDialog.waitFor();

    // Verificar desglose diferenciado
    assert.ok(await page.getByText('LIQUIDACIÓN TRIBUTARIA & TOTALES (SENIAT)').isVisible());
    assert.ok(await page.getByText('SUBTOTAL BASE IMPONIBLE (GRAVABLE 16%):').isVisible());
    assert.ok(await page.getByText('TOTAL FACTURA FISCAL DIGITAL').isVisible());
    assert.ok(await page.getByText('EQUIVALENTE EN BOLÍVARES (BCV)').isVisible());

    // Verificar detalle de forma de pago
    assert.ok(await page.getByText('Pago móvil').first().isVisible());
    assert.ok(await page.getByText('Banesco Banco Universal').first().isVisible());
    assert.ok(await page.getByText('Ref Nro. 984123').isVisible());
    console.log('PASS: Invoice receipt has visually differentiated SENIAT totals and full payment bank/code details');
    await page.screenshot({ path: 'artifacts/04-invoice-enhanced.png', fullPage: false });

    await page.getByRole('button', { name: 'Cerrar ventana' }).click();

    // 9. Verificar botón de Cerrar Sesión (Logout)
    await page.locator('.sidebar-logout-btn').click();
    await page.waitForSelector('.login-card', { state: 'visible' });
    console.log('PASS: Logout button successfully returns to login view');

    assert.deepEqual(errors, []);
    console.log('ALL NEW TESORIO SENIAT V2 REQUIREMENTS PASSED FULLY!');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
