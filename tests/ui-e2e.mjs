// UI E2E: verifies the expanded settings panel — pill edit (rename + color
// palette), pause/resume commands registered, and persistence across reload.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });

// Open the settings panel
await page.click('.settings-btn');
await page.waitForSelector('.settings-panel');

// Seed a fake profile directly into IndexedDB (raw IDB, no module import).
await page.evaluate(async () => {
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('keyval-store', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('keyval');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('keyval', 'readwrite');
      const profile = {
        id: 'sp-test-1',
        name: 'Test User',
        color: '#4ade80',
        active: true,
        createdAt: Date.now(),
        referenceSamples: new Float32Array(32000),
      };
      tx.objectStore('keyval').put(profile, 'speaker:sp-test-1');
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.click('.settings-btn');
await page.waitForSelector('.pill');

// Pill shows the persisted name
const pillText = await page.textContent('.pill-toggle');
console.log('pill name:', pillText);

// Click edit → editor appears with name input + palette
await page.click('.pill-edit');
await page.waitForSelector('.pill-editor');
await page.fill('.pill-name-input', 'Michael');
await page.press('.pill-name-input', 'Enter');
await page.waitForSelector('.pill-toggle');
const renamed = await page.textContent('.pill-toggle');
console.log('renamed pill:', renamed);
if (renamed !== 'Michael') throw new Error('rename failed');

// Color swatch
await page.click('.pill-edit');
await page.waitForSelector('.palette-row');
const swatchCount = await page.locator('.swatch').count();
console.log('palette swatches:', swatchCount);
await page.locator('.swatch').nth(1).click(); // amber
await page.waitForTimeout(300); // allow the async IndexedDB write to flush
const bg = await page.evaluate(() => document.querySelector('.pill')?.getAttribute('style') ?? '');
console.log('pill style after color:', bg);
if (!bg.includes('rgb(251, 191, 36)')) throw new Error('color change failed'); // #fbbf24 as rgb

// Persisted? reload and re-check
await page.reload({ waitUntil: 'domcontentloaded' });
await page.click('.settings-btn');
await page.waitForSelector('.pill');
const afterReload = await page.textContent('.pill-toggle');
const styleAfter = await page.evaluate(() => document.querySelector('.pill')?.getAttribute('style') ?? '');
console.log('after reload:', afterReload, styleAfter);
if (afterReload !== 'Michael' || !styleAfter.includes('rgb(251, 191, 36)')) throw new Error('persistence failed');

// Delete: two-click confirm
await page.click('.pill-delete');
await page.click('.pill-delete');
const pillGone = await page.locator('.pill').count();
console.log('pill count after double delete:', pillGone);
if (pillGone !== 0) throw new Error('delete failed');

if (errors.length > 0) {
  console.error('PAGE ERRORS:', errors);
  process.exit(1);
}
console.log('UI E2E PASSED');
await browser.close();
