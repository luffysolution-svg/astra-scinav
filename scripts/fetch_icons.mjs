// 构建期抓取站点图标到 site/icons，生成 site/data/icons.js 清单
// 运行时不依赖谷歌服务，国内可直接访问
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
ctx.NAV = ctx.window.NAV = [];
for (const f of ['ai', 'lit', 'lab', 'kit']) vm.runInNewContext(fs.readFileSync(`site/data/${f}.js`, 'utf8'), ctx);
const hosts = [...new Set(ctx.NAV.flatMap(c => c.s.map(s => new URL(s[1]).hostname)))];
fs.mkdirSync('site/icons', { recursive: true });

const ok = [];
// 子域名取不到时退回主域名，如 patents.google.com → google.com
const root = h => h.split('.').slice(/\.(com|org|gov|edu|ac)\.cn$/.test(h) ? -3 : -2).join('.');
async function grab(h) {
  const file = `site/icons/${h}.png`;
  if (fs.existsSync(file)) return ok.push(h);
  for (const d of [...new Set([h, root(h)])]) {
    try {
      const r = await fetch(`https://www.google.com/s2/favicons?domain=${d}&sz=64`, { signal: AbortSignal.timeout(15000) });
      if (!r.ok) continue;
      fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      return ok.push(h);
    } catch { /* 失败则前端使用字母头像 */ }
  }
}
const queue = [...hosts];
await Promise.all(Array.from({ length: 12 }, async () => { while (queue.length) await grab(queue.shift()); }));
ok.sort();
fs.writeFileSync('site/data/icons.js', `// 自动生成：已本地化图标的域名\nwindow.ICONS = new Set(${JSON.stringify(ok)});\n`);
console.log(`icons ${ok.length}/${hosts.length}`);
console.log('missing:', hosts.filter(h => !ok.includes(h)).join(' '));
