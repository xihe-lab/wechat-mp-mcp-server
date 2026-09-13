import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import { formatToolError, WechatMcpError } from '../errors'
import { logInfo } from '../logger'
import { getContext, requireWeixinMeta } from '../webhub/session'
import { appmsgAnalysis, userAnalysis } from '../webhub/api'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 微信 misc 数据接口限制：日期跨度 ≤7 天且 end ≥ begin */
function validateDateRange(beginDate: string, endDate: string): void {
  if (!DATE_RE.test(beginDate) || !DATE_RE.test(endDate)) {
    throw new WechatMcpError('WECHAT_007', '日期格式不合法，须为 YYYY-MM-DD（如 2026-09-01）')
  }
  const begin = new Date(`${beginDate}T00:00:00Z`).getTime()
  const end = new Date(`${endDate}T00:00:00Z`).getTime()
  if (Number.isNaN(begin) || Number.isNaN(end)) {
    throw new WechatMcpError('WECHAT_007', '日期不真实，请检查年月日')
  }
  if (end < begin) {
    throw new WechatMcpError('WECHAT_007', 'end_date 不能早于 begin_date')
  }
  const spanDays = (end - begin) / 86_400_000 + 1
  if (spanDays > 7) {
    throw new WechatMcpError('WECHAT_007', `日期跨度 ${spanDays} 天超过微信接口 7 天上限，请分段查询`)
  }
}

export function registerStatsTools(server: McpServer): void {
  server.tool(
    'wechat_stats_article_summary',
    '图文数据统计（web 后台 misc 接口，cookie 鉴权无 IP 白名单依赖）：按日返回指定日期区间内文章的阅读/分享/点赞等数据。跨度 ≤7 天，查询昨天及更早的数据最准',
    {
      begin_date: z.string().describe('开始日期 YYYY-MM-DD'),
      end_date: z.string().describe('结束日期 YYYY-MM-DD（跨度 ≤7 天）'),
    },
    async ({ begin_date, end_date }) => {
      try {
        validateDateRange(begin_date, end_date)
        const meta = await requireWeixinMeta()
        const ctx = await getContext()
        const data = await appmsgAnalysis(ctx, meta, begin_date, end_date)
        logInfo('Article stats fetched', { begin_date, end_date })
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ fetched_at: new Date().toISOString(), begin_date, end_date, data }, null, 2),
          }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )

  server.tool(
    'wechat_stats_user_summary',
    '用户数据统计（web 后台 misc 接口，cookie 鉴权无 IP 白名单依赖）：按日返回指定日期区间内的新增关注/取关/净增等数据。跨度 ≤7 天',
    {
      begin_date: z.string().describe('开始日期 YYYY-MM-DD'),
      end_date: z.string().describe('结束日期 YYYY-MM-DD（跨度 ≤7 天）'),
    },
    async ({ begin_date, end_date }) => {
      try {
        validateDateRange(begin_date, end_date)
        const meta = await requireWeixinMeta()
        const ctx = await getContext()
        const data = await userAnalysis(ctx, meta, begin_date, end_date)
        logInfo('User stats fetched', { begin_date, end_date })
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ fetched_at: new Date().toISOString(), begin_date, end_date, data }, null, 2),
          }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
