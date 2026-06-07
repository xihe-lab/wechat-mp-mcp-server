# WeChat MP MCP Server

[![npm version](https://img.shields.io/npm/v/@xihe-lab/wechat-mp-mcp-server.svg)](https://www.npmjs.com/package/@xihe-lab/wechat-mp-mcp-server)
[![license](https://img.shields.io/npm/l/@xihe-lab/wechat-mp-mcp-server.svg)](https://github.com/xihe-lab/wechat-mp-mcp-server/blob/main/LICENSE)
[![Node.js](https://img.shields.io/node/v/@xihe-lab/wechat-mp-mcp-server.svg)](https://www.npmjs.com/package/@xihe-lab/wechat-mp-mcp-server)

微信公众号 MCP Server，通过 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 接入 Claude、Cursor 等 AI 助手，用自然语言管理微信公众号的素材、草稿和发布。

## 系统要求

- Node.js >= 18
- 微信公众号 AppID 和 AppSecret（在 [微信公众平台](https://mp.weixin.qq.com/) → 开发 → 基本配置 中获取）

## 快速开始

### 1. 配置 MCP 客户端

#### 方式一：一键安装命令（Claude Code）

替换必填参数后执行。`-s user` 为用户级配置（所有项目生效），改为 `-s project` 则仅当前项目生效：

```bash
claude mcp add -s user wechat-mp \
  --env WECHAT_APP_ID=your_app_id \
  --env WECHAT_APP_SECRET=your_app_secret \
  -- npx -y "@xihe-lab/wechat-mp-mcp-server@latest"
```

若忘记替换凭证，重新安装前需先卸载旧配置：

```bash
claude mcp list
claude mcp remove wechat-mp
```

#### 方式二：手动配置

编辑 Claude Code 配置文件（用户目录下 `.claude.json`）：

```json
{
  "mcpServers": {
    "wechat-mp": {
      "command": "npx",
      "args": ["-y", "@xihe-lab/wechat-mp-mcp-server@latest"],
      "env": {
        "WECHAT_APP_ID": "your_app_id",
        "WECHAT_APP_SECRET": "your_app_secret"
      }
    }
  }
}
```

其他客户端配置方式：

- **Claude Desktop**：编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）
- **Cursor / VS Code**：在项目根目录创建 `.cursor/mcp.json` 或 `.vscode/mcp.json`

配置格式与上方相同。

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

### 2. 开始使用

配置完成后重启客户端，直接用自然语言与 AI 助手对话：

> 帮我上传这张图片作为封面 /path/to/cover.jpg

> 创建一篇草稿，标题是"每周技术分享"，内容如下...

> 查看最近的草稿列表

> 把这篇草稿发布出去

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `WECHAT_APP_ID` | 二选一 | 公众号 AppID |
| `WECHAT_APP_SECRET` | 二选一 | 公众号 AppSecret |
| `DATA_DIR` | 否 | 数据存储目录，默认 `./data` |

也可以不设环境变量，启动后通过 `wechat_auth_configure` 工具动态配置（凭据会持久化到本地 SQLite）。

## 支持的能力

| 模块 | 工具数 | 可用操作 |
|------|--------|----------|
| 认证管理 | 3 | 配置凭据并验证；获取 Access Token（自动刷新）；强制刷新 Token |
| 素材管理 | 3 | 上传临时素材（图片/语音/视频）；获取临时素材；上传永久图片素材（封面图） |
| 草稿管理 | 4 | 创建草稿（支持多图文最多 8 篇）；获取草稿列表；获取草稿详情；删除草稿 |
| 发布管理 | 4 | 提交发布；获取已发布列表；查询发布状态；删除已发布文章 |

共 **14 个工具**。AI 助手会根据你的自然语言描述自动选择合适的工具。

## 工具详情

### 认证管理

| 工具 | 说明 | 参数 |
|------|------|------|
| `wechat_auth_configure` | 配置 AppID/AppSecret 并验证 | `app_id` (string)、`app_secret` (string) |
| `wechat_auth_get_token` | 获取当前 Access Token（自动刷新） | 无 |
| `wechat_auth_refresh` | 强制刷新 Access Token | 无 |

### 素材管理

| 工具 | 说明 | 参数 |
|------|------|------|
| `wechat_media_upload` | 上传临时素材（有效期 3 天） | `type` (image/voice/video)、`file_path` (本地文件路径) |
| `wechat_media_get` | 获取临时素材内容 | `media_id` |
| `wechat_material_upload_image` | 上传永久图片素材（用于草稿封面图） | `file_path` (JPG/PNG，≤10MB) |

支持的文件格式：
- image：JPG、PNG
- voice：MP3、WMA、WAV、AMR
- video：MP4

文件大小限制：10MB。

### 草稿管理

| 工具 | 说明 | 参数 |
|------|------|------|
| `wechat_draft_add` | 创建草稿（最多 8 篇图文） | `articles` 数组 |
| `wechat_draft_list` | 获取草稿列表 | `offset` (默认 0)、`count` (默认 20) |
| `wechat_draft_get` | 获取草稿详情 | `media_id` |
| `wechat_draft_delete` | 删除草稿 | `media_id` |

`wechat_draft_add` 每篇文章的字段：

| 字段 | 必填 | 说明 |
|------|------|------|
| `title` | 是 | 标题 |
| `content` | 是 | 正文 HTML |
| `thumb_media_id` | 是 | 封面图 media_id（通过 `wechat_material_upload_image` 获取） |
| `author` | 否 | 作者 |
| `digest` | 否 | 摘要 |
| `content_source_url` | 否 | 原文链接 |
| `show_cover_pic` | 否 | 是否显示封面（默认 true） |

### 发布管理

| 工具 | 说明 | 参数 |
|------|------|------|
| `wechat_publish_submit` | 提交发布（草稿 → 发布） | `media_id` |
| `wechat_publish_list` | 获取已发布文章列表 | `offset` (默认 0)、`count` (默认 20) |
| `wechat_publish_get` | 查询发布状态 | `article_id` |
| `wechat_publish_delete` | 删除已发布文章 | `article_id` |

发布为异步操作，`wechat_publish_submit` 后需轮询 `wechat_publish_get` 确认状态。

## 典型工作流

```
AI 生成文章内容
  → wechat_material_upload_image（上传封面图，获取 thumb_media_id）
  → wechat_draft_add（创建草稿）
  → wechat_draft_get（预览草稿，人工审核）
  → wechat_publish_submit（提交发布）
  → wechat_publish_get（确认发布状态）
```

## 常见问题

### AI 助手没有识别到微信工具

确认 Node.js >= 18 已安装，npx 可正常执行。修改配置后需重启客户端。

### 工具返回"AppID 或 AppSecret 未配置"

检查环境变量 `WECHAT_APP_ID` 和 `WECHAT_APP_SECRET` 是否正确设置，或通过 `wechat_auth_configure` 工具配置。

### 上传图片返回格式不支持

确认文件格式为 JPG 或 PNG，且不超过 10MB。

### 发布后查询状态一直显示"发布中"

微信发布审核可能需要几分钟，请稍后再次查询。如果长时间未成功，登录微信公众平台后台检查。

## 更新

MCP 客户端使用 `npx` 运行时会自动检查并下载最新版本。

### npm 全局安装方式

```bash
# 查看当前版本
npm list -g @xihe-lab/wechat-mp-mcp-server

# 更新到最新版本
npm update -g @xihe-lab/wechat-mp-mcp-server
```

更新后需重启 MCP 客户端。

### 查看版本信息

```bash
# 查看最新发布版本
npm view @xihe-lab/wechat-mp-mcp-server version

# 查看所有已发布版本
npm view @xihe-lab/wechat-mp-mcp-server versions
```

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
