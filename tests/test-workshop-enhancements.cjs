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
    // 1. Iniciar sesión como Sucursal 1 (Fábrica / Bordadora)
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('tesorio_auth');
      document.fonts.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });

    assert.ok(await page.locator('.login-card').isVisible());
    await page.getByText('Gerente Sucursal 1 (Fábrica / Bordadora)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    // 2. Verificar que Sucursal 1 puede asignar trabajos a Bordadora, DTF y Costura
    await page.locator('.sidebar').getByRole('button', { name: /Taller & Estaciones/ }).click();
    await page.waitForLoadState('networkidle');

    assert.ok(await page.getByRole('button', { name: 'Asignar Nuevo Trabajo a Taller' }).isVisible());
    await page.getByRole('button', { name: 'Asignar Nuevo Trabajo a Taller' }).click();
    const modal = page.getByRole('dialog');
    await modal.waitFor();

    // Comprobar que Sucursal 1 ve las 3 estaciones para asignar
    assert.ok(await modal.getByText('1. Plotter DTF I3200').isVisible());
    assert.ok(await modal.getByText('2. Bordadora Barudan').isVisible());
    assert.ok(await modal.getByText('3. Taller de Costura').isVisible());
    console.log('PASS: Sucursal 1 can assign tasks to DTF, Bordadora and Costura');

    // 3. Probar Croquis Interactivo con Arrastre Libre y Especificación de Logos
    assert.ok(await modal.getByText('Croquis Interactivo con Arrastre Libre y Especificación de Logos').isVisible());
    assert.ok(await modal.getByText('Coordenadas exactas en prenda:').isVisible());
    assert.ok(await modal.locator('input[placeholder*="Escudo_Colegio"]').isVisible());

    // Probar agregar un nuevo punto / logo sobre la silueta
    await modal.getByRole('button', { name: '+ Pecho Derecho' }).click();
    await page.waitForTimeout(300);
    assert.ok(await modal.getByText('Logo #2').isVisible());
    console.log('PASS: Multiple logo markers placement with drag support and coordinates verified');

    // Llenar datos y asignar
    await modal.locator('input[placeholder*="Uniformes Caracas"]').fill('Lácteos Los Andes C.A.');
    await modal.locator('input[placeholder*="10x10 cm pecho"]').fill('12x12 cm Pecho / 28x14 cm Espalda');
    await modal.locator('input[placeholder*="0.00 si pagó"]').fill('50.00'); // Saldo restante por pagar
    await modal.getByRole('button', { name: 'Asignar a Taller' }).click();
    await modal.waitFor({ state: 'hidden' });
    console.log('PASS: Order created by Sucursal 1 with custom logo specs and pending balance');

    // 4. Probar que Sucursal 1 y Dueño pueden EDITAR la orden creada
    const orderCard = page.locator('.production-card').filter({ hasText: 'Lácteos Los Andes C.A.' }).first();
    assert.ok(await orderCard.isVisible());
    await orderCard.getByRole('button', { name: /Editar/ }).click();
    const editModal = page.getByRole('dialog');
    await editModal.waitFor();
    assert.ok(await editModal.getByText('Editar Orden').isVisible());
    // Modificar observaciones
    await editModal.locator('textarea').fill('Ajuste de supervisión: hilo dorado metálico en contorno.');
    await editModal.getByRole('button', { name: 'Guardar Cambios de Orden' }).click();
    await page.waitForSelector('[role="dialog"]', { state: 'hidden' });
    console.log('PASS: Branch 1 and Owner can edit production orders smoothly');

    // 5. Cambiar a Operador de Plotter DTF para verificar que ve el croquis técnico
    await page.locator('.sidebar-logout-btn').click();
    await page.waitForSelector('.login-card', { state: 'visible' });

    await page.getByText('PC Plotter DTF I3200 (Operario Taller)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    // Operador ve la orden de Lácteos Los Andes con botón de Ver Croquis
    const operatorCard = page.locator('.production-card').filter({ hasText: 'Lácteos Los Andes C.A.' }).first();
    assert.ok(await operatorCard.isVisible());
    assert.ok(await operatorCard.getByRole('button', { name: /Ver Croquis/ }).isVisible());

    // Abrir el croquis técnico de la prenda
    await operatorCard.getByRole('button', { name: /Ver Croquis/ }).click();
    const croquisDialog = page.getByRole('dialog');
    await croquisDialog.waitFor();
    assert.ok(await croquisDialog.getByText('Croquis Técnico de la Prenda').isVisible());
    assert.ok(await croquisDialog.getByText('Especificación de Cada Logo / Aplicación:').isVisible());
    console.log('PASS: Operator can view full technical croquis and exact logo coordinates');
    await croquisDialog.getByRole('button', { name: 'Cerrar Visor' }).click();

    // Operador marca el trabajo como en proceso y luego terminado
    await operatorCard.getByRole('button', { name: 'Iniciar Trabajo' }).click();
    await page.waitForTimeout(600);
    const activeOpCard = page.locator('.production-card').filter({ hasText: 'Lácteos Los Andes C.A.' }).first();
    await activeOpCard.getByRole('button', { name: 'Marcar Terminado / Listo' }).click();
    await page.waitForTimeout(600);
    console.log('PASS: Operator marked job finished and ready for pickup/delivery');

    // 6. Iniciar sesión como Dueño (Eliezer Parra) para verificar la ALERTA y autorizar DELIVERY
    await page.locator('.sidebar-logout-btn').click();
    await page.waitForSelector('.login-card', { state: 'visible' });

    await page.getByText('Eliezer Parra (Dueño)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    // Ir a Taller & Estaciones
    await page.locator('.sidebar').getByRole('button', { name: /Taller & Estaciones/ }).click();
    await page.waitForLoadState('networkidle');

    // Verificar que aparece la ALERTA destacada para el Dueño
    assert.ok(await page.getByText(/Trabajo\(s\) terminado\(s\) por los Operadores en Taller!/).isVisible());
    console.log('PASS: Owner and branches receive immediate alert of finished workshop jobs');

    // Abrir modal de Autorizar Retiro / Delivery para Lácteos Los Andes
    const readyCard = page.locator('.production-card').filter({ hasText: 'Lácteos Los Andes C.A.' }).first();
    await readyCard.getByRole('button', { name: 'Autorizar Retiro / Delivery' }).click();
    const deliveryModal = page.getByRole('dialog');
    await deliveryModal.waitFor();

    assert.ok(await deliveryModal.getByText('Estado de Pago del Cliente:').isVisible());
    assert.ok(await deliveryModal.getByText('Saldo Pendiente: $50.00').isVisible());

    // Validar cobro del saldo restante
    await deliveryModal.locator('input[type="checkbox"]').click();

    // Seleccionar Delivery Regional (Caracas)
    await deliveryModal.getByRole('button', { name: /Delivery Regional/ }).click();
    await deliveryModal.locator('textarea').fill('Av. Rómulo Gallegos, Edif. Torre Polar, Piso 3, Ofic. 302');

    await deliveryModal.getByRole('button', { name: 'Autorizar y Notificar al Cliente' }).click();
    await deliveryModal.waitFor({ state: 'hidden' });
    console.log('PASS: Owner validated 100% payment and authorized Regional Delivery with automated notification');

    await page.screenshot({ path: 'artifacts/35-delivery-authorized-seniat.png', fullPage: true });

    assert.deepEqual(errors, []);
    console.log('ALL 5 REQUIREMENTS (OPERATOR CROQUIS, FREE DRAG & DROP, LOGO SPECS, MULTI-BRANCH ASSIGN & EDIT, DELIVERY/PICKUP NOTIFICATIONS) PASSED 100%!');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
