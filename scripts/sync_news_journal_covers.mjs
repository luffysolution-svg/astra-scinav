// 期刊封面独立于论文图片：只取官网明确标注的卷期封面 / ON THE COVER 选图。
// node scripts/sync_news_journal_covers.mjs           联网更新，失败保留已有封面
// node scripts/sync_news_journal_covers.mjs --offline 由缓存重建前端数据，不联网
// Nature 的 cover-hires、APS 的 cover-image、Wiley RSS 的封面专门条目已核验；不使用 og:image、广告或通用期刊图。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const FILE = 'content/news-journal-covers.json', OUT = 'site/data/news-journal-covers.js', DIR = 'site/news-journals';
const UA = 'Astra-news-sync/1.0 (Astra academic feed aggregator; +https://nav.luffysite.top)';
const RSS_ACCEPT = 'application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, */*;q=0.1';
const decode = s => s.replace(/&(?:amp|quot|lt|gt|apos|#39);/g, e => ({ '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&apos;': "'", '&#39;': "'" })[e]);
const attr = (tag, name) => decode((tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i')) || [])[1] || '');
const tagText = (xml, name) => decode((xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`)) || [])[1] || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
const imageUrl = (raw, base, host) => {
  try { const u = new URL(raw, base); return u.protocol === 'https:' && u.hostname === host ? u.href : null; }
  catch { return null; }
};

export function findCover(html, s) {
  const host = new URL(s.site).hostname;
  if (host === 'www.nature.com') {
    for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
      const url = imageUrl(attr(tag, 'src'), s.site, 'media.springernature.com');
      if (url && /\/(?:springer-static\/cover-hires\/journal\/\d+\/\d+\/\d+|nature-assets\/[^/]+\/journal\/v\d+\/n\d+\/covers\/)/.test(url)) {
        return { imageUrl: url, label: attr(tag, 'alt') || '卷期封面', kind: 'issue' };
      }
    }
  } else if (host === 'journals.aps.org') {
    // 只接受有明确 ON THE COVER 标注的区块，排除 journal_covers/ 下的通用刊物图。
    for (const [block] of html.matchAll(/<div\b[^>]*class=["'][^"']*\bcover-image\b[^"']*["'][^>]*>[\s\S]*?<\/section>/gi)) {
      if (!/ON THE COVER/i.test(block)) continue;
      const tag = (block.match(/<img\b[^>]*>/i) || [])[0] || '';
      const url = imageUrl(attr(tag, 'src'), s.site, 'cdn.journals.aps.org');
      if (url) return { imageUrl: url, label: '官网封面选图', kind: 'art' };
    }
  } else if (/(?:^|\.)onlinelibrary\.wiley\.com$/.test(host)) {
    const covers = [...html.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/g)].map(([, item]) => ({ item, title: tagText(item, 'title'), date: tagText(item, 'prism:coverDate') || tagText(item, 'pubDate') }))
      .filter(c => /^(?:(?:inside )?(?:front|back) )?cover(?: (?:image|picture))?(?: and issue information)?(?:\s*[:(].*)?$/i.test(c.title))
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
    for (const { item } of covers) {
      const content = tagText(item, 'content:encoded') || tagText(item, 'description');
      const tag = (content.match(/<img\b[^>]*>/i) || [])[0] || '';
      try {
        const u = new URL(attr(tag, 'src'), s.feed);
        if (u.protocol !== 'https:' || !/(?:^|\.)onlinelibrary\.wiley\.com$/.test(u.hostname) || !u.pathname.startsWith('/cms/asset/')) continue;
        const vol = tagText(item, 'prism:volume'), issue = tagText(item, 'prism:number');
        return { imageUrl: u.href, label: vol && issue ? `Volume ${vol} Issue ${issue}` : '官网封面选图', kind: 'art' };
      } catch { /* 无有效公开图片则继续检查下一条封面条目。 */ }
    }
  }
  return null;
}

export const render = data => `// 自动生成：scripts/sync_news_journal_covers.mjs\nwindow.NEWS_JOURNAL_COVERS = ${JSON.stringify(Object.fromEntries(data.covers.map(({ journal, image, source, label, kind }) => [journal, { image, source, label, kind }])))};\n`;

// 接受 Nature 正常的 Cookie/SSO 跳转，不执行验证页、不伪装浏览器、不使用代理。
const jar = new Map();
const blocked = new Set();
async function request(url, binary = false, hops = 0, accept = 'text/html') {
  if (hops > 8) throw new Error('跳转次数过多');
  const u = new URL(url), key = u.hostname.endsWith('.nature.com') ? 'nature.com' : u.hostname;
  if (blocked.has(u.hostname)) throw new Error('本次已被该主机拦截');
  const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(20000), headers: { 'user-agent': UA, accept: binary ? 'image/*' : accept, cookie: jar.get(key) || '' } });
  const cookies = r.headers.getSetCookie?.() || [];
  if (cookies.length) jar.set(key, [jar.get(key), ...cookies.map(c => c.split(';')[0])].filter(Boolean).join('; '));
  if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
    await r.body?.cancel();
    return request(new URL(r.headers.get('location'), url).href, binary, hops + 1, accept);
  }
  if (!r.ok) {
    await r.body?.cancel();
    if ([403, 429].includes(r.status)) blocked.add(u.hostname);
    throw new Error(`HTTP ${r.status}`);
  }
  if (binary) {
    if (!/^image\//i.test(r.headers.get('content-type') || '')) { await r.body?.cancel(); throw new Error('返回内容不是图片'); }
    const chunks = [];
    let size = 0;
    for await (const part of r.body) {
      size += part.length;
      if (size > 8 * 1024 * 1024) throw new Error('图片超过 8 MB');
      chunks.push(part);
    }
    return Buffer.concat(chunks);
  }
  const html = await r.text();
  if (/Client Challenge|cf-chl-|Just a moment/i.test(html)) throw new Error('官网返回验证页');
  return html;
}

async function main() {
  const cfg = JSON.parse(fs.readFileSync('content/news-sources.json', 'utf8'));
  const data = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { generated: null, covers: [] };
  // 已删除的来源、缺失的本地图片不进入前端。
  const names = new Set(cfg.sources.filter(s => s.enabled !== false).map(s => s.name));
  data.covers = data.covers.filter(c => names.has(c.journal) && fs.existsSync(`site/${c.image}`));
  if (!process.argv.includes('--offline')) {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    fs.mkdirSync(DIR, { recursive: true });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-journal-covers-'));
    let updated = 0;
    try {
      // 同一出版社顺序请求并留间隔；不同出版社互不阻塞。
      const publishers = [
        { matches: s => new URL(s.site).hostname === 'www.nature.com', page: s => s.site.replace(/\/?$/, '/') },
        { matches: s => new URL(s.site).hostname === 'journals.aps.org', page: s => s.site },
        { matches: s => /(?:^|\.)onlinelibrary\.wiley\.com$/.test(new URL(s.site).hostname), page: s => s.feed, accept: RSS_ACCEPT },
      ];
      await Promise.all(publishers.map(async publisher => {
        const sources = cfg.sources.filter(s => s.enabled !== false && publisher.matches(s) && publisher.page(s));
        for (const s of sources) {
          try {
            let html;
            try { html = await request(publisher.page(s), false, 0, publisher.accept); }
            catch (e) {
              // Nature 首页的公开 Contents 链接指向此期刊卷期页，可独立获取当前封面。
              if (s.id !== 'nature') throw e;
              html = await request('https://www.nature.com/nature/current-issue');
            }
            const cover = findCover(html, s);
            if (!cover) { console.log(`${s.name}: 官网未提供可识别的封面`); continue; }
            const hash = crypto.createHash('sha1').update(cover.imageUrl).digest('hex').slice(0, 10);
            const image = `news-journals/${s.id}-${hash}.webp`, out = `site/${image}`;
            if (!fs.existsSync(out)) {
              const src = path.join(tmp, s.id + '.image'), target = path.join(tmp, s.id + '.webp');
              fs.writeFileSync(src, await request(cover.imageUrl, true));
              execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-y', '-i', src, '-frames:v', '1', '-vf', "scale='min(180,iw)':-2", '-c:v', 'libwebp', '-quality', '78', target], { timeout: 30000 });
              fs.copyFileSync(target, out);
            }
            data.covers = data.covers.filter(c => c.journal !== s.name);
            data.covers.push({ journal: s.name, image, source: s.site, ...cover });
            updated++;
            console.log(`${s.name}: ${cover.label}`);
          } catch (e) { console.warn(`${s.name}: ${e.message}，保留已有封面`); }
          finally { await new Promise(resolve => setTimeout(resolve, 1000)); }
        }
      }));
    } finally {
      if (path.dirname(path.resolve(tmp)) !== path.resolve(os.tmpdir())) throw new Error('临时目录不在预期位置');
      fs.rmSync(tmp, { recursive: true, force: true });
    }
    if (updated) data.generated = new Date().toISOString();
  }
  data.covers.sort((a, b) => a.journal.localeCompare(b.journal, 'en'));
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
  fs.writeFileSync(OUT, render(data));
  console.log(`期刊封面：${data.covers.length} 本，前端只使用本地 WebP`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
