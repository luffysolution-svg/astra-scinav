import test from 'node:test';
import assert from 'node:assert/strict';
import { findCover, render } from '../scripts/sync_news_journal_covers.mjs';

const nature = { site: 'https://www.nature.com/nm' };
const aps = { site: 'https://journals.aps.org/prl/' };
const wiley = { site: 'https://onlinelibrary.wiley.com/journal/2041210x', feed: 'https://onlinelibrary.wiley.com/action/showFeed' };

test('Nature accepts an official issue cover and decodes URL entities', () => {
  const cover = findCover('<img src="https://media.springernature.com/w440/springer-static/cover-hires/journal/41591/32/9?q=95&amp;as=webp" alt="Volume 32 Issue 9">', nature);
  assert.equal(cover.kind, 'issue');
  assert.equal(cover.label, 'Volume 32 Issue 9');
  assert.ok(cover.imageUrl.endsWith('?q=95&as=webp'));
});

test('Nature rejects logos, advertisements and images on another host', () => {
  assert.equal(findCover('<img src="https://media.springernature.com/nature-cms/advertisement.jpg" alt="Cover"><meta property="og:image" content="https://example.com/logo.png">', nature), null);
  assert.equal(findCover('<img src="https://example.com/springer-static/cover-hires/journal/41591/32/9" alt="Volume 32 Issue 9">', nature), null);
});

test('APS requires an explicit cover block and does not use its generic journal image', () => {
  const html = '<img src="//cdn.journals.aps.org/development/journals/images/journal_covers/prl.png"><div class="article-card cover-image"><img src="//cdn.journals.aps.org/test/issue.png"><section>ON THE COVER</section></div>';
  assert.equal(findCover(html, aps).imageUrl, 'https://cdn.journals.aps.org/test/issue.png');
  assert.equal(findCover('<img src="//cdn.journals.aps.org/development/journals/images/journal_covers/prl.png">', aps), null);
});

test('Wiley accepts dedicated cover entries, selects newest issue and ignores banners', () => {
  const entry = (issue, date) => `<item><title>Cover Picture and Issue Information</title><prism:coverDate>${date}</prism:coverDate><prism:volume>17</prism:volume><prism:number>${issue}</prism:number><content:encoded>&lt;img src="https://besjournals.onlinelibrary.wiley.com/cms/asset/issue-${issue}.png"/&gt;</content:encoded></item>`;
  const cover = findCover(`<channel><image><url>https://besjournals.onlinelibrary.wiley.com/pb-assets/journal-banners/2041210x.jpg</url></image>${entry(8, '2026-08-01')}${entry(9, '2026-09-01')}</channel>`, wiley);
  assert.equal(cover.label, 'Volume 17 Issue 9');
  assert.ok(cover.imageUrl.endsWith('issue-9.png'));
  assert.equal(cover.kind, 'art');
});

test('Wiley rejects ordinary research articles and offsite images', () => {
  assert.equal(findCover('<item><title>Discovering biodiversity</title><content:encoded>&lt;img src="https://besjournals.onlinelibrary.wiley.com/cms/asset/figure.png"/&gt;</content:encoded></item>', wiley), null);
  assert.equal(findCover('<item><title>Front Cover</title><content:encoded>&lt;img src="https://example.com/cms/asset/advertisement.png"/&gt;</content:encoded></item>', wiley), null);
});

test('browser data retains attribution and leaves remote image URLs out', () => {
  const js = render({ covers: [{ journal: 'Nature Medicine', image: 'news-journals/nm-test.webp', source: nature.site, imageUrl: 'https://media.springernature.com/cover', label: 'Volume 32 Issue 9', kind: 'issue' }] });
  assert.ok(js.includes('news-journals/nm-test.webp'));
  assert.ok(js.includes(nature.site));
  assert.ok(!js.includes('media.springernature.com'));
});
