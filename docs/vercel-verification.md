# Vercel 线上配置与验证记录

记录日期：2026-10-02，时间按 UTC+08:00。用户在收尾阶段要求停止继续验收，改为完成提交和部署；以下区分已取得证据与未继续验证的范围。

## 已完成的配置

- 导航项目：`luffysolution-4375s-projects/astra-scinav`，项目 ID `prj_twslERVv4Yh1137RYU1Kj38xstpL`。Other、仓库根目录、输出 `site`、安装 `npm ci`、空 Build Command、Node.js 22。
- 私有存储：`astra-feedback`，ID `store_rE3bN5Afl5ymlneO`，详情 API 的 `access` 为 `private`。只连接目标项目，环境为 Production / Preview，`BLOB_READ_WRITE_TOKEN` 已注入；不记录令牌值。
- GitHub Actions：`VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID` 均存在。当前 CLI OAuth 无法创建长期个人 Token；用户在 Vercel / GitHub 页面完成安全保存后，配置脚本重跑成功。
- 画布复用已有 `luffy-canvas-site`，项目 ID `prj_e81s7fdkusOCmDQlnJX2zQOKCToq`，关联 `luffysolution-svg/infinite-canvas` fork 的 main。安装 `cd web && bun install`，构建 `cd web && bun run build`，输出 `web/dist`；已有 SPA 回退。
- `canvas.yml` 继续同步上游到 fork，Vercel Git 集成配置为跟随 fork main 发布。手动调用 merge-upstream 返回 `merge_type: none`，fork 与上游均为 `dab19adc0847e32e39b7fc8ff90cb392561fb826`，没有虚构新的同步提交。
- 画布 Vercel 项目级 Routing Rule `Astra canvas embedding headers` 已发布：`frame-ancestors 'self' https://nav.luffysite.top https://astra-scinav.vercel.app`，同时设置 nosniff 和 Referrer-Policy。无需改动 fork 源码；随机预览域名未放行。

## 真实验证证据

- Vercel 连接器的团队、项目列表和部署查询实际成功；单项目查询曾出现参数校验不一致，资源写入使用 CLI 完成，未根据“插件已启用”推断连接成功。
- 五类反馈 API 分别返回 201，按返回 UUID 找到私有 JSON 并读回核对字段；未认证下载均返回 403。随后使用真实桌面 Edge 提交五类表单，确认五条记录实际保存。使用合成内容标记，共保留 10 条测试记录，未公开内容。
- Edge 来自 Microsoft 签名的 `msedge.exe`，版本 154.0.4258.48，浏览器品牌含 Microsoft Edge；使用独立无头测试会话。已核验首页收藏刷新持久化、SKILL / Prompt / 绘图列表与检索、文献摘要及复制、404 内容。后续会话曾重启成 Chrome，画布嵌入已重新指定真实 Edge 核验。
- [手动文献同步 run 36918832817](https://github.com/luffysolution-svg/astra-scinav/actions/runs/36918832817) 成功：102/102 来源、3160 篇文章，提交 `6bfab83baf29b5bc76bcd3b52826b909f3b14138` 已推送 main；41 个封面抓取失败属于上游请求限制。
- 数据提交的 [Vercel Git 部署](https://vercel.com/luffysolution-4375s-projects/astra-scinav/CwZbATGynJGwmwSboQs9qLCcuuZm) 状态 READY。原本缺 Token 的 [Actions 发布 run 36920010828](https://github.com/luffysolution-svg/astra-scinav/actions/runs/36920010828) 配置凭据后重跑成功，并重新发布生产别名。
- 在线 `fetchedAt` 为 `2026-10-01T20:13Z`，页面显示最近抓取成功于 **2026-10-02 04:13**。保留原 Service Worker，普通刷新后文章数从 3036 更新为 3160，9 类摘要版本更新，真实摘要加载并复制成功，没有删除缓存。发布过程中旧页面与新摘要数据曾暂时不一致，普通刷新后恢复。
- 画布 [Vercel 生产重新部署](https://vercel.com/luffysolution-4375s-projects/luffy-canvas-site/AryF58MwjNg7KgJ3YyWQz3cG6E5S) 成功。正式画布域名 HTTPS 返回 200、Server 为 Vercel、嵌入 CSP 与配置一致；深层 SPA 路由返回 200。真实 Edge 在 Vercel 导航工作台 iframe 内加载画布并新建文本节点。
- Windows 配置脚本修复 `.cmd` 启动 EINVAL 和 CLI Blob 列表缺少 `access` 两项实测问题。5 项脚本回归测试通过；真实 `npm run migrate:configure` 重跑确认私有存储、两个环境和三项 Secrets。

## DNS 与缓存

Cloudflare 仍管理 nameserver；只修改了 nav 和 canvas 两条 CNAME，两者均为 DNS only、TTL Auto。Vercel 返回两个域名 `configured-correctly`、`verified: true`。

| 记录 | 当前目标 | 原目标 / 回退目标 |
| --- | --- | --- |
| nav CNAME | `24cf9a9183f08969.vercel-dns-017.com` | `astra-scinav.netlify.app` |
| canvas CNAME | `795ff6642e009a68.vercel-dns-017.com` | `astra-canvas.netlify.app` |
| 根域 A | `76.76.21.21`（保留） | 未修改 |
| www A | `76.76.21.21`（保留） | 未修改 |

检查到 Cache Rules 0、Cache Response Rules 0、Caching Level Standard、Browser Cache TTL 4 小时，Always Online / Development Mode 关闭。DNS only 不经过 Cloudflare 缓存，因此未进行整站清缓存或添加缓存规则；未新增或删除其他 DNS 记录。

如需回退画布，只恢复 canvas CNAME 原目标；不要删除 Netlify 项目。导航回退会恢复旧导航版本，不能把包含 `/api/feedback` 的新客户端手动发到旧 Netlify 站。画布数据主要保存在浏览器本地，保留正式域名避免人为改变 origin；没有迁移用户本地数据或宣称云同步。

## Netlify 备用与未验证范围

- [画布 Actions run 36916142387](https://github.com/luffysolution-svg/astra-scinav/actions/runs/36916142387) 构建成功、生产部署 403。使用当前账号对同一站点发起生产部署，API 明确返回 `Account credit usage exceeded - new deploys are blocked until credits are added`；控制台也显示仅剩 operational credits，生产发布暂停。未购买套餐、未删除或停用画布。旧生产版本保留，Vercel 正式画布不依赖这次 Netlify 发布成功。
- Chrome 触屏模拟确认 8 个平台通过 Enter 在当前标签跳转到真实目标：百度、Google、谷歌学术、必应、知网、PubMed、X-MOL、Semantic Scholar。PubMed 落在验证码页；搜索按钮的真实触屏点击未完成验证。Sci-Hub 被浏览器安全策略阻止，未绕过。
- 未进行真实手机 Edge 或中国大陆网络测试，不能保证大陆各地区/运营商的访问。
- nav 域名切换后的完整功能验收，按用户收尾指令未继续。正式域名配置和部署成功不替代这一验收。
- 未用真实 AI Key 发起付费生成或连接用户的本地 Agent；没有把画布 UI 可操作等同于这些外部服务已配置。
- 历史 Netlify Forms 未导出或迁入 Blob；原导航站保留，后续关闭前仍应导出所需历史反馈。
