import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, extname } from 'node:path';

// ASTRA_BROWSER_TESTS=1 enables this regression; use PLAYWRIGHT_MODULE and
// BROWSER_EXECUTABLE when Playwright and Chromium are supplied outside the repo.
test('workbench preserves an unsaved cross-origin canvas through site navigation and history', {
  skip: process.env.ASTRA_BROWSER_TESTS !== '1', timeout: 30000,
}, async () => {
  const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
  const root = fileURLToPath(new URL('../site/', import.meta.url));
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const headers = Object.fromEntries(config.headers[0].headers.map(h => [h.key, h.value]));
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'index.html';
    try {
      const body = await readFile(join(root, path));
      res.writeHead(200, { ...headers, 'Content-Type': mime[extname(path)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
    const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('astra:calm', 'true'));
    let canvasLoads = 0;
    await context.route('https://canvas.luffysite.top/**', route => {
      canvasLoads++;
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html>
        <textarea id="node"></textarea><button id="zoom">Zoom</button><button id="pan">Pan</button><output id="view"></output>
        <script>window.instance=Math.random();window.view={x:0,k:1};
        const render=()=>document.getElementById('view').textContent=JSON.stringify(view);render();
        document.getElementById('zoom').onclick=()=>{view.k=1.7;render()};
        document.getElementById('pan').onclick=()=>{view.x=172;render()};
        history.pushState(null,'','/canvas/regression-project');</script>` });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/workbench.html');
    const canvas = page.frameLocator('#wbFrame');
    await canvas.locator('#node').fill('unsaved research diagram');
    await canvas.locator('#zoom').click(); await canvas.locator('#pan').click();
    const frame = page.frames().find(f => f.url().startsWith('https://canvas.luffysite.top/'));
    const snapshot = () => frame.evaluate(() => ({ instance: window.instance, note: document.getElementById('node').value, view: window.view, display: document.getElementById('view').textContent, url: location.href }));
    const before = await snapshot();
    assert.equal(await page.evaluate(() => {
      try { document.getElementById('wbFrame').contentWindow.document; return false; }
      catch { return true; }
    }), true, 'the fixture must retain the actual cross-origin boundary');
    const size = () => page.locator('#wbFrame').evaluate(el => ({ width: el.clientWidth, height: el.clientHeight }));
    const beforeSize = await size();
    const site = page.frameLocator('#wbSiteFrame');
    async function expectPage(path) {
      await page.waitForURL(new RegExp('/' + path.replace('.', '\\.') + '(?:[?#]|$)'));
      await site.locator('.page-nav').waitFor();
      await page.waitForFunction(expected => document.getElementById('wbSiteFrame').contentWindow.location.pathname.endsWith('/' + expected), path);
    }
    await page.locator('.page-nav a[href="skills.html"]').click(); await expectPage('skills.html');
    assert.deepEqual(await size(), beforeSize, 'hidden canvas keeps its dimensions');
    await site.locator('.page-nav a[href="news.html"]').click(); await expectPage('news.html');
    await site.locator('#q').fill('CRISPR'); await page.waitForURL('**/news.html?q=CRISPR');
    await site.locator('.page-nav a[href="figures.html"]').click(); await expectPage('figures.html');
    await site.locator('.page-nav a[href="workbench.html"]').click(); await page.waitForURL('**/workbench.html');
    assert.deepEqual(await snapshot(), before);
    assert.equal(canvasLoads, 1);
    assert.equal(await page.locator('#wbSiteFrame').isHidden(), true);
    for (const path of ['figures.html', 'news.html', 'skills.html', 'workbench.html']) {
      await page.goBack(); await page.waitForURL(new RegExp('/' + path.replace('.', '\\.') + '(?:[?#]|$)'));
    }
    assert.deepEqual(await snapshot(), before);
    for (const path of ['skills.html', 'news.html', 'figures.html', 'workbench.html']) {
      await page.goForward(); await page.waitForURL(new RegExp('/' + path.replace('.', '\\.') + '(?:[?#]|$)'));
    }
    assert.deepEqual(await snapshot(), before);
    assert.equal(canvasLoads, 1);
    // Reopening the currently cached site page restores its title without recreating the canvas.
    await page.locator('.page-nav a[href="figures.html"]').click(); await expectPage('figures.html');
    assert.equal(await page.title(), await site.locator('title').textContent());
    await context.route('https://luffysite.top/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>External page</h1>' }));
    const popupPromise = page.waitForEvent('popup');
    await site.locator('.blog-link').click();
    const popup = await popupPromise; await popup.waitForLoadState();
    assert.equal(new URL(popup.url()).hostname, 'luffysite.top');
    await popup.close();
    await site.locator('.page-nav a[href="workbench.html"]').click(); await page.waitForURL('**/workbench.html');
    assert.deepEqual(await snapshot(), before);
    assert.equal(canvasLoads, 1);
    // A user can return before a large child-page script finishes downloading.
    await context.route('**/data/skills.js', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.continue().catch(() => {});
    });
    await page.locator('.page-nav a[href="skills.html"]').click();
    await site.locator('.page-nav a[href="workbench.html"]').waitFor();
    assert.equal(await site.locator('body').evaluate(() => document.readyState), 'loading');
    await site.locator('.page-nav a[href="workbench.html"]').click(); await page.waitForURL('**/workbench.html');
    await page.waitForFunction(() => document.getElementById('wbSiteFrame').contentDocument.readyState === 'complete');
    assert.equal(new URL(page.url()).pathname, '/workbench.html');
    assert.deepEqual(await snapshot(), before);
    assert.equal(canvasLoads, 1);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
