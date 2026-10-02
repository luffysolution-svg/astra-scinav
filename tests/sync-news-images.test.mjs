import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { articleUrl, feedImages, meta, pageImages, pmcImages, rasterImage, robotPolicy } from '../scripts/sync_news.mjs';

test('RSS/Atom image candidates accept single quotes, lazy images and relative links', () => {
  const xml = `<media:content type='video/mp4' url='movie.mp4'/>
    <media:thumbnail url='https://cdn.test/logo.png'/>
    <link rel='enclosure' type='image/jpeg' href='/cover.jpg'/>
    <summary><![CDATA[<img data-src="/paper.webp" src="/placeholder.png">]]></summary>`;
  assert.deepEqual(feedImages(xml, 'https://journal.test/feed'), ['https://journal.test/cover.jpg', 'https://journal.test/paper.webp']);
});

test('article metadata handles reversed attribute order and escaped URLs', () => {
  const html = `<meta content='https://cdn.test/figure.jpg?a=1&amp;b=2' property='og:image'>
    <meta name="twitter:image" content="https://cdn.test/alternative.jpg">`;
  assert.equal(meta(html, 'og:image'), 'https://cdn.test/figure.jpg?a=1&b=2');
  assert.deepEqual(pageImages(html, 'https://journal.test/article'), ['https://cdn.test/figure.jpg?a=1&b=2', 'https://cdn.test/alternative.jpg']);
});

test('paper figures skip publisher logos and journal promotion figures', () => {
  const html = `<meta property="og:image" content="/journal-logo.png">
    <figure class="CardJournal"><img src="/journal.jpg"></figure>
    <figure id="F1"><img srcset="/small.jpg 200w, /large.jpg 1000w" src="/fallback.jpg"></figure>`;
  assert.deepEqual(pageImages(html, 'https://journal.test/article'), ['https://journal.test/large.jpg', 'https://journal.test/small.jpg', 'https://journal.test/fallback.jpg']);
});

test('Frontiers journal promotion image is rejected in favor of its article graphic', () => {
  const html = `<meta name="image" property="og:image" content="https://cdn.test/Main%20Visual_Green.webp">
    <img src="https://www.frontiersin.org/files/Articles/123/image_m/fevo-14-123-g001.jpg">`;
  assert.deepEqual(pageImages(html, 'https://www.frontiersin.org/articles/123'), ['https://www.frontiersin.org/files/Articles/123/image_m/fevo-14-123-g001.jpg']);
});

test('Europe PMC uses the actual OA full-text figure asset and excludes thumbnail alternatives', () => {
  const xml = `<fig id="F1"><graphic content-type="image" xlink:href="paperf1.jpg">
    <?cloudpmc-path blobs/abcd/1234/efgh/paperf1.jpg?></graphic>
    <graphic content-type="thumb"><?cloudpmc-path blobs/abcd/1234/efgh/paperf1.gif?></graphic></fig>`;
  assert.deepEqual(pmcImages(xml), ['https://cdn.ncbi.nlm.nih.gov/pmc/blobs/abcd/1234/efgh/paperf1.jpg']);
  assert.deepEqual(pmcImages('<graphic xlink:href="guessed.jpg"/>'), []);
  assert.deepEqual(pmcImages('<fig><graphic xlink:href="https://publisher.test/paper-fig1.jpg"/></fig>'), ['https://publisher.test/paper-fig1.jpg']);
});

test('Nature DOI URLs reach the official article page without requiring a DOI redirect', () => {
  assert.equal(articleUrl({ doi: '10.1038/s41467-026-78107-6', url: 'https://doi.org/10.1038/s41467-026-78107-6' }), 'https://www.nature.com/articles/s41467-026-78107-6');
  assert.equal(articleUrl({ doi: '10.0000/unknown', url: 'https://doi.org/10.0000/unknown' }), null);
  assert.equal(articleUrl({ landing: 'https://publisher.test/paper', url: 'https://doi.org/10.0000/paper' }), 'https://publisher.test/paper');
});

