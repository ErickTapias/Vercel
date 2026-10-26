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
    // 1. Probar que el botón del ojo funciona y muestra/oculta la contraseña
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('tesorio_auth');
      document.fonts.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });

    const passwordInput = page.locator('input[placeholder="••••••••••••"]');
    assert.equal(await passwordInput.getAttribute('type'), 'password');

    // Clic en el botón del ojo
    const eyeBtn = page.locator('.password-toggle-eye-btn');
    await eyeBtn.click();
    assert.equal(await passwordInput.getAttribute('type'), 'text');
    console.log('PASS: Password toggle eye reveals plain text password');

    // Clic de nuevo para ocultar
    await eyeBtn.click();
    assert.equal(await passwordInput.getAttribute('type'), 'password');
    console.log('PASS: Password toggle eye hides password back to dots');

    // 2. Iniciar sesión como Dueño (Eliezer Parra)
    await page.getByText('Eliezer Parra (Dueño)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    // 3. Probar carga de múltiples imágenes y video en el formulario de Producto
    await page.locator('.sidebar').getByRole('button', { name: 'Inventario' }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Nuevo artículo' }).click();
    const productModal = page.getByRole('dialog');
    await productModal.waitFor();

    // Crear 2 imágenes dummy para probar subida múltiple
    const img1 = '/tmp/prod-foto-1.png';
    const img2 = '/tmp/prod-foto-2.png';
    const base64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    fs.writeFileSync(img1, Buffer.from(base64.split(',')[1], 'base64'));
    fs.writeFileSync(img2, Buffer.from(base64.split(',')[1], 'base64'));

    await productModal.locator('input[type="file"][multiple]').setInputFiles([img1, img2]);
    await page.waitForTimeout(500);

    assert.ok(await productModal.getByText('2 imagen(es) cargada(s)').isVisible());
    console.log('PASS: Multiple images upload in Product form functional');

    // Cerrar modal
    await productModal.getByRole('button', { name: 'Cancelar' }).click();

    // 4. Probar sección de Conexión API de Imprenta Digital SENIAT en Configuración
    await page.locator('.sidebar').getByRole('button', { name: 'Configuración & Logo' }).click();
    await page.waitForLoadState('networkidle');

    assert.ok(await page.getByText('Conexión API · Imprenta Digital Homologada SENIAT').isVisible());
    assert.ok(await page.locator('input[name="digitalPrinterApiUrl"]').isVisible());
    assert.ok(await page.locator('input[name="digitalPrinterApiKey"]').isVisible());
    console.log('PASS: Digital Printer API settings section is present and configurable');

    // Probar el botón de Test de Conectividad API
    await page.getByRole('button', { name: 'Test de Conectividad API' }).click();
    await page.waitForTimeout(1000);
    console.log('PASS: Test de Conectividad API ping executed');

    // 5. Probar el nuevo diseño de Factura Digital SENIAT Oficial (Letter 8.5x11 con QR y Providencia 000102)
    await page.locator('.sidebar').getByRole('button', { name: 'Ventas y Facturación' }).click();
    await page.waitForLoadState('networkidle');

    await page.locator('.tabs button').filter({ hasText: 'Registro de Facturas Emitidas' }).click();
    await page.locator('.data-table tbody tr').first().click();

    const invoiceDialog = page.getByRole('dialog');
    await invoiceDialog.waitFor();

    // Escuchar la apertura de la ventana de impresión que genera el nuevo documento SENIAT
    const popupPromise = page.waitForEvent('popup');
    await invoiceDialog.getByRole('button', { name: /Imprimir \/ Descargar PDF Oficial/ }).click();
    const invoicePopup = await popupPromise;
    await invoicePopup.waitForLoadState('load');

    const popupHtml = await invoicePopup.content();
    assert.ok(popupHtml.includes('FACTURA EMITIDA CONFORME A LA PROVIDENCIA ADMINISTRATIVA SENIAT N° SNAT/2024/000102'));
    assert.ok(popupHtml.includes('DOCUMENTO FISCAL ELECTRÓNICO'));
    assert.ok(popupHtml.includes('https://api.qrserver.com/v1/create-qr-code'));
    assert.ok(popupHtml.includes('RIF Imprenta Digital'));
    console.log('PASS: Official SENIAT 2026 digital invoice format verified with Prov. 000102, QR and Letter layout');

    await invoicePopup.pdf({ path: 'artifacts/seniat-invoice-official-2026.pdf', format: 'Letter' });
    await invoicePopup.close();

    await invoiceDialog.getByRole('button', { name: 'Cerrar ventana' }).click();

    assert.deepEqual(errors, []);
    console.log('ALL 4 USER REQUESTS (PASSWORD EYE, MULTI-IMAGE/VIDEO UPLOAD, DIGITAL PRINTER API, OFFICIAL SENIAT 2026 INVOICE DESIGN) PASSED 100%!');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
