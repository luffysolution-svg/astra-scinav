// 失效链接检测：node scripts/linkcheck.mjs [--all] [--content] [--sample N] [--write]
// 默认只查主导航，跳过标记为 'vpn' 的站点（国内网络下必然超时），--all 全部检测
// --content 另外检查 Skill、Prompt 来源文件、绘图模板/来源/下载地址与期刊指南
// --sample N 只抽查 N 个，按周轮换批次，几周内覆盖全部链接，避免一次请求六百多个地址
// --write   把结果写入 content/status.json 并重新生成 site/data/status.js：
//           可访问的记为今日核验通过；404/410/域名不存在/证书异常记一次失败（连续两次才在页面标「疑似失效」）；
//           超时、5xx、拒绝爬虫等不确定的结果不改动。国内网络噪声大，建议只在 GitHub Actions 中使用。
import { items, extraLinks } from './keys.mjs';
import * as status from './status.mjs';

const argv = process.argv.slice(2);
const all = argv.includes('--all'), content = argv.includes('--content'), write = argv.includes('--write');
// 每个链接带上所属条目的键名（没有对应条目的补充链接 key 为空）
let sites = items().filter(x => (content || !/^[spf]:/.test(x.key)) && (all || !x.vpn))
  .flatMap(x => [x.url, ...(x.extra || [])].map(url => ({ key: x.key, name: x.name, url })));
if (content) sites.push(...extraLinks());
sites = [...new Map(sites.map(s => [s.url, s])).values()];
const k = argv.indexOf('--sample'), sample = k >= 0 ? +argv[k + 1] : 0;
if (sample > 0 && sample < sites.length) {
  // 按周数轮换起点：每周查不同的一批
  const batches = Math.ceil(sites.length / sample), week = Math.floor(Date.now() / 6048e5) % batches;
  sites = sites.slice(week * sample, week * sample + sample);
  console.log(`抽查第 ${week + 1}/${batches} 批，共 ${sites.length} 个`);
}

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

const HARD = /ENOTFOUND|CERT|SSL|TLS|SIGNATURE/;
const isOk = r => typeof r.status === 'number' && r.status < 400;
const isDead = r => r.status === 404 || r.status === 410 || HARD.test(r.status);
const groups = {
  '疑似失效（404/410/5xx、域名不存在、证书异常）': r => isDead(r) || r.status >= 500,
  '无法连接或超时（多为网络原因，换网络或 --all 挂代理复查）': r => typeof r.status === 'string' && !HARD.test(r.status),
  '拒绝爬虫（401/403/429，通常仍可用）': r => [401, 403, 429].includes(r.status),
  '跳转到其他域名（考虑更新链接）': r => isOk(r) && r.final,
};
for (const [title, test] of Object.entries(groups)) {
  const list = results.filter(test);
  if (!list.length) continue;
  console.log(`\n## ${title} ${list.length}`);
  for (const r of list) console.log(`  ${String(r.status).padEnd(12)} ${r.name}  ${r.url}${r.final ? `  →  ${r.final}` : ''}`);
}
const ok = results.filter(r => isOk(r) && !r.final).length;
console.log(`\nchecked=${results.length} ok=${ok}${all ? '' : '（已跳过 vpn 标记站点，--all 可全部检测）'}`);

if (write) {
  const st = status.sync(status.load()), today = new Date().toISOString().slice(0, 10);
  // 一个条目可能有多个链接（如绘图的下载地址）：任一失效算失败，全部可访问才算核验通过
  const byKey = Map.groupBy(results.filter(r => r.key && st[r.key]), r => r.key);
  let n = 0;
  for (const [key, rs] of byKey) {
    const s = st[key];
    if (rs.some(isDead)) { s.fails = (s.fails || 0) + 1; n++; }
    else if (rs.every(isOk)) { s.checked = today; delete s.fails; n++; }
  }
  status.save(st);
  console.log(`已更新 ${n} 个条目的核验状态`);
}
