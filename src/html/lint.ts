/**
 * 公众号正文 HTML 静态检查。
 * 规则来源：羲和实验室皋陶/墨子的发布前审查清单（ul/li 不渲染、br 必须独立 span、
 * 占位符残留、图片必须 mmbiz 图床、SVG begin 双事件）与微信官方编辑器插件开发规范。
 */

export interface LintFinding {
  rule: string
  level: 'error' | 'warn' | 'info'
  count: number
  message: string
}

export interface LintReport {
  html_char_count: number
  text_char_count: number
  text_char_limit: number
  findings: LintFinding[]
  pass: boolean
}

export const TEXT_CHAR_LIMIT = 20_000
const TEXT_CHAR_WARN_THRESHOLD = 19_000

/** 去标签后的正文字数（微信限制的是字数而非 HTML 字符数） */
export function stripTags(html: string): string {
  return html
    .replace(/<(pre|script|style|textarea)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, ' ')
}

export function lintHtml(html: string): LintReport {
  const findings: LintFinding[] = []

  // 1. ul/li 标签：公众号编辑器不渲染，会挤成一行
  const ulCount = (html.match(/<ul[\s>]/gi) ?? []).length
  const liCount = (html.match(/<li[\s>]/gi) ?? []).length
  if (ulCount > 0 || liCount > 0) {
    findings.push({
      rule: 'ul-li-residue',
      level: 'error',
      count: ulCount + liCount,
      message: `检测到 <ul>×${ulCount} / <li>×${liCount}：公众号编辑器不渲染列表标签，请替换为 • 文本 + 独立段落分行`,
    })
  }

  // 2. 裸 <br>：必须包裹在独立 <span leaf=""><br></span> 中，否则换行丢失
  const brTotal = (html.match(/<br\s*\/?>/gi) ?? []).length
  const brInLeafSpan = (html.match(/<span[^>]*leaf[^>]*>\s*<br\s*\/?>\s*<\/span>/gi) ?? []).length
  if (brTotal > brInLeafSpan) {
    findings.push({
      rule: 'bare-br',
      level: 'error',
      count: brTotal - brInLeafSpan,
      message: `共 ${brTotal} 个 <br>，仅 ${brInLeafSpan} 个位于独立 <span leaf> 内；裸 <br> 在公众号编辑器中会被忽略导致换行丢失`,
    })
  }

  // 3. 占位符残留
  const placeholderHits = [
    ...(html.match(/PLACEHOLDER[^"'\s<>]*/gi) ?? []),
    ...(html.match(/待编辑/g) ?? []),
  ]
  if (placeholderHits.length > 0) {
    findings.push({
      rule: 'placeholder-residue',
      level: 'error',
      count: placeholderHits.length,
      message: `检测到占位符残留 ${placeholderHits.length} 处（如 ${placeholderHits.slice(0, 3).join('、')}），发布前必须全部替换`,
    })
  }

  // 4. 图片来源检查：正文图片必须来自 mmbiz 图床（本地路径/外链会被过滤）
  const imgSrcs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1])
  const badImgs = imgSrcs.filter((src) => {
    if (/^https?:\/\/[^/]*mmbiz\.(qpic|qlogo)\.cn\//i.test(src)) return false
    if (/^data:image\//i.test(src)) return false
    return true
  })
  if (badImgs.length > 0) {
    findings.push({
      rule: 'non-mmbiz-image',
      level: 'warn',
      count: badImgs.length,
      message: `${badImgs.length} 张图片 src 非 mmbiz 图床（如 ${badImgs[0].slice(0, 60)}），正文直发会被微信过滤，需先经 wechat_media_uploadimg / wechat_web_upload_image 上传替换`,
    })
  }

  // 5. script 标签：会被强制去除
  const scriptCount = (html.match(/<script[\s>]/gi) ?? []).length
  if (scriptCount > 0) {
    findings.push({
      rule: 'script-tag',
      level: 'warn',
      count: scriptCount,
      message: `检测到 ${scriptCount} 个 <script> 标签，微信会强制去除 JS，相关交互将失效`,
    })
  }

  // 6. SVG animate 的 begin 必须双事件（touchstart;click），否则 PC 端点击无响应
  const begins = [...html.matchAll(/<animate[^>]+begin=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1])
  const badBegins = begins.filter((b) => !/touchstart/i.test(b) || !/click/i.test(b))
  if (badBegins.length > 0) {
    findings.push({
      rule: 'svg-begin-single-event',
      level: 'warn',
      count: badBegins.length,
      message: `${badBegins.length} 个 SVG <animate> 的 begin 未同时绑定 touchstart 和 click 双事件（官方编辑器插件规范），移动端或 PC 端将无法触发`,
    })
  }

  // 7. 正文字数（去标签）：编辑器通道的上限约束
  const textCharCount = stripTags(html).replace(/\s/g, '').length
  if (textCharCount >= TEXT_CHAR_LIMIT) {
    findings.push({
      rule: 'text-char-limit',
      level: 'error',
      count: textCharCount,
      message: `去标签正文字数 ${textCharCount}，已达/超过 ${TEXT_CHAR_LIMIT} 上限，微信会拒绝保存（错误码 -99/64705），必须删减正文`,
    })
  } else if (textCharCount >= TEXT_CHAR_WARN_THRESHOLD) {
    findings.push({
      rule: 'text-char-limit',
      level: 'warn',
      count: textCharCount,
      message: `去标签正文字数 ${textCharCount}，接近 ${TEXT_CHAR_LIMIT} 上限，请注意删减`,
    })
  }

  const htmlCharCount = html.length
  if (htmlCharCount >= 20_000) {
    findings.push({
      rule: 'api-char-limit',
      level: 'info',
      count: htmlCharCount,
      message: `HTML 总长 ${htmlCharCount} 字符 ≥2 万：不可走官方 draft/add 接口（其限制 HTML 字符数），请使用 wechat_web_write_draft 编辑器通道（其限制的是去标签字数，当前 ${textCharCount}）`,
    })
  }

  return {
    html_char_count: htmlCharCount,
    text_char_count: textCharCount,
    text_char_limit: TEXT_CHAR_LIMIT,
    findings,
    pass: !findings.some((f) => f.level === 'error'),
  }
}
