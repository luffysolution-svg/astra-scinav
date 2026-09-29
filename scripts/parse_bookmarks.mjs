// 解析 Chrome 书签导出文件，保留文件夹路径
import fs from 'node:fs';

const html = fs.readFileSync(process.argv[2], 'utf8');
const out = [];
const stack = [];
let pending = null;
const tok = /<DT><H3[^>]*>([\s\S]*?)<\/H3>|<DL>|<\/DL>|<DT><A[^>]*HREF="([^"]+)"[^>]*>([\s\S]*?)<\/A>/gi;
let m;
while ((m = tok.exec(html))) {
  const t = m[0].toUpperCase();
  if (m[1] !== undefined) pending = m[1].trim();
  else if (t === '<DL>') { stack.push(pending ?? ''); pending = null; }
  else if (t === '</DL>') stack.pop();
  else if (m[2]) out.push({ name: m[3].replace(/<[^>]+>/g, '').trim(), url: m[2], folder: stack.filter(Boolean).join(' / ') });
}
fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
console.log(out.length);
