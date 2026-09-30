// 全站条目的统一键名与主链接，供 status.mjs（新增日期、核验状态）与 linkcheck.mjs 共用
//   主导航：链接本身；Skill：s:作者/仓库；Prompt：p:id；绘图：f:id —— 与首页收藏的键名一致
import fs from 'node:fs';
import vm from 'node:vm';

const gh = r => `https://github.com/${r}`;
const enc = p => p.split('/').map(encodeURIComponent).join('/');

// src：按文件名返回文本，默认读工作区；status.mjs 回溯 git 历史时传入旧版本内容
export function items(src = f => fs.readFileSync(f, 'utf8')) {
  const out = [];
  const text = f => { try { return src(f); } catch { return null; } };
  const ctx = { window: {} };
  ctx.NAV = ctx.window.NAV = [];
  for (const f of ['ai', 'lit', 'lab', 'kit']) {
    const t = text(`site/data/${f}.js`);
    if (t) vm.runInNewContext(t, ctx);
  }
  for (const c of ctx.NAV) for (const s of c.s) out.push({ key: s[1], name: s[0], url: s[1], vpn: s[3] === 'vpn' });
  const json = f => { const t = text(f); return t ? JSON.parse(t) : null; };
  const skills = json('content/skills.json'), prompts = json('content/prompts.json'), figs = json('content/figures.json');
  for (const c of skills?.categories || []) for (const r of c.repos) out.push({ key: 's:' + r.repo, name: r.name, url: gh(r.repo) });
  const branch = new Map((prompts?.repos || []).map(r => [r.repo, r.branch || 'HEAD']));
  for (const c of prompts?.categories || []) for (const p of c.prompts) if (p.id)
    out.push({ key: 'p:' + p.id, name: p.t, url: p.path ? `${gh(p.src)}/blob/${branch.get(p.src)}/${enc(p.path)}` : gh(p.src) });
  for (const c of figs?.categories || []) for (const x of c.items) if (x.id)
    out.push({ key: 'f:' + x.id, name: x.t, url: x.url, extra: x.dl ? [x.dl] : [] });
  return [...new Map(out.map(x => [x.key, x])).values()];
}

// 不对应单个条目、但也值得检查的链接：Skill 子目录、Prompt 来源仓库、绘图来源、期刊指南
export function extraLinks() {
  const json = f => JSON.parse(fs.readFileSync(f, 'utf8'));
  const skills = json('content/skills.json'), prompts = json('content/prompts.json'), figs = json('content/figures.json');
  const out = [];
  for (const c of skills.categories) for (const r of c.repos) for (const x of r.skills || [])
    out.push({ name: `Skill ${r.repo} ${x.name}`, url: `${gh(r.repo)}/tree/HEAD/${enc(x.path)}` });
  for (const r of prompts.repos) out.push({ name: `Prompt 来源 ${r.repo}`, url: gh(r.repo) });
  for (const s of figs.sources) out.push({ name: `绘图来源 ${s.id}`, url: s.url });
  for (const j of figs.journals) for (const r of [{ t: '', url: j.url }, ...(j.refs || [])]) out.push({ name: `期刊 ${j.j} ${r.t}`, url: r.url });
  return out;
}
