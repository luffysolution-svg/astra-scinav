# 安全问题披露

请通过本仓库的 [GitHub Private Vulnerability Reporting](https://github.com/luffysolution-svg/astra-scinav/security/advisories/new) 私下报告安全问题，提供受影响页面、复现步骤与影响说明。不要在公开 Issue、PR 或评论中发布有效凭据、用户资料或可利用的敏感细节；普通功能问题可提交公开 Issue。

本项目的反馈接口 `/api/feedback` 是公开提交入口，使用服务端环境变量写入 Private Blob，不提供公开的反馈读取接口。请勿把反馈记录、部署凭据、`.env` 或本地授权配置提交到仓库。反馈限流只覆盖单个函数实例的短时突发，生产环境需要时应另行配置平台限流。

收藏、备注和备份属于用户当前浏览器的数据。绘图画布是独立应用，其 API Key、作品与请求受该应用的实现及配置管理；导航仓库的安全检查不覆盖画布上游、用户选择的 AI 接口或外部资源网站。

维护者会根据复现情况评估问题和修复范围。现有检查不能保证不存在漏洞。
