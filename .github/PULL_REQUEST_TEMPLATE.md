## 变更摘要

<!-- 1-2 句话说明做了什么、为什么 -->

## 关联

- TAPD 需求/缺陷 ID：`1133468222001xxxxx`（无则写「无」）
- 关闭 Issue：`Closes #N`（如适用）

## 变更类型

- [ ] feature（新能力）
- [ ] bugfix
- [ ] refactor（行为不变）
- [ ] docs
- [ ] test
- [ ] ci / chore

## 影响范围（与 labeler 自动打标对照）

- [ ] `pkg/server`——包体改动（`src/**`：官方 API 层 / Web 会话层 / HTML 检查）
- [ ] `pkg/repo`——仓库级（CI / 发布 / 文档 / 配置）

## 兼容性声明

- [ ] 存量工具 schema 与默认行为零变化（改了工具参数请说明）
- [ ] Web 会话层内部接口如有调整，已集中在 `src/webhub/api.ts` 并说明风险
- [ ] 无破坏性变更；如有，已在 CHANGELOG **Removed/Changed** 预记

## 测试证据

- [ ] `pnpm build` / `pnpm type-check` / `pnpm test` 三绿
- [ ] 真机 e2e（涉 Web 会话层或发布链路时必填，凭证脱敏）：
  ```
  粘贴关键输出（html_check 报告 / write_draft 返回的 appMsgId 与 lint_summary / stats 数据等）
  ```

## Checklist

- [ ] 提交信息符合 Conventional Commits（`feat|fix|docs|test|chore: <描述>`）
- [ ] 发布红线未动：最终发表保持人工确认（每天仅 1 次群发额度）
