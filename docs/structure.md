# 微信公众号 MCP 服务器 - 目录结构说明

## 项目根目录

```
weixin-mcp-server/
├── src/                    # 源代码
├── dist/                   # 构建产物（Vite library 模式）
├── tests/                  # 测试文件
├── docs/                   # 项目文档
├── data/                   # SQLite 数据文件（运行时生成）
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 构建配置
├── pnpm-lock.yaml          # 依赖锁文件
└── README.md               # 项目说明
```

## 源代码结构

```
src/
├── index.ts                # MCP Server 入口，注册所有工具 + StdioServerTransport
├── errors.ts               # WechatMcpError 类 + ErrorCodes + formatToolError
├── logger.ts               # 日志工具（redact 脱敏 + stderr 输出）
├── wechat/
│   ├── client.ts           # Axios 实例 + Token 管理（拦截器自动注入）
│   └── types.ts            # 微信 API 类型定义（Token/Media/Draft/Publish）
├── tools/
│   ├── auth.ts             # 认证工具（configure/get_token/refresh）
│   ├── media.ts            # 素材工具（upload/get + 文件校验 + 永久图片上传）
│   ├── draft.ts            # 草稿工具（add/list/get/delete + 多图文）
│   └── publish.ts          # 发布工具（submit/list/get/delete + 状态映射）
└── storage/
    └── db.ts               # SQLite 存储（config 表 key/value + WAL 模式）
```

## 测试结构

```
tests/
├── errors.test.ts          # 错误码 + WechatMcpError + formatToolError（7 tests）
├── logger.test.ts          # redact 脱敏 + logInfo/logError（6 tests）
├── storage/
│   └── db.test.ts          # SQLite CRUD + DATA_DIR（6 tests）
└── wechat/
    └── client.test.ts      # Token 获取/刷新/缓存（3 tests）
```

## 分层架构

```
index.ts（入口层）    →  McpServer + StdioServerTransport
tools/*.ts（工具层）  →  Zod Schema 校验 + 业务编排 + 错误处理
wechat/client.ts     →  Axios HTTP 客户端 + Token 自动注入
storage/db.ts        →  SQLite key/value 持久化
errors.ts            →  统一错误码 + MCP 错误格式
logger.ts            →  脱敏日志 → stderr
```

## 工具命名规范

```
wechat_<领域>_<动作>

领域: auth / media / draft / publish
动作: configure / get_token / refresh / upload / get / add / list / delete / submit
```

## 数据文件

```
data/
└── config.db              # SQLite 数据库（WAL 模式）
                           # 表: config (key TEXT PK, value TEXT, updated_at INTEGER)
                           # 存储: app_id, app_secret, access_token, token_expires_at
```
