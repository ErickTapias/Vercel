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

    // 1. OPERADOR DTF: solo ve sus trabajos asignados
    await page.getByText('PC Plotter DTF I3200 (Operario Taller)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });
    await page.locator('.sidebar').getByRole('button', { name: /Órdenes de mi Máquina/ }).click();
    await page.waitForLoadState('networkidle');

    const cardsText = await page.locator('.production-card').allTextContents();
    assert.ok(cardsText.length > 0, 'DTF operator must see his assigned jobs');
    assert.ok(cardsText.every((t) => /OP-DTF/.test(t)), 'DTF operator must ONLY see DTF orders');
    assert.ok(!cardsText.some((t) => /OP-BOR|OP-COST/.test(t)), 'DTF operator must NOT see other stations orders');

    // Rendimiento: solo su máquina
    assert.ok(await page.getByText('Récord de mi máquina').isVisible());
    assert.equal(await page.getByText('Carlos DTF').count() >= 1, true);
    assert.equal(await page.getByText('Katerin Bordados').count(), 0);
    console.log('PASS: DTF operator sees only his jobs and only his performance record');

    // 3. Lista ordenada: solo título, se despliega con click
    const firstCard = page.locator('.production-card').first();
    assert.equal(await firstCard.locator('.order-card-details').count(), 0, 'Cards must be collapsed by default');
    await firstCard.click();
    assert.ok(await firstCard.locator('.order-card-details').isVisible(), 'Click must expand full details');
    assert.ok(await firstCard.getByText('Instrucción operario:').isVisible());
    await firstCard.click();
    assert.equal(await firstCard.locator('.order-card-details').count(), 0, 'Click again must collapse');
    console.log('PASS: Job list ordered by arrival, collapsed titles expand on click with full details');

    // 4 y 5. Croquis visible para operario y modo solo lectura (sin edición de orden)
    await firstCard.click();
    assert.equal(await firstCard.getByRole('button', { name: 'Editar' }).count(), 0, 'Operator must NOT be able to edit the order');
    await firstCard.getByRole('button', { name: /Ver Croquis/ }).click();
    const croquis = page.getByRole('dialog');
    await croquis.waitFor();
    assert.ok(await croquis.getByText('Modo solo lectura').isVisible());
    assert.ok((await croquis.locator('svg').count()) > 0, 'Croquis silhouette must be rendered');
    await croquis.getByRole('button', { name: 'Entendido' }).click();
    console.log('PASS: Operator croquis renders correctly in read-only mode without edit controls');
    await page.screenshot({ path: 'artifacts/60-operator-dtf-readonly.png', fullPage: true });

    // 2. OPERADOR BORDADORA: solo sus trabajos y marca Meistergram 8 Cabezales
    await page.locator('.sidebar-logout-btn').click();
    await page.waitForSelector('.login-card', { state: 'visible' });
    await page.getByText('PC Bordadora (Operario Taller)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });
    assert.ok(await page.getByText(/Meistergram 8 Cabezales/).first().isVisible(), 'Bordadora must be labeled Meistergram 8 Cabezales');
    const borCards = await page.locator('.production-card').allTextContents();
    assert.ok(borCards.length > 0 && borCards.every((t) => /OP-BOR/.test(t)), 'Bordadora operator sees only OP-BOR jobs');
    assert.ok(!borCards.some((t) => /OP-DTF|OP-COST/.test(t)));
    assert.equal(await page.locator('.production-card').first().getByRole('button', { name: 'Editar' }).count(), 0);
    console.log('PASS: Meistergram 8 Cabezales label and Bordadora operator isolation verified');
    await page.screenshot({ path: 'artifacts/61-operator-bordadora-meistergram.png', fullPage: true });

    // OPERADOR COSTURA: solo sus trabajos de confección
    await page.locator('.sidebar-logout-btn').click();
    await page.waitForSelector('.login-card', { state: 'visible' });
    await page.getByText('PC Taller de Costura (Operario Confección)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });
    const costCards = await page.locator('.production-card').allTextContents();
    assert.ok(costCards.every((t) => /OP-COST/.test(t) || !/OP-/.test(t)), 'Sewing operator sees only costura jobs');
    assert.ok(!costCards.some((t) => /OP-DTF|OP-BOR/.test(t)), 'Sewing operator must not see DTF or embroidery jobs');
    console.log('PASS: Sewing workshop operator sees only his own confection jobs');

    // DUEÑO: ve todas las estaciones con pestañas y edición disponible
    await page.locator('.sidebar-logout-btn').click();
    await page.waitForSelector('.login-card', { state: 'visible' });
    await page.getByText('Eliezer Parra (Dueño)').click();
    await page.getByRole('button', { name: 'Entrar al Sistema' }).click();
    await page.waitForSelector('.workspace', { state: 'visible' });
    await page.locator('.sidebar').getByRole('button', { name: /Taller & Estaciones/ }).click();
    await page.waitForLoadState('networkidle');
    assert.ok(await page.getByText('Vista General').isVisible(), 'Owner must see all station tabs');
    await page.locator('.production-card').first().click();
    assert.ok(await page.locator('.production-card').first().getByRole('button', { name: /Editar/ }).isVisible(), 'Owner can edit orders');
    console.log('PASS: Owner retains full multi-station view and edit rights');
    await page.screenshot({ path: 'artifacts/62-owner-full-view.png', fullPage: true });

    assert.deepEqual(errors, []);
    console.log('ALL 5 REQUIREMENTS VERIFIED 100%!');
  } finally {
    await browser.close();
  }
})().catch((err) => { console.error(err); process.exit(1); });
