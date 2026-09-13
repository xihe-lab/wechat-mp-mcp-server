import { describe, it, expect } from 'vitest'
import { extractWeixinMeta, buildEditorUrl } from '../src/webhub/session'
import { buildAppmsgForm, assertOk, extractRet } from '../src/webhub/api'
import { WechatMcpError } from '../src/errors'

/** 伪造的 mp 后台首页内联配置片段（字段形态与真实页面一致） */
const FAKE_HOME_HTML = `
window.wx = {
  t: "e8f7a6b5c4d3210987654321abcdef01" || "",
  ticket: "ticket-abc123",
  user_name: "gh_xihe_lab",
  nick_name: "羲和实验室",
  time: "1789400000",
  head_img: "https://wx.qlogo.cn/mmhead/xxx/132"
};
`

describe('extractWeixinMeta', () => {
  it('should extract meta from fake mp home html', () => {
    const meta = extractWeixinMeta(FAKE_HOME_HTML)
    expect(meta).not.toBeNull()
    expect(meta?.token).toBe('e8f7a6b5c4d3210987654321abcdef01')
    expect(meta?.ticket).toBe('ticket-abc123')
    expect(meta?.userName).toBe('gh_xihe_lab')
    expect(meta?.nickName).toBe('羲和实验室')
    expect(meta?.svrTime).toBe(1789400000)
  })

  it('should return null for login page without token', () => {
    const loginHtml = '<html><body>请扫码登录</body></html>'
    expect(extractWeixinMeta(loginHtml)).toBeNull()
  })

  it('should handle single-quote variants', () => {
    const html = "t: 'tok123' || ''; ticket: 'tk9'; user_name: 'gh_x'; nick_name: '名'; time: '100'"
    const meta = extractWeixinMeta(html)
    expect(meta?.token).toBe('tok123')
    expect(meta?.ticket).toBe('tk9')
  })
})

describe('buildEditorUrl', () => {
  it('should build editor url with appmsgid and token', () => {
    const url = buildEditorUrl('123456', 'tok789')
    expect(url).toContain('appmsg?t=media/appmsg_edit')
    expect(url).toContain('appmsgid=123456')
    expect(url).toContain('token=tok789')
    expect(url).toContain('type=77')
  })
})

describe('buildAppmsgForm', () => {
  const meta = {
    token: 'tok123',
    ticket: 'tk',
    userName: 'gh_x',
    nickName: '名',
    svrTime: 100,
  }

  it('should set key fields for create', () => {
    const form = buildAppmsgForm(meta, {
      title: '测试标题',
      content: '<p>正文</p>',
      author: '羲和实验室',
      digest: '摘要',
      showCoverPic: false,
    }, 'create')
    expect(form.get('token')).toBe('tok123')
    expect(form.get('title0')).toBe('测试标题')
    expect(form.get('content0')).toBe('<p>正文</p>')
    expect(form.get('author0')).toBe('羲和实验室')
    expect(form.get('digest0')).toBe('摘要')
    expect(form.get('auto_gen_digest0')).toBe('0')
    expect(form.get('show_cover_pic0')).toBe('0')
    expect(form.get('count')).toBe('1')
    expect(form.get('AppMsgId')).toBe('')
    expect(form.get('isnew')).toBe('0')
    expect(form.get('f')).toBe('json')
  })

  it('should auto-generate digest when not provided', () => {
    const form = buildAppmsgForm(meta, { title: 't', content: 'c' }, 'create')
    expect(form.get('auto_gen_digest0')).toBe('1')
  })

  it('should mark update mode and carry AppMsgId', () => {
    const form = buildAppmsgForm(meta, { title: 't', content: 'c' }, 'update', '999')
    expect(form.get('isnew')).toBe('1')
    expect(form.get('AppMsgId')).toBe('999')
  })
})

describe('extractRet / assertOk', () => {
  it('should read ret from top level or base_resp', () => {
    expect(extractRet({ ret: -99 })).toBe(-99)
    expect(extractRet({ base_resp: { ret: 200003 } })).toBe(200003)
    expect(extractRet({ appMsgId: '1' })).toBeNull()
  })

  it('should pass on ret 0 or missing', () => {
    expect(() => assertOk({ ret: 0 }, 'x')).not.toThrow()
    expect(() => assertOk({ appMsgId: '1' }, 'x')).not.toThrow()
  })

  it('should throw WECHAT_007 with human message for known codes', () => {
    try {
      assertOk({ ret: -99 }, '创建草稿')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(WechatMcpError)
      expect((error as WechatMcpError).code).toBe('WECHAT_007')
      expect((error as WechatMcpError).message).toContain('字数')
      expect((error as WechatMcpError).message).toContain('创建草稿')
    }
  })

  it('should throw WECHAT_009 for login expiry (200003)', () => {
    try {
      assertOk({ base_resp: { ret: 200003 } }, '查询')
      expect.unreachable()
    } catch (error) {
      expect((error as WechatMcpError).code).toBe('WECHAT_009')
      expect((error as WechatMcpError).message).toContain('wechat_web_login')
    }
  })

  it('should include raw code for unknown ret', () => {
    try {
      assertOk({ ret: 99999 }, 'x')
      expect.unreachable()
    } catch (error) {
      expect((error as WechatMcpError).message).toContain('99999')
    }
  })
})
