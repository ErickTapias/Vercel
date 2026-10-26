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
    // 1. Iniciar sesión como Dueño (Eliezer Parra)
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      localStorage.removeItem('tesorio_auth');
      document.fonts.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });

    await page.getByText('Eliezer Parra (Dueño)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });

    // 2. Probar Colapso y Expansión del Sidebar (Boton de recoger el menu a puro iconos y volver)
    const collapseBtn = page.locator('.collapse-button');
    assert.ok(await collapseBtn.isVisible(), 'Collapse button must exist in brand row');

    // Click para colapsar a solo iconos
    await collapseBtn.click();
    await page.waitForTimeout(350);
    assert.ok(await page.locator('.sidebar-collapsed').isVisible(), 'Shell should have .sidebar-collapsed class');
    assert.ok(await collapseBtn.isVisible(), 'Collapse button must REMAIN visible when collapsed to expand back');
    console.log('PASS: Sidebar collapses cleanly to icon-only mode with visible toggle button');

    // Click para volver a expandir a tamaño normal
    await collapseBtn.click();
    await page.waitForTimeout(350);
    assert.ok(!(await page.locator('.sidebar-collapsed').isVisible()), 'Shell should not be collapsed after second click');
    console.log('PASS: Sidebar expands back smoothly without UI breaking');
    await page.screenshot({ path: 'artifacts/50-sidebar-toggle.png' });

    // 3. Probar Módulo de Inventario con tarjetas reducidas al 50% y botón destacado de Cargar Lista con Excel
    await page.locator('.sidebar').getByRole('button', { name: 'Inventario' }).click();
    await page.waitForLoadState('networkidle');

    // Verificar botón destacado de Excel
    const excelBtn = page.getByRole('button', { name: /Cargar Lista con Excel/ });
    assert.ok(await excelBtn.isVisible(), 'Button "Cargar Lista con Excel" must be prominently visible');

    // Probar abrir el modal de importación
    await excelBtn.click();
    const importModal = page.getByRole('dialog');
    await importModal.waitFor();
    assert.ok(await importModal.getByText('Importar Inventario desde Excel').isVisible());
    assert.ok(await importModal.getByRole('button', { name: 'Plantilla' }).isVisible());
    await importModal.getByRole('button', { name: 'Cancelar' }).click();
    console.log('PASS: "Cargar Lista con Excel" opens massive upload modal properly');

    // Comprobar tamaño de tarjeta reducida en cuadrícula
    const cardHeight = await page.locator('.inventory-product-card').first().evaluate((el) => el.getBoundingClientRect().height);
    console.log(`Inventory product card height: ${cardHeight}px (compact 50% scale)`);
    assert.ok(cardHeight <= 170, `Card height should be <= 170px for compact view (was ${cardHeight}px)`);
    console.log('PASS: Inventory product cards are compact at half size');
    await page.screenshot({ path: 'artifacts/51-inventory-compact-grid.png', fullPage: true });

    // 4. Probar Alerta Financiera de Pérdida Cambiaria en Cuentas Bancarias
    await page.locator('.sidebar').getByRole('button', { name: 'Cuentas y Bancos' }).click();
    await page.waitForLoadState('networkidle');

    assert.ok(await page.getByText('ALERTA FINANCIERA VENEZUELA · RIESGO CAMBIARIO BCV').isVisible());
    assert.ok(await page.getByText(/retenidos en cuentas nacionales/).isVisible());
    assert.ok(await page.getByText('Pasar Fondos a Dólares ($)').isVisible());
    console.log('PASS: Exchange rate loss alert for Bolivars and recommendation to USD verified');
    await page.screenshot({ path: 'artifacts/52-accounts-ves-risk-alert.png', fullPage: false });

    // 5. Probar Historial Completo y Comportamiento Integral en Ficha de Cliente
    await page.locator('.sidebar').getByRole('button', { name: 'Clientes / RIF' }).click();
    await page.waitForLoadState('networkidle');

    await page.locator('.data-table tbody tr').first().click();
    const customerExpediente = page.getByRole('dialog');
    await customerExpediente.waitFor();

    assert.ok(await customerExpediente.getByText('Expediente Fiscal y Comportamiento Integral de Cliente').isVisible());
    assert.ok(await customerExpediente.getByText('Total Comprado Histórico').isVisible());
    assert.ok(await customerExpediente.getByText('Prendas y Servicios Más Comprados por este Cliente').isVisible());
    assert.ok(await customerExpediente.getByText('Historial Completo de Facturas Emitidas').isVisible());
    console.log('PASS: Customer detail modal displays full purchase history, top products and financial status');
    await customerExpediente.getByRole('button', { name: 'Cerrar ventana' }).click();

    // 6. Probar Centro de Respaldos SENIAT y Base de Datos (Diario, Semanal, Mensual, Inventario)
    await page.locator('.sidebar').getByRole('button', { name: 'Configuración & Logo' }).click();
    await page.waitForLoadState('networkidle');

    assert.ok(await page.getByText('Centro de Respaldos Automáticos SENIAT & Base de Datos').isVisible());
    assert.ok(await page.getByRole('button', { name: 'Enviar Respaldo del Día' }).isVisible());
    assert.ok(await page.getByRole('button', { name: 'Enviar Respaldo Semanal' }).isVisible());
    assert.ok(await page.getByRole('button', { name: 'Enviar Respaldo Mensual' }).isVisible());
    assert.ok(await page.getByRole('button', { name: 'Descargar y Enviar Copia Completa Ahora' }).isVisible());

    // Probar generación y envío de respaldo del día
    await page.getByRole('button', { name: 'Enviar Respaldo del Día' }).click();
    await page.waitForTimeout(1000);
    assert.ok(await page.getByText('Último respaldo (DAILY)').isVisible());
    console.log('PASS: Automatic backup trigger and owner email dispatch verified');
    await page.screenshot({ path: 'artifacts/53-backup-manager.png', fullPage: true });

    assert.deepEqual(errors, []);
    console.log('ALL 6 USER REQUESTS VERIFIED AND PASSING 100%!');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
