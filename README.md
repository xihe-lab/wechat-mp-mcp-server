# WeChat MP MCP Server

[![npm version](https://img.shields.io/npm/v/@xihe-lab/wechat-mp-mcp-server.svg)](https://www.npmjs.com/package/@xihe-lab/wechat-mp-mcp-server)
[![license](https://img.shields.io/npm/l/@xihe-lab/wechat-mp-mcp-server.svg)](https://github.com/xihe-lab/wechat-mp-mcp-server/blob/main/LICENSE)
[![Node.js](https://img.shields.io/node/v/@xihe-lab/wechat-mp-mcp-server.svg)](https://www.npmjs.com/package/@xihe-lab/wechat-mp-mcp-server)
[![CI](https://github.com/xihe-lab/wechat-mp-mcp-server/actions/workflows/build-check.yml/badge.svg)](https://github.com/xihe-lab/wechat-mp-mcp-server/actions/workflows/build-check.yml)

微信公众号 MCP Server，通过 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 接入 Claude、Cursor 等 AI 助手，用自然语言管理微信公众号的素材、草稿和发布。

**25 个工具，三层架构**：官方 API 层（access_token，素材/短文草稿/发布）、Web 会话层（浏览器登录态，长文直写/传图/数据统计，无 IP 白名单依赖）、本地工具层（HTML 发布前检查）。版本历史见 [CHANGELOG](CHANGELOG.md)。

## 系统要求

- Node.js >= 20
- 微信公众号 AppID 和 AppSecret（在 [微信公众平台](https://mp.weixin.qq.com/) → 开发 → 基本配置 中获取）
- 本机 Chrome 浏览器（仅 Web 会话层需要；官方 API 层与 HTML 检查不需要）

## 快速开始

### 1. 获取凭证

#### 方式一：AppID / AppSecret（官方 API 层）

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)，进入 **设置与开发 → 基本配置**
2. 记录 **AppID**，点击"重置"获取 **AppSecret**（只显示一次，注意保存）
3. **IP 白名单**：官方 API 层要求把调用方出口 IP 加入白名单（同一页面下方）。家庭/办公网络切换会导致 40164——可调用 `wechat_auth_health_check` 获取当前出口 IP 与加白指引；或改用方式二规避

开发者文档与接入指引见 [微信开放平台 · 公众号开发](https://developers.weixin.qq.com/platform)（服务端 API 目录、测试号申请、错误码说明均在其中）。

#### 方式二：Web 会话层（免凭证）

只用 **长文直写 / 传图 / 数据统计** 等 Web 会话工具时，无需 AppSecret——首次调用 `wechat_web_login` 扫码登录即可（cookie 持久保存）。适合不想维护 IP 白名单的场景。

### 2. 配置 MCP 客户端

#### 方式一：一键安装命令（Claude Code）

注意替换以下参数（必填项标记为 **必填**，其余可选）。`-s user` 为用户级配置（所有项目生效），改为 `-s project` 则仅当前项目生效：

```bash
claude mcp add -s user wechat-mp \
  --env WECHAT_APP_ID=your_app_id \                            # 必填（官方 API 层）：公众号 AppID
  --env WECHAT_APP_SECRET=your_app_secret \                    # 必填（官方 API 层）：公众号 AppSecret
  --env DATA_DIR=/path/to/data \                               # 可选：数据目录（凭据 + 浏览器 profile），默认 ./data
  --env WECHAT_BROWSER_CHANNEL=chrome \                        # 可选：Web 会话层浏览器，默认本机 Chrome
  --env WECHAT_BROWSER_HEADLESS=false \                        # 可选：是否无头，默认 false（登录需可见窗口扫码）
  -- npx -y "@xihe-lab/wechat-mp-mcp-server@latest"
```

若忘记替换凭证，重新安装前需先卸载旧配置：

```bash
claude mcp list
claude mcp remove wechat-mp
```

#### 方式二：手动配置

编辑 Claude Code 的配置文件（用户目录下 `.claude.json`）：

```json
{
  "mcpServers": {
    "wechat-mp": {
      "command": "npx",
      "args": ["-y", "@xihe-lab/wechat-mp-mcp-server@latest"],
      "env": {
        "WECHAT_APP_ID": "",
        "WECHAT_APP_SECRET": "",
        "DATA_DIR": "",
        "WECHAT_BROWSER_CHANNEL": "chrome",
        "WECHAT_BROWSER_HEADLESS": "false"
      }
    }
  }
}
```

其他客户端配置方式：

- **Claude Desktop**：编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）
- **Cursor / VS Code**：在项目根目录创建 `.cursor/mcp.json` 或 `.vscode/mcp.json`
- **WorkBuddy（腾讯 CodeBuddy 办公客户端）**：见下方专节

配置格式与上方相同。

#### WorkBuddy（腾讯 CodeBuddy 办公客户端）

WorkBuddy 采用标准 `mcpServers` 配置，支持两级配置文件：

| 级别 | 配置文件路径 | 适用场景 |
|------|-------------|---------|
| 用户级 | `~/.workbuddy/mcp.json` | 配置一次，所有项目复用（推荐） |
| 项目级 | `<项目目录>/.workbuddy/mcp.json` | 仅当前项目生效 |

操作入口：侧边栏 **插件** → 右上角 **MCP 服务器** → **配置 MCP**，在可视化编辑器中粘贴与上方相同的 `mcpServers` 配置并保存（也可直接编辑上述路径的 JSON 文件）。

保存后检查 MCP Server 状态灯：🟢 连接成功；🔴 配置异常（依次检查 JSON 格式、`npx` 环境、凭证有效性）。

> 安全提示：`WECHAT_APP_SECRET` 是调用凭证。使用项目级配置时，请将 `.workbuddy/` 加入 `.gitignore`，避免提交到仓库。

#### 方式三：从源码运行

```bash
git clone https://github.com/xihe-lab/wechat-mp-mcp-server.git
cd wechat-mp-mcp-server
pnpm install && pnpm build
```

然后在 MCP 客户端配置中指定构建产物路径：

```json
{
  "mcpServers": {
    "wechat-mp": {
      "command": "node",
      "args": ["/absolute/path/to/wechat-mp-mcp-server/dist/index.js"],
      "env": {
        "WECHAT_APP_ID": "your_app_id",
        "WECHAT_APP_SECRET": "your_app_secret"
      }
    }
  }
}
```

### 3. 开始使用

配置完成后重启客户端，直接用自然语言与 AI 助手对话：

> 帮我上传这张图片作为封面 /path/to/cover.jpg

> 创建一篇草稿，标题是"每周技术分享"，内容如下...

> 检查这篇文章的 HTML 有没有排版问题：/path/to/文章.html

> 扫码登录公众号后台

> 把这篇长文直接写进草稿箱：/path/to/文章-待发布.html

> 查一下最近 7 天的阅读数据

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `WECHAT_APP_ID` | 二选一 | 公众号 AppID |
| `WECHAT_APP_SECRET` | 二选一 | 公众号 AppSecret |
| `DATA_DIR` | 否 | 数据存储目录，默认 `./data`（浏览器登录 profile 存于其下 `browser-profile/`） |
| `WECHAT_BROWSER_CHANNEL` | 否 | Web 会话层使用的浏览器，默认 `chrome`（本机已装的 Google Chrome） |
| `WECHAT_BROWSER_HEADLESS` | 否 | Web 会话层是否无头运行，默认 `false`（登录时需要可见窗口扫码） |

也可以不设环境变量，启动后通过 `wechat_auth_configure` 工具动态配置（凭据会持久化到本地 SQLite）。

## 支持的能力

三层架构：官方 API 层（access_token + IP 白名单）、本地工具层（纯本地无网络）、Web 会话层（浏览器登录态 + 内部接口，无 IP 白名单依赖）。

| 层 | 模块 | 工具数 | 可用操作 |
|----|------|--------|----------|
| 官方 API | 认证管理 | 5 | 配置凭据并验证；获取 Access Token（自动刷新）；强制刷新；凭据健康检查（识别缓存假阳性）；从环境变量同步凭据 |
| 官方 API | 素材管理 | 4 | 上传临时素材；获取临时素材；上传永久图片素材（封面图）；上传正文图片（uploadimg 专用端点） |
| 官方 API | 草稿管理 | 5 | 创建草稿（支持 content_file_path 文件入参）；获取草稿列表/详情；删除草稿；更新草稿 |
| 官方 API | 发布管理 | 4 | 提交发布；获取已发布列表；查询发布状态；删除已发布文章 |
| 本地工具 | HTML 检查 | 1 | 发布前静态检查（ul/li、裸 br、占位符、非 mmbiz 图片、SVG 双事件、字数上限） |
| Web 会话 | 编辑器通道 | 4 | 扫码登录；登录态检查；filetransfer 传图；**长文直写草稿**（不受官方接口 2 万 HTML 字符限制） |
| Web 会话 | 数据统计 | 2 | 图文阅读/分享数据；用户净增/取关数据 |

共 **25 个工具**。AI 助手会根据你的自然语言描述自动选择合适的工具。

## 工具详情

### 认证管理（官方 API 层）

| 工具 | 说明 | 参数 |
|------|------|------|
| `wechat_auth_configure` | 配置 AppID/AppSecret 并验证 | `app_id` (string)、`app_secret` (string) |
| `wechat_auth_get_token` | 获取当前 Access Token（自动刷新） | 无 |
| `wechat_auth_refresh` | 强制刷新 Access Token | 无 |
| `wechat_auth_health_check` | 凭据健康检查：清缓存强制换新 token，识别「缓存未过期但 secret 已失效」的假阳性；失败时返回错误码、出口 IP 与操作指引 | 无 |
| `wechat_auth_sync_from_env` | 从环境变量（必要时解析 `~/.zshenv`）同步凭据到本地存储并清 token 缓存；secret 不出现在返回结果中 | `zshenv_path`（可选） |

### 素材管理（官方 API 层）

| 工具 | 说明 | 参数 |
|------|------|------|
| `wechat_media_upload` | 上传临时素材（有效期 3 天） | `type` (image/voice/video)、`file_path` (本地文件路径) |
| `wechat_media_get` | 获取临时素材内容 | `media_id` |
| `wechat_material_upload_image` | 上传永久图片素材（用于草稿封面图） | `file_path` (JPG/PNG，≤10MB) |
| `wechat_media_uploadimg` | 上传图文正文图片（专用端点），返回可直接嵌入正文 HTML 的 mmbiz URL | `file_path` (JPG/PNG，≤10MB) |

支持的文件格式：
- image：JPG、PNG
- voice：MP3、WMA、WAV、AMR
- video：MP4

文件大小限制：10MB。

### 草稿管理（官方 API 层）

| 工具 | 说明 | 参数 |
|------|------|------|
| `wechat_draft_add` | 创建草稿（最多 8 篇图文） | `articles` 数组 |
| `wechat_draft_list` | 获取草稿列表 | `offset` (默认 0)、`count` (默认 20) |
| `wechat_draft_get` | 获取草稿详情 | `media_id` |
| `wechat_draft_delete` | 删除草稿 | `media_id` |
| `wechat_draft_update` | 更新草稿中的单篇文章（只传需要修改的字段） | `media_id`、`index`、可选字段 |

`wechat_draft_add` 每篇文章的字段：

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 标题 |
| `content` | 二选一 | 正文 HTML（注意：官方接口限制正文 <2 万 HTML 字符，超长会被本工具拦截并提示改用编辑器通道） |
| `content_file_path` | 二选一 | 正文 HTML 的本地文件路径（推荐：server 直接读文件，大内容不经对话上下文转手） |
| `thumb_media_id` | 是 | 封面图 media_id（通过 `wechat_material_upload_image` 获取） |
| `author` | 否 | 作者 |
| `digest` | 否 | 摘要 |
| `content_source_url` | 否 | 原文链接 |
| `show_cover_pic` | 否 | 是否显示封面（默认 true） |

### 发布管理（官方 API 层）

| 工具 | 说明 | 参数 |
|------|------|------|
| `wechat_publish_submit` | 提交发布（草稿 → 发布） | `media_id` |
| `wechat_publish_list` | 获取已发布文章列表 | `offset` (默认 0)、`count` (默认 20) |
| `wechat_publish_get` | 查询发布状态 | `article_id` |
| `wechat_publish_delete` | 删除已发布文章 | `article_id` |

发布为异步操作，`wechat_publish_submit` 后需轮询 `wechat_publish_get` 确认状态。

### HTML 检查（本地工具层）

| 工具 | 说明 | 参数 |
|------|------|------|
| `wechat_html_check` | 发布前静态检查：ul/li 残留、裸 br 换行丢失风险、占位符残留、非 mmbiz 图片、script 标签、SVG 动画双事件、去标签字数上限预警 | `file_path` |

### Web 会话层（编辑器通道 + 数据统计）

| 工具 | 说明 | 参数 |
|------|------|------|
| `wechat_web_login` | 扫码登录公众号后台（打开 Chrome 窗口），登录一次后 cookie 持久保存 | `timeout_ms`（默认 300000） |
| `wechat_web_status` | 检查登录态（未登录不报错，返回登录指引） | 无 |
| `wechat_web_upload_image` | filetransfer 通道上传图片，返回 mmbiz URL（不依赖 IP 白名单） | `file_path` |
| `wechat_web_write_draft` | **长文直写草稿**：读本地 HTML → lint 预检 → 外链降级 → 图片自动上图床 → 创建完整草稿；返回 appMsgId 与编辑器 URL | `file_path` 必填；`title`/`author`/`digest`/`source_url`/`show_cover_pic`/`auto_process_images`/`strip_links`/`wrap_section` 可选 |
| `wechat_stats_article_summary` | 图文阅读/分享数据（按日，跨度 ≤7 天） | `begin_date`、`end_date` |
| `wechat_stats_user_summary` | 用户净增/取关数据（按日，跨度 ≤7 天） | `begin_date`、`end_date` |

## Web 会话层与登录

Web 会话层用于解决官方 API 的两个硬限制：**draft/add 接口的 2 万 HTML 字符上限**（长文排版 HTML 通常 5–10 万字符）与 **IP 白名单依赖**（家庭/办公网络切换即 40164）。它通过一个持久化的浏览器 profile 维护公众号后台登录态，所有操作以你自己的登录态调用后台内部接口（与主流公众号工具同一模式，等效人工操作）。

使用流程：

1. 首次使用调用 `wechat_web_login`，会打开 Chrome 窗口展示二维码，扫码确认后 cookie 持久保存（存于 `DATA_DIR/browser-profile/`），日常操作无需重复登录
2. 之后直接调用 `wechat_web_write_draft` 写入长文草稿——正文图片自动上传图床、非微信域名外链自动降级为纯文本
3. 工具返回 `editor_url`，在浏览器打开即可人工预览、补充封面后发表

**发布最后一步保持人工**：每天仅 1 次群发额度且发错不可撤回，`wechat_web_write_draft` 只到「草稿已保存」，最终发表由人工确认，这也与发布前人工审核流程互补。

浏览器要求：默认使用本机已安装的 Google Chrome（`channel: 'chrome'`），无需额外下载；可通过 `WECHAT_BROWSER_CHANNEL` 切换（如 `msedge`）。

## 典型工作流

短文（HTML <2 万字符）走官方 API：

```
AI 生成文章内容
  → wechat_material_upload_image（上传封面图，获取 thumb_media_id）
  → wechat_draft_add（创建草稿，content 可用 content_file_path 指向本地文件）
  → wechat_draft_get（预览草稿，人工审核）
  → wechat_publish_submit（提交发布）
  → wechat_publish_get（确认发布状态）
```

长文（排版 HTML，5–10 万字符）走 Web 会话层：

```
AI 生成排版 HTML → 存本地文件
  → wechat_html_check（发布前静态检查）
  → wechat_web_login（仅首次，扫码）
  → wechat_web_write_draft（长文直写：图片自动上图床、外链自动降级）
  → 浏览器打开 editor_url 人工预览/补充封面 → 人工点发表
  → wechat_stats_article_summary（发布后 1h/24h 记录阅读数据）
```

## 常见问题

### AI 助手没有识别到微信工具

确认 Node.js >= 20 已安装，npx 可正常执行。修改配置后需重启客户端。

### MCP 客户端报 -32000 连接失败

server 进程启动即崩溃，常见原因：本地源码方式运行但未 `pnpm install`（dist 外部化了 better-sqlite3 等原生依赖）。先安装依赖再启动。另外避免同一台机器重复注册多个 server 实例指向同一 `DATA_DIR`——浏览器 profile 是单实例的，第二个实例会被 Chrome SingletonLock 拒绝。

### 工具返回"AppID 或 AppSecret 未配置"

检查环境变量 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` 是否正确设置，或通过 `wechat_auth_configure` 工具配置。

### Token 获取失败（40164 / 40125）

- `40164 invalid ip ... not in whitelist`：当前出口 IP 不在白名单。调用 `wechat_auth_health_check` 会返回当前出口 IP 与加白路径指引；切网后 IP 变化属正常现象。Web 会话层不受 IP 白名单影响，可作替代通道
- `40125 invalid appsecret`：AppSecret 已失效（平台侧重置过）。更新 `~/.zshenv` 后调用 `wechat_auth_sync_from_env` 同步本地 SQLite 并自动验证——不要在对话中明文发送 secret

### Web 会话工具报"登录态无效或已过期"（200003）

重新调用 `wechat_web_login` 扫码即可；持久化 profile 让扫码频率保持在最低（通常仅在 cookie 过期或长期未用时需要）。

### 上传图片返回格式不支持

确认文件格式为 JPG 或 PNG，且不超过 10MB。

### 发布后查询状态一直显示"发布中"

微信发布审核可能需要几分钟，请稍后再次查询。如果长时间未成功，登录微信公众平台后台检查。

## 更新

MCP 客户端使用 `npx` 运行时会自动检查并下载最新版本。如需确保使用最新版本：

### Claude Code

重新安装配置（会自动使用最新版本）：

```bash
claude mcp remove wechat-mp
claude mcp add -s user wechat-mp \
  --env WECHAT_APP_ID=your_app_id \
  --env WECHAT_APP_SECRET=your_app_secret \
  -- npx -y "@xihe-lab/wechat-mp-mcp-server@latest"
```

### Claude Desktop / Cursor

修改配置文件中的版本号为 `@latest` 或删除版本锁定（WorkBuddy 的配置文件路径见「配置 MCP 客户端 → WorkBuddy」小节）：

```json
{
  "mcpServers": {
    "wechat-mp": {
      "command": "npx",
      "args": ["-y", "@xihe-lab/wechat-mp-mcp-server@latest"],
      "env": { ... }
    }
  }
}
```

### npm 全局安装方式

如果通过 npm 全局安装使用：

```bash
# 查看当前版本
npm list -g @xihe-lab/wechat-mp-mcp-server

# 更新到最新版本
npm update -g @xihe-lab/wechat-mp-mcp-server

# 或指定版本安装
npm install -g @xihe-lab/wechat-mp-mcp-server@0.2.0
```

更新后需重启 MCP 客户端。

### npx 缓存清理

如果 npx 使用了旧版本缓存，可手动清理后重新运行：

```bash
# 清理 npx 缓存
npx clear-npx-cache

# 或手动删除缓存目录
rm -rf ~/.npm/_npx
```

### 查看版本信息

```bash
# 查看最新发布版本
npm view @xihe-lab/wechat-mp-mcp-server version

# 查看所有已发布版本
npm view @xihe-lab/wechat-mp-mcp-server versions
```

各版本变更明细见 [CHANGELOG.md](CHANGELOG.md)；发布走 GitHub Actions 可信发布（OIDC），见 `releases/<版本>` 分支流水线。

## 本地开发

```bash
git clone https://github.com/xihe-lab/wechat-mp-mcp-server.git
cd wechat-mp-mcp-server
pnpm install
pnpm build
pnpm dev
```

添加新工具：在 `src/tools/` 下创建模块文件，导出 `registerXxxTools(server)` 函数，然后在 `src/index.ts` 中导入并调用。

## 许可证

[Apache-2.0](LICENSE)
