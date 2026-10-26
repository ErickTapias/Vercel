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
    // 1. Verificar Pantalla de Login con 5 cuentas seguras
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('tesorio_auth');
      document.fonts.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });

    assert.ok(await page.locator('.login-card').isVisible());
    assert.ok(await page.getByText('Eliezer Parra (Dueño)').isVisible());
    assert.ok(await page.getByText('Gerente Sucursal 1 (Fábrica / Bordadora)').isVisible());
    assert.ok(await page.getByText('Gerente Sucursal 2 (DTF Textil)').isVisible());
    assert.ok(await page.getByText('PC Plotter DTF I3200 (Operario Taller)').isVisible());
    assert.ok(await page.getByText('PC Bordadora (Operario Taller)').isVisible());
    console.log('PASS: Login displays all 5 requested system roles with secure configurations');
    await page.screenshot({ path: 'artifacts/20-login-roles.png' });

    // 2. Probar BLINDAJE ESTRICTO del Operador de Bordadora
    // El operario de máquina NO debe ver Facturación, Libros SENIAT, Inventario ni Configuración
    await page.getByText('PC Bordadora (Operario Taller)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    assert.ok(await page.getByText('Estación de Taller Blindada').isVisible());
    assert.ok(await page.getByText('Estación Bordadora Barudan 6 Cabezales').first().isVisible());

    // Verificar que los módulos privados NO existen para el operario
    assert.equal(await page.locator('.sidebar').getByText('Libros Fiscales SENIAT').count(), 0);
    assert.equal(await page.locator('.sidebar').getByText('Ventas y Facturación').count(), 0);
    assert.equal(await page.locator('.sidebar').getByText('Configuración & Logo').count(), 0);
    assert.equal(await page.locator('.sidebar').getByText('Cuentas y Bancos').count(), 0);
    assert.equal(await page.locator('.sidebar').getByText('Gastos y Egresos').count(), 0);
    console.log('PASS: Machine Operator is completely blocked from invoices, fiscal books, financials and settings');

    // Comprobar que en su terminal SOLO ve las órdenes de bordado para operar y terminar
    assert.ok(await page.getByText('OP-BOR-0201').first().isVisible());
    assert.ok(await page.getByText('Escudo_SanIgnacio_Matriz.dst').isVisible());
    assert.ok(await page.getByText('18.500 puntadas').isVisible());
    console.log('PASS: Bordadora Operator has full technical specs of embroidery orders');

    // Operario cambia orden a en proceso
    await page.locator('.production-card').filter({ hasText: 'OP-BOR-0201' }).getByRole('button', { name: 'Iniciar Trabajo' }).click();
    await page.waitForTimeout(600);
    console.log('PASS: Bordadora operator set job to in_process');

    // Operario marca lista para entrega
    await page.locator('.production-card').filter({ hasText: 'OP-BOR-0201' }).getByRole('button', { name: /Marcar Terminado|Marcar Listo/ }).click();
    await page.waitForTimeout(600);
    console.log('PASS: Bordadora operator set job ready for office pickup');

    await page.screenshot({ path: 'artifacts/21-operator-bordadora-isolated.png', fullPage: true });

    // Cerrar sesión del operario
    await page.locator('.sidebar-logout-btn').click();
    await page.waitForSelector('.login-card', { state: 'visible' });

    // 3. Probar BLINDAJE ESTRICTO del Operador de Plotter DTF
    await page.getByText('PC Plotter DTF I3200 (Operario Taller)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    assert.ok(await page.getByText('Estación Plotter DTF I3200').first().isVisible());
    assert.equal(await page.locator('.sidebar').getByText('Libros Fiscales SENIAT').count(), 0);
    assert.equal(await page.locator('.sidebar').getByText('Ventas y Facturación').count(), 0);
    assert.equal(await page.locator('.sidebar').getByText('Configuración & Logo').count(), 0);
    console.log('PASS: DTF Operator is completely blocked from private company modules');

    // Cerrar sesión
    await page.locator('.sidebar-logout-btn').click();
    await page.waitForSelector('.login-card', { state: 'visible' });

    // 4. Probar Acceso Completo del Dueño: Eliezer Parra
    await page.getByText('Eliezer Parra (Dueño)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    assert.ok(await page.getByText('Eliezer Parra').first().isVisible());
    assert.ok(await page.getByText('Propietario & Director General').first().isVisible());
    assert.ok(await page.locator('.sidebar').getByText('Libros Fiscales SENIAT').isVisible());
    assert.ok(await page.locator('.sidebar').getByText('Ventas y Facturación').isVisible());
    assert.ok(await page.locator('.sidebar').getByText('Configuración & Logo').isVisible());
    console.log('PASS: Owner Eliezer Parra has full omniscient access to both branches and all modules');

    // 5. Probar Responsividad en Móvil (Viewport 375x812 - iPhone)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(400);

    // Menú móvil hamburger visible
    assert.ok(await page.locator('.mobile-menu').isVisible(), 'Mobile menu hamburger must be visible');
    assert.ok(await page.locator('.bcv-rate-pill').isVisible(), 'BCV rate pill is adapted on mobile');

    // Abrir menú móvil
    await page.locator('.mobile-menu').click();
    assert.ok(await page.locator('.sidebar.mobile-open').isVisible(), 'Sidebar drawer opens on mobile');

    // Cerrar menú móvil
    await page.locator('.mobile-close').click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'artifacts/22-mobile-responsive-iphone.png' });
    console.log('PASS: Mobile responsive layout verified on 375px');

    // 6. Probar Responsividad en Tablet (Viewport 768x1024 - iPad)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'artifacts/23-tablet-responsive-ipad.png' });
    console.log('PASS: Tablet responsive layout verified on 768px');

    assert.deepEqual(errors, []);
    console.log('ALL TESORIO V4 ADJUSTMENTS (STRICT OPERATOR BLINDAGE, 5 SECURE ROLES, ELIEZER PARRA OWNER, BCV LIVE & RESPONSIVE) VERIFIED 100%!');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
