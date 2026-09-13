/**
 * 公众号后台内部接口封装（cookie + token 鉴权，经浏览器会话的 request 通道发出）。
 * 接口形态与错误码来自对公众平台 Web 后台网络行为的互操作性调研（详见内部知识库）。
 */
import fs from 'fs'
import path from 'path'
import type { BrowserContext } from 'playwright-core'
import { WechatMcpError } from '../errors'
import { logInfo } from '../logger'
import type { WeixinMeta } from './session'

const MP_ORIGIN = 'https://mp.weixin.qq.com'

/** operate_appmsg 常见错误码 → 人话（公众平台 Web 后台语义整理） */
const RET_MESSAGES: Record<string, string> = {
  '-6': '需要输入验证码，请在浏览器中打开编辑器完成验证后重试',
  '-8': '需要输入验证码，请在浏览器中打开编辑器完成验证后重试',
  '-1': '系统错误，请注意备份内容后重试',
  '-2': '参数错误，请注意备份内容后重试',
  '-5': '服务错误，请注意备份内容后重试',
  '-99': '内容超出字数限制（去标签正文 ≤2 万字），请删减后重试',
  '-206': '服务负荷过大，请稍后重试',
  '200002': '参数错误，请注意备份内容后重试',
  '200003': '登录态超时，请调用 wechat_web_login 重新扫码登录',
  '412': '图文中含非法外链',
  '62752': '可能含有具备安全风险的链接，请检查正文链接',
  '64502': '你输入的微信号不存在',
  '64506': '保存失败，链接不合法',
  '64507': '内容不能包含外部链接（非微信域名的 <a> 需降级为纯文本）',
  '64562': '请勿插入非微信域名的链接',
  '64509': '正文中不能包含超过 3 个视频',
  '64515': '当前素材非最新内容，请重新打开并编辑',
  '64702': '标题超出 64 字长度限制',
  '64703': '摘要超出 120 字长度限制',
  '64705': '内容超出字数限制（去标签正文 ≤2 万字），请删减后重试',
  '10806': '正文不能有违规内容，请重新编辑',
  '10807': '内容不能违反公众平台协议',
  '220001': '素材管理中的存储数量已达上限',
  '220002': '图片库已达到存储上限',
}

function extractRet(json: Record<string, unknown>): number | null {
  const baseResp = json.base_resp as { ret?: number; err_msg?: string } | undefined
  const ret = (json.ret as number | undefined) ?? baseResp?.ret
  return typeof ret === 'number' ? ret : null
}

function assertOk(json: Record<string, unknown>, action: string): void {
  const ret = extractRet(json)
  if (ret !== null && ret !== 0) {
    const hint = RET_MESSAGES[String(ret)] ?? `失败（错误码: ${ret}）`
    if (ret === 200003) {
      throw new WechatMcpError('WECHAT_009', `${action}失败：${hint}`)
    }
    throw new WechatMcpError('WECHAT_007', `${action}失败：${hint}`)
  }
}

export { assertOk, extractRet, RET_MESSAGES }

function commonHeaders(): Record<string, string> {
  return {
    Origin: MP_ORIGIN,
    Referer: `${MP_ORIGIN}/cgi-bin/home?t=home/lang=zh_CN&token=`,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  }
}

export interface DraftPayload {
  title: string
  content: string
  author?: string
  digest?: string
  sourceUrl?: string
  showCoverPic?: boolean
  needOpenComment?: number
  onlyFansCanComment?: number
}