test('robots uses matching bot groups, longest rule, allow ties and crawl delay', () => {
  const robots = `User-agent: *\nDisallow: /private\nDisallow: /*/figures\nAllow: /private/open\nCrawl-delay: 30\nUser-agent: GPTBot\nDisallow: /`;
  assert.deepEqual(robotPolicy(robots, 'https://journal.test/articles/paper'), { allowed: true, delay: 30000 });
  assert.equal(robotPolicy(robots, 'https://journal.test/articles/paper/figures').allowed, false);
  assert.equal(robotPolicy(robots, 'https://journal.test/private/open').allowed, true);
  assert.equal(robotPolicy(robots, 'https://journal.test/private/paper').allowed, false);
  const named = `User-agent: *\nDisallow: /\nUser-agent: Astra-news-sync\nAllow: /paper$\nDisallow: /`;
  assert.equal(robotPolicy(named, 'https://journal.test/paper').allowed, true);
  assert.equal(robotPolicy(named, 'https://journal.test/paper/other').allowed, false);
});

test('image signature validation rejects HTML even if served with an image MIME type', () => {
  assert.equal(rasterImage(Buffer.from('<html>verification required</html>')), false);
  assert.equal(rasterImage(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), true);
  assert.equal(rasterImage(Buffer.from('RIFF1234WEBP')), true);
  assert.equal(rasterImage(Buffer.from('RIFF1234WAVE')), false);
});

test('offline generation survives a temporary image directory left by an interrupted download', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-images-test-'));
  try {
    fs.mkdirSync(path.join(tmp, 'content'));
    fs.mkdirSync(path.join(tmp, 'site/data'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'site/news/.tmp-interrupted'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'content/news-sources.json'), JSON.stringify({ categories: [{ id: 'nature' }], sources: [] }));
    fs.writeFileSync(path.join(tmp, 'content/news.json'), JSON.stringify({ generated: '2026-10-02', articles: [{ id: 'n123456789012', category: 'nature', image: 'news/n123456789012.webp', abstract: null }] }));
    fs.writeFileSync(path.join(tmp, 'site/news/n123456789012.webp'), 'retained');
    fs.writeFileSync(path.join(tmp, 'site/news/orphan.webp'), 'obsolete');
    execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/sync_news.mjs', import.meta.url)), '--offline'], { cwd: tmp, stdio: 'pipe' });
    assert.ok(fs.existsSync(path.join(tmp, 'site/news/.tmp-interrupted')));
    assert.ok(fs.existsSync(path.join(tmp, 'site/news/n123456789012.webp')));
    assert.equal(fs.existsSync(path.join(tmp, 'site/news/orphan.webp')), false);
    assert.ok(fs.existsSync(path.join(tmp, 'site/data/news.js')));
  } finally {
    assert.equal(path.dirname(path.resolve(tmp)), path.resolve(os.tmpdir()));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('consecutive publisher network failures stop further pages while preserving the snapshot', { timeout: 30000 }, async () => {
  const visited = new Set();
  const server = createServer((req, res) => {
    if (req.url === '/robots.txt') return void res.end('User-agent: *\nAllow: /');
    visited.add(req.url);
    req.socket.destroy();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-network-test-'));
  try {
    fs.mkdirSync(path.join(tmp, 'content'));
    fs.mkdirSync(path.join(tmp, 'site/data'), { recursive: true });
    const snapshot = { generated: '2026-10-02', fetchedAt: '2026-10-02T00:00Z', articles: Array.from({ length: 8 }, (_, i) => ({ id: `n${String(i).padStart(12, '0')}`, title: `Paper ${i}`, date: '2026-10-01', journal: 'Test', doi: null, image: null, abstract: 'Existing abstract remains unchanged.', url: `http://127.0.0.1:${server.address().port}/paper/${i}`, category: 'nature', source: 'rss' })) };
    fs.writeFileSync(path.join(tmp, 'content/news-sources.json'), JSON.stringify({ categories: [{ id: 'nature' }], sources: [] }));
    fs.writeFileSync(path.join(tmp, 'content/news.json'), JSON.stringify(snapshot));
    const child = spawn(process.execPath, [fileURLToPath(new URL('../scripts/sync_news.mjs', import.meta.url)), '--images-only'], { cwd: tmp });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.resume();
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    assert.equal(code, 0);
    assert.ok(visited.size <= 4, `unexpected ${visited.size} publisher pages`);
    assert.match(output, /连续网络失败/);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp, 'content/news.json'), 'utf8')), snapshot);
  } finally {
    await new Promise(resolve => server.close(resolve));
    assert.equal(path.dirname(path.resolve(tmp)), path.resolve(os.tmpdir()));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
