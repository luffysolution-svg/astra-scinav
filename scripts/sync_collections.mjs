// 科研 SKILL / Prompt 数据同步
//   node scripts/sync_collections.mjs          刷新 GitHub 星标、更新时间、协议，并生成 site/data/{skills,prompts}.js
//   node scripts/sync_collections.mjs --scan   另外列出各 Skill 仓库里尚未收录的 SKILL.md，便于人工补充
//   node scripts/sync_collections.mjs --offline 不联网，只由 content/*.json 生成 site/data/*.js
// 内容以 content/skills.json、content/prompts.json 为准，手工编辑分类与中文简介后重新运行即可。
// 需要 GITHUB_TOKEN 环境变量，或已登录的 gh CLI（自动读取 gh auth token）。
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const offline = args.has('--offline'), scan = args.has('--scan');
const token = process.env.GITHUB_TOKEN || (() => { try { return execSync('gh auth token', { encoding: 'utf8' }).trim(); } catch { return ''; } })();
if (!offline && !token) { console.error('缺少 GITHUB_TOKEN，也未登录 gh；可加 --offline 仅生成数据文件'); process.exit(1); }

async function api(path) {
  const r = await fetch(`https://api.github.com/${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'astra-sync' } });
  if (!r.ok) throw new Error(`${r.status} ${path}`);
  return r.json();
}
async function refresh(repo) {
  const d = await api(`repos/${repo}`);
  return { stars: d.stargazers_count, updated: d.pushed_at.slice(0, 10), license: !d.license || d.license.spdx_id === 'NOASSERTION' ? (d.license ? '其他协议' : null) : d.license.spdx_id, branch: d.default_branch, full: d.full_name };
}
const today = new Date().toISOString().slice(0, 10);

/* ---------- Skills ---------- */
const skills = JSON.parse(fs.readFileSync('content/skills.json', 'utf8'));
if (!offline) {
  for (const c of skills.categories) for (const r of c.repos) {
    try {
      const m = await refresh(r.repo);
      if (m.full !== r.repo) console.log(`仓库已改名：${r.repo} → ${m.full}（请更新 content/skills.json）`);
      Object.assign(r, { stars: m.stars, updated: m.updated, license: m.license });
      if (scan) {
        const tree = await api(`repos/${r.repo}/git/trees/${m.branch}?recursive=1`);
        const known = new Set((r.skills || []).map(s => s.path));
        const found = tree.tree.filter(t => t.type === 'blob' && /(^|\/)SKILL\.md$/i.test(t.path)).map(t => t.path.replace(/\/?SKILL\.md$/i, ''));
        const fresh = found.filter(p => !known.has(p));
        if (fresh.length) console.log(`\n${r.repo} 未收录 ${fresh.length} 个：\n  ${fresh.slice(0, 40).join('\n  ')}${fresh.length > 40 ? '\n  …' : ''}`);
      }
    } catch (e) { console.warn(`跳过 ${r.repo}：${e.message}`); }
  }
  skills.generated = today;
  fs.writeFileSync('content/skills.json', JSON.stringify(skills, null, 2) + '\n');
}
fs.writeFileSync('site/data/skills.js', `// 自动生成：scripts/sync_collections.mjs，请编辑 content/skills.json\nwindow.SKILLS = ${JSON.stringify(skills)};\n`);

/* ---------- Prompts ---------- */
const prompts = JSON.parse(fs.readFileSync('content/prompts.json', 'utf8'));
// 每条 Prompt 有稳定 id（分类 id-序号），用于分享链接与收藏；新增条目自动续号，已有 id 不变
let idsAdded = 0;
for (const c of prompts.categories) {
  let n = Math.max(0, ...c.prompts.map(p => +(p.id || '').slice(c.id.length + 1) || 0));
  for (const p of c.prompts) if (!p.id) { p.id = `${c.id}-${++n}`; idsAdded++; }
}
if (idsAdded) console.log(`新增 ${idsAdded} 个 Prompt id`);
if (!offline) {
  for (const r of prompts.repos) {
    try { Object.assign(r, (({ stars, updated, license, branch }) => ({ stars, updated, license, branch }))(await refresh(r.repo))); }
    catch (e) { console.warn(`跳过 ${r.repo}：${e.message}`); }
  }
  prompts.generated = today;
}
if (!offline || idsAdded) fs.writeFileSync('content/prompts.json', JSON.stringify(prompts, null, 2) + '\n');
fs.writeFileSync('site/data/prompts.js', `// 自动生成：scripts/sync_collections.mjs，请编辑 content/prompts.json\nwindow.PROMPTS = ${JSON.stringify(prompts)};\n`);

const nRepo = skills.categories.reduce((n, c) => n + c.repos.length, 0);
const nPrompt = prompts.categories.reduce((n, c) => n + c.prompts.length, 0);
console.log(`\nskills: ${skills.categories.length} 类 ${nRepo} 仓库 · prompts: ${prompts.categories.length} 类 ${nPrompt} 条 / ${prompts.repos.length} 来源`);
