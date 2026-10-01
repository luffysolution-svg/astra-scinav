// 学术前沿：聚合期刊官方 RSS/Atom、Crossref 与预印本官方 API 的最新论文元数据
//   node scripts/sync_news.mjs            联网同步，更新 content/news.json 并生成 site/data/news.js
//   node scripts/sync_news.mjs --offline  不联网，只由 content/news.json 重建 site/data/news.js 与 news-abstracts/*.json
//   node scripts/sync_news.mjs --backfill 联网同步，并为所有文章重试摘要/封面（默认补新文章，并每天重试旧文章缺失的摘要）
// 来源配置在 content/news-sources.json（人工维护）；每条保存标题、日期、期刊、DOI、原文链接、摘要与封面。
// 数据源优先级：官方 RSS/Atom → Crossref（按 ISSN，或按 DOI 前缀）→ 预印本官方 API。
// 配置了 feed 又有 issn 的来源，Feed 请求失败时自动改用 Crossref。
// 摘要：Feed 自带 → Crossref 存档摘要 → Europe PMC → 允许抓取的落地页 meta（nature.com）。
// 封面：Feed 里的 media:content / enclosure / 正文首图 → 落地页 og:image；下载后用 ffmpeg 转成本地小 WebP（site/news/），页面不外链图片。
// 不伪装浏览器、不用无头浏览器或第三方代理绕过 Cloudflare；被拦截的主机本次跳过。
// 单个来源失败只打印错误；全部失败时不改动现有数据并以退出码 1 结束。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const MAX_DAYS = 30;      // 只保留最近 30 天
const PER_SOURCE = 50;    // 每个来源最多保留 50 条
const CONCURRENCY = 4;    // 同时处理的来源数；同一主机的请求始终串行并留间隔
const ABS_MAX = 4000;     // 摘要最长字符数
const IMG_W = 360;        // 封面缩略图宽度（卡片 + 阅读面板共用）
const UA = 'Astra-news-sync/1.0 (Astra academic feed aggregator; +https://nav.luffysite.top)';
// 各主机两次请求的最小间隔（毫秒）：arXiv 要求 3 秒一次；Crossref 公共池限 1 次/秒、并发 1
const GAP = { 'export.arxiv.org': 3100, 'api.crossref.org': 1100, 'api.biorxiv.org': 1000, 'www.ebi.ac.uk': 300, 'www.nature.com': 800, 'www.cell.com': 1500, 'www.thelancet.com': 1500 };
// 可以抓落地页 meta 补摘要/封面的主机（未被 Cloudflare 拦截，robots.txt 允许 /articles/）
const LANDING = /^www\.nature\.com$/;

const SRC_FILE = 'content/news-sources.json', FILE = 'content/news.json', OUT = 'site/data/news.js', ABS_DIR = 'site/data/news-abstracts', IMG_DIR = 'site/news';
export const CATEGORY_IDS = ['nature', 'science', 'cell', 'medical', 'multidisciplinary', 'ecology', 'chem-materials', 'physics', 'preprints'];
export const FIELDS = ['id', 'title', 'date', 'journal', 'doi', 'image', 'abstract', 'url', 'category', 'source'];
export const SOURCE_TYPES = ['rss', 'atom', 'crossref', 'arxiv', 'biorxiv', 'medrxiv'];
export const APIS = ['rss', 'crossref', 'arxiv', 'biorxiv', 'medrxiv', 'chemrxiv'];

