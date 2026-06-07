import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import { getConfig, setConfig } from '../storage/db'
import { getAccessToken, fetchNewToken } from '../wechat/client'
import { WechatMcpError, formatToolError } from '../errors'
import { logInfo } from '../logger'

export function registerAuthTools(server: McpServer): void {
  server.tool('wechat_auth_configure', '配置微信公众号 AppID 和 AppSecret', {
    app_id: z.string().describe('公众号 AppID'),
    app_secret: z.string().describe('公众号 AppSecret'),
  }, async ({ app_id, app_secret }) => {
    try {
      setConfig('app_id', app_id)
      setConfig('app_secret', app_secret)
      const token = await fetchNewToken()
      return {
        content: [{
          type: 'text' as const,
          text: `配置成功，Access Token 已获取（${token.slice(0, 10)}...）`,
        }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })

  server.tool('wechat_auth_get_token', '获取当前 Access Token（自动刷新）', {}, async () => {
    try {
      const appId = getConfig('app_id') ?? process.env.WECHAT_APP_ID
      if (!appId) {
        throw new WechatMcpError('WECHAT_001')
      }
      const token = await getAccessToken()
      const expiresAt = getConfig('token_expires_at')
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ access_token: token, expires_at: Number(expiresAt) }),
        }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })

  server.tool('wechat_auth_refresh', '强制刷新 Access Token', {}, async () => {
    try {
      const token = await fetchNewToken()
      logInfo('Token manually refreshed')
      return {
        content: [{
          type: 'text' as const,
          text: `Access Token 已刷新（${token.slice(0, 10)}...）`,
        }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })
}
