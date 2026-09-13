# Changelog

本项目的所有显著变更都记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本管理遵循 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [0.2.0] - 2026-09-13

围绕一个核心痛点重构发布链路：官方 draft/add 接口限制正文 <2 万 HTML 字符，
而公众号长文排版 HTML 通常 5–10 万字符，导致此前「只能建骨架草稿 + 人工粘贴」。
本版引入 Web 会话层（编辑器通道）彻底解决（基于真实使用调研与公众号后台互操作性分析）。

### 新增

**Web 会话层（浏览器登录态 + 后台内部接口，无 IP 白名单依赖）**
- `wechat_web_login`：扫码登录公众号后台，cookie 持久化（`DATA_DIR/browser-profile/`），一次登录长期有效
- `wechat_web_status`：登录态检查（未登录不报错，返回指引）
- `wechat_web_upload_image`：filetransfer 通道传图，返回 mmbiz URL
- `wechat_web_write_draft`：**长文全文直写草稿**——server 端读本地 HTML 文件、lint 红线预检、
  非微信外链自动降级、图片自动上图床，经 operate_appmsg 创建完整草稿并返回编辑器 URL；
  最终发表保持人工（每天仅 1 次群发额度，不可逆）
- `wechat_stats_article_summary` / `wechat_stats_user_summary`：图文阅读/分享与用户净增数据
  （web 后台 misc 接口，cookie 鉴权）

**本地工具层**
- `wechat_html_check`：发布前静态检查——ul/li 残留、裸 br（未包独立 `<span leaf>`）、占位符残留、
  非 mmbiz 图片、script 标签、SVG animate 双事件、去标签字数上限预警

**凭据健壮性（官方 API 层）**
- `wechat_auth_health_check`：清缓存强制向平台换 token 试真，识别「缓存 token 假阳性」
  （本地 token 未过期但 AppSecret 已失效）；40164 附当前出口 IP 与加白指引
- `wechat_auth_sync_from_env`：从进程环境变量 / `~/.zshenv` 同步凭据到本地 SQLite 并清缓存
  （解决「平台重置 secret 后 DB 残留旧值」），secret 不经对话明文

**官方 API 增强**
- `wechat_media_uploadimg`：正文图专用端点（区别于封面素材），返回可直接嵌入正文的 mmbiz URL
- `wechat_draft_update`：官方 `/draft/update`，按 media_id + index 局部更新
- `wechat_draft_add` 支持 `content_file_path` 文件入参（大内容不经对话上下文转手），超 2 万字符拦截并提示改走编辑器通道

**工程**
- GitHub Actions：`build-check.yml`（PR/分支门禁）、`release.yml`（`releases/<版本>` 分支触发 →
  npm OIDC Trusted Publishing → 幂等 tag + GitHub Release）
- 单元测试 22 → 51 例（html-lint / webhub-api / errors 适配）
- 文档：README 三层架构工具表（14 → 25）、FSD 全面补充（v0.2.0 章节）、PRD 变更摘要、特性调研报告

### 变更

- 网络超时 10s → 30s；token 获取失败信息附可操作指引（40164 / 40125 分类）
- 错误码扩展：`WECHAT_007`（浏览器/Web 会话）、`WECHAT_008`（HTML 校验）、`WECHAT_009`（后台未登录）

### 修复

- `media_get` 响应头类型导致的 tsc 严格模式报错

### 移除

- 死依赖 `express` / `cors`（stdio server 从未使用）
- `engines.node` 从 `>=18` 收紧为 `>=20`（对齐 better-sqlite3@12 与 playwright-core 的实际要求）

## [0.1.2] - 2026-06-07

### 修复

- 源码入口补 shebang，修复 npm bin 直接执行失败

## [0.1.1] - 2026-06-07

### 修复

- npm bin 入口 shebang 注入与包描述修正

## [0.1.0] - 2026-06-07

### 新增

- 初始版本：14 个 MCP 工具（认证 3 / 素材 3 / 草稿 4 / 发布 4）
- SQLite 凭据与 token 持久化、错误处理与日志脱敏、Vite 库模式构建

[0.2.0]: https://github.com/xihe-lab/wechat-mp-mcp-server/releases/tag/v0.2.0
[0.1.2]: https://github.com/xihe-lab/wechat-mp-mcp-server/releases/tag/v0.1.2
[0.1.1]: https://github.com/xihe-lab/wechat-mp-mcp-server/releases/tag/v0.1.1
[0.1.0]: https://github.com/xihe-lab/wechat-mp-mcp-server/releases/tag/v0.1.0