/* ---------- 规范化 ---------- */
export function normDoi(s) {
  const m = String(s || '').match(/10\.\d{4,9}\/[^\s"'<>?#&]+/);
  if (!m) return null;
  let d = m[0].replace(/[.,;]+$/, '');
  // Lancet 等 DOI 自带括号，只去掉不成对的结尾括号
  while (d.endsWith(')') && (d.match(/\(/g) || []).length < (d.match(/\)/g) || []).length) d = d.slice(0, -1);
  return d.toLowerCase();
}
const TRACKING = /^(af|rss|dgcid|utm_\w+|ref|src)$/i;
export function normUrl(u) {
  const x = new URL(u);
  x.protocol = 'https:';
  x.hash = '';
  for (const k of [...x.searchParams.keys()]) if (TRACKING.test(k)) x.searchParams.delete(k);
  return x.href;
}
// 去重用的键：主机名去掉 www.、结尾斜杠
const urlKey = u => { const x = new URL(normUrl(u)); return x.host.replace(/^www\./, '') + x.pathname.replace(/\/$/, '') + x.search; };
const titleKey = t => t.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');
// 稳定 id：优先由 DOI 生成，无 DOI 时由规范化原文链接生成
export const makeId = a => 'n' + crypto.createHash('sha1').update(a.doi ? 'doi:' + a.doi : 'url:' + urlKey(a.url)).digest('hex').slice(0, 12);
// 文章归属的来源：按 DOI 前缀查询的来源（Annual Reviews）看 DOI，其余看期刊名
export const owner = (sources, a) => sources.find(s => s.prefix ? a.doi?.startsWith(s.prefix.toLowerCase() + '/') : s.name === a.journal);

const decode = s => s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => e[0] === '#'
  ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1))
  : { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[e.toLowerCase()]);
