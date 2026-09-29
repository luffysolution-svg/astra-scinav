// 解析科研通导航页面，输出 name/url/desc 列表（按 <a> 块切分，避免跨条目匹配）
import fs from 'node:fs';

const html = fs.readFileSync(process.argv[2], 'utf8');
const strip = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const out = [];
for (const block of html.split(/<a (?=[^>]*daohang-item-a-wrapper)/).slice(1)) {
  const a = block.slice(0, block.indexOf('</a>'));
  const url = (a.match(/href="([^"]+)"/) || [])[1];
  const title = (a.match(/title="([^"]*)"/) || [])[1] || '';
  const name = strip((a.match(/(?:links-item-name|hot-links-item-name)[^>]*>([\s\S]*?)<\/(?:div|span)>/) || [])[1]);
  const desc = strip((a.match(/links-item-desc">([\s\S]*?)<\/div>/) || [])[1]);
  if (url && url.startsWith('http')) out.push({ name: name || title, url, desc, title, src: 'ablesci' });
}
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
console.log(out.length);
