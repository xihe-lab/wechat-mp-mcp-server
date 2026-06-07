# 微信公众号 MCP 服务器 FSD（功能规格文档）

## 1. 系统架构

### 1.1 分层架构

```
┌─────────────────────────────────────────────────┐
│                MCP Client (AI App)               │
│          Claude Desktop / Cursor / Windsurf      │
└───────────────────────┬─────────────────────────┘
                        │ MCP Protocol (Stdio)
┌───────────────────────▼─────────────────────────┐
│               MCP Server (入口层)                │
│  src/index.ts — McpServer + StdioServerTransport │
└───────────────────────┬─────────────────────────┘
                        │ registerTool()
┌───────────────────────▼─────────────────────────┐
│              Tools (工具层)                       │
│  src/tools/*.ts — Zod 校验 + 业务编排            │
│  auth / media / draft / publish       │
└───────────────────────┬─────────────────────────┘
                        │
┌─────────────┬─────────▼──────────┬──────────────┐
│   Client    │     Storage        │    Errors    │
│ (接口层)    │    (存储层)         │   (错误层)   │
│ client.ts   │   db.ts            │  errors.ts   │
│ Axios 实例  │   SQLite config    │  WechatError │
│ Token 注入  │   key/value store  │  formatError │
└──────┬──────┘────────────────────└──────────────┘
       │
┌──────▼──────────────────────────────────────────┐
│           微信公众号 API                         │
│  https://api.weixin.qq.com/cgi-bin/*             │
└─────────────────────────────────────────────────┘
```

### 1.2 通信方式

- **传输协议**：Stdio（标准输入/输出）
- **启动方式**：MCP 客户端以子进程启动本服务器
- **日志输出**：`console.error` → stderr（stdout 被 MCP 协议占用）

### 1.3 模块依赖关系

```
index.ts
├── tools/auth.ts      → client.ts, db.ts, errors.ts
├── tools/media.ts     → client.ts, errors.ts
├── tools/draft.ts     → client.ts, errors.ts
└── tools/publish.ts   → client.ts, errors.ts

client.ts → db.ts, errors.ts, logger.ts
db.ts → logger.ts
errors.ts（无依赖）
logger.ts（无依赖）
```

## 2. 数据流

### 2.1 自动发布完整流程

```
                    MCP Client (AI)
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
auth_configure    material_upload_image  draft_add
  存凭据到DB      上传永久封面图          创建草稿
  获取Token       返回media_id           返回media_id
    │                    │                    │
    │                    └──────┬─────────────┘
    │                           │
    │                           ▼
    │                    publish_submit
    │                    提交发布(草稿ID)
    │                           │
    │                           ▼
    │                    publish_get
    │                    轮询发布状态
    │                    publishing → success
    │                           │
    └───────────────────────────┘
                                │
                                ▼
                         发布完成
```

### 2.2 请求处理流程

```
MCP Client 调用工具
    │
    ▼
McpServer 分发到对应 handler
    │
    ▼
Tool handler 执行:
  1. Zod 校验输入参数
  2. 调用 Client 发送 HTTP 请求
  3. Client 拦截器自动注入 access_token
  4. 响应拦截器检查 errcode
  5. 成功 → 返回 MCP content
     失败 → formatToolError() 返回错误
```

## 3. 核心模块设计

### 3.1 认证模块（src/wechat/client.ts + src/tools/auth.ts）

**Token 生命周期**：

```
首次启动
  │
  ├─ 有环境变量 → 自动获取 Token
  │
  └─ 无环境变量 → 等待 auth_configure

Token 获取/刷新:
  getAccessToken()
    │
    ├─ DB 有 Token 且未过期（剩余 > 200s）→ 直接返回
    │
    └─ DB 无 Token 或已过期 → fetchNewToken()
        │
        ├─ 读取 app_id / app_secret（DB 优先，环境变量兜底）
        │
        ├─ 调用微信 /cgi-bin/token
        │
        ├─ 存储 token + expires_at 到 DB
        │
        └─ 返回 access_token
```

**Axios 拦截器**：
- **请求拦截器**：自动注入 `access_token` 参数（支持 `X-Skip-Auth` 跳过）
- **响应拦截器**：检查 `errcode`，非 0 抛出 `WechatMcpError('WECHAT_006')`

### 3.2 素材上传模块（src/tools/media.ts）

**上传流程**：

```
validateFile(type, file_path)
  │
  ├─ 检查文件存在性
  ├─ 检查文件大小 ≤ 10MB
  ├─ 检查文件扩展名是否匹配 type
  └─ 检查路径不含 '..'

upload:
  │
  ├─ 获取 access_token
  ├─ 构建 FormData (form-data 库)
  ├─ POST /cgi-bin/media/upload
  └─ 返回 { media_id, type, created_at }
```

**类型映射**：

| type 参数 | 允许扩展名 | 微信 API type |
|-----------|-----------|---------------|
| image | jpg, jpeg, png | image |
| voice | mp3, wma, wav, amr | voice |
| video | mp4 | video |

### 3.3 存储模块（src/storage/db.ts）

**数据模型**：

