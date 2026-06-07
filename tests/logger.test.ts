import { describe, it, expect } from 'vitest'
import { redact } from '../src/logger'

describe('redact', () => {
  it('should redact access_token', () => {
    const result = redact({ access_token: 'secret123', name: 'test' })
    expect(result).toEqual({ access_token: '***redacted***', name: 'test' })
  })

  it('should redact app_secret', () => {
    const result = redact({ app_secret: 's3cret', app_id: 'wx123' })
    expect(result).toEqual({ app_secret: '***redacted***', app_id: 'wx123' })
  })

  it('should redact AppSecret (case-insensitive)', () => {
    const result = redact({ AppSecret: 'abc' })
    expect(result).toEqual({ AppSecret: '***redacted***' })
  })

  it('should redact nested objects', () => {
    const result = redact({ data: { access_token: 'tok', value: 1 } })
    expect(result).toEqual({ data: { access_token: '***redacted***', value: 1 } })
  })

  it('should handle arrays', () => {
    const result = redact([{ access_token: 'a' }, { name: 'b' }])
    expect(result).toEqual([{ access_token: '***redacted***' }, { name: 'b' }])
  })

  it('should pass through non-sensitive values', () => {
    expect(redact('string')).toBe('string')
    expect(redact(123)).toBe(123)
    expect(redact(null)).toBe(null)
    expect(redact(undefined)).toBe(undefined)
  })
})
