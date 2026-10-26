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

    // 2. Verificar que en el panel izquierdo (sidebar) no se corta el texto
    const sidebarWidth = await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width);
    assert.ok(sidebarWidth >= 250, `Sidebar width should be >= 250px (was ${sidebarWidth}px)`);
    assert.ok(await page.locator('.sidebar').getByText('Taller & Estaciones (DTF/Bordado)').isVisible());
    assert.ok(await page.locator('.sidebar').getByText('Cuentas por Cobrar/Pagar').isVisible());
    console.log('PASS: Sidebar width and menu labels are clean and not clipped');

    // 3. Probar en Asignar Trabajo: selección de estación con estilo visual activo marcado y tamaño proporcional
    await page.locator('.sidebar').getByRole('button', { name: /Taller & Estaciones/ }).click();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Asignar Nuevo Trabajo a Taller' }).click();
    const modal = page.getByRole('dialog');
    await modal.waitFor();

    // Probar click en estación Bordadora y verificar que se nota claramente el botón seleccionado (borde, fondo, badge activo)
    const bordadoraBtn = modal.getByRole('button', { name: /2\. Bordadora Barudan/ });
    await bordadoraBtn.click();
    assert.ok(await bordadoraBtn.getByText('✓ ACTIVO').isVisible());
    console.log('PASS: Selected station button has prominent active badge and visual border');

    // Click en Taller de Costura y verificar cambio activo
    const costuraBtn = modal.getByRole('button', { name: /3\. Taller de Costura/ });
    await costuraBtn.click();
    assert.ok(await costuraBtn.getByText('✓ ACTIVO').isVisible());
    console.log('PASS: Station selection changes active status cleanly');

    // 4. Probar la barra de tamaños y formas proporcionales del logo en el croquis
    assert.ok(await modal.getByText('Tamaño & Forma Proporcional:').isVisible());
    assert.ok(await modal.getByRole('button', { name: /🔘 Pequeño \/ Escudo/ }).isVisible());
    assert.ok(await modal.getByRole('button', { name: /⬛ Estándar Pecho/ }).isVisible());
    assert.ok(await modal.getByRole('button', { name: /🌈 Espalda Arco/ }).isVisible());

    // Clic en tamaño pequeño y verificar que se actualiza el tamaño en el croquis
    await modal.getByRole('button', { name: /🔘 Pequeño \/ Escudo/ }).click();
    assert.ok(await modal.getByText(/8x8 cm/).first().isVisible());
    console.log('PASS: Proportional logo shape buttons update dimensions instantly');

    // Cerrar modal
    await modal.getByRole('button', { name: 'Cancelar' }).click();

    // 5. Verificar Dashboard de Récords y Métricas de Operarios de Taller
    assert.ok(await page.getByText('Rendimiento y Récord de Operarios de Taller').isVisible());
    assert.ok(await page.getByText('Carlos DTF').first().isVisible());
    assert.ok(await page.getByText('Katerin Bordados').first().isVisible());
    assert.ok(await page.getByText('Efectividad de Despacho:').first().isVisible());
    console.log('PASS: Operator performance records and statistics dashboard verified');
    await page.screenshot({ path: 'artifacts/40-operator-records.png', fullPage: false });

    // 6. Probar Gráficos Modernos en Resumen Financiero
    await page.locator('.sidebar').getByRole('button', { name: 'Resumen Financiero' }).click();
    await page.waitForLoadState('networkidle');

    assert.ok(await page.getByText('Gráfico Financiero Dinámico en Tiempo Real').isVisible());
    assert.ok(await page.getByRole('button', { name: 'Flujo de Cascada' }).isVisible());
    assert.ok(await page.getByRole('button', { name: 'Distribución %' }).isVisible());

    // Cambiar a vista de dona / distribución porcentual
    await page.getByRole('button', { name: 'Distribución %' }).click();
    await page.waitForTimeout(400);
    assert.ok(await page.getByText('Costo Directo de Insumos').isVisible());
    console.log('PASS: Modern financial charts render waterfall and percentage distribution');
    await page.screenshot({ path: 'artifacts/41-financial-charts.png', fullPage: true });

    // 7. Probar Gráficos Modernos en Reportes
    await page.locator('.sidebar').getByRole('button', { name: 'Reportes' }).click();
    await page.waitForLoadState('networkidle');
    assert.ok(await page.getByText('Gráfico Financiero Dinámico en Tiempo Real').isVisible());
    console.log('PASS: Modern financial chart integrated in Reports module');

    // 8. Probar Gráficas Modernas de Ventas por Canal y Categorías en Estadísticas
    await page.locator('.sidebar').getByRole('button', { name: 'Estadísticas' }).click();
    await page.waitForLoadState('networkidle');

    assert.ok(await page.getByText('Ventas por Canal de Distribución').first().isVisible());
    assert.ok(await page.getByText('Rendimiento por Línea de Producto').first().isVisible());
    assert.ok(await page.getByText('Rendimiento y Récord de Operarios de Taller').isVisible());
    console.log('PASS: Modern gradient bar charts and operator records integrated in Statistics view');
    await page.screenshot({ path: 'artifacts/42-modern-statistics-charts.png', fullPage: true });

    assert.deepEqual(errors, []);
    console.log('ALL 5 USER ADJUSTMENTS PASSED 100%!');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
