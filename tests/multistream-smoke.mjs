// Multi-stream ASR test: proves a segment decode no longer clobbers the
// persistent live stream (the "no active stream" pipeline error).
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await page.goto('http://localhost:5173/test-multistream.html', { waitUntil: 'domcontentloaded' });

const out = await page
  .waitForFunction(
    () => {
      const t = document.getElementById('out')?.textContent ?? '';
      return t.includes('MULTI-STREAM TEST PASSED') || t.includes('FAIL');
    },
    null,
    { timeout: 300_000 },
  )
  .then(async () => page.evaluate(() => document.getElementById('out')?.textContent));

console.log(out);
if (errors.length) { console.error('page errors:', errors); }
await browser.close();
process.exit(String(out).includes('MULTI-STREAM TEST PASSED') && errors.length === 0 ? 0 : 1);
