// 条目状态：新增日期与链接核验结果
//   node scripts/status.mjs   给新条目记上今天为新增日期、删掉已移除的条目，并生成 site/data/status.js
// 源数据在 content/status.json：{ 键名: { added, checked?, fails? } }
//   added   首次收录日期；首次运行时按 git 历史回填
//   checked 最近一次核验通过的日期（由 linkcheck.mjs --write 写入）
//   fails   连续几次核验判定失效；≥2 时页面标「疑似失效」，一次偶发故障不会误标
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { items } from './keys.mjs';

const FILE = 'content/status.json', OUT = 'site/data/status.js';
export const DEAD_AFTER = 2;
const today = () => new Date().toISOString().slice(0, 10);

// 按提交顺序找每个键第一次出现的日期
function backfill() {
  const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] });
  const files = ['site/data/ai.js', 'site/data/lit.js', 'site/data/lab.js', 'site/data/kit.js', 'content/skills.json', 'content/prompts.json', 'content/figures.json'];
  const first = {};
  let log = '';
  try { log = git('log', '--reverse', '--format=%H %ad', '--date=short', '--', ...files); } catch { return first; }
  for (const line of log.trim().split('\n').filter(Boolean)) {
    const [sha, date] = line.split(' ');
    for (const x of items(f => git('show', `${sha}:${f}`))) first[x.key] ??= date;
  }
  return first;
}

export function load() {
  return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : null;
}
// 与当前条目对齐：补新增日期、删多余键；返回按条目顺序排列的新对象
export function sync(status) {
  const old = status || backfill();
  const next = {};
  for (const { key } of items()) {
    const s = old[key];
    next[key] = typeof s === 'string' ? { added: s } : s ? { ...s } : { added: today() };
  }
  return next;
}
// 页面只需要：新增日期、最近核验日期、是否疑似失效
export const render = status => `// 自动生成：scripts/status.mjs，请勿手工编辑\nwindow.STATUS = ${JSON.stringify(Object.fromEntries(
  Object.entries(status).map(([k, s]) => [k, [s.added, s.checked || '', (s.fails || 0) >= DEAD_AFTER ? 1 : 0]])))};\n`;
export function save(status) {
  fs.writeFileSync(FILE, JSON.stringify(status, null, 1) + '\n');
  fs.writeFileSync(OUT, render(status));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = sync(load());
  save(s);
  const v = Object.values(s);
  console.log(`status: ${v.length} 条 · 今日新增 ${v.filter(x => x.added === today()).length} · 已核验 ${v.filter(x => x.checked).length} · 疑似失效 ${v.filter(x => (x.fails || 0) >= DEAD_AFTER).length}`);
}
