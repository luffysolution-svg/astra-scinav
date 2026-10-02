# Vercel 部署与维护

导航和独立画布仅使用 Vercel。Cloudflare 保留 DNS 管理；画布仍是独立项目，源码跟随上游 fork，不搬入导航仓库。

## 项目与域名

团队：`luffysolution-4375s-projects`（`team_cYDpJCxe3TbR9wKh0NoiK9MP`）。

| 项目 | 正式域名 | 默认域名 | Git 仓库 |
| --- | --- | --- | --- |
| astra-scinav | nav.luffysite.top | astra-scinav.vercel.app | luffysolution-svg/astra-scinav main |
| luffy-canvas-site | canvas.luffysite.top | luffy-canvas-site.vercel.app | luffysolution-svg/infinite-canvas main |

导航项目 ID 为 `prj_twslERVv4Yh1137RYU1Kj38xstpL`：Other、仓库根目录、输出 `site`、安装 `npm ci`、空 Build Command、Node.js 22。页面为原生静态文件，五类反馈使用 `/api/feedback`。

画布项目 ID 为 `prj_e81s7fdkusOCmDQlnJX2zQOKCToq`：安装 `cd web && bun install`、构建 `cd web && bun run build`、输出 `web/dist`，项目已有 SPA 回退。`.github/workflows/canvas.yml` 每小时同步 `basketikun/infinite-canvas` 到 fork；新提交由 Vercel Git 集成发布，不需要第二套构建或部署步骤。手动同步可运行 `gh workflow run canvas.yml`，定时暂停使用仓库变量 `CANVAS_SYNC_PAUSED=true`。

## 私有反馈与自动发布

Private Blob `astra-feedback`（`store_rE3bN5Afl5ymlneO`）连接导航项目的 Production / Preview，环境变量 `BLOB_READ_WRITE_TOKEN` 已注入。反馈写入 `feedback/YYYY-MM-DD/<UUID>.json`；人工审核，不提供公开读取入口。凭据、反馈正文和私有下载地址不得提交或输出。

Actions 保留 `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`，画布同步保留 `CANVAS_FORK_TOKEN`。部署 Token 名称为 `astra-scinav-github-actions`，值只能通过安全输入保存。

普通 main push 由 Vercel Git 发布。文献、Skill/Prompt 同步和定时/手动外链核验由 `deploy.yml` 的 `workflow_run` 接续生产 CLI 发布；普通 push 的接续发布跳过，避免重复部署。

```bash
npm run migrate:check
npm run migrate:configure
gh workflow run news.yml
gh workflow run canvas.yml
npx --yes vercel@62.1.0 inspect https://nav.luffysite.top --scope luffysolution-4375s-projects
npx --yes vercel@62.1.0 --prod --yes --scope luffysolution-4375s-projects
```

配置脚本用于已登录 Vercel / GitHub 的终端：复用私有存储，核对两个环境，设置项目和 Actions Secrets；不部署或修改 DNS。生产环境变量修改后需要重新部署。`.vercelignore` 只上传页面、函数和运行配置；`raw/`、私人笔记与凭据不上传。

## DNS、安全头与缓存

| Cloudflare 记录 | 目标 | 模式 |
| --- | --- | --- |
| nav CNAME | 24cf9a9183f08969.vercel-dns-017.com | DNS only / TTL Auto |
| canvas CNAME | 795ff6642e009a68.vercel-dns-017.com | DNS only / TTL Auto |

其他 DNS 保留，包括 apex / www 的 A 记录 `76.76.21.21`。DNS only 不经过 Cloudflare 缓存；没有整站清缓存或新增缓存规则。不要把 HTML、数据、Service Worker 或 API 配成强制全站缓存。

导航响应头在 `vercel.json`；画布项目 Routing Rule 的 `frame-ancestors` 只允许 self、`https://nav.luffysite.top`、`https://astra-scinav.vercel.app`，不放行随机预览域名。画布数据主要保存在浏览器本地；正式域名保持不变，未迁移用户本地数据或宣称云同步。

## 2026-10-02 验收快照

- 真实 Microsoft 签名桌面 Edge 154.0.4258.48：首页收藏刷新、自定义站点 v4 实际导出/导入恢复，SKILL / Prompt / 绘图检索、收藏、复制与大图预览通过。五类实际 UI 反馈分别返回 201，按 UUID 私有读回一致，匿名下载均为 403。
- 正式导航 iframe 内创建并编辑画布文本，重新载入同一画布后文本保留；两个正式域名 HTTPS 200、画布深层 SPA 200、导航未知路径 404，CSP 实际核对。
- [文献同步 36962759193](https://github.com/luffysolution-svg/astra-scinav/actions/runs/36962759193) 与 [接续发布 36963220514](https://github.com/luffysolution-svg/astra-scinav/actions/runs/36963220514) 成功。页面 `fetchedAt=2026-10-02T04:08Z`（UTC+8 12:08）、3177 篇；保持 `astra-v16` 和旧摘要缓存，普通刷新四类摘要哈希更新，摘要加载/复制与五个主页面离线打开通过。
- 本轮抓取 98/102 来源成功：四个 arXiv 来源发生 429 或超时，24 个封面下载失败。工作流成功不等于所有来源抓取成功。
- 真实桌面 Edge 触屏模拟完成八个平台 × Enter / 点击，共 16 次正确关键词的当前标签导航。百度/知网验证页、Google 一次 429、X-MOL 429、Semantic Scholar 202 未确认结果内容；Sci-Hub 前轮安全策略阻止，未绕过。实体手机 Edge、中国大陆网络、付费 AI 和本地 Agent 未实测。
- 旧 Netlify Forms 的五类正常记录/垃圾箱及站点总表共 12 次查询，均为 0；查询结果已保存在 Private Blob 的 `archive/netlify-forms/`，读回一致、匿名 403，SHA-256 `616898ddd4579e36587dd803d0f47f47eeed03345345a63f43c77fd7d8aefbc3`。删除前重新核对无新增记录，按后续授权删除旧 `astra-scinav` / `astra-canvas` 两站，API 均返回 204、读回 404；仓库 Netlify 配置、专用 Secret / Variable 和本地关联已移除，不再维护备用发布链。

以上时间和数量是验收快照；后续状态以实际 Actions、Vercel 部署和页面为准。