/** 构造 operate_appmsg 表单（单图文，字段名与后台编辑器保存时一致） */
export function buildAppmsgForm(meta: WeixinMeta, p: DraftPayload, sub: 'create' | 'update', appMsgId?: string): URLSearchParams {
  const form = new URLSearchParams()
  form.set('token', meta.token)
  form.set('lang', 'zh_CN')
  form.set('f', 'json')
  form.set('ajax', '1')
  form.set('random', String(Math.random()))
  form.set('AppMsgId', appMsgId ?? '')
  form.set('count', '1')
  form.set('data_seq', '0')
  form.set('operate_from', 'Chrome')
  form.set('isnew', sub === 'create' ? '0' : '1')
  form.set('ad_video_transition0', '')
  form.set('can_reward0', '0')
  form.set('related_video0', '')
  form.set('is_video_recommend0', '-1')
  form.set('title0', p.title)
  form.set('author0', p.author ?? '')
  form.set('writerid0', '0')
  form.set('fileid0', '')
  form.set('digest0', p.digest ?? '')
  form.set('auto_gen_digest0', p.digest ? '0' : '1')
  form.set('content0', p.content)
  form.set('sourceurl0', p.sourceUrl ?? '')
  form.set('need_open_comment0', String(p.needOpenComment ?? 1))
  form.set('only_fans_can_comment0', String(p.onlyFansCanComment ?? 0))
  form.set('cdn_url0', '')
  form.set('cdn_235_1_url0', '')
  form.set('cdn_1_1_url0', '')
  form.set('cdn_url_back0', '')
  form.set('crop_list0', '')
  form.set('music_id0', '')
  form.set('video_id0', '')
  form.set('voteid0', '')
  form.set('voteismlt0', '')
  form.set('supervoteid0', '')
  form.set('cardid0', '')
  form.set('cardquantity0', '')
  form.set('cardlimit0', '')
  form.set('vid_type0', '')
  form.set('show_cover_pic0', p.showCoverPic ? '1' : '0')
  form.set('shortvideofileid0', '')
  form.set('copyright_type0', '0')
  form.set('releasefirst0', '')
  form.set('platform0', '')
  form.set('reprint_permit_type0', '')
  form.set('allow_reprint0', '')
  form.set('allow_reprint_modify0', '')
  form.set('original_article_type0', '')
  form.set('ori_white_list0', '')
  form.set('free_content0', '')
  form.set('fee0', '0')
  form.set('ad_id0', '')
  form.set('guide_words0', '')
  form.set('is_share_copyright0', '0')
  form.set('share_copyright_url0', '')
  form.set('source_article_type0', '')
  form.set('reprint_recommend_title0', '')
  form.set('reprint_recommend_content0', '')
  form.set('share_page_type0', '0')
  form.set('share_imageinfo0', '{"list":[]}')
  form.set('share_video_id0', '')
  form.set('dot0', '{}')
  form.set('share_voice_id0', '')
  form.set('insert_ad_mode0', '')
  form.set('categories_list0', '[]')
  return form
}

async function postForm(ctx: BrowserContext, url: string, form: URLSearchParams): Promise<Record<string, unknown>> {
  const resp = await ctx.request.post(url, {
    headers: { ...commonHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
    data: form.toString(),
    maxRedirects: 0,
  })
  const text = await resp.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new WechatMcpError('WECHAT_007', `接口返回非 JSON（HTTP ${resp.status()}）：${text.slice(0, 200)}`)
  }
}

/** 新建图文草稿（完整正文直写，无 2 万 HTML 字符限制） */
export async function operateAppmsgCreate(ctx: BrowserContext, meta: WeixinMeta, payload: DraftPayload): Promise<{ appMsgId: string }> {
  const form = buildAppmsgForm(meta, payload, 'create')
  const json = await postForm(ctx, `${MP_ORIGIN}/cgi-bin/operate_appmsg?t=ajax-response&sub=create&type=77&token=${meta.token}&lang=zh_CN`, form)
  assertOk(json, '创建草稿')
  const appMsgId = String(json.appMsgId ?? json.AppMsgId ?? '')
  if (!appMsgId) {
    throw new WechatMcpError('WECHAT_007', `创建草稿成功但未返回 appMsgId：${JSON.stringify(json).slice(0, 300)}`)
  }
  logInfo('Draft created via operate_appmsg', { appMsgId })
  return { appMsgId }
}

