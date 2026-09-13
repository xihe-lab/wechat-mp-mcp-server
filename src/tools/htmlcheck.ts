import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import fs from 'fs'
import { lintHtml } from '../html/lint'
import { formatToolError, WechatMcpError } from '../errors'
import { logInfo } from '../logger'

export function registerHtmlCheckTools(server: McpServer): void {
  server.tool(
    'wechat_html_check',
    '公众号正文 HTML 发布前静态检查（纯本地无网络）：ul/li 残留、裸 br 换行丢失风险、占位符残留、非 mmbiz 图片、script 标签、SVG 动画双事件、去标签字数上限预警',
    {
      file_path: z.string().describe('正文 HTML 文件路径'),
    },
    async ({ file_path }) => {
      try {
        if (file_path.includes('..')) {
          throw new WechatMcpError('WECHAT_008', '文件路径不合法')
        }
        if (!fs.existsSync(file_path)) {
          throw new WechatMcpError('WECHAT_008', `文件不存在: ${file_path}`)
        }
        const html = fs.readFileSync(file_path, 'utf-8')
        const report = lintHtml(html)
        logInfo('HTML lint done', { file: file_path, pass: report.pass })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ file: file_path, ...report }, null, 2) }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
