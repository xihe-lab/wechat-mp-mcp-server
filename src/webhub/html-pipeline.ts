/**
 * 写入公众号前的 HTML 转换管道：
 * - stripExternalLinks：非微信域名链接降级为纯文本（规避 64507/64562 外链违规）
 * - processImages：本地/外链图片上传到 mmbiz 图床并替换 src（规避图片被过滤）
 * 参考同类工具的通用预处理管道 + 羲和实验室发布规范。
 */
import fs from 'fs'
import path from 'path'
import type { BrowserContext } from 'playwright-core'
import { logInfo } from '../logger'
import type { WeixinMeta } from './session'
import { filetransferUpload } from './api'

const MM = /mmbiz\.(qpic|qlogo)\.cn/i

/** 非微信域名的 <a> 降级为纯文本；保留 mp.weixin.qq.com / weixin.qq.com / 锚点 / javascript: */
export function stripExternalLinks(html: string): { html: string; stripped: number } {
  let stripped = 0
  const result = html.replace(
    /<a\s[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (whole, href: string, inner: string) => {
      const keep =
        href.includes('mp.weixin.qq.com') ||
        href.includes('weixin.qq.com') ||
        href.startsWith('#') ||
        href.startsWith('javascript:')
      if (keep) return whole
      stripped += 1
      return inner
    },
  )
  return { html: result, stripped }
}

export interface ImageProcessResult {
  html: string
  uploaded: Array<{ source: string; url: string }>
  skipped: number
}

/** 收集需要处理的 img src：本地路径 + 非 mmbiz 外链 */
export function collectImageSources(html: string): { local: string[]; remote: string[] } {
  const srcs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1])
  const local: string[] = []
  const remote: string[] = []
  for (const src of srcs) {
    if (MM.test(src)) continue
    if (/^data:image\//i.test(src)) continue
    if (/^https?:\/\//i.test(src)) remote.push(src)
    else local.push(src)
  }
  return { local: [...new Set(local)], remote: [...new Set(remote)] }
}

function replaceSrc(html: string, source: string, newUrl: string): string {
  // 同时替换引号两种形态；URL 中的特殊字符按字面匹配
  const esc = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return html
    .replace(new RegExp(`(src=["'])${esc}(["'])`, 'gi'), `$1${newUrl}$2`)
}

/** 上传本地图片并替换 src */
export async function processImages(
  ctx: BrowserContext,
  meta: WeixinMeta,
  html: string,
  options?: { baseDir?: string },
): Promise<ImageProcessResult> {
  const { local, remote } = collectImageSources(html)
  const uploaded: Array<{ source: string; url: string }> = []
  let skipped = 0

  for (const src of local) {
    const resolved = path.isAbsolute(src) ? src : path.resolve(options?.baseDir ?? process.cwd(), src)
    if (!fs.existsSync(resolved)) {
      logInfo('Image not found, keep src as-is', { src })
      skipped += 1
      continue
    }
    const { url } = await filetransferUpload(ctx, meta, resolved)
    uploaded.push({ source: src, url })
    html = replaceSrc(html, src, url)
  }

  for (const src of remote) {
    try {
      const resp = await ctx.request.get(src, { maxRedirects: 3 })
      if (!resp.ok()) {
        skipped += 1
        continue
      }
      const buffer = await resp.body()
      const tmpName = `webhub-img-${Date.now()}-${uploaded.length}${path.extname(new URL(src).pathname) || '.jpg'}`
      const tmpPath = path.join(process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data'), tmpName)
      fs.mkdirSync(path.dirname(tmpPath), { recursive: true })
      fs.writeFileSync(tmpPath, buffer)
      const { url } = await filetransferUpload(ctx, meta, tmpPath)
      uploaded.push({ source: src, url })
      html = replaceSrc(html, src, url)
      fs.unlinkSync(tmpPath)
    } catch (error) {
      logInfo('Remote image download failed, keep as-is', { src, error: String(error) })
      skipped += 1
    }
  }

  return { html, uploaded, skipped }
}

/** 包裹外层 section（默认排版包裹；已自带排版的文章无需） */
export function wrapSection(html: string): string {
  return `<section style="margin-left: 6px; margin-right: 6px; line-height: 1.75em;">${html}</section>`
}
