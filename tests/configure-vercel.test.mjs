import test from 'node:test';
import assert from 'node:assert/strict';
import { configure, TARGET, SETTINGS } from '../scripts/configure_vercel.mjs';

function fixture({ stores = [], token = false, secrets = ['VERCEL_TOKEN'], accountId = TARGET.teamId } = {}) {
  const calls = [], logs = [], secretNames = new Set(secrets);
  const project = { id: 'prj_fixture', name: TARGET.project, accountId };
  let connected = stores, production = token;
  const run = async (command, args, options = {}) => {
    calls.push({ command, args, input: options.input });
    if (command === 'gh') {
      if (args[1] === 'list') return JSON.stringify([...secretNames].map(name => ({ name })));
      if (args[1] === 'set') { secretNames.add(args[2]); return ''; }
    }
    if (args[0] === 'link') return '';
    if (args[0] === 'blob') {
      if (args[1] === 'list-stores') return JSON.stringify({ stores: connected });
      if (args[1] === 'create-store') { connected = [{ access: 'private' }]; production = true; return ''; }
    }
    if (args[0] === 'api') {
      if (args[1].endsWith('/env')) return JSON.stringify({ envs: production ? [{ key: 'BLOB_READ_WRITE_TOKEN', target: ['production', 'preview'] }] : [] });
      if (options.input) return JSON.stringify({ ...project, ...JSON.parse(options.input) });
      return JSON.stringify(project);
    }
    assert.fail(`Unexpected command: ${command} ${args.join(' ')}`);
  };
  return { calls, logs, options: { run, readLink: () => ({ projectId: project.id, orgId: TARGET.teamId }), env: {}, log: message => logs.push(message) } };
}

test('new project setup creates a private store and writes both project IDs without deploying', async () => {
  const f = fixture(); await configure(f.options);
  const create = f.calls.find(c => c.args[1] === 'create-store');
  assert.ok(create); assert.equal(create.args[create.args.indexOf('--access') + 1], 'private');
  assert.ok(create.args.includes('production')); assert.ok(create.args.includes('preview'));
  const patch = f.calls.find(c => c.command === 'vercel' && c.input);
  assert.deepEqual(JSON.parse(patch.input), SETTINGS);
  assert.deepEqual(f.calls.filter(c => c.command === 'gh' && c.args[1] === 'set').map(c => [c.args[2], c.input]), [['VERCEL_ORG_ID', TARGET.teamId], ['VERCEL_PROJECT_ID', 'prj_fixture']]);
  assert.ok(f.calls.every(c => !c.args.includes('deploy') && !c.args.includes('dns') && !c.args.includes('workflow')));
});
test('repeated setup reuses one existing private production store and preserves the deployment token', async () => {
  const f = fixture({ stores: [{ access: 'private' }], token: true }); await configure(f.options);
  assert.ok(!f.calls.some(c => c.args[1] === 'create-store'));
  assert.ok(!f.calls.some(c => c.args[1] === 'set' && c.args[2] === 'VERCEL_TOKEN'));
});
test('ambiguous, public or unconnected stores stop before creating resources or patching settings', async () => {
  for (const options of [
    { stores: [{ access: 'public' }], token: true },
    { stores: [{ access: 'private' }], token: false },
    { stores: [{ access: 'private' }, { access: 'public' }], token: true },
  ]) {
    const f = fixture(options); await assert.rejects(configure(f.options), /已有存储/);
    assert.ok(!f.calls.some(c => c.args[1] === 'create-store' || c.input));
  }
});
test('wrong team or missing noninteractive credentials stop before writes', async () => {
  const wrong = fixture({ accountId: 'team_other' }); await assert.rejects(configure(wrong.options), /不匹配/);
  assert.equal(wrong.calls.length, 1);
  const missing = fixture({ secrets: [] }); await assert.rejects(configure(missing.options), /缺少 Actions/);
  assert.ok(!missing.calls.some(c => c.args[0] === 'link' || c.input));
});
test('provided deployment token travels through stdin and is absent from logs and arguments', async () => {
  const f = fixture({ stores: [{ access: 'private' }], token: true }); f.options.env = { VERCEL_TOKEN: 'test-secret-value' };
  await configure(f.options);
  const upload = f.calls.find(c => c.args[2] === 'VERCEL_TOKEN'); assert.equal(upload.input, 'test-secret-value');
  assert.ok(!JSON.stringify(f.calls.map(c => c.args)).includes('test-secret-value'));
  assert.ok(!f.logs.join('\n').includes('test-secret-value'));
});
