/**
 * 公众号 Web 会话层：用 Playwright 维护一个已登录 mp.weixin.qq.com 的持久化浏览器 profile。
 * 浏览器只在扫码登录时需要可见；日常操作全部通过 context.request（共享 cookie）直调内部接口，
 * 不做 DOM 自动化（生产实践验证过的纯 HTTP 路线）。
 */
import fs from 'fs'
import path from 'path'
import type { BrowserContext } from 'playwright-core'
import { logInfo, logError } from '../logger'
import { WechatMcpError } from '../errors'

const MP_HOME = 'https://mp.weixin.qq.com/'

export interface WeixinMeta {
  token: string
  ticket: string
  userName: string
  nickName: string
  svrTime: number
}

let context: BrowserContext | null = null
let launching: Promise<BrowserContext> | null = null

function getProfileDir(): string {
  const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data')
  return path.join(dataDir, 'browser-profile')
}

/** 启动（或复用）持久化浏览器上下文 */
export async function getContext(headless?: boolean): Promise<BrowserContext> {
  if (context) return context
  if (launching) return launching

  launching = (async () => {
    const { chromium } = await import('playwright-core')
    const profileDir = getProfileDir()
    fs.mkdirSync(profileDir, { recursive: true })
    const channel = process.env.WECHAT_BROWSER_CHANNEL ?? 'chrome'
    const isHeadless = headless ?? process.env.WECHAT_BROWSER_HEADLESS === 'true'
    try {
      const ctx = await chromium.launchPersistentContext(profileDir, {
        channel,
        headless: isHeadless,
        viewport: { width: 1280, height: 900 },
        args: ['--disable-blink-features=AutomationControlled'],
      })
      logInfo('Browser session started', { channel, headless: isHeadless })
      context = ctx
      return ctx
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logError('Browser session failed to start', error)
      if (/channel|chrome|browserType/i.test(message)) {
        throw new WechatMcpError(
          'WECHAT_007',
          `无法启动 Chrome（channel: ${channel}）：${message}。请确认本机已安装 Google Chrome，或设置 WECHAT_BROWSER_CHANNEL 环境变量指定其他浏览器（如 msedge）`,
        )
      }
      throw new WechatMcpError('WECHAT_007', `浏览器启动失败: ${message}`)
    } finally {
      launching = null
    }
  })()

  return launching
}

export async function closeContext(): Promise<void> {
  if (context) {
    await context.close().catch(() => {})
    context = null
  }
}

/** 从页面 HTML 提取登录态元信息（正则与字段名均来自 mp 后台页面自身的内联配置） */
export function extractWeixinMeta(html: string): WeixinMeta | null {
  const token = html.match(/\bt:\s*["']([^"']+)["']\s*\|\|/)?.[1]
  if (!token) return null
  return {
    token,
    ticket: html.match(/ticket:\s*["']([^"']+)["']/)?.[1] ?? '',
    userName: html.match(/user_name:\s*["']([^"']+)["']/)?.[1] ?? '',
    nickName: html.match(/nick_name:\s*["']([^"']+)["']/)?.[1] ?? '',
    svrTime: Number(html.match(/time:\s*["'](\d+)["']/)?.[1] ?? Math.floor(Date.now() / 1000)),
  }
}

/** 检查登录态：GET 公众号后台首页，从返回页面提取 token 等元信息 */
export async function getWeixinMeta(): Promise<WeixinMeta | null> {
  const ctx = await getContext()
  const resp = await ctx.request.get(MP_HOME, {
    maxRedirects: 5,
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' },
  })
  const html = await resp.text()
  return extractWeixinMeta(html)
}

/** 要求已登录，否则抛错并指引 login */
export async function requireWeixinMeta(): Promise<WeixinMeta> {
  const meta = await getWeixinMeta()
  if (!meta) {
    throw new WechatMcpError(
      'WECHAT_009',
      '公众号后台登录态无效或已过期，请调用 wechat_web_login 扫码登录（登录一次后 cookie 持久保存）',
    )
  }
  return meta
}

/**
 * 扫码登录：打开有头浏览器访问后台首页，等待扫码完成（页面出现 token）。
 * 最长等待 timeoutMs（默认 5 分钟）。
 */
export async function loginWithQrCode(timeoutMs = 300_000): Promise<WeixinMeta> {
  const ctx = await getContext(false) // 登录必须有头
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.goto(MP_HOME, { waitUntil: 'domcontentloaded' }).catch(() => {})

  const startAt = Date.now()
  while (Date.now() - startAt < timeoutMs) {
    // 优先从当前页面内容判断（扫码后页面会自动跳转到带 token 的后台）
    const html = await page.content().catch(() => '')
    const meta = extractWeixinMeta(html)
    if (meta) {
      logInfo('WeChat MP login succeeded', { nick_name: meta.nickName })
      return meta
    }
    await page.waitForTimeout(3000)
  }
  throw new WechatMcpError('WECHAT_009', `扫码超时（${Math.round(timeoutMs / 1000)} 秒内未完成登录），请重试 wechat_web_login`)
}

/** 编辑器页面 URL：写入成功后可直接打开人工预览/发表 */
export function buildEditorUrl(appMsgId: string, token: string): string {
  return `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=${appMsgId}&token=${token}&lang=zh_CN`
}