/** 上传图片（web 编辑器 filetransfer 通道，返回 mmbiz cdn_url，无 IP 白名单依赖） */
export async function filetransferUpload(ctx: BrowserContext, meta: WeixinMeta, filePath: string): Promise<{ url: string }> {
  if (filePath.includes('..')) {
    throw new WechatMcpError('WECHAT_003', '文件路径不合法')
  }
  if (!fs.existsSync(filePath)) {
    throw new WechatMcpError('WECHAT_003', `文件不存在: ${filePath}`)
  }
  const stat = fs.statSync(filePath)
  if (stat.size > 10 * 1024 * 1024) {
    throw new WechatMcpError('WECHAT_003', '文件超过 10MB 限制')
  }
  const name = path.basename(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg'

  const seq = Date.now()
  const url =
    `${MP_ORIGIN}/cgi-bin/filetransfer?action=upload_material&f=json&scene=8&writetype=doublewrite&groupid=1` +
    `&ticket_id=${encodeURIComponent(meta.userName)}&ticket=${encodeURIComponent(meta.ticket)}&svr_time=${meta.svrTime}` +
    `&token=${encodeURIComponent(meta.token)}&lang=zh_CN&seq=${seq}&t=${Math.random()}`

  const resp = await ctx.request.post(url, {
    headers: commonHeaders(),
    multipart: {
      type: mime,
      id: String(seq),
      name,
      lastModifiedDate: new Date().toString(),
      size: String(stat.size),
      file: { name, mimeType: mime, buffer: fs.readFileSync(filePath) },
    },
    maxRedirects: 0,
  })
  const text = await resp.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new WechatMcpError('WECHAT_003', `filetransfer 返回非 JSON（HTTP ${resp.status()}）：${text.slice(0, 200)}`)
  }
  const baseResp = json.base_resp as { err_msg?: string } | undefined
  const cdnUrl = String(json.cdn_url ?? '')
  if (!cdnUrl || (baseResp?.err_msg && baseResp.err_msg !== 'ok')) {
    throw new WechatMcpError('WECHAT_003', `图片上传失败: ${baseResp?.err_msg ?? JSON.stringify(json).slice(0, 200)}`)
  }
  logInfo('Image uploaded via filetransfer', { file: name })
  return { url: cdnUrl }
}

/** 图文分析（阅读量等，web 后台 misc 接口，按日）。report_type: daily（旧）/ daily_v2（新版后台使用） */
export async function appmsgAnalysis(
  ctx: BrowserContext,
  meta: WeixinMeta,
  beginDate: string,
  endDate: string,
  reportType: 'daily' | 'daily_v2' = 'daily_v2',
): Promise<Record<string, unknown>> {
  const url =
    `${MP_ORIGIN}/misc/appmsganalysis?action=report&type=${reportType}&begin_date=${beginDate}&end_date=${endDate}` +
    `&token=${meta.token}&lang=zh_CN&f=json&ajax=1&random=${Math.random()}`
  const resp = await ctx.request.get(url, { headers: commonHeaders() })
  const text = await resp.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new WechatMcpError('WECHAT_007', `appmsganalysis 返回非 JSON（HTTP ${resp.status()}）：${text.slice(0, 200)}`)
  }
  assertOk(json, '图文分析')
  return pickAnalysisData(json)
}

/** 只保留数据字段，剥离 base_resp 会话信息 / user_acl 等噪声（含 ticket 等敏感值） */
const ANALYSIS_DATA_KEYS = [
  'read_item', 'read_item_new', 'share_item', 'share_item_new', 'like_item', 'like_item_new',
  'zaikan_item', 'comment_item', 'read_summary', 'read_summary_new', 'share_summary',
  'like_summary', 'zaikan_summary', 'comment_summary', 'load_done',
]

function pickAnalysisData(json: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const key of ANALYSIS_DATA_KEYS) {
    if (key in json) picked[key] = json[key]
  }
  return picked
}

/** 用户分析（净增/取关等，web 后台 misc 接口） */
export async function userAnalysis(ctx: BrowserContext, meta: WeixinMeta, beginDate: string, endDate: string): Promise<Record<string, unknown>> {
  const url =
    `${MP_ORIGIN}/misc/useranalysis?begin_date=${beginDate}&end_date=${endDate}` +
    `&token=${meta.token}&lang=zh_CN&f=json&order_by=1&order_direction=2&random=${Math.random()}`
  const resp = await ctx.request.get(url, { headers: commonHeaders() })
  const text = await resp.text()
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new WechatMcpError('WECHAT_007', `useranalysis 返回非 JSON（HTTP ${resp.status()}）：${text.slice(0, 200)}`)
  }
  assertOk(json, '用户分析')
  // 剥离会话信息与账号 ACL 噪声（含 verify_code 等非统计数据）
  delete json.base_resp
  delete json.user_info
  delete json.user_acl
  return json
}