// XML 节点内容 → 纯文本：去 CDATA、实体与 HTML/MathML 标签
function plain(raw) {
  const cdata = raw.includes('<![CDATA[');
  let s = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  if (!cdata) s = decode(s);
  s = s.replace(/<[^>]+>/g, '');
  return (cdata ? decode(s) : s).replace(/\s+/g, ' ').trim();
}
const tag = (x, name) => (x.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`)) || [])[1] ?? null;
const day = ms => new Date(ms).toISOString().slice(0, 10);
const ymd = v => { const t = Date.parse(v); return Number.isNaN(t) ? null : day(t); };
// Crossref 的 date-parts：只接受年月日齐全的
const parts = d => { const p = d?.['date-parts']?.[0]; return p?.length === 3 ? `${p[0]}-${String(p[1]).padStart(2, '0')}-${String(p[2]).padStart(2, '0')}` : null; };
// 期刊目录里常见的非论文条目
const JUNK = /^(issue information|(cover image|cover picture|front cover|back cover|inside (front|back) cover)( and issue information)?|(issue )?(editorial )?masthead|issue publication information|table of contents|graphical abstract|contents?( list| continued)?|editorial board|advisory board and contents|subscription and copyright information|in this issue|in other journals|in science journals|department of error)$/i;

/* ---------- 摘要与封面 ---------- */
// Feed 描述里常见的非摘要内容：刊名卷期页码、在线发表说明、作者列表、EarlyView 标记
const BOILER = /^(author\(s\):|\[?[\w.&' -]+ \d+, \d+\]? published|[^.]{0,80}\b(published online|earlyview|ahead of print)\b|[^.]{0,120}\bvolume \d+, issue \d+|\[?(phys\. rev\.|rev\. mod\.)[^\]]*\]|doi:\s*10\.)/i;
function clip(s) {
  s = s.replace(/^(abstract|summary)\s*[:.]?\s*/i, '').trim();
  if (s.length <= ABS_MAX) return s;
  const cut = s.slice(0, ABS_MAX), end = cut.lastIndexOf('. ');
  return (end > ABS_MAX * 0.6 ? cut.slice(0, end + 1) : cut) + '…';
}
// HTML 片段 → 按段落拆开 → 去掉非摘要段 → 合并成纯文本；太短（少于 60 字符）视为没有摘要
function cleanAbstract(raw) {
  if (!raw) return null;
  let html = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  if (!/<[a-z]/i.test(html)) html = decode(html);   // 实体转义过的 HTML
  const blocks = html.split(/<\/?(?:p|br|div|jats:p|jats:sec)\b[^>]*>/i)
    .map(b => decode(b.replace(/<(jats:)?title\b[^>]*>[\s\S]*?<\/(jats:)?title>/gi, '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  // PLOS 首段是「by 作者1, 作者2…」
  if (/^by [^.]{3,}(, [^,]+){1,}$/.test(blocks[0] || '') && blocks.length > 1) blocks.shift();
  let s = blocks.filter(b => !BOILER.test(b)).join(' ').trim();
  // Wiley 的 dc:description 先是目录摘要，再是「ABSTRACT 正式摘要」
  const k = s.search(/\bABSTRACT\b/);
  if (k > 0 && s.length - k > 200) s = s.slice(k);
  s = clip(s);
  return s.length >= 60 ? s : null;
}
// 同一条目的几个描述字段里取最长的有效摘要
function feedAbstract(x) {
  return ['dc:description', 'content:encoded', 'description', 'summary', 'content']
    .map(k => cleanAbstract(tag(x, k))).filter(Boolean).sort((a, b) => b.length - a.length)[0] || null;
}
const BAD_IMG = /logo|icon|avatar|spacer|pixel|badge|\.svg(\?|$)/i;
const absUrl = (u, base) => { try { const x = new URL(decode(u).replace(/^\/\//, 'https://'), base); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; } };
function feedImage(x, base) {
  const cands = [...x.matchAll(/<(?:media:content|media:thumbnail|enclosure)\b[^>]*\burl="([^"]+)"[^>]*>/g)]
    .filter(m => !/type="(?!image)/.test(m[0])).map(m => m[1]);
  const body = (tag(x, 'content:encoded') || tag(x, 'description') || tag(x, 'content') || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  for (const m of decode(body).matchAll(/<img\b[^>]*\bsrc=["']?([^"'\s>]+)/gi)) cands.push(m[1]);
  return cands.map(u => absUrl(u, base)).find(u => u && !BAD_IMG.test(u)) || null;
}

/* ---------- 请求：同一主机串行并留间隔；Nature 的 Feed 会先跳转到 idp.nature.com 设 Cookie，需要手动跟随跳转 ---------- */
const lanes = new Map(), jar = new Map();
const wait = ms => new Promise(ok => setTimeout(ok, ms));
function lane(host, fn) {
  const prev = lanes.get(host) || Promise.resolve();
  const run = prev.then(fn);
  lanes.set(host, run.catch(() => {}).then(() => wait(GAP[host] ?? 500)));
  return run;
}
const site = host => host.split('.').slice(-2).join('.');
async function request(url, accept, hops = 0) {
  const u = new URL(url);
  // 读完响应体才释放该主机，保证同一 API 同时只有一个请求
  const { r, text } = await lane(u.host, async () => {
    const r = await fetch(url, {
      redirect: 'manual', signal: AbortSignal.timeout(30000),
      headers: { 'user-agent': UA, accept, cookie: jar.get(site(u.host)) || '' },
    });
    const moved = r.status >= 300 && r.status < 400;
    if (moved) await r.body?.cancel();
    return { r, text: moved ? '' : await r.text() };
  });
  const set = r.headers.getSetCookie?.() || [];
  if (set.length) jar.set(site(u.host), [jar.get(site(u.host)), ...set.map(c => c.split(';')[0])].filter(Boolean).join('; '));
  if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
    if (hops > 8) throw new Error('跳转次数过多');
    return request(new URL(r.headers.get('location'), url).href, accept, hops + 1);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}${/Just a moment|cf-chl/i.test(text) ? '（Cloudflare 验证页）' : ''}`);
  return text;
}
// 网络层错误（超时、连接重置）与 429 限流重试一次；其他 HTTP 错误不重试
async function get(url, accept) {
  try { return await request(url, accept); }
  catch (e) {
    if (/^HTTP /.test(e.message) && !/^HTTP 429/.test(e.message)) throw e;
    await wait(/^HTTP 429/.test(e.message) ? 10000 : 3000);
    return request(url, accept);
  }
}
const getJson = async url => JSON.parse(await get(url, 'application/json'));

