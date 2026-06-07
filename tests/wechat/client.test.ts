import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import os from 'node:os'

vi.mock('axios')

describe('WeChat Client - Token Management', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.WECHAT_APP_ID
    delete process.env.WECHAT_APP_SECRET
  })

  it('should throw WECHAT_001 when no credentials configured', async () => {
    delete process.env.WECHAT_APP_ID
    delete process.env.WECHAT_APP_SECRET
    process.env.DATA_DIR = `${os.tmpdir()}/weixin-test-${Date.now()}`

    const { fetchNewToken } = await import('../../src/wechat/client')
    await expect(fetchNewToken()).rejects.toThrow('AppID 或 AppSecret 未配置')
  })

  it('should fetch token from WeChat API', async () => {
    const mockedAxios = vi.mocked(axios)
    mockedAxios.get.mockResolvedValueOnce({
      data: { access_token: 'tok_abc', expires_in: 7200 },
    })

    process.env.WECHAT_APP_ID = 'wx123'
    process.env.WECHAT_APP_SECRET = 'secret'
    process.env.DATA_DIR = `${os.tmpdir()}/weixin-test-${Date.now()}`

    const { fetchNewToken } = await import('../../src/wechat/client')
    const token = await fetchNewToken()
    expect(token).toBe('tok_abc')
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/token'),
      expect.objectContaining({
        params: expect.objectContaining({ appid: 'wx123' }),
      }),
    )
  })

  it('should throw on WeChat API error response', async () => {
    const mockedAxios = vi.mocked(axios)
    mockedAxios.get.mockResolvedValueOnce({
      data: { errcode: 40013, errmsg: 'invalid appid' },
    })

    process.env.WECHAT_APP_ID = 'bad'
    process.env.WECHAT_APP_SECRET = 'bad'
    process.env.DATA_DIR = `${os.tmpdir()}/weixin-test-${Date.now()}`

    const { fetchNewToken } = await import('../../src/wechat/client')
    await expect(fetchNewToken()).rejects.toThrow()
  })
})
