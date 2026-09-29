// 失效链接检测：node scripts/linkcheck.mjs [--all]
// 默认跳过标记为 'vpn' 的站点（国内网络下必然超时），--all 全部检测
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
ctx.NAV = ctx.window.NAV = [];
for (const f of ['ai', 'lit', 'lab', 'kit']) vm.runInNewContext(fs.readFileSync(`site/data/${f}.js`, 'utf8'), ctx);
const all = process.argv.includes('--all');
const sites = [...new Map(ctx.NAV.flatMap(c => c.s)
  .filter(s => all || s[3] !== 'vpn')
  .map(s => [s[1], { name: s[0], url: s[1] }])).values()];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
async function probe(url, method) {
  const r = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(15000), headers: { 'user-agent': UA, accept: 'text/html,*/*' } });
  r.body?.cancel().catch(() => {});
  return r;
}
async function check(s, retry = 1) {
  try {
    let r = await probe(s.url, 'HEAD');
    // 不少站点对 HEAD 返回 403/405，改用 GET 复查
    if (r.status >= 400) r = await probe(s.url, 'GET');
    const moved = new URL(r.url).hostname.replace(/^www\./, '') !== new URL(s.url).hostname.replace(/^www\./, '');
    return { ...s, status: r.status, final: moved ? r.url : '' };
  } catch (e) {
    // 连接被重置在国内网络下很常见，稍等后重试一次
    if (retry) { await new Promise(r => setTimeout(r, 1500)); return check(s, retry - 1); }
    return { ...s, status: e.name === 'TimeoutError' ? 'TIMEOUT' : (e.cause?.code || e.name) };
  }
}

const results = [];
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < sites.length) {
    const s = sites[next++];
    results.push(await check(s));
    process.stderr.write(`\r${results.length}/${sites.length}`);
  }
}));
process.stderr.write('\n');

const groups = {
  '疑似失效（404/410/5xx、域名不存在、证书异常）': r => r.status === 404 || r.status === 410 || r.status >= 500 || /ENOTFOUND|CERT|SSL|TLS|SIGNATURE/.test(r.status),
  '无法连接或超时（多为网络原因，换网络或 --all 挂代理复查）': r => typeof r.status === 'string' && !/ENOTFOUND|CERT|SSL|TLS|SIGNATURE/.test(r.status),
  '拒绝爬虫（401/403/429，通常仍可用）': r => [401, 403, 429].includes(r.status),
  '跳转到其他域名（考虑更新链接）': r => typeof r.status === 'number' && r.status < 400 && r.final,
};
for (const [title, test] of Object.entries(groups)) {
  const list = results.filter(test);
  if (!list.length) continue;
  console.log(`\n## ${title} ${list.length}`);
  for (const r of list) console.log(`  ${String(r.status).padEnd(12)} ${r.name}  ${r.url}${r.final ? `  →  ${r.final}` : ''}`);
}
const ok = results.filter(r => typeof r.status === 'number' && r.status < 400 && !r.final).length;
console.log(`\nchecked=${results.length} ok=${ok}${all ? '' : '（已跳过 vpn 标记站点，--all 可全部检测）'}`);