/* ---------- 各数据源适配：统一返回 { title, date, doi, url, journal, source } ---------- */
// 优先取字符串开头的日期本身，避免时区换算把日期挪一天
const feedDate = v => v && (/^\d{4}-\d{2}-\d{2}/.test(v.trim()) ? v.trim().slice(0, 10) : ymd(v.trim()));
function feedLink(x) {
  for (const m of x.matchAll(/<link\b([^>]*?)\/?>/g)) {
    const rel = (m[1].match(/rel="([^"]*)"/) || [])[1] || 'alternate', href = (m[1].match(/href="([^"]*)"/) || [])[1];
    if (href && rel === 'alternate') return decode(href);
  }
  return plain(tag(x, 'link') || tag(x, 'prism:url') || '') || null;
}
async function fromFeed(s) {
  const text = await get(s.feed, 'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, */*;q=0.1');
  const root = (text.match(/<(rss|feed|rdf:RDF)\b/) || [])[1];
  if (!root) throw new Error('返回内容不是 RSS/Atom');
  const source = root === 'feed' ? 'atom' : 'rss';
  return [...text.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/g)].map(([, , x]) => {
    const url = feedLink(x);
    const doi = normDoi(tag(x, 'prism:doi')) || normDoi(tag(x, 'dc:identifier')) || normDoi(tag(x, 'guid')) || normDoi(tag(x, 'id')) || normDoi(url) || normDoi(tag(x, 'dc:source'));
    const date = feedDate(tag(x, 'dc:date') || tag(x, 'prism:publicationDate') || tag(x, 'pubDate') || tag(x, 'pubdate') || tag(x, 'published') || tag(x, 'updated') || tag(x, 'prism:coverDate'));
    return { title: plain(tag(x, 'title') || tag(x, 'dc:title') || ''), date, doi, url, journal: s.name, source, abstract: feedAbstract(x), cover: feedImage(x, s.feed) };
  });
}
async function fromCrossref(s) {
  const from = day(Date.now() - MAX_DAYS * 864e5);
  const path = s.prefix ? `prefixes/${s.prefix}` : `journals/${s.issn}`;
  const q = new URLSearchParams({
    rows: String(PER_SOURCE * 2), sort: 'created', order: 'desc',
    filter: `from-created-date:${from},type:journal-article`,
    select: 'DOI,title,container-title,published-online,published-print,created,abstract',
  });
  const j = await getJson(`https://api.crossref.org/${path}/works?${q}`);
  return j.message.items.map(w => ({
    title: plain(w.title?.[0] || ''),
    // 首次在线发表日期；没有时用 DOI 注册日期（接近上线时间），不用可能是未来的纸刊日期
    date: parts(w['published-online']) || parts(w.created),
    doi: normDoi(w.DOI), url: `https://doi.org/${normDoi(w.DOI)}`,
    journal: s.prefix ? plain(w['container-title']?.[0] || s.name) : s.name, source: 'crossref',
    abstract: cleanAbstract(w.abstract), cover: null,
  }));
}
async function fromArxiv(s) {
  const q = new URLSearchParams({ search_query: s.query, sortBy: 'submittedDate', sortOrder: 'descending', max_results: String(PER_SOURCE) });
  const text = await get(`https://export.arxiv.org/api/query?${q}`, 'application/atom+xml');
  if (!/<feed\b/.test(text)) throw new Error('返回内容不是 Atom');
  return [...text.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, x]) => {
    const id = plain(tag(x, 'id') || '').replace(/^https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '');
    // 不用 arXiv 自身的 DataCite DOI，避免与期刊正式发表版本混淆
    return { title: plain(tag(x, 'title') || ''), date: feedDate(tag(x, 'published')), doi: null, url: `https://arxiv.org/abs/${id}`, journal: s.name, source: 'arxiv', abstract: cleanAbstract(tag(x, 'summary')), cover: null };
  });
}
// bioRxiv / medRxiv 按日期区间分页（从早到晚，每页 30 条）：先取总数，再取最后几页；只收 v1，日期即首次上线日期
async function fromRxiv(s) {
  const base = `https://api.biorxiv.org/details/${s.api}/${day(Date.now() - 3 * 864e5)}/${day(Date.now())}`;
  const first = await getJson(`${base}/0`);
  const m = first.messages?.[0];
  if (m?.status !== 'ok') return [];
  const total = +m.total, step = +m.count || 30;
  let rows = first.collection;
  if (total > step) {
    rows = [];
    for (let c = Math.max(0, total - step * 3); c < total; c += step) rows.push(...(await getJson(`${base}/${c}`)).collection);
  }
  return rows.filter(x => String(x.version) === '1').map(x => ({
    title: plain(x.title || ''), date: feedDate(x.date), doi: normDoi(x.doi), url: `https://doi.org/${normDoi(x.doi)}`,
    journal: s.name, source: s.api, abstract: cleanAbstract(x.abstract), cover: null,
  }));
}

