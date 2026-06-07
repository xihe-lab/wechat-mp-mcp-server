import axios, { type AxiosInstance } from 'axios'
import { WechatMcpError } from '../errors'
import { getConfig, setConfig, closeDb } from '../storage/db'
import { logInfo, logError } from '../logger'
import type { TokenResponse, WechatApiError } from './types'

const BASE_URL = 'https://api.weixin.qq.com/cgi-bin'
const TOKEN_REFRESH_THRESHOLD = 200

let client: AxiosInstance | null = null

function createClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 10_000,
  })

  instance.interceptors.request.use(async (config) => {
    const skipAuth = config.headers?.['X-Skip-Auth'] === 'true'
    if (!skipAuth) {
      const token = await getAccessToken()
      config.params = { ...config.params, access_token: token }
    }
    delete config.headers?.['X-Skip-Auth']
    return config
  })

  instance.interceptors.response.use(
    (response) => {
      const data = response.data as WechatApiError | undefined
      if (data?.errcode && data.errcode !== 0) {
        logError('WeChat API error', data)
        throw new WechatMcpError('WECHAT_006', `${data.errmsg} (errcode: ${data.errcode})`)
      }
      return response
    },
    (error) => {
      logError('Request failed', error)
      throw new WechatMcpError('WECHAT_006', error.message, error)
    },
  )

  return instance
}

export async function fetchNewToken(): Promise<string> {
  const appId = getConfig('app_id') ?? process.env.WECHAT_APP_ID
  const appSecret = getConfig('app_secret') ?? process.env.WECHAT_APP_SECRET

  if (!appId || !appSecret) {
    throw new WechatMcpError('WECHAT_001')
  }

  logInfo('Fetching new access token')
  const resp = await axios.get<TokenResponse>(
    `${BASE_URL}/token`,
    { params: { grant_type: 'client_credential', appid: appId, secret: appSecret } },
  )

  const { access_token, expires_in, errcode, errmsg } = resp.data
  if (errcode) {
    throw new WechatMcpError('WECHAT_002', `${errmsg} (errcode: ${errcode})`)
  }

  const expiresAt = Math.floor(Date.now() / 1000) + expires_in
  setConfig('access_token', access_token)
  setConfig('token_expires_at', String(expiresAt))
  logInfo('Access token refreshed', { expires_in })

  return access_token
}

export async function getAccessToken(): Promise<string> {
  const token = getConfig('access_token')
  const expiresAt = Number(getConfig('token_expires_at') ?? 0)
  const now = Math.floor(Date.now() / 1000)

  if (token && expiresAt - now > TOKEN_REFRESH_THRESHOLD) {
    return token
  }

  return fetchNewToken()
}

export function getClient(): AxiosInstance {
  if (!client) {
    client = createClient()
  }
  return client
}

export function closeClientDb(): void {
  closeDb()
}
