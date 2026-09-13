# 标签体系（Issues / PR）

四轴正交：一个问题 = **1 个类型 + 0..n 个范围 + 0..1 优先级 + 流程标签按需**。

| 轴 | 标签 | 用途 |
|---|---|---|
| 类型 | `type/bug` `type/feature` `type/docs` `type/test` `type/refactor` `type/chore` `type/security` | 单选；与 commit type 对应 |
| 范围 | `pkg/server` `pkg/repo` | 多选；`pkg/server` = 包体改动（`src/**`：官方 API 层 / Web 会话层 / HTML 检查），`pkg/repo` = 仓库级（CI/发布/文档/配置） |
| 优先级 | `prio/high` `prio/medium` `prio/low` | 维护者定级 |
| 流程 | `flow/needs-triage` `flow/blocked` `tapd/linked` | 入口默认 / 阻塞标记 / 已关联 TAPD 工作项 |

约定：
- Issue 表单自动带 `type/* + flow/needs-triage`，triage 时补优先级
- PR 由 labeler 按路径自动打 `pkg/*`（`src/**` → `pkg/server`；`.github/**`、`package.json` 等 → `pkg/repo`），维护者补优先级
- `tapd/linked`：描述或评论含 TAPD 长即打——与 TAPD 需求（workspace 33468222「微信公众号mcp」）双向可溯

> 标签需在仓库 Issues → Labels 中手动创建一次（或用 `gh label create`）。
