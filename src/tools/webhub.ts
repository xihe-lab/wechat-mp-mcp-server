import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { formatToolError, WechatMcpError } from '../errors'
import { logInfo } from '../logger'
import { lintHtml, type LintFinding } from '../html/lint'
import { getContext, getWeixinMeta, requireWeixinMeta, loginWithQrCode, buildEditorUrl } from '../webhub/session'
import { operateAppmsgCreate, filetransferUpload } from '../webhub/api'
import { stripExternalLinks, processImages, wrapSection } from '../webhub/html-pipeline'

/** 从 HTML 推断标题：<title> 优先，其次第一个 <h1> */
function extractTitle(html: string): string | null {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  if (title) return title
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim()
  if (h1) return h1
  return null
}

function formatWarnings(findings: LintFinding[]): string[] {
  return findings.filter((f) => f.level !== 'error').map((f) => `[${f.rule}] ${f.message}`)
}

export function registerWebhubTools(server: McpServer): void {
  server.tool(
    'wechat_web_login',
    '扫码登录公众号后台（打开 Chrome 窗口展示二维码）。登录一次后 cookie 持久保存于本地浏览器 profile，日常操作无需重复登录',
    {
      timeout_ms: z.number().default(300_000).describe('等待扫码的最长时间（毫秒），默认 5 分钟'),
    },
    async ({ timeout_ms }) => {
      try {
        const meta = await loginWithQrCode(timeout_ms)
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ status: 'ok', nick_name: meta.nickName, user_name: meta.userName }),
          }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )

  server.tool(
    'wechat_web_status',
    '检查公众号后台登录态（不报错：未登录时返回 logged_in: false 与登录指引）',
    {},
    async () => {
      try {
        const meta = await getWeixinMeta()
        if (meta) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                logged_in: true,
                nick_name: meta.nickName,
                user_name: meta.userName,
                token_preview: `${meta.token.slice(0, 8)}...`,
              }),
            }],
          }
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ logged_in: false, hint: '调用 wechat_web_login 扫码登录' }),
          }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )

  server.tool(
    'wechat_web_upload_image',
    '通过 web 编辑器通道上传图片（filetransfer 接口），返回 mmbiz 图床 URL。不依赖 IP 白名单，适合无白名单/出口 IP 多变的环境',
    {
      file_path: z.string().describe('本地图片文件路径（JPG/PNG，≤10MB）'),
    },
    async ({ file_path }) => {
      try {
        if (file_path.includes('..')) {
          throw new WechatMcpError('WECHAT_003', '文件路径不合法')
        }
        if (!fs.existsSync(file_path)) {
          throw new WechatMcpError('WECHAT_003', `文件不存在: ${file_path}`)
        }
        const meta = await requireWeixinMeta()
        const ctx = await getContext()
        const { url } = await filetransferUpload(ctx, meta, file_path)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ url }) }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )

  server.tool(
    'wechat_web_write_draft',
    '长文直写公众号草稿（编辑器通道）：读取本地 HTML 文件 → lint 预检 → 外链降级 → 图片自动上图床 → operate_appmsg 创建完整草稿。不受官方接口 2 万 HTML 字符限制（限制的是去标签正文字数 ≤2 万）。返回 appMsgId 与编辑器 URL，最终发表由人工确认（每天仅 1 次群发额度）',
    {
      file_path: z.string().describe('正文 HTML 文件路径'),
      title: z.string().optional().describe('标题（≤64字）；缺省时从 <title> 或首个 <h1> 提取'),
      author: z.string().optional().describe('作者（≤16字）'),
      digest: z.string().optional().describe('摘要（≤120字），缺省时由公众号自动截取正文开头'),
      source_url: z.string().optional().describe('原文链接'),
      show_cover_pic: z.boolean().default(false).describe('是否显示封面'),
      auto_process_images: z.boolean().default(true).describe('自动把本地/外链图片上传到 mmbiz 图床并替换 src（推荐开启）'),
      strip_links: z.boolean().default(true).describe('把非微信域名的 <a> 降级为纯文本（规避外链违规拒绝保存）'),
      wrap_section: z.boolean().default(false).describe('是否用默认排版 section 包裹正文（自带排版的文章保持 false）'),
    },
    async (args) => {
      try {
        // a) 路径校验与读取
        const { file_path } = args
        if (file_path.includes('..')) {
          throw new WechatMcpError('WECHAT_008', '文件路径不合法')
        }
        if (!fs.existsSync(file_path)) {
          throw new WechatMcpError('WECHAT_008', `文件不存在: ${file_path}`)
        }
        let html = fs.readFileSync(file_path, 'utf-8')

        // b) lint 预检：error 级问题一律拒绝（占位符残留、裸 br、ul/li、超字数等都是发布红线）
        const lint = lintHtml(html)
        if (!lint.pass) {
          const errors = lint.findings.filter((f) => f.level === 'error').map((f) => `[${f.rule}] ${f.message}`)
          throw new WechatMcpError('WECHAT_008', `HTML 预检未通过（${errors.length} 项 error），请先修复后重试：\n${errors.join('\n')}`)
        }
        const warnings = formatWarnings(lint.findings)

        // c) 标题
        const title = args.title?.trim() || extractTitle(html)
        if (!title) {
          throw new WechatMcpError('WECHAT_008', '未能推断标题：HTML 中无 <title>/<h1>，请显式传入 title 参数')
        }
        if (title.length > 64) {
          throw new WechatMcpError('WECHAT_008', `标题 ${title.length} 字超过 64 字上限`)
        }

        // d) 登录态与浏览器会话
        const meta = await requireWeixinMeta()
        const ctx = await getContext()

        // e) 外链降级
        let linksStripped = 0
        if (args.strip_links) {
          const result = stripExternalLinks(html)
          html = result.html
          linksStripped = result.stripped
        }

        // f) 图片上图床
        let imagesUploaded: Array<{ source: string; url: string }> = []
        let imagesSkipped = 0
        if (args.auto_process_images) {
          const result = await processImages(ctx, meta, html, { baseDir: path.dirname(path.resolve(file_path)) })
          html = result.html
          imagesUploaded = result.uploaded
          imagesSkipped = result.skipped
        }

        // g) 可选排版包裹
        if (args.wrap_section) {
          html = wrapSection(html)
        }

        // h) 创建草稿
        const { appMsgId } = await operateAppmsgCreate(ctx, meta, {
          title,
          content: html,
          author: args.author,
          digest: args.digest,
          sourceUrl: args.source_url,
          showCoverPic: args.show_cover_pic,
        })

        logInfo('Draft written via web channel', { appMsgId, title, images: imagesUploaded.length })

        // i) 返回
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              appMsgId,
              editor_url: buildEditorUrl(appMsgId, meta.token),
              title,
              lint_summary: { text_char_count: lint.text_char_count, html_char_count: lint.html_char_count },
              warnings,
              images_uploaded: imagesUploaded,
              images_skipped: imagesSkipped,
              links_stripped: linksStripped,
              next_step: '在浏览器打开 editor_url 人工预览/补充封面后发表（每天仅1次群发额度，最后一步人工确认）',
            }, null, 2),
          }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
