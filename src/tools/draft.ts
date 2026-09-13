import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import fs from 'fs'
import { getClient } from '../wechat/client'
import { formatToolError, WechatMcpError } from '../errors'
import { logInfo } from '../logger'

/** 官方 draft/add 接口对 content 的限制：小于 2 万字符。超长正文请改用 wechat_web_write_draft（编辑器通道） */
const DRAFT_CONTENT_CHAR_LIMIT = 20_000

const DraftArticleSchema = z.object({
  title: z.string().describe('标题（≤64字）'),
  author: z.string().optional().describe('作者（≤16字）'),
  digest: z.string().optional().describe('摘要（≤120字）'),
  content: z.string().optional().describe('正文 HTML（与 content_file_path 二选一；注意官方接口限制正文 <2 万字符，超长请用 wechat_web_write_draft）'),
  content_file_path: z.string().optional().describe('正文 HTML 的本地文件路径（推荐：server 直接读文件，大内容不经对话上下文转手；同样受 2 万字符限制）'),
  content_source_url: z.string().optional().describe('原文链接'),
  thumb_media_id: z.string().describe('封面图 media_id（需通过 wechat_material_upload_image 上传永久图片素材获取）'),
  show_cover_pic: z.boolean().default(true).describe('是否显示封面'),
})

/** 解析文章正文：content_file_path 优先于内联 content */
function resolveArticleContent(article: { content?: string; content_file_path?: string; title: string }): string {
  if (article.content_file_path) {
    if (article.content_file_path.includes('..')) {
      throw new WechatMcpError('WECHAT_004', '文件路径不合法')
    }
    if (!fs.existsSync(article.content_file_path)) {
      throw new WechatMcpError('WECHAT_004', `文件不存在: ${article.content_file_path}`)
    }
    return fs.readFileSync(article.content_file_path, 'utf-8')
  }
  if (!article.content) {
    throw new WechatMcpError('WECHAT_004', '正文不能为空（content 或 content_file_path 必填其一）')
  }
  return article.content
}

export function registerDraftTools(server: McpServer): void {
  server.tool('wechat_draft_add', '创建草稿（支持多图文，最多8篇）。注意：官方接口限制正文 <2 万字符，长文请改用 wechat_web_write_draft', {
    articles: z.array(DraftArticleSchema).min(1).max(8).describe('图文列表'),
  }, async ({ articles }) => {
    try {
      const resolved = articles.map((a) => {
        const content = resolveArticleContent(a)
        if (content.length >= DRAFT_CONTENT_CHAR_LIMIT) {
          throw new WechatMcpError(
            'WECHAT_004',
            `正文 ${content.length} 字符，超过官方接口 ${DRAFT_CONTENT_CHAR_LIMIT} 字符限制。请改用 wechat_web_write_draft（编辑器通道，无此限制）`,
          )
        }
        return {
          title: a.title,
          author: a.author,
          digest: a.digest,
          content,
          content_source_url: a.content_source_url,
          thumb_media_id: a.thumb_media_id,
          show_cover_pic: a.show_cover_pic ? 1 : 0,
        }
      })
      const resp = await getClient().post('/draft/add', {
        articles: resolved,
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

  server.tool(
    'wechat_draft_update',
    '更新草稿中的单篇文章（官方 /draft/update 接口）。只传需要修改的字段，正文同样受 2 万字符限制',
    {
      media_id: z.string().describe('草稿 media_id'),
      index: z.number().describe('要更新的文章在草稿中的位置（从 0 开始）'),
      title: z.string().optional().describe('新标题'),
      author: z.string().optional().describe('新作者'),
      digest: z.string().optional().describe('新摘要'),
      content: z.string().optional().describe('新正文 HTML（与 content_file_path 二选一）'),
      content_file_path: z.string().optional().describe('新正文 HTML 的本地文件路径'),
      content_source_url: z.string().optional().describe('新原文链接（传空字符串清除）'),
      thumb_media_id: z.string().optional().describe('新封面图 media_id'),
      show_cover_pic: z.boolean().optional().describe('是否显示封面'),
      need_open_comment: z.number().optional().describe('是否打开评论（0/1）'),
      only_fans_can_comment: z.number().optional().describe('是否仅粉丝可评论（0/1）'),
    },
    async (args) => {
      try {
        const update: Record<string, unknown> = {
          media_id: args.media_id,
          index: args.index,
        }
        if (args.title !== undefined) update.title = args.title
        if (args.author !== undefined) update.author = args.author
        if (args.digest !== undefined) update.digest = args.digest
        if (args.content_source_url !== undefined) update.content_source_url = args.content_source_url
        if (args.thumb_media_id !== undefined) update.thumb_media_id = args.thumb_media_id
        if (args.show_cover_pic !== undefined) update.show_cover_pic = args.show_cover_pic ? 1 : 0
        if (args.need_open_comment !== undefined) update.need_open_comment = args.need_open_comment
        if (args.only_fans_can_comment !== undefined) update.only_fans_can_comment = args.only_fans_can_comment
        if (args.content !== undefined || args.content_file_path !== undefined) {
          const content = resolveArticleContent({ ...args, title: args.title ?? '' })
          if (content.length >= DRAFT_CONTENT_CHAR_LIMIT) {
            throw new WechatMcpError(
              'WECHAT_004',
              `正文 ${content.length} 字符，超过官方接口 ${DRAFT_CONTENT_CHAR_LIMIT} 字符限制。请改用 wechat_web_write_draft`,
            )
          }
          update.content = content
        }
        const resp = await getClient().post('/draft/update', update)
        logInfo('Draft updated', { media_id: args.media_id, index: args.index })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(resp.data) }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
