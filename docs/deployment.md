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

旧 Netlify Forms 无历史提交，查询结果已私有归档到 `archive/netlify-forms/`；旧 Netlify 站点及发布配置已退役，不再维护备用发布链。

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