// 标准化一个来源返回的列表：丢弃无标题/无日期/超出窗口的条目，统一字段顺序，按日期取最新 PER_SOURCE 条
const cutoff = () => day(Date.now() - MAX_DAYS * 864e5);
const tomorrow = () => day(Date.now() + 864e5);   // 各时区的 Feed 日期可能比 UTC 早一天
const byDate = (a, b) => b.date.localeCompare(a.date) || (a.journal < b.journal ? -1 : a.journal > b.journal ? 1 : 0) || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
function finish(list, s) {
  const out = [];
  for (const a of list) {
    if (!a.title || JUNK.test(a.title) || !a.date || a.date < cutoff() || a.date > tomorrow() || !a.url) continue;
    let url;
    try { url = normUrl(a.url); } catch { continue; }
    // image 是下载后的本地 WebP 路径；cover 是远程封面地址，只在同步过程中使用，不写入文件
    const x = { title: a.title, date: a.date, journal: a.journal, doi: a.doi || null, image: null, abstract: a.abstract || null, url, category: s.category, source: a.source };
    out.push({ id: makeId(x), ...x, cover: a.cover || null });
  }
  return out.sort(byDate).slice(0, PER_SOURCE);
}
async function fetchSource(s) {
  if (s.api === 'rss') {
    try { return { list: finish(await fromFeed(s), s), via: s.feed }; }
    catch (e) {
      if (!s.issn) throw e;
      console.warn(`  ${s.name}：Feed 失败（${e.message}），改用 Crossref ${s.issn}`);
      return { list: finish(await fromCrossref(s), s), via: `crossref ${s.issn}` };
    }
  }
  const fn = { crossref: fromCrossref, arxiv: fromArxiv, biorxiv: fromRxiv, medrxiv: fromRxiv }[s.api];
  if (!fn) throw new Error(`不支持的 api：${s.api}`);
  return { list: finish(await fn(s), s), via: endpoint(s) };
}
const endpoint = s => s.feed || (s.api === 'crossref' ? `https://api.crossref.org/${s.prefix ? 'prefixes/' + s.prefix : 'journals/' + s.issn}/works`
  : s.api === 'arxiv' ? `https://export.arxiv.org/api/query?search_query=${s.query}` : `https://api.biorxiv.org/details/${s.api}`);
async function pool(list, n, fn) {
  const out = new Array(list.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < list.length) { const k = i++; out[k] = await fn(list[k]); } }));
  return out;
}

