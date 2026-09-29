// 补齐谷歌图标服务取不到的站点：用真实浏览器打开首页，读取 <link rel=icon>，
// 在 Node 端下载字节（无跨域限制），再交给页面解码并统一转为 64px PNG
// 用法：PUPPETEER_DIR=<含 node_modules/puppeteer-core 的目录> node scripts/fix_icons.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire((process.env.PUPPETEER_DIR || process.cwd()) + '/');
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const ctx = { window: {} };
ctx.NAV = ctx.window.NAV = [];
for (const f of ['ai', 'lit', 'lab', 'kit']) vm.runInNewContext(fs.readFileSync(`site/data/${f}.js`, 'utf8'), ctx);
const urls = new Map(ctx.NAV.flatMap(c => c.s.map(s => [new URL(s[1]).hostname, s[1]])));
const missing = [...urls.keys()].filter(h => !fs.existsSync(`site/icons/${h}.png`));
console.log('missing', missing.length);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
async function bytes(u) {
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const b = Buffer.from(await r.arrayBuffer());
    return b.length > 60 ? { b64: b.toString('base64'), type: r.headers.get('content-type') || '' } : null;
  } catch { return null; }
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const decoder = await browser.newPage();
await decoder.goto('about:blank');
// 解码任意格式（ico/png/svg/webp）并居中绘制为 64px PNG
const toPng = d => decoder.evaluate(async ({ b64, type }) => {
  const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const svg = /svg/.test(type) || new TextDecoder().decode(raw.slice(0, 200)).includes('<svg');
  const url = URL.createObjectURL(new Blob([raw], { type: svg ? 'image/svg+xml' : type || 'image/x-icon' }));
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch { return null; }
  if (!img.naturalWidth && !svg) return null;
  const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 });
  c.getContext('2d').drawImage(img, 0, 0, 64, 64);
  return c.toDataURL('image/png').split(',')[1];
}, d);

for (const h of missing) {
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  let cands = [];
  try {
    await page.goto(urls.get(h), { waitUntil: 'domcontentloaded', timeout: 25000 });
    await new Promise(r => setTimeout(r, 1500));
    // 按尺寸从大到小排序，apple-touch-icon 通常最清晰
    cands = await page.evaluate(() => [...document.querySelectorAll('link[rel~="icon"], link[rel="shortcut icon"], link[rel^="apple-touch-icon"]')]
      .map(l => ({ href: l.href, s: parseInt(l.sizes?.value) || (l.rel.includes('apple') ? 180 : 32) }))
      .sort((a, b) => b.s - a.s).map(x => x.href));
    cands.push(new URL('/favicon.ico', page.url()).href);
  } catch { cands.push(`https://${h}/favicon.ico`); }
  await page.close();
  // 首页取不到时，退回公共图标服务
  // （icon.horse / favicon.im 找不到时会返回字母占位图，故不使用）
  cands.push(`https://icons.duckduckgo.com/ip3/${h}.ico`);
  let done = false;
  for (const u of [...new Set(cands)]) {
    const d = await bytes(u); // Node fetch 同样支持 data: URL
    const png = d && await toPng(d).catch(() => null);
    if (png) { fs.writeFileSync(`site/icons/${h}.png`, Buffer.from(png, 'base64')); done = true; break; }
  }
  console.log(done ? 'OK  ' : 'FAIL', h);
}
await browser.close();
