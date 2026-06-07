# 微信公众号 MCP 服务器 PRD

## 1. 项目概述

构建符合 Model Context Protocol (MCP) 标准的微信公众号管理服务器，使 AI 应用（Claude Desktop、Cursor、Windsurf 等）通过 MCP 协议直接调用微信公众号 API，实现内容管理的完整自动化。

**核心价值**：AI 驱动的公众号内容自动发布，从内容生成到上线无需人工操作微信公众号后台。

## 2. MVP 范围

### 核心场景

```
内容来源 → AI 提取/生成 → 上传封面 → 创建草稿 → AI 审核 → 提交发布 → 状态确认
```

### 工具矩阵（14 个）

| 模块 | 工具数 | 工具列表 |
|------|--------|---------|
| 认证管理 | 3 | `auth_configure` / `auth_get_token` / `auth_refresh` |
| 素材管理 | 3 | `media_upload` / `media_get` / `material_upload_image` |
| 草稿管理 | 4 | `draft_add` / `draft_list` / `draft_get` / `draft_delete` |
| 发布管理 | 4 | `publish_submit` / `publish_list` / `publish_get` / `publish_delete` |

### 未纳入 MVP

- 永久素材管理（图片/语音/视频素材，非图文）
- 菜单管理
- 用户标签/分组
- 模板消息推送
- 数据统计（阅读量/分享量）
- 留言管理
- 自动回复规则

## 3. 功能需求

### 3.1 认证管理

| ID | 工具 | 功能 | 输入 | 输出 |
|----|------|------|------|------|
| AUTH-01 | `wechat_auth_configure` | 配置 AppID/AppSecret 并验证 | `app_id`, `app_secret` | 成功提示 + Token 前10位 |
| AUTH-02 | `wechat_auth_get_token` | 获取当前 Token（自动刷新） | 无 | `{ access_token, expires_at }` |
| AUTH-03 | `wechat_auth_refresh` | 强制刷新 Token | 无 | 成功提示 + Token 前10位 |