/* ---------- 合并去重：DOI → 规范化原文链接 → 期刊 + 规范化标题 ---------- */
// 先放入的（本次抓到的）为准；同一论文保留最早的日期（首次在线发表），补上缺失的 DOI
function merge(...lists) {
  const keys = a => [a.doi && 'd:' + a.doi, 'u:' + urlKey(a.url), 't:' + a.journal + '|' + titleKey(a.title)].filter(Boolean);
  const seen = new Map(), out = [];
  for (const a of lists.flat()) {
    const hit = keys(a).map(k => seen.get(k)).find(Boolean);
    if (!hit) { const x = { ...a }; out.push(x); keys(x).forEach(k => seen.set(k, x)); continue; }
    if (a.date < hit.date) hit.date = a.date;
    if (!hit.doi && a.doi) hit.doi = a.doi;
    // 摘要取更长的（落地页或 Crossref 补到的完整摘要优先于 Feed 的简短导语）；已有的本地封面保留
    if ((a.abstract?.length || 0) > (hit.abstract?.length || 0)) hit.abstract = a.abstract;
    if (!hit.image && a.image) hit.image = a.image;
    if (!hit.cover && a.cover) hit.cover = a.cover;
    hit.id = makeId(hit);
    keys(hit).forEach(k => seen.set(k, hit));
  }
  return out;
}
// 只保留仍启用的来源的文章，分类以来源配置为准，每个来源最多 PER_SOURCE 条，整体确定性排序
export function build(sources, articles) {
  const groups = new Map();
  for (const a of articles) {
    const s = owner(sources, a);
    if (!s || s.enabled === false || a.date < cutoff() || JUNK.test(a.title)) continue;
    if (!groups.has(s.id)) groups.set(s.id, []);
    // 按固定字段顺序重建（兼容旧数据缺 abstract；丢掉同步过程中的 cover）
    groups.get(s.id).push(Object.fromEntries(FIELDS.map(k => [k, k === 'category' ? s.category : a[k] ?? null])));
  }
  return [...groups.values()].flatMap(g => g.sort(byDate).slice(0, PER_SOURCE)).sort(byDate);
}

