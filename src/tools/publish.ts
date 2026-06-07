import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import { getClient } from '../wechat/client'
import { formatToolError } from '../errors'
import { logInfo } from '../logger'

export function registerPublishTools(server: McpServer): void {
  server.tool('wechat_publish_submit', '提交发布（草稿 → 发布）', {
    media_id: z.string().describe('草稿 media_id'),
  }, async ({ media_id }) => {
    try {
      const resp = await getClient().post('/freepublish/submit', { media_id })
      const data = resp.data
      logInfo('Publish submitted', { publish_id: data.publish_id, article_id: data.article_id })
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ publish_id: data.publish_id, article_id: data.article_id }),
        }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })

  server.tool('wechat_publish_list', '获取已发布文章列表', {
    offset: z.number().default(0).describe('偏移量'),
    count: z.number().default(20).describe('数量（最大20）'),
  }, async ({ offset, count }) => {
    try {
      const resp = await getClient().post('/freepublish/batchget', {
        offset,
        count: Math.min(count, 20),
        no_content: 1,
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(resp.data) }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })

  server.tool('wechat_publish_get', '获取发布状态', {
    article_id: z.string().describe('发布文章 article_id'),
  }, async ({ article_id }) => {
    try {
      const resp = await getClient().post('/freepublish/get', { article_id })
      const data = resp.data
      const status = data.publish_status
      const statusText = status === 'success'
        ? '发布成功'
        : status === 'failed'
          ? `发布失败${data.fail_idx !== undefined ? `（第 ${data.fail_idx} 篇）` : ''}`
          : '发布中，请稍后查询'
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ...data, status_text: statusText }),
        }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })

  server.tool('wechat_publish_delete', '删除已发布文章', {
    article_id: z.string().describe('发布文章 article_id'),
  }, async ({ article_id }) => {
    try {
      const resp = await getClient().post('/freepublish/delete', { article_id })
      logInfo('Published article deleted', { article_id })
      return {
        content: [{ type: 'text' as const, text: `已发布文章 ${article_id} 已删除` }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })
}
