import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { getConfig, setConfig, deleteConfig } from '../storage/db'
import { getAccessToken, fetchNewToken, fetchPublicIp } from '../wechat/client'
import { WechatMcpError, formatToolError } from '../errors'
import { logInfo } from '../logger'

/** 从 shell 配置文件（如 ~/.zshenv）解析 export VAR=value */
function readExportFromFile(filePath: string, varName: string): string | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined
    const content = fs.readFileSync(filePath, 'utf-8')
    const re = new RegExp(`^\\s*export\\s+${varName}=(?:"([^"]*)"|'([^']*)'|([^\\s#]+))`, 'm')
    const m = content.match(re)
    return m?.[1] ?? m?.[2] ?? m?.[3]
  } catch {
    return undefined
  }
}

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

  server.tool(
    'wechat_auth_health_check',
    '凭据健康检查：清除本地缓存 token，强制向微信平台换取新 token 以验证凭据真实有效（可识别「缓存 token 假阳性」——本地 token 未过期但 AppSecret 已失效的情况）。失败时返回错误码、出口 IP 与操作指引',
    {},
    async () => {
      try {
        deleteConfig('access_token')
        deleteConfig('token_expires_at')
        const token = await fetchNewToken()
        const expiresAt = Number(getConfig('token_expires_at') ?? 0)
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'ok',
              message: '凭据有效，新 token 已获取并缓存',
              token_preview: `${token.slice(0, 10)}...`,
              expires_at: expiresAt,
            }),
          }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const errcodeMatch = message.match(/errcode:\s*(-?\d+)/)
        const errcode = errcodeMatch ? Number(errcodeMatch[1]) : null
        const publicIp = await fetchPublicIp()
        let hint = ''
        if (errcode === 40164) {
          hint = `请到 mp.weixin.qq.com → 设置与开发 → 基本配置 → IP 白名单，添加 IP ${publicIp ?? '(获取失败，见错误信息中的 IP)'}，然后重新调用本工具`
        } else if (errcode === 40125 || errcode === 40001 || errcode === 41004) {
          hint = '请在公众平台重置 AppSecret，更新 ~/.zshenv 中的 WECHAT_APP_SECRET 后调用 wechat_auth_sync_from_env'
        }
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({ status: 'error', errcode, message, public_ip: publicIp, hint }),
          }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'wechat_auth_sync_from_env',
    '从环境变量同步 AppID/AppSecret 到本地存储并清除 token 缓存（解决「平台重置 secret 后本地 SQLite 仍存旧值」的问题）。优先读进程环境变量，缺失时自动解析 ~/.zshenv（或指定文件）中的 export 语句。secret 不会出现在返回结果中',
    {
      zshenv_path: z.string().optional().describe('包含 export WECHAT_APP_SECRET 的 shell 配置文件路径，默认 ~/.zshenv（仅在进程环境变量缺失时读取）'),
    },
    async ({ zshenv_path }) => {
      try {
        let appId = process.env.WECHAT_APP_ID
        let appSecret = process.env.WECHAT_APP_SECRET
        const sources: string[] = []

        const fallbackPath = zshenv_path ?? path.join(os.homedir(), '.zshenv')
        if (!appSecret) {
          appSecret = readExportFromFile(fallbackPath, 'WECHAT_APP_SECRET')
          if (appSecret) sources.push(`secret ← ${fallbackPath}`)
        }
        if (!appId) {
          appId = readExportFromFile(fallbackPath, 'WECHAT_APP_ID')
          if (appId) sources.push(`app_id ← ${fallbackPath}`)
        }
        if (appId && appSecret && appId.startsWith('${')) {
          // .mcp.json 中的 ${VAR} 未经展开时会是字面量，视为无效
          appId = undefined
        }
        if (appSecret && appSecret.startsWith('${')) {
          appSecret = undefined
        }

        if (!appId || !appSecret) {
          const dbAppId = getConfig('app_id')
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'skipped',
                message: '环境变量中未找到有效凭据（WECHAT_APP_ID / WECHAT_APP_SECRET）',
                checked: ['process.env', fallbackPath],
                db_app_id: dbAppId ? `${dbAppId.slice(0, 6)}...` : null,
                hint: '请先在 shell 配置文件中设置 export WECHAT_APP_ID=... export WECHAT_APP_SECRET=...，或直接调用 wechat_auth_configure',
              }),
            }],
            isError: true,
          }
        }

        setConfig('app_id', appId)
        setConfig('app_secret', appSecret)
        deleteConfig('access_token')
        deleteConfig('token_expires_at')
        sources.unshift('process.env')

        // 同步后立即做一次真实验证
        const token = await fetchNewToken()
        const expiresAt = Number(getConfig('token_expires_at') ?? 0)
        logInfo('Credentials synced from env', { sources })
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              status: 'ok',
              message: '凭据已同步并通过平台验证',
              sources,
              app_id: `${appId.slice(0, 6)}...`,
              token_preview: `${token.slice(0, 10)}...`,
              expires_at: expiresAt,
            }),
          }],
        }
      } catch (error) {
        return formatToolError(error)
      }
    },
  )
}
