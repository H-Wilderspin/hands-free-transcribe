// Diagnose ASR worker boot: capture console + network, report every 10s.
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message.slice(0, 300)}`));
page.on('requestfailed', (req) => logs.push(`[reqfail] ${req.url().slice(-60)} ${req.failure()?.errorText}`));

await page.goto('http://localhost:5173/test-asr.html', { waitUntil: 'domcontentloaded' });

for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(10_000);
  const out = await page.evaluate(() => document.getElementById('out')?.textContent);
  console.log(`=== t=${(i + 1) * 10}s ===`);
  console.log(out?.split('\n').slice(-3).join('\n'));
  const newLogs = logs.splice(0).filter((l) => /sherpa|error|fail|chunk/i.test(l));
  for (const l of newLogs.slice(0, 6)) console.log('  ' + l.slice(0, 200));
  if (out?.includes('SMOKE TEST PASSED') || out?.includes('FAIL')) break;
}

await browser.close();