**业务规则**：
- Token 有效期 7200 秒，本地提前 200 秒刷新
- 首次使用必须调用 `auth_configure` 或设置环境变量 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`
- Token 持久化到 SQLite，进程重启后自动加载

### 3.2 素材管理

| ID | 工具 | 功能 | 输入 | 输出 |
|----|------|------|------|------|
| MEDIA-01 | `wechat_media_upload` | 上传临时素材 | `type` (image/voice/video), `file_path` | `{ media_id, type, created_at }` |
| MEDIA-02 | `wechat_media_get` | 获取临时素材信息 | `media_id` | 素材元信息 |

**文件限制**：
- 类型：image (JPG/PNG) / voice (MP3/WMA/WAV/AMR) / video (MP4)
- 大小：≤ 10MB
- 路径安全：禁止 `..` 路径遍历

**临时素材有效期**：3 天，`media_id` 用于草稿封面图

### 3.3 永久图片素材

| ID | 工具 | 功能 | 输入 | 输出 |
|----|------|------|------|------|
| MEDIA-03 | `wechat_material_upload_image` | 上传永久图片素材 | `file_path` | `{ media_id, url }` |

**用途**：上传的永久图片可用于草稿封面（`thumb_media_id`），不受临时素材 3 天有效期限制。

**文件限制**：JPG/PNG，≤ 10MB，路径禁止 `..`。

### 3.4 草稿管理

| ID | 工具 | 功能 | 输入 | 输出 |
|----|------|------|------|------|
| DRAFT-01 | `wechat_draft_add` | 创建草稿（多图文 ≤ 8 篇） | `articles[]` | `{ media_id }` |
| DRAFT-02 | `wechat_draft_list` | 分页获取草稿列表 | `offset`, `count` | `{ total_count, item }` |
| DRAFT-03 | `wechat_draft_get` | 获取草稿详情 | `media_id` | 草稿详情 |
| DRAFT-04 | `wechat_draft_delete` | 删除草稿 | `media_id` | 成功提示 |

**关键约束**：
- 单次最多 8 篇图文
- `thumb_media_id` 来自 `media_upload` 返回的临时素材 ID
- 草稿创建后返回的 `media_id` 用于发布提交

### 3.5 发布管理

**新发布流程**：`material_upload_image`（永久封面图）→ `draft_add`（创建草稿）→ `publish_submit`（提交发布）→ `publish_get`（确认状态）

| ID | 工具 | 功能 | 输入 | 输出 |
|----|------|------|------|------|
| PUB-01 | `wechat_publish_submit` | 提交草稿发布 | `media_id` | `{ publish_id, article_id }` |
| PUB-02 | `wechat_publish_list` | 获取已发布文章列表 | `offset`, `count` | `{ total_count, item }` |
| PUB-03 | `wechat_publish_get` | 查询发布状态 | `article_id` | 状态详情 + 中文提示 |
| PUB-04 | `wechat_publish_delete` | 删除已发布文章 | `article_id` | 成功提示 |

**发布状态机**：
```
草稿 → submit → publishing → success / failed
```
- `publishing`：微信异步处理中，需轮询 `publish_get`
- `success`：发布成功
- `failed`：发布失败，返回失败篇目索引

## 4. 非功能需求

### 4.1 安全
- 日志脱敏：access_token / app_secret 自动替换为 `***redacted***`
- 文件路径校验：禁止 `..` 路径遍历
- 文件校验：类型 + 大小双重检查
- AppSecret 明文存储在本地 SQLite（后续迭代支持 AES 加密）

### 4.2 可靠性
- Axios 全局 10s 超时
- 微信 API errcode 自动检测并抛出结构化错误
- Token 缓存 + 自动刷新，避免频繁调用微信 API

### 4.3 可维护性
- TypeScript 全类型覆盖
- Zod 输入校验
- 6 个结构化错误码
- 分层架构：Tools → Client → Storage

### 4.4 兼容性
- 运行时：Node.js 18+
- MCP 传输：Stdio（子进程模式）
- 客户端：Claude Desktop / Cursor / Windsurf / 任何 MCP 客户端

## 5. 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| 语言 | TypeScript | 5.3+ |
| MCP SDK | @modelcontextprotocol/sdk | ^0.5.0 |
| HTTP | Axios | ^1.6.0 |
| 存储 | better-sqlite3 | ^12.10.0 |
| 校验 | Zod | ^3.23.0 |
| 构建 | Vite | ^5.1.0 |
| 测试 | Vitest | ^1.2.0 |
| 运行时 | Node.js | 18+ |

## 6. 交付标准

- [x] 14 个 MCP 工具接口全部实现
- [ ] 单元测试覆盖率 ≥ 80%
- [x] README + API 文档
- [ ] Claude Desktop 集成指南

## 7. 后续迭代

| 迭代 | 功能 | 优先级 |
|------|------|--------|
| Sprint 2 | 永久素材管理（图片/语音/视频）、素材统计 | 高 |
| Sprint 3 | 菜单管理、自动回复规则 | 中 |
| Sprint 4 | 用户标签/分组、模板消息 | 中 |
| Sprint 5 | 数据统计、留言管理 | 低 |
| Sprint 6 | 小程序/微信支付扩展 | 低 |

## 8. 错误码

| 错误码 | 说明 | 处理建议 |
|--------|------|----------|
| `WECHAT_001` | AppID 或 AppSecret 未配置 | 调用 `wechat_auth_configure` |
| `WECHAT_002` | Access Token 过期或刷新失败 | 检查凭据，调用 `wechat_auth_refresh` |
| `WECHAT_003` | 文件上传失败（大小/格式/路径） | 检查文件大小和格式 |
| `WECHAT_004` | 草稿创建失败 | 检查图文内容格式 |
| `WECHAT_005` | 发布失败 | 检查公众号权限和内容合规 |
| `WECHAT_006` | 网络错误或微信 API 返回错误 | 检查网络连接，查看 errcode |
