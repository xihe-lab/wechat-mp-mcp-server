import { describe, it, expect } from 'vitest'
import { WechatMcpError, ErrorCodes, formatToolError } from '../src/errors'

describe('WechatMcpError', () => {
  it('should create error with code and default message', () => {
    const error = new WechatMcpError('WECHAT_001')
    expect(error.code).toBe('WECHAT_001')
    expect(error.message).toBe(ErrorCodes.WECHAT_001)
    expect(error.name).toBe('WechatMcpError')
  })

  it('should create error with custom message', () => {
    const error = new WechatMcpError('WECHAT_006', 'Connection timeout')
    expect(error.message).toBe('Connection timeout')
  })

  it('should preserve cause', () => {
    const cause = new Error('original')
    const error = new WechatMcpError('WECHAT_002', 'Token expired', cause)
    expect(error.cause).toBe(cause)
  })

  it('should define all error codes', () => {
    const codes = Object.keys(ErrorCodes)
    expect(codes).toHaveLength(6)
    expect(codes).toContain('WECHAT_001')
    expect(codes).toContain('WECHAT_006')
  })
})

describe('formatToolError', () => {
  it('should format WechatMcpError', () => {
    const error = new WechatMcpError('WECHAT_001')
    const result = formatToolError(error)
    expect(result.isError).toBe(true)
    expect(result.content[0].type).toBe('text')
    expect(result.content[0].text).toContain('WECHAT_001')
  })

  it('should format generic Error', () => {
    const result = formatToolError(new Error('something broke'))
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('WECHAT_006')
    expect(result.content[0].text).toContain('something broke')
  })

  it('should format non-Error', () => {
    const result = formatToolError('string error')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('string error')
  })
})
