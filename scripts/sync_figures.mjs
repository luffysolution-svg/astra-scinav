// 科研绘图模板数据同步
//   node scripts/sync_figures.mjs            下载缺失的预览图，转成 webp 缩略图存到 site/figures/，并生成 site/data/figures.js
//   node scripts/sync_figures.mjs --force    重新下载全部预览图
//   node scripts/sync_figures.mjs --offline  不联网，只由 content/figures.json 生成 site/data/figures.js
// 内容以 content/figures.json 为准；需要本机装有 ffmpeg / ffprobe（用于压缩成 webp）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const offline = args.has('--offline'), force = args.has('--force');
const MAX_W = 960;   // 缩略图最大宽度，卡片与大图预览共用
const data = JSON.parse(fs.readFileSync('content/figures.json', 'utf8'));
fs.mkdirSync('site/figures', { recursive: true });

// 每条模板有稳定 id（分类 id-序号），用于缩略图文件名、分享链接与收藏；新增条目自动续号，已有 id 不变
let idsAdded = 0;
for (const c of data.categories) {
  let n = Math.max(0, ...c.items.map(x => +(x.id || '').slice(c.id.length + 1) || 0));
  for (const x of c.items) if (!x.id) { x.id = `${c.id}-${++n}`; idsAdded++; }
}
if (idsAdded) console.log(`新增 ${idsAdded} 个模板 id`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-fig-'));
const size = f => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', f], { encoding: 'utf8' })
  .trim().split(',').map(Number);
let got = 0, failed = 0;
for (const c of data.categories) for (const x of c.items) {
  const out = `site/figures/${x.id}.webp`;
  x.thumb = `figures/${x.id}.webp`;
  if (offline || (!force && fs.existsSync(out) && x.w)) continue;
  try {
    const r = await fetch(x.img, { headers: { 'user-agent': 'Mozilla/5.0 (astra-sync)', referer: x.url }, signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(r.status);
    const type = r.headers.get('content-type') || '';
    if (!/^image\/(png|jpeg|gif|webp)/.test(type)) throw new Error(`不是位图：${type}`);
    const src = path.join(tmp, x.id);
    fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
    // gif 只取第一帧；小图不放大；保留透明通道（否则透明底会变黑），由页面的浅色画框垫底
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-frames:v', '1', '-vf', `scale='min(${MAX_W},iw)':-2,format=rgba`, '-c:v', 'libwebp', '-pix_fmt', 'yuva420p', '-quality', '82', out]);
    [x.w, x.h] = size(out);
    got++;
  } catch (e) {
    failed++;
    console.warn(`预览图失败 ${x.id}（${x.t}）：${e.message}`);
  }
}
fs.rmSync(tmp, { recursive: true, force: true });

// 删掉已不在数据里的缩略图
const keep = new Set(data.categories.flatMap(c => c.items.map(x => `${x.id}.webp`)));
for (const f of fs.readdirSync('site/figures')) if (!keep.has(f)) fs.rmSync(`site/figures/${f}`);

if (!offline) data.generated = new Date().toISOString().slice(0, 10);
fs.writeFileSync('content/figures.json', JSON.stringify(data, null, 2) + '\n');
// 页面不需要原图直链，只保留缩略图
const pub = { ...data, categories: data.categories.map(c => ({ ...c, items: c.items.filter(x => x.w).map(({ img, ...x }) => x) })) };
fs.writeFileSync('site/data/figures.js', `// 自动生成：scripts/sync_figures.mjs，请编辑 content/figures.json\nwindow.FIGURES = ${JSON.stringify(pub)};\n`);
const n = pub.categories.reduce((s, c) => s + c.items.length, 0);
console.log(`\nfigures: ${pub.categories.length} 类 ${n} 个模板 · 本次下载 ${got}${failed ? ` · 失败 ${failed}（未上线）` : ''}`);
