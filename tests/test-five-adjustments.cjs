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
    // 1. Probar que la estación DTF ahora se llama I3200 (en login y en terminales)
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('tesorio_auth');
      document.fonts.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });

    assert.ok(await page.getByText('PC Plotter DTF I3200 (Operario Taller)').isVisible());
    console.log('PASS: Login reflects Plotter DTF I3200 name');

    // Iniciar sesión como Dueño (Eliezer Parra)
    await page.getByText('Eliezer Parra (Dueño)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    // 2. Probar botón de DESCARGA DE LOGO en Configuración & Logo
    await page.locator('.sidebar').getByRole('button', { name: 'Configuración & Logo' }).click();
    await page.waitForLoadState('networkidle');

    const downloadLogoBtn = page.getByRole('button', { name: 'Descargar Logo' });
    assert.ok(await downloadLogoBtn.isVisible(), 'Descargar Logo button must be visible');
    console.log('PASS: Download Logo button is present and ready');

    // 3. Probar Taller & Estaciones con las 3 Estaciones (DTF I3200, Bordadora y Taller de Costura)
    await page.locator('.sidebar').getByRole('button', { name: /Taller & Estaciones/ }).click();
    await page.waitForLoadState('networkidle');

    assert.ok(await page.getByText('Terminal 1 · Plotter DTF I3200').first().isVisible());
    assert.ok(await page.getByText('Terminal 2 · Bordadora Barudan').first().isVisible());
    assert.ok(await page.getByText('Terminal 3 · Taller de Costura').first().isVisible());
    console.log('PASS: Production workspace includes DTF I3200, Bordadora and Taller de Costura');

    // 4. Probar creación de orden con Selector Interactivo de Bordado (Silueta de Prenda, Frente/Atrás y opción Sin Bordado)
    await page.getByRole('button', { name: 'Asignar Nuevo Trabajo a Taller' }).click();
    const orderModal = page.getByRole('dialog');
    await orderModal.waitFor();

    // Comprobar que existe el selector interactivo de prenda
    assert.ok(await orderModal.getByText('Ubicación Interactiva de Bordado / Estampado').isVisible());
    assert.ok(await orderModal.getByText('👕 Franela / Chemise').isVisible());
    assert.ok(await orderModal.getByText('👖 Pantalón / Táctico').isVisible());
    assert.ok(await orderModal.getByRole('button', { name: 'FRENTE' }).isVisible());
    assert.ok(await orderModal.getByRole('button', { name: 'ATRÁS (ESPALDA)' }).isVisible());

    // Probar clic en botón "Picar si NO lleva bordado"
    const noEmbroideryBtn = orderModal.getByRole('button', { name: /Picar si NO lleva bordado/ });
    await noEmbroideryBtn.click();
    assert.ok(await orderModal.getByText('Prenda lisa sin bordado ni estampado').isVisible());
    console.log('PASS: "NO lleva bordado" toggle verified');

    // Volver a activar bordado e interactuar con silueta
    await orderModal.getByRole('button', { name: /Esta prenda NO lleva bordado/ }).click();
    await orderModal.getByRole('button', { name: 'ATRÁS (ESPALDA)' }).click();
    await page.waitForTimeout(300);

    // Seleccionar Taller de Costura
    await orderModal.getByRole('button', { name: /3\. Taller de Costura/ }).click();
    assert.ok(await orderModal.locator('input[value*="Corte y Confección"]').isVisible());

    // Cargar archivo del cliente
    const dummyArte = '/tmp/arte-cliente-test.png';
    fs.writeFileSync(dummyArte, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));
    await orderModal.locator('input[type="file"]').setInputFiles(dummyArte);
    assert.ok(await orderModal.getByText('arte-cliente-test.png').isVisible());
    console.log('PASS: Client file upload inside Assign Task modal verified');

    // Asignar a taller
    await orderModal.locator('input[placeholder*="Uniformes Caracas"]').fill('Colegio San Ignacio');
    await orderModal.getByRole('button', { name: 'Asignar a Taller' }).click();
    await orderModal.waitFor({ state: 'hidden' });
    console.log('PASS: Sewing workshop order assigned successfully');

    // 5. Filtrar pestaña de Taller de Costura y verificar orden con botón de Descargar Archivo
    await page.locator('.tabs button').filter({ hasText: 'Taller de Costura' }).click();
    await page.waitForTimeout(500);
    assert.ok(await page.getByText('Colegio San Ignacio').first().isVisible());
    assert.ok(await page.getByRole('button', { name: /Bajar Archivo/ }).first().isVisible());
    console.log('PASS: Operator has direct "Bajar Archivo" download button on production card');

    await page.screenshot({ path: 'artifacts/30-production-sewing-workshop.png', fullPage: true });

    assert.deepEqual(errors, []);
    console.log('ALL 5 USER ADJUSTMENTS (DTF I3200, LOGO DOWNLOAD, FILE UPLOAD IN TASKS, SEWING WORKSHOP, INTERACTIVE EMBROIDERY SILHOUETTE) PASSED 100%!');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
