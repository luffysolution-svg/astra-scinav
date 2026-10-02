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
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as status from './status.mjs';
import * as news from './sync_news.mjs';
import * as journalCovers from './sync_news_journal_covers.mjs';

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
const fSrc = new Set(figs.sources.map(s => s.id)), figSrc = new Map(figs.sources.map(s => [s.id, s]));
for (const s of figs.sources) if (!s.license) err(`绘图来源 ${s.id} 未标注协议`);
const items = figs.categories.flatMap(c => c.items.map(x => ({ ...x, cat: c.id })));
unique(items.map(x => x.id), '绘图模板 id');
for (const x of items) {
  if (!x.id || !ID.test(x.id) || !x.id.startsWith(x.cat + '-')) err(`绘图模板 id 不合法：${x.id}（${x.t}）`);
  if (!fSrc.has(x.src)) err(`绘图模板 ${x.id}：来源 ${x.src} 不在 sources 列表中`);
  if (x.code && !x.lang) err(`绘图模板 ${x.id}：有代码但缺少 lang`);
  // 子分类：分类声明了 subs 时每条都必须属于其中之一，否则页面不会显示
  const subs = figs.categories.find(c => c.id === x.cat).subs;
  if (subs ? !subs.some(s => s.id === x.sub) : x.sub) err(`绘图模板 ${x.id}：子分类 ${x.sub ?? '缺失'} 不在分类 ${x.cat} 的 subs 中`);
  // 生图提示词：必须有 prompt，不用 code 冒充；来源必须有可核验的再分发授权依据
  const s = figSrc.get(x.src);
  if (s?.listOnly) err(`绘图模板 ${x.id}：来源 ${x.src} 未获再分发授权（listOnly），只能列出链接，不能收录条目`);
  if (x.type === 'prompt') {
    if (!x.prompt?.trim()) err(`绘图模板 ${x.id}：type 为 prompt 但缺少 prompt`);
    if (x.code) err(`绘图模板 ${x.id}：Prompt 条目不应带 code，提示词写在 prompt 字段`);
    if (s && !s.licenseUrl && !s.licenseNote) err(`Prompt 条目 ${x.id}：来源 ${x.src} 缺少授权依据（licenseUrl 或 licenseNote）`);
    if (x.tags && !(Array.isArray(x.tags) && x.tags.every(t => typeof t === 'string' && t))) err(`Prompt 条目 ${x.id}：tags 必须是字符串数组`);
    if (x.aspect && !/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(x.aspect)) err(`Prompt 条目 ${x.id}：aspect 应写成 16:9 这样的比例`);
  } else if (x.prompt) err(`绘图模板 ${x.id}：只有 type 为 prompt 的条目才有 prompt 字段`);
  if (!x.w) warn(`绘图模板 ${x.id} 还没有缩略图，不会上线；请运行 node scripts/sync_figures.mjs`);
  else if (!fs.existsSync(`site/${x.thumb}`)) err(`缩略图缺失：site/${x.thumb}`);
}
const promptItems = items.filter(x => x.type === 'prompt');
const squash = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
unique(promptItems.map(x => squash(x.t)), 'Prompt 条目标题');
unique(promptItems.map(x => squash(x.prompt)), 'Prompt 条目提示词');
unique(promptItems.map(x => x.img).filter(Boolean), 'Prompt 条目图片');
// 原图链接不同但内容相同的，看缩略图文件哈希
unique(promptItems.filter(x => x.w && fs.existsSync(`site/${x.thumb}`)).map(x => crypto.createHash('sha1').update(fs.readFileSync(`site/${x.thumb}`)).digest('hex')), 'Prompt 条目缩略图内容');
unique(figs.journals.map(j => j.j), '期刊规范');
for (const j of figs.journals) if (!j.url) err(`期刊 ${j.j} 缺少链接`);
for (const p of figs.palettes) for (const c of p.c) if (!/^#[0-9a-f]{6}$/i.test(c)) err(`配色 ${p.name} 色值不合法：${c}`);

/* ---------- 学术前沿 ---------- */
const nCfg = json('content/news-sources.json');
const nData = fs.existsSync('content/news.json') ? json('content/news.json') : null;
if (JSON.stringify(nCfg.categories.map(c => c.id)) !== JSON.stringify(news.CATEGORY_IDS)) err(`学术前沿分类必须是固定的 ${news.CATEGORY_IDS.join('、')}（顺序一致）`);
unique(nCfg.sources.map(s => s.id), '学术前沿来源 id');
for (const s of nCfg.sources) {
  const w = `学术前沿来源 ${s.id}`;
  if (!ID.test(s.id || '')) err(`${w}：id 不合法`);
  if (!s.name) err(`${w}：缺少 name`);
  if (!news.CATEGORY_IDS.includes(s.category)) err(`${w}：未知分类 ${s.category}`);
  if (!news.APIS.includes(s.api)) err(`${w}：未知 api ${s.api}`);
  checkUrl(s.site, `${w}.site`);
  if (s.feed) checkUrl(s.feed, `${w}.feed`);
  if (s.enabled === false && !s.note) err(`${w}：已禁用但没有在 note 写明原因`);
  if (s.enabled === false) continue;
  if (s.api === 'rss' && !s.feed) err(`${w}：api 为 rss 但缺少 feed`);
  if (s.api === 'crossref' && !s.issn && !s.prefix) err(`${w}：api 为 crossref 但缺少 issn 或 prefix`);
  if (s.issn && !/^\d{4}-\d{3}[\dX]$/.test(s.issn)) err(`${w}：ISSN 格式不对 ${s.issn}`);
  if (s.api === 'arxiv' && !s.query) err(`${w}：api 为 arxiv 但缺少 query`);
}
unique(nCfg.sources.filter(s => s.enabled !== false && !s.prefix).map(s => s.name), '学术前沿启用来源名称（文章按期刊名归属来源）');
if (!nData) err('缺少 content/news.json，请运行 node scripts/sync_news.mjs');
else {
  if (nData.generated !== null && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(nData.generated)) err(`news.json generated 格式不对：${nData.generated}`);
  if (nData.fetchedAt !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(nData.fetchedAt)) err(`news.json fetchedAt 格式不对：${nData.fetchedAt}`);
  unique(nData.articles.map(a => a.id), '学术前沿文章 id');
  const fields = JSON.stringify(news.FIELDS);
  for (const a of nData.articles) {
    const w = `学术前沿文章 ${a.id}（${String(a.title).slice(0, 30)}）`;
    // 只允许约定的字段，字段顺序固定
    if (JSON.stringify(Object.keys(a)) !== fields) { err(`${w}：字段必须恰好是 ${news.FIELDS.join(', ')}，实际为 ${Object.keys(a).join(', ')}`); continue; }
    if (!/^n[0-9a-f]{12}$/.test(a.id) || a.id !== news.makeId(a)) err(`${w}：id 与 DOI / 链接推算的不一致`);
    if (typeof a.title !== 'string' || !a.title.trim() || /<[a-z/][^>]*>/i.test(a.title)) err(`${w}：标题为空或含 HTML`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date) || (t => Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== a.date)(Date.parse(a.date + 'T00:00:00Z'))) err(`${w}：日期不合法 ${a.date}`);
    if (a.doi !== null && (typeof a.doi !== 'string' || !/^10\.\d{4,9}\/\S+$/.test(a.doi) || a.doi !== a.doi.toLowerCase())) err(`${w}：DOI 格式不对 ${a.doi}（只存小写的 10.xxxx/…，不带 doi.org 前缀）`);
    checkUrl(a.url, `${w}.url`);
    if (!news.CATEGORY_IDS.includes(a.category)) err(`${w}：未知分类 ${a.category}`);
    if (!news.SOURCE_TYPES.includes(a.source)) err(`${w}：未知 source ${a.source}`);
    const s = news.owner(nCfg.sources, a);
    if (!s) err(`${w}：期刊 ${a.journal} 不属于任何来源`);
    else if (s.category !== a.category) err(`${w}：分类 ${a.category} 与来源 ${s.id} 的分类 ${s.category} 不一致`);
    // 封面：只能是已下载的本地 WebP（页面 CSP 不允许外链图片）
    if (a.image !== null && (typeof a.image !== 'string' || !/^news\/n[0-9a-f]{12}\.webp$/.test(a.image) || !fs.existsSync(`site/${a.image}`))) err(`${w}：image 必须是已存在的本地 WebP（news/<id>.webp）`);
    if (a.abstract !== null && (typeof a.abstract !== 'string' || a.abstract.length < 60 || a.abstract.length > 4001 || /<[a-z/][^>]*>/i.test(a.abstract))) err(`${w}：摘要必须是 60–4000 字的纯文本`);
  }
  same('site/data/news.js', news.render(nCfg, nData));
  for (const category of news.CATEGORY_IDS) same(`site/data/news-abstracts/${category}.json`, news.renderAbstracts(nData, category));
  const covers = new Set(nData.articles.map(a => a.image).filter(Boolean));
  if (fs.existsSync('site/news')) for (const f of fs.readdirSync('site/news')) if (!covers.has(`news/${f}`)) warn(`多余的封面文件 site/news/${f}（运行 sync_news.mjs --offline 清理）`);
}

