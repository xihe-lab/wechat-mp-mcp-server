export const ErrorCodes = {
  WECHAT_001: 'AppID 或 AppSecret 未配置',
  WECHAT_002: 'Access Token 过期或刷新失败',
  WECHAT_003: '文件上传失败',
  WECHAT_004: '草稿创建失败',
  WECHAT_005: '发布失败',
  WECHAT_006: '网络错误',
} as const

export type ErrorCode = keyof typeof ErrorCodes

export class WechatMcpError extends Error {
  readonly code: ErrorCode
  readonly cause?: unknown

  constructor(code: ErrorCode, message?: string, cause?: unknown) {
    super(message ?? ErrorCodes[code])
    this.name = 'WechatMcpError'
    this.code = code
    this.cause = cause
  }
}

export function formatToolError(error: unknown): {
  content: Array<{ type: 'text'; text: string }>
  isError: true
} {
  if (error instanceof WechatMcpError) {
    return {
      content: [{ type: 'text', text: `[${error.code}] ${error.message}` }],
      isError: true,
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  return {
    content: [{ type: 'text', text: `[WECHAT_006] ${message}` }],
    isError: true,
  }
}
