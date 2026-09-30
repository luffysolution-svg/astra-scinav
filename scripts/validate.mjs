// 数据校验（不联网）：node scripts/validate.mjs
// 提交前与 GitHub Actions 中运行；有错误时退出码为 1，警告只提示不阻止。
//   1. 所有链接字段必须是单个合法的 http(s) 地址（不能混入说明文字或多个地址）
//   2. 各类 id 唯一且格式合法
//   3. 来源、分类引用存在；缩略图与图标文件存在
//   4. 协议：摘录了正文的 Prompt 来源必须有允许再分发的协议；Skill 仓库未声明协议时警告
//   5. 生成文件 site/data/{skills,prompts,figures,status}.js 与 content/*.json 一致；每个条目都有新增日期
// 外链是否可访问另用 node scripts/linkcheck.mjs --content --sample 80 分批抽查。
import fs from 'node:fs';
import vm from 'node:vm';
import * as status from './status.mjs';

const errors = [], warns = [];
const err = m => errors.push(m), warn = m => warns.push(m);
const read = f => fs.readFileSync(f, 'utf8');
const json = f => JSON.parse(read(f));

/* ---------- 1. 链接字段 ---------- */
function checkUrl(u, where) {
  if (typeof u !== 'string') return err(`${where}：链接不是字符串`);
  // 全角标点、中文、空白说明链接里混进了备注，或拼接了两个地址
  if (/[\s　-〿一-鿿＀-￯]/.test(u) || (u.match(/https?:\/\//g) || []).length > (u.startsWith('https://web.archive.org/web/') ? 2 : 1)) return err(`${where}：链接混入了其他文字 ${u}`);
  try {
    if (!/^https?:$/.test(new URL(u).protocol)) err(`${where}：只允许 http(s) 链接 ${u}`);
  } catch { err(`${where}：不是合法链接 ${u}`); }
}
// 递归检查 JSON 中所有名为 url / img / dl 或以 Url 结尾的字段
function walkUrls(o, path) {
  if (Array.isArray(o)) return o.forEach((x, i) => walkUrls(x, `${path}[${i}]`));
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (/^(url|img|dl)$|Url$/.test(k) && v != null) checkUrl(v, `${path}.${k}`);
    else walkUrls(v, `${path}.${k}`);
  }
}

/* ---------- 工具 ---------- */
function unique(list, what) {
  const seen = new Set();
  for (const x of list) { if (seen.has(x)) err(`${what} 重复：${x}`); seen.add(x); }
}
const ID = /^[a-z0-9][a-z0-9-]*$/;
const runData = (files, init = {}) => {
  const ctx = { window: {}, Set, ...init };
  Object.assign(ctx.window, init);
  for (const f of files) vm.runInNewContext(read(f), ctx);
  return { ...ctx, ...ctx.window };
};

/* ---------- 主导航 ---------- */
const navCtx = runData(['ai', 'lit', 'lab', 'kit'].map(f => `site/data/${f}.js`), { NAV: [] });
const NAV = navCtx.NAV;
unique(NAV.map(c => c.id), '主导航分类 id');
for (const c of NAV) for (const s of c.s) {
  checkUrl(s[1], `site/data/${c.sec}.js ${c.id} ${s[0]}`);
  if (s[3] && !['vpn', 'campus'].includes(s[3])) err(`${c.id} ${s[0]}：未知标记 ${s[3]}`);
  if (!s[2]) warn(`${c.id} ${s[0]}：缺少简介`);
}
const icons = runData(['site/data/icons.js']).ICONS;
for (const h of icons) if (!fs.existsSync(`site/icons/${h}.png`)) err(`图标文件缺失：site/icons/${h}.png`);

/* ---------- Skills ---------- */
const skills = json('content/skills.json');
walkUrls(skills, 'skills');
unique(skills.categories.map(c => c.id), 'Skill 分类 id');
const repos = skills.categories.flatMap(c => c.repos);
unique(repos.map(r => r.repo), 'Skill 仓库');
for (const r of repos) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(r.repo)) err(`Skill 仓库名格式不对：${r.repo}`);
  if (!r.license) warn(`Skill 仓库未声明协议（页面只展示简介与链接）：${r.repo}`);
  unique((r.skills || []).map(s => s.path), `${r.repo} 的 Skill 路径`);
  for (const s of r.skills || []) if (!s.path || /^\/|\.\./.test(s.path)) err(`${r.repo} Skill 路径不合法：${s.path}`);
}

