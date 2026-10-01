// 在已登录 Vercel / GitHub CLI 的终端配置账号侧资源；不发布站点、不修改 DNS。
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

export const TARGET = {
  project: 'astra-scinav', team: 'luffysolution-4375s-projects',
  teamId: 'team_cYDpJCxe3TbR9wKh0NoiK9MP', repo: 'luffysolution-svg/astra-scinav',
};
export const SETTINGS = { framework: null, rootDirectory: null, buildCommand: '', installCommand: 'npm ci', outputDirectory: 'site', nodeVersion: '22.x' };

export async function configure({ run, readLink, env = process.env, interactive = false, log = console.log }) {
  const vc = (args, options) => run('vercel', [...args, '--scope', TARGET.team], options);
  const api = (path, options) => vc(['api', path, '--raw', ...(options ? ['-X', 'PATCH', '--input', '-'] : [])], options);
  // 在任何远端写入前确认两个账号连接及已有密钥，缺权限时立即停止。
  const project = JSON.parse(await api(`/v9/projects/${TARGET.project}`));
  if (project.name !== TARGET.project || !/^prj_/.test(project.id) || project.accountId !== TARGET.teamId) throw new Error('Vercel 项目或所属团队不匹配，已停止配置。');
  const secretNames = new Set(JSON.parse(await run('gh', ['secret', 'list', '--repo', TARGET.repo, '--json', 'name'])).map(s => s.name));
  if (!secretNames.has('VERCEL_TOKEN') && !env.VERCEL_TOKEN && !interactive) throw new Error('缺少 Actions 发布 token；请在交互终端运行配置，或通过环境变量提供 VERCEL_TOKEN。不要发送到聊天。');
  await vc(['link', '--yes', '--project', TARGET.project]);
  const link = readLink();
  if (link.projectId !== project.id || link.orgId !== TARGET.teamId) throw new Error('本地项目关联与目标不一致，已停止配置。');

  const listStores = async () => {
    const response = JSON.parse(await vc(['blob', 'list-stores', '--json']));
    const stores = Array.isArray(response) ? response : response.stores;
    if (!Array.isArray(stores)) throw new Error('无法识别 Blob 存储列表，未创建新存储。');
    return stores;
  };
  const hasProductionToken = async () => {
    const { envs } = JSON.parse(await api(`/v10/projects/${project.id}/env`));
    if (!Array.isArray(envs)) throw new Error('无法读取项目环境变量，已停止配置。');
    return envs.some(e => e.key === 'BLOB_READ_WRITE_TOKEN' && Array.isArray(e.target) && e.target.includes('production'));
  };
  const stores = await listStores(), tokenPresent = await hasProductionToken();
  if (!(tokenPresent && stores.length === 1 && stores[0].access === 'private')) {
    if (stores.length || tokenPresent) throw new Error('已有存储或令牌尚不满足 Private + Production 配置；请在项目 Storage 中核对连接，再重试。未创建重复存储。');
    await vc(['blob', 'create-store', 'astra-feedback', '--access', 'private', '--yes', '--environment', 'production', '--environment', 'preview']);
    if (!await hasProductionToken() || !(await listStores()).some(s => s.access === 'private')) throw new Error('存储已创建，但生产环境连接未确认；请在 Storage 核对后重试。');
    log('已创建私有反馈存储，并连接 Production / Preview。');
  } else log('已复用现有私有反馈存储，生产环境令牌已配置。');

  const updated = JSON.parse(await api(`/v9/projects/${project.id}`, { input: JSON.stringify(SETTINGS) }));
  if (!Object.entries(SETTINGS).every(([k, v]) => updated[k] === v)) throw new Error('Vercel 项目配置未完全生效，请核对控制台设置。');
  log('已配置 Other 框架、site 输出、npm ci 安装及 Node.js 22。');
  for (const [key, value] of [['VERCEL_ORG_ID', link.orgId], ['VERCEL_PROJECT_ID', link.projectId]]) {
    await run('gh', ['secret', 'set', key, '--repo', TARGET.repo], { input: value });
  }
  if (env.VERCEL_TOKEN) await run('gh', ['secret', 'set', 'VERCEL_TOKEN', '--repo', TARGET.repo], { input: env.VERCEL_TOKEN });
  else if (!secretNames.has('VERCEL_TOKEN')) {
    log('请在 GitHub CLI 的隐藏输入提示中填写长期 Vercel 部署 token；不会写入源码。');
    await run('gh', ['secret', 'set', 'VERCEL_TOKEN', '--repo', TARGET.repo], { interactive: true });
  }
  const configured = new Set(JSON.parse(await run('gh', ['secret', 'list', '--repo', TARGET.repo, '--json', 'name'])).map(s => s.name));
  if (!['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'].every(k => configured.has(k))) throw new Error('GitHub 发布凭据未全部确认，请重试。');
  log('GitHub 三项发布凭据已配置。未触发发布、未修改 DNS。');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  process.chdir(root);
  if (process.argv.includes('--check')) {
    const config = JSON.parse(fs.readFileSync('vercel.json'));
    if (config.framework !== null || config.outputDirectory !== 'site' || config.installCommand !== 'npm ci' || config.buildCommand !== '') throw new Error('本地 Vercel 配置不匹配。');
    for (const file of ['api/feedback.js', 'lib/feedback.mjs', '.github/workflows/deploy.yml', '.vercelignore']) if (!fs.existsSync(file)) throw new Error(`缺少配置文件：${file}`);
    console.log('本地迁移配置检查通过；账号资源尚需实际配置和验证。');
  } else {
    const run = async (command, args, options = {}) => {
      const executable = command === 'vercel' ? (process.platform === 'win32' ? 'npx.cmd' : 'npx') : command;
      const argv = command === 'vercel' ? ['--yes', 'vercel@62.1.0', ...args] : args;
      try {
        return execFileSync(executable, argv, {
          cwd: root, encoding: 'utf8', input: options.input,
          env: { ...process.env, VERCEL_TELEMETRY_DISABLED: '1' },
          stdio: options.interactive ? 'inherit' : ['pipe', 'pipe', 'pipe'],
          timeout: options.interactive ? undefined : 180000,
        }) || '';
      } catch {
        // CLI 错误输出可能包含账号信息或令牌；不直接打印捕获内容。
        throw new Error(`${command} ${args.slice(0, 2).join(' ')} 未完成。请确认登录、权限及网络；已完成步骤可在重试时复用。`);
      }
    };
    try { await configure({ run, readLink: () => JSON.parse(fs.readFileSync('.vercel/project.json')), interactive: !!process.stdin.isTTY }); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}