/* ---------- 补摘要与封面：只处理缺的；默认只补本次新增的，--backfill 补全部 ---------- */
const blocked = new Map();   // 主机 → 被拒次数；连续 3 次 403/429 后本次不再请求
const allow = host => (blocked.get(host) || 0) < 3;
const note = (host, e) => { if (/HTTP (403|429)/.test(e.message)) blocked.set(host, (blocked.get(host) || 0) + 1); };
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const meta = (html, n) => decode((html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${n}["'][^>]*>`, 'i')) || [''])[0].match(/content=["']([^"']*)["']/)?.[1] || '');

async function enrich(list, todo) {
  const want = a => todo(a) && (!a.abstract || a.abstract.length < 400);
  // 1. Crossref：出版社存档的 JATS 摘要，按 DOI 批量查
  let n = 0;
  for (const g of chunk(list.filter(a => a.doi && !a.abstract && todo(a)), 20)) {
    try {
      const q = new URLSearchParams({ filter: g.map(a => 'doi:' + a.doi).join(','), rows: String(g.length), select: 'DOI,abstract' });
      for (const w of (await getJson(`https://api.crossref.org/works?${q}`)).message.items) {
        const a = g.find(x => x.doi === normDoi(w.DOI)), s = cleanAbstract(w.abstract);
        if (a && s) { a.abstract = s; n++; }
      }
    } catch (e) { console.warn(`  Crossref 摘要：${e.message}`); }
  }
  // 2. Europe PMC：生物医学论文（PubMed 收录后才有，新文章可能要等几天）
  let m = 0;
  for (const g of chunk(list.filter(a => a.doi && !a.abstract && todo(a)), 20)) {
    try {
      const q = new URLSearchParams({ query: g.map(a => `DOI:"${a.doi}"`).join(' OR '), resultType: 'core', format: 'json', pageSize: '50' });
      for (const r of (await getJson(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${q}`)).resultList.result) {
        const a = g.find(x => x.doi === r.doi?.toLowerCase()), s = cleanAbstract(r.abstractText);
        if (a && !a.abstract && s) { a.abstract = s; m++; }
      }
    } catch (e) { console.warn(`  Europe PMC 摘要：${e.message}`); }
  }
  // 3. 落地页 meta：Nature 系 Feed 只有一句导语，完整摘要在文章页的 dc.description；新闻类有 og:image
  let k = 0;
  const pages = list.filter(a => LANDING.test(new URL(a.url).host) && (want(a) || (!a.image && !a.cover && todo(a))));
  await pool(pages, 2, async a => {
    const host = new URL(a.url).host;
    if (!allow(host)) return;
    try {
      const html = await get(a.url, 'text/html');
      const s = cleanAbstract(meta(html, 'dc.description') || meta(html, 'citation_abstract') || meta(html, 'description'));
      if (s && s.length > (a.abstract?.length || 0)) a.abstract = s;
      const img = absUrl(meta(html, 'og:image'), a.url);
      if (!a.cover && img && !BAD_IMG.test(img)) a.cover = img;
      k++;
    } catch (e) { note(host, e); }
  });
  console.log(`补摘要：Crossref ${n} · Europe PMC ${m} · 落地页 ${k} 页${[...blocked].filter(([, c]) => c >= 3).map(([h]) => ` · ${h} 拒绝访问，已跳过`).join('')}`);
}

// 远程封面 → 本地 WebP（site/news/<id>.webp）；需要 ffmpeg，没有就跳过封面
async function covers(list) {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { console.warn('未找到 ffmpeg，跳过封面下载'); return; }
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-news-'));
  let got = 0, bad = 0;
  await pool(list.filter(a => a.cover && !(a.image && fs.existsSync(`site/${a.image}`))), 3, async a => {
    const host = new URL(a.cover).host;
    if (!allow(host)) return;
    try {
      const buf = await lane(host, async () => {
        const r = await fetch(a.cover, { headers: { 'user-agent': UA, accept: 'image/*' }, signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        if (!/^image\/(png|jpe?g|gif|webp)/.test(r.headers.get('content-type') || '')) throw new Error('不是位图');
        return Buffer.from(await r.arrayBuffer());
      });
      if (buf.length < 2000) throw new Error('图片过小');
      const src = path.join(tmp, a.id), out = `${IMG_DIR}/${a.id}.webp`;
      fs.writeFileSync(src, buf);
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-frames:v', '1', '-vf', `scale='min(${IMG_W},iw)':-2`, '-c:v', 'libwebp', '-quality', '72', out]);
      a.image = `news/${a.id}.webp`;
      got++;
    } catch (e) { note(host, e); bad++; }
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`封面：新下载 ${got}${bad ? ` · 失败 ${bad}` : ''}${[...blocked].filter(([, c]) => c >= 3).map(([h]) => ` · ${h} 拒绝访问`).join('')}`);
}

/* ---------- 输出 ---------- */
// content/news.json 每篇一行，便于看 diff
export const stringify = data => `{\n  "generated": ${JSON.stringify(data.generated)},\n${data.fetchedAt ? `  "fetchedAt": ${JSON.stringify(data.fetchedAt)},\n` : ''}  "articles": [${data.articles.length ? '\n' + data.articles.map(a => '    ' + JSON.stringify(a)).join(',\n') + '\n  ' : ''}]\n}\n`;
// 页面数据：来源配置（不含抓取参数）+ 文章快照
// 摘要体积大，按九个大分类拆到 data/news-abstracts/*.json；打开阅读面板只加载当前分类，搜索摘要才加载全部；列表只留 abstract: true/false
export const render = (cfg, data) => `// 自动生成：scripts/sync_news.mjs，请编辑 content/news-sources.json\nwindow.NEWS = ${JSON.stringify({
  generated: data.generated,
  fetchedAt: data.fetchedAt || null,
  abstractVersions: Object.fromEntries(cfg.categories.map(c => [c.id, crypto.createHash('sha256').update(renderAbstracts(data, c.id)).digest('hex').slice(0, 16)])),
  categories: cfg.categories,
  sources: cfg.sources.map(({ id, name, category, site, api, enabled, note }) => ({ id, name, category, site, api, enabled: enabled !== false, ...(note ? { note } : {}) })),
  articles: data.articles.map(a => ({ ...a, abstract: !!a.abstract })),
})};\n`;
export const renderAbstracts = (data, category) => JSON.stringify(Object.fromEntries(data.articles.filter(a => a.category === category && a.abstract).map(a => [a.id, a.abstract]))) + '\n';
function write(cfg, data) {
  fs.writeFileSync(OUT, render(cfg, data));
  fs.mkdirSync(ABS_DIR, { recursive: true });
  for (const category of CATEGORY_IDS) fs.writeFileSync(`${ABS_DIR}/${category}.json`, renderAbstracts(data, category));
  for (const f of fs.readdirSync(ABS_DIR)) if (!CATEGORY_IDS.some(c => f === `${c}.json`)) fs.rmSync(`${ABS_DIR}/${f}`);
  // 旧版单文件由分类文件取代
  fs.rmSync('site/data/news-abstracts.json', { force: true });
  // 删掉已不在数据里的封面
  const keep = new Set(data.articles.map(a => a.image).filter(Boolean).map(p => path.basename(p)));
  if (fs.existsSync(IMG_DIR)) for (const f of fs.readdirSync(IMG_DIR)) if (!keep.has(f)) fs.rmSync(`${IMG_DIR}/${f}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = JSON.parse(fs.readFileSync(SRC_FILE, 'utf8'));
  const old = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { generated: null, articles: [] };
  if (process.argv.includes('--offline')) {
    write(cfg, old);
    console.log(`news（离线）: ${old.articles.length} 篇`);
    process.exit(0);
  }
  const on = cfg.sources.filter(s => s.enabled !== false);
  const failed = [], fresh = [];
  const t0 = Date.now();
  await pool(on, CONCURRENCY, async s => {
    try {
      const { list, via } = await fetchSource(s);
      fresh.push(...list);
      console.log(`  ✓ ${s.name}：${list.length} 篇（${via}）`);
    } catch (e) {
      failed.push(s);
      console.error(`  ✗ ${s.name}：${endpoint(s)} → ${e.message}`);
    }
  });
  if (failed.length === on.length) {
    console.error(`\n全部 ${on.length} 个来源失败，保留现有 ${FILE}，未做改动`);
    process.exit(1);
  }
  // 本次结果与仍在窗口内的旧数据合并（失败来源的旧文章因此得以保留）
  fresh.sort((a, b) => a.id < b.id ? -1 : 1);   // 并发完成顺序不定，先排好保证合并结果确定
  // 先按窗口和每源上限筛一遍，再只对留下的补摘要与封面
  const merged = merge(fresh, old.articles);
  const kept = new Set(build(cfg.sources, merged).map(a => a.id));
  const live = merged.filter(a => kept.has(a.id));
  const known = new Set(old.articles.map(a => a.id)), backfill = process.argv.includes('--backfill');
  // 新文章补全部元数据；旧文章若仍缺摘要则每天重试（Europe PMC / Crossref 常在论文上线几天后才补摘要）
  const todo = a => backfill || !known.has(a.id) || !a.abstract;
  await enrich(live, todo);
  await covers(live);
  const articles = build(cfg.sources, live);
  const changed = JSON.stringify(articles) !== JSON.stringify(old.articles);
  const fetchedAt = new Date().toISOString().slice(0, 16) + 'Z';
  const data = { generated: changed || !old.generated ? fetchedAt : old.generated, fetchedAt, articles };
  fs.writeFileSync(FILE, stringify(data));
  write(cfg, data);
  const cats = CATEGORY_IDS.map(c => `${c} ${articles.filter(a => a.category === c).length}`).join(' · ');
  console.log(`\nnews: ${articles.length} 篇（${cats}）· 成功 ${on.length - failed.length}/${on.length} 个来源 · ${((Date.now() - t0) / 1000).toFixed(0)}s${failed.length ? `\n失败：${failed.map(s => s.name).join('、')}` : ''}`);
}
