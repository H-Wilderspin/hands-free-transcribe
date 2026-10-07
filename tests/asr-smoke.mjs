// E2E smoke test: boots the ASR worker (182MB model) in Chromium.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

await page.goto('http://localhost:5173/test-asr.html', { waitUntil: 'domcontentloaded' });

const text = await page.waitForFunction(
  () => {
    const t = document.getElementById('out')?.textContent ?? '';
    return t.includes('SMOKE TEST PASSED') || t.includes('FAIL');
  },
  null,
  { timeout: 300_000 }, // model download can take minutes
).then((h) => h.toString());

const out = await page.evaluate(() => document.getElementById('out')?.textContent);
console.log('--- result ---');
console.log(out);
console.log('--- console (sherpa/error) ---');
for (const l of logs.filter((l) => /sherpa|error|fail/i.test(l)).slice(0, 15)) console.log(l.slice(0, 300));

await browser.close();
process.exit(out.includes('SMOKE TEST PASSED') ? 0 : 1);