```sql
CREATE TABLE config (
  key       TEXT PRIMARY KEY,
  value     TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**存储的 Key**：

| Key | 说明 | 示例值 |
|-----|------|--------|
| `app_id` | 公众号 AppID | `wx17803175543` |
| `app_secret` | 公众号 AppSecret | `abc123...` |
| `access_token` | 当前 Token | `72_xxx...` |
| `token_expires_at` | Token 过期时间戳 | `1780467947` |

**配置优先级**：DB 存储值 > 环境变量（`WECHAT_APP_ID` / `WECHAT_APP_SECRET`）

**数据目录**：`DATA_DIR` 环境变量指定，默认 `{cwd}/data`，自动创建

### 3.4 错误处理（src/errors.ts）

**错误类层次**：

```
WechatMcpError extends Error
  ├── code: ErrorCode (WECHAT_001 ~ WECHAT_006)
  ├── message: string
  └── cause?: unknown

formatToolError(error) → MCP 错误格式:
  {
    content: [{ type: 'text', text: '[WECHAT_001] AppID 或 AppSecret 未配置' }],
    isError: true
  }
```

**错误映射**：

| 错误源 | 映射到 | 场景 |
|--------|--------|------|
| 凭据缺失 | WECHAT_001 | app_id / app_secret 未配置 |
| Token API 失败 | WECHAT_002 | errcode 返回或网络错误 |
| 文件校验失败 | WECHAT_003 | 大小/格式/路径不合法 |
| 草稿 API 失败 | WECHAT_004 | 内容格式问题 |
| 发布 API 失败 | WECHAT_005 | 权限/合规问题 |
| 网络/API 错误 | WECHAT_006 | 超时/errcode/未知错误 |

### 3.5 日志模块（src/logger.ts）

**脱敏规则**：对象中包含 `access_token` / `app_secret` / `AppSecret` 的字段自动替换为 `***redacted***`

**输出方式**：
- `logInfo(msg, data?)` → `[INFO] msg {"data":...}`
- `logError(msg, error?)` → `[ERROR] msg error.message`

**输出目标**：stderr（stdout 用于 MCP 协议通信）

## 4. 微信 API 映射

### 4.1 认证

| MCP 工具 | 微信 API | HTTP Method |
|---------|---------|-------------|
| `auth_configure` | `/cgi-bin/token` | GET |
| `auth_get_token` | （本地缓存） | - |
| `auth_refresh` | `/cgi-bin/token` | GET |

### 4.2 素材

| MCP 工具 | 微信 API | HTTP Method |
|---------|---------|-------------|
| `media_upload` | `/cgi-bin/media/upload` | POST (multipart) |
| `media_get` | `/cgi-bin/media/get` | GET |

### 4.3 永久图片素材

| MCP 工具 | 微信 API | HTTP Method |
|---------|---------|-------------|
| `material_upload_image` | `/cgi-bin/material/add_material` | POST (multipart) |

### 4.4 草稿

| MCP 工具 | 微信 API | HTTP Method |
|---------|---------|-------------|
| `draft_add` | `/cgi-bin/draft/add` | POST |
| `draft_list` | `/cgi-bin/draft/batchget` | POST |
| `draft_get` | `/cgi-bin/draft/get` | POST |
| `draft_delete` | `/cgi-bin/draft/delete` | POST |

### 4.5 发布

> 注：原 4.3 图文素材管理工具（articles_add/list/get/delete）因微信 API 废弃已移除。

| MCP 工具 | 微信 API | HTTP Method |
|---------|---------|-------------|
| `publish_submit` | `/cgi-bin/freepublish/submit` | POST |
| `publish_list` | `/cgi-bin/freepublish/batchget` | POST |
| `publish_get` | `/cgi-bin/freepublish/get` | POST |
| `publish_delete` | `/cgi-bin/freepublish/delete` | POST |

## 5. MCP 客户端配置

### 5.1 Claude Desktop

```json
{
  "mcpServers": {
    "weixin": {
      "command": "node",
      "args": ["/path/to/weixin-mcp-server/dist/index.js"],
      "env": {
        "WECHAT_APP_ID": "your_app_id",
        "WECHAT_APP_SECRET": "your_app_secret"
      }
    }
  }
}
```

配置文件位置：
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

### 5.2 Cursor

在 `.cursor/mcp.json` 中配置，格式同上。

## 6. 构建与部署

### 6.1 构建

```bash
pnpm build    # Vite library 模式，输出 ESM 到 dist/
```

### 6.2 开发

```bash
pnpm dev      # Vite watch 模式
pnpm test     # Vitest 单次运行
pnpm test:watch  # Vitest watch 模式
```

### 6.3 运行时依赖

- Node.js 18+
- 本地文件系统（SQLite 数据文件、上传的临时文件）
- 网络访问 `api.weixin.qq.com`

## 7. 测试策略

### 7.1 测试分层

| 层级 | 测试文件 | 覆盖内容 |
|------|---------|---------|
| 错误处理 | `errors.test.ts` | ErrorCodes 映射、WechatMcpError 构造、formatToolError |
| 日志 | `logger.test.ts` | redact 脱敏、logInfo/logError 输出 |
| 存储 | `storage/db.test.ts` | SQLite CRUD、DATA_DIR 环境变量 |
| 客户端 | `wechat/client.test.ts` | Token 获取/刷新/缓存、API 错误处理 |

### 7.2 Mock 策略

- 微信 API 响应：`vi.mock('axios')`，mock 返回值
- SQLite：使用 `DATA_DIR` 指向临时目录，测试后自动清理

### 7.3 未覆盖模块（需补充）

| 模块 | 待测试内容 |
|------|-----------|
| tools/auth | MCP 工具注册和 handler 逻辑 |
| tools/media | 文件校验、上传流程 |
| tools/media | 文件校验、上传流程（含永久图片） |
| tools/draft | 草稿 CRUD handler（多图文边界） |
| tools/publish | 发布状态机 handler |
