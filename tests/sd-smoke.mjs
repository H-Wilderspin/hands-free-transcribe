// E2E smoke test: boots the SD worker (44MB models) in Chromium.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message.slice(0, 300)}`));

await page.goto('http://localhost:5173/test-sd.html', { waitUntil: 'domcontentloaded' });

const out = await page
  .waitForFunction(
    () => {
      const t = document.getElementById('out')?.textContent ?? '';
      return t.includes('SMOKE TEST PASSED') || t.includes('FAIL');
    },
    null,
    { timeout: 300_000 },
  )
  .then(async () => page.evaluate(() => document.getElementById('out')?.textContent));

console.log('--- result ---');
console.log(out);
console.log('--- console ---');
for (const l of logs.filter((l) => /sherpa|error|fail/i.test(l)).slice(0, 15)) console.log(l.slice(0, 250));

await browser.close();
process.exit(String(out).includes('SMOKE TEST PASSED') ? 0 : 1);
