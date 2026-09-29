// 校验：去重情况，以及原始来源中哪些站点未被收录
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
ctx.NAV = ctx.window.NAV = [];
for (const f of ['ai', 'lit', 'lab', 'kit']) vm.runInNewContext(fs.readFileSync(`site/data/${f}.js`, 'utf8'), ctx);
const host = u => new URL(u).hostname.replace(/^(www|zh|cn|app|library|next-gen)\./, '');
const key = u => { const x = new URL(u); return host(u) + x.pathname.replace(/\/$/, ''); };

const all = ctx.NAV.flatMap(c => c.s.map(s => ({ c: c.id, name: s[0], url: s[1] })));
const seen = new Map();
for (const s of all) {
  const k = key(s.url);
  if (seen.has(k)) console.log('DUP', s.name, seen.get(k).name, s.url);
  seen.set(k, s);
}
const hosts = new Set(all.map(s => host(s.url)));
const src = [...JSON.parse(fs.readFileSync('raw/ablesci.json')), ...JSON.parse(fs.readFileSync('raw/bm_sel.json'))];
for (const s of src) if (!hosts.has(host(s.url))) console.log('MISSING', s.name, s.url);
console.log(`categories=${ctx.NAV.length} sites=${all.length}`);
