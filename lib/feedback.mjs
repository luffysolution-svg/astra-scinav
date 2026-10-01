import { randomUUID } from 'node:crypto';

const LIMIT = 64000;
const TYPES = {
  suggest: { name: 40, url: 2048, desc: 80 },
  'suggest-skill': { url: 2048, desc: 300 },
  'suggest-prompt': { title: 40, prompt: 4000, url: 2048 },
  'suggest-figure': { url: 2048, desc: 300 },
  report: { item: 2048, page: 512, url: 2048, reason: 40, note: 500 },
};
const REASONS = ['链接失效', '跳转到其他网站', '信息有误', '协议或版权问题', '其他'];

async function readBody(req) {
  if (Number(req.headers['content-length']) > LIMIT) throw new Error('size');
  let body = req.body;
  if (body === undefined) {
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > LIMIT) throw new Error('size');
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > LIMIT) throw new Error('size');
    body = Object.fromEntries(new URLSearchParams(body));
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > LIMIT) throw new Error('body');
  return body;
}

export function createFeedbackHandler({ put, env = process.env }) {
  // 仅为同一实例的突发提交节流；生产全局限流可在 Vercel Firewall 配置。
  const bursts = new Map();
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const send = (code, body) => res.status(code).json(body);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(405, { ok: false, error: '仅支持提交表单' });
    }
    let origin;
    try { origin = new URL(req.headers.origin); } catch { return send(403, { ok: false, error: '请从网站页面提交' }); }
    if (!/^https?:$/.test(origin.protocol) || origin.host !== req.headers.host) return send(403, { ok: false, error: '请从网站页面提交' });
    if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(req.headers['content-type'] || '')) return send(415, { ok: false, error: '表单格式不正确' });
    let body;
    try { body = await readBody(req); }
    catch (e) { return send(e.message === 'size' ? 413 : 400, { ok: false, error: '提交内容过长或格式不正确' }); }
    if (body['bot-field']) return send(200, { ok: true });
    const type = body['form-name'];
    if (typeof type !== 'string' || !Object.hasOwn(TYPES, type)) return send(400, { ok: false, error: '未知表单' });
    const fields = {};
    for (const [key, max] of Object.entries(TYPES[type])) {
      const v = body[key] ?? '';
      if (typeof v !== 'string' || v.trim().length > max) return send(400, { ok: false, error: '表单字段格式不正确或过长' });
      fields[key] = v.trim();
    }
    const optionalUrl = type === 'suggest-prompt';
    if (fields.url || !optionalUrl) {
      let url;
      try { url = new URL(fields.url); } catch { return send(400, { ok: false, error: '请填写有效链接' }); }
      if (!/^https?:$/.test(url.protocol) || url.username || url.password || (type === 'suggest-skill' && url.hostname !== 'github.com')) return send(400, { ok: false, error: '链接格式不正确' });
    }
    if (type === 'suggest-prompt' && (!fields.title || !fields.prompt)) return send(400, { ok: false, error: '请填写用途和提示词' });
    if (type === 'report' && !REASONS.includes(fields.reason)) return send(400, { ok: false, error: '请选择问题类型' });
    if (!env.BLOB_READ_WRITE_TOKEN) return send(503, { ok: false, error: '反馈服务暂未配置，请稍后重试' });
    const ip = String(req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
    const now = Date.now(), prev = bursts.get(ip);
    if (prev && now - prev.time < 60000 && prev.count >= 10) return send(429, { ok: false, error: '提交过于频繁，请稍后重试' });
    if (bursts.size > 1000) for (const [key, value] of bursts) if (now - value.time >= 60000) bursts.delete(key);
    if (bursts.size > 1000) return send(429, { ok: false, error: '提交繁忙，请稍后重试' });
    bursts.set(ip, prev && now - prev.time < 60000 ? { time: prev.time, count: prev.count + 1 } : { time: now, count: 1 });
    const id = randomUUID(), createdAt = new Date(now).toISOString();
    try {
      await put(`feedback/${createdAt.slice(0, 10)}/${id}.json`, JSON.stringify({ id, type, createdAt, fields }), {
        access: 'private', contentType: 'application/json', addRandomSuffix: false,
        token: env.BLOB_READ_WRITE_TOKEN,
      });
    } catch {
      // 不在日志中输出反馈内容或存储凭据，也不返回私有文件地址。
      console.error('Feedback storage failed');
      return send(503, { ok: false, error: '反馈暂未保存，请稍后重试' });
    }
    return send(201, { ok: true, id });
  };
}