const jCovers = json('content/news-journal-covers.json');
unique(jCovers.covers.map(c => c.journal), '期刊封面名称');
for (const c of jCovers.covers) {
  const w = `期刊封面 ${c.journal}`;
  if (!nCfg.sources.some(s => s.enabled !== false && s.name === c.journal)) err(`${w}：未知期刊`);
  checkUrl(c.source, `${w}.source`);
  checkUrl(c.imageUrl, `${w}.imageUrl`);
  if (!['issue', 'art'].includes(c.kind)) err(`${w}：kind 必须是 issue 或 art`);
  if (!c.label) err(`${w}：缺少封面说明`);
  if (!/^news-journals\/[a-z0-9-]+\.webp$/.test(c.image || '') || !fs.existsSync(`site/${c.image}`)) err(`${w}：image 必须是已存在的本地 WebP`);
}
same('site/data/news-journal-covers.js', journalCovers.render(jCovers));

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

// 验证自动同步的静态提交路径，防止抓取成功却因遗留文件名无法提交。
for (const file of fs.readdirSync('.github/workflows').filter(f => f.endsWith('.yml'))) {
  const text = read(`.github/workflows/${file}`);
  for (const m of text.matchAll(/^\s*git add -A -- (.+)$/gm)) {
    try { execFileSync('git', ['add', '--dry-run', '-A', '--', ...m[1].trim().split(/\s+/)], { stdio: 'pipe' }); }
    catch { err(`工作流 ${file} 的 git add 路径不可用：${m[1]}`); }
  }
}

/* ---------- 输出 ---------- */
if (warns.length) console.log(`\n警告 ${warns.length}：\n  ${warns.join('\n  ')}`);
if (errors.length) console.log(`\n错误 ${errors.length}：\n  ${errors.join('\n  ')}`);
const n = NAV.reduce((s, c) => s + c.s.length, 0);
console.log(`\nnav ${n} · skills ${repos.length} · prompts ${allPrompts.length} · figures ${items.length} · news ${nData?.articles.length ?? 0} · 错误 ${errors.length} · 警告 ${warns.length}`);
process.exit(errors.length ? 1 : 0);