/* ---------- Prompts ---------- */
const prompts = json('content/prompts.json');
walkUrls(prompts, 'prompts');
unique(prompts.categories.map(c => c.id), 'Prompt 分类 id');
unique(prompts.repos.map(r => r.repo), 'Prompt 来源仓库');
const pRepos = new Map(prompts.repos.map(r => [r.repo, r]));
const allPrompts = prompts.categories.flatMap(c => c.prompts.map(p => ({ ...p, cat: c.id })));
unique(allPrompts.map(p => p.id).filter(Boolean), 'Prompt id');
const usedRepos = new Set();
for (const p of allPrompts) {
  if (!p.id) err(`Prompt「${p.t}」缺少 id，请运行 node scripts/sync_collections.mjs --offline`);
  else if (!p.id.startsWith(p.cat + '-')) err(`Prompt id ${p.id} 与分类 ${p.cat} 不符`);
  if (!['zh', 'en'].includes(p.lang)) err(`Prompt ${p.id}：lang 只能是 zh / en`);
  if (!p.p?.trim()) err(`Prompt ${p.id}：正文为空`);
  const r = pRepos.get(p.src);
  if (!r) { err(`Prompt ${p.id}：来源 ${p.src} 不在 repos 列表中`); continue; }
  usedRepos.add(p.src);
}
// 摘录了正文的来源必须声明允许再分发的协议；NC/ND 或未声明协议的只能列出链接
for (const repo of usedRepos) {
  const r = pRepos.get(repo), lic = r.licenseNote || r.license;
  if (!lic || lic === '其他协议') err(`Prompt 来源 ${repo} 协议未确认（${lic || '未声明'}），不能摘录正文；核实后在 licenseNote 注明`);
  else if (/\bN[CD]\b|NC-|-ND/.test(lic)) err(`Prompt 来源 ${repo} 为 ${lic}，不允许再分发正文`);
}
for (const r of prompts.repos) if (!usedRepos.has(r.repo) && !r.license && !r.licenseNote) warn(`Prompt 来源未声明协议（仅列出链接）：${r.repo}`);

/* ---------- Figures ---------- */
const figs = json('content/figures.json');
walkUrls(figs, 'figures');
unique(figs.categories.map(c => c.id), '绘图分类 id');
unique(figs.sources.map(s => s.id), '绘图来源 id');
const fSrc = new Set(figs.sources.map(s => s.id));
for (const s of figs.sources) if (!s.license) err(`绘图来源 ${s.id} 未标注协议`);
const items = figs.categories.flatMap(c => c.items.map(x => ({ ...x, cat: c.id })));
unique(items.map(x => x.id), '绘图模板 id');
for (const x of items) {
  if (!x.id || !ID.test(x.id) || !x.id.startsWith(x.cat + '-')) err(`绘图模板 id 不合法：${x.id}（${x.t}）`);
  if (!fSrc.has(x.src)) err(`绘图模板 ${x.id}：来源 ${x.src} 不在 sources 列表中`);
  if (x.code && !x.lang) err(`绘图模板 ${x.id}：有代码但缺少 lang`);
  if (!x.w) warn(`绘图模板 ${x.id} 还没有缩略图，不会上线；请运行 node scripts/sync_figures.mjs`);
  else if (!fs.existsSync(`site/${x.thumb}`)) err(`缩略图缺失：site/${x.thumb}`);
}
unique(figs.journals.map(j => j.j), '期刊规范');
for (const j of figs.journals) if (!j.url) err(`期刊 ${j.j} 缺少链接`);
for (const p of figs.palettes) for (const c of p.c) if (!/^#[0-9a-f]{6}$/i.test(c)) err(`配色 ${p.name} 色值不合法：${c}`);

/* ---------- 5. 生成文件与源数据一致 ---------- */
function same(file, expected) {
  if (!fs.existsSync(file)) return err(`生成文件缺失：${file}`);
  // Windows 下 git 可能把换行转成 CRLF，比较前统一成 LF
  if (read(file).replace(/\r\n/g, '\n') !== expected) err(`${file} 与 content/*.json 不一致，请运行对应同步脚本（可加 --offline）`);
}
same('site/data/skills.js', `// 自动生成：scripts/sync_collections.mjs，请编辑 content/skills.json\nwindow.SKILLS = ${JSON.stringify(skills)};\n`);
same('site/data/prompts.js', `// 自动生成：scripts/sync_collections.mjs，请编辑 content/prompts.json\nwindow.PROMPTS = ${JSON.stringify(prompts)};\n`);
const pub = { ...figs, categories: figs.categories.map(c => ({ ...c, items: c.items.filter(x => x.w).map(({ img, ...x }) => x) })) };
same('site/data/figures.js', `// 自动生成：scripts/sync_figures.mjs，请编辑 content/figures.json\nwindow.FIGURES = ${JSON.stringify(pub)};\n`);
const st = status.load();
if (!st) err('缺少 content/status.json，请运行 node scripts/status.mjs');
else {
  const want = status.sync(st);
  if (JSON.stringify(Object.keys(want)) !== JSON.stringify(Object.keys(st))) err('content/status.json 与当前条目不一致（有新增或删除），请运行 node scripts/status.mjs');
  for (const [k, v] of Object.entries(st)) if (!/^\d{4}-\d{2}-\d{2}$/.test(v.added)) err(`status ${k} 新增日期不合法：${v.added}`);
  same('site/data/status.js', status.render(st));
}

/* ---------- 离线缓存清单里的文件都存在 ---------- */
const shell = read('site/sw.js').match(/const SHELL = \[([^\]]+)\]/)[1].match(/'([^']+)'/g).map(s => s.slice(1, -1));
for (const f of shell) if (f !== './' && !fs.existsSync(`site/${f}`)) err(`sw.js 离线清单中的文件不存在：${f}`);

/* ---------- 输出 ---------- */
if (warns.length) console.log(`\n警告 ${warns.length}：\n  ${warns.join('\n  ')}`);
if (errors.length) console.log(`\n错误 ${errors.length}：\n  ${errors.join('\n  ')}`);
const n = NAV.reduce((s, c) => s + c.s.length, 0);
console.log(`\nnav ${n} · skills ${repos.length} · prompts ${allPrompts.length} · figures ${items.length} · 错误 ${errors.length} · 警告 ${warns.length}`);
process.exit(errors.length ? 1 : 0);
