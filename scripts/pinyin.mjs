// 生成站名拼音索引（全拼 + 首字母），供站内搜索匹配。新增站点后重新运行：node scripts/pinyin.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import { pinyin } from 'pinyin-pro';

const ctx = { window: {} };
ctx.NAV = ctx.window.NAV = [];
for (const f of ['ai', 'lit', 'lab', 'kit']) vm.runInNewContext(fs.readFileSync(`site/data/${f}.js`, 'utf8'), ctx);

const map = {};
for (const c of ctx.NAV) for (const [name] of c.s) {
  const han = name.match(/\p{Script=Han}+/gu);
  if (!han || map[name]) continue;
  const syl = pinyin(han.join(''), { toneType: 'none', type: 'array' });
  map[name] = `${syl.join('')} ${syl.map(s => s[0]).join('')}`;
}
fs.writeFileSync('site/data/pinyin.js',
  `// 自动生成：scripts/pinyin.mjs\nwindow.PINYIN = ${JSON.stringify(map)};\n`);
console.log(`pinyin entries=${Object.keys(map).length}`);
