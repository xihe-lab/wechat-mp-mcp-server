import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp'
import { z } from 'zod'
import { getClient, getAccessToken } from '../wechat/client'
import { formatToolError, WechatMcpError } from '../errors'
import { logInfo } from '../logger'
import fs from 'fs'
import path from 'path'

const MAX_FILE_SIZE = 10 * 1024 * 1024

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['jpg', 'jpeg', 'png'],
  voice: ['mp3', 'wma', 'wav', 'amr'],
  video: ['mp4'],
}

function validateFile(type: string, filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new WechatMcpError('WECHAT_003', `文件不存在: ${filePath}`)
  }
  const stat = fs.statSync(filePath)
  if (stat.size > MAX_FILE_SIZE) {
    throw new WechatMcpError('WECHAT_003', `文件超过 10MB 限制`)
  }
  const ext = path.extname(filePath).slice(1).toLowerCase()
  const allowed = ALLOWED_TYPES[type]
  if (!allowed || !allowed.includes(ext)) {
    throw new WechatMcpError('WECHAT_003', `${type} 类型不支持 .${ext} 格式，允许: ${allowed?.join('/')}`)
  }
  if (filePath.includes('..')) {
    throw new WechatMcpError('WECHAT_003', '文件路径不合法')
  }
}

export function registerMediaTools(server: McpServer): void {
  server.tool('wechat_media_upload', '上传临时素材（图片/语音/视频）', {
    type: z.enum(['image', 'voice', 'video']).describe('素材类型'),
    file_path: z.string().describe('本地文件路径'),
  }, async ({ type, file_path }) => {
    try {
      validateFile(type, file_path)
      const token = await getAccessToken()
      const FormData = (await import('form-data')).default
      const form = new FormData()
      form.append('media', fs.createReadStream(file_path))

      const resp = await getClient().post(
        `https://api.weixin.qq.com/cgi-bin/media/upload`,
        form,
        {
          headers: { ...form.getHeaders() },
          params: { access_token: token, type },
        },
      )
      const data = resp.data
      if (data.errcode && data.errcode !== 0) {
        throw new WechatMcpError('WECHAT_003', data.errmsg)
      }
      logInfo('Media uploaded', { media_id: data.media_id, type })
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ media_id: data.media_id, type: data.type, created_at: data.created_at }),
        }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })

  server.tool('wechat_media_get', '获取临时素材', {
    media_id: z.string().describe('素材 media_id'),
  }, async ({ media_id }) => {
    try {
      const token = await getAccessToken()
      const resp = await getClient().get(
        `https://api.weixin.qq.com/cgi-bin/media/get`,
        {
          params: { access_token: token, media_id },
          responseType: 'arraybuffer',
        },
      )
      const contentType = resp.headers['content-type'] ?? ''
      if (contentType.includes('application/json') || contentType.includes('text/plain')) {
        const text = new TextDecoder().decode(resp.data as ArrayBuffer)
        const json = JSON.parse(text)
        if (json.errcode && json.errcode !== 0) {
          throw new WechatMcpError('WECHAT_003', json.errmsg)
        }
      }
      return {
        content: [{
          type: 'text' as const,
          text: `素材获取成功（media_id: ${media_id}，content-type: ${contentType}，size: ${Number(resp.data.byteLength ?? 0)} bytes）`,
        }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })

  server.tool('wechat_material_upload_image', '上传永久图片素材（用于草稿封面图，返回的 media_id 可作为 thumb_media_id）', {
    file_path: z.string().describe('本地图片文件路径（JPG/PNG，≤10MB）'),
  }, async ({ file_path }) => {
    try {
      validateFile('image', file_path)
      const token = await getAccessToken()
      const FormData = (await import('form-data')).default
      const form = new FormData()
      form.append('media', fs.createReadStream(file_path))

      const resp = await getClient().post(
        `https://api.weixin.qq.com/cgi-bin/material/add_material`,
        form,
        {
          headers: { ...form.getHeaders() },
          params: { access_token: token, type: 'image' },
        },
      )
      const data = resp.data
      if (data.errcode && data.errcode !== 0) {
        throw new WechatMcpError('WECHAT_003', data.errmsg)
      }
      logInfo('Permanent image uploaded', { media_id: data.media_id })
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ media_id: data.media_id, url: data.url }),
        }],
      }
    } catch (error) {
      return formatToolError(error)
    }
  })
}
