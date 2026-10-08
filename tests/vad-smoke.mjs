// E2E smoke test: boots the VAD worker in a real Chromium and verifies
// init/accept/drain work with real wasm. Run: node tests/vad-smoke.mjs
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto('http://localhost:5173/test-vad.html', { waitUntil: 'domcontentloaded' });

// Wait for the smoke test verdict.
const result = await page.waitForFunction(
  () => document.getElementById('out')?.textContent?.includes('SMOKE TEST PASSED') ||
        document.getElementById('out')?.textContent?.includes('FAIL'),
  null,
  { timeout: 60_000 },
);

const text = await page.evaluate(() => document.getElementById('out')?.textContent);
console.log('--- result ---');
console.log(text);
console.log('--- console ---');
for (const l of logs.filter((l) => /sherpa|error|fail/i.test(l)).slice(0, 15)) console.log(l);

await browser.close();
process.exit(text.includes('SMOKE TEST PASSED') ? 0 : 1);
