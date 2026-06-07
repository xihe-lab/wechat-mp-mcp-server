import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import { getClient } from '../wechat/client'
import { formatToolError } from '../errors'
import { logInfo } from '../logger'

const DraftArticleSchema = z.object({
  title: z.string().describe('标题'),
  author: z.string().optional().describe('作者'),
  digest: z.string().optional().describe('摘要'),
  content: z.string().describe('正文 HTML'),
  content_source_url: z.string().optional().describe('原文链接'),
  thumb_media_id: z.string().describe('封面图 media_id（需通过 wechat_material_upload_image 上传永久图片素材获取）'),
  show_cover_pic: z.boolean().default(true).describe('是否显示封面'),
})

export function registerDraftTools(server: McpServer): void {
  server.tool('wechat_draft_add', '创建草稿（支持多图文，最多8篇）', {
    articles: z.array(DraftArticleSchema).min(1).max(8).describe('图文列表'),
  }, async ({ articles }) => {
    try {
      const resp = await getClient().post('/draft/add', {
        articles: articles.map((a) => ({
          title: a.title,
          author: a.author,
          digest: a.digest,
          content: a.content,
          content_source_url: a.content_source_url,
          thumb_media_id: a.thumb_media_id,
          show_cover_pic: a.show_cover_pic ? 1 : 0,
        })),
      })
      const data = resp.data
      logInfo('Draft created', { media_id: data.media_id })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ media_id: data.media_id }) }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })

  server.tool('wechat_draft_list', '获取草稿列表', {
    offset: z.number().default(0).describe('偏移量'),
    count: z.number().default(20).describe('数量（最大20）'),
  }, async ({ offset, count }) => {
    try {
      const resp = await getClient().post('/draft/batchget', {
        offset,
        count: Math.min(count, 20),
        no_content: 0,
      })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(resp.data) }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })

  server.tool('wechat_draft_get', '获取草稿详情', {
    media_id: z.string().describe('草稿 media_id'),
  }, async ({ media_id }) => {
    try {
      const resp = await getClient().post('/draft/get', { media_id })
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(resp.data) }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })

  server.tool('wechat_draft_delete', '删除草稿', {
    media_id: z.string().describe('草稿 media_id'),
  }, async ({ media_id }) => {
    try {
      const resp = await getClient().post('/draft/delete', { media_id })
      logInfo('Draft deleted', { media_id })
      return {
        content: [{ type: 'text' as const, text: `草稿 ${media_id} 已删除` }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })
}
