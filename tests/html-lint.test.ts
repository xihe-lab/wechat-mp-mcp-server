import { describe, it, expect } from 'vitest'
import { lintHtml, stripTags } from '../src/html/lint'

function findRule(html: string, rule: string) {
  return lintHtml(html).findings.find((f) => f.rule === rule)
}

describe('stripTags', () => {
  it('should remove tags and decode entities to spaces', () => {
    expect(stripTags('<p>你好</p><section style="x">世界</section>')).toBe('你好世界')
    expect(stripTags('<p>a&nbsp;b</p>')).toBe('a b')
  })

  it('should drop script/style/pre blocks entirely', () => {
    expect(stripTags('<pre><code>const a=1</code></pre>正文')).toBe('正文')
    expect(stripTags('<style>.a{}</style><script>var b</script>字')).toBe('字')
  })
})

describe('lintHtml: ul/li 残留', () => {
  it('should detect ul and li tags', () => {
    const f = findRule('<ul><li>a</li><li>b</li></ul>', 'ul-li-residue')
    expect(f).toBeDefined()
    expect(f?.level).toBe('error')
    expect(f?.count).toBe(3) // 1 ul + 2 li
  })

  it('should pass when no list tags', () => {
    expect(findRule('<p>• 项目一</p><p>• 项目二</p>', 'ul-li-residue')).toBeUndefined()
  })
})

describe('lintHtml: 裸 br 检查', () => {
  it('should flag bare br outside leaf span', () => {
    const f = findRule('<p>第一行<br/>第二行</p>', 'bare-br')
    expect(f).toBeDefined()
    expect(f?.level).toBe('error')
    expect(f?.count).toBe(1)
  })

  it('should accept br wrapped in independent span leaf', () => {
    const html = '<p>行一<span leaf=""><br></span>行二</p>'
    const report = lintHtml(html)
    expect(report.findings.find((x) => x.rule === 'bare-br')).toBeUndefined()
  })

  it('should count mixed forms correctly', () => {
    const html = '<p>a<span leaf=""><br></span>b<br>c</p>'
    const f = findRule(html, 'bare-br')
    expect(f?.count).toBe(1)
  })
})

describe('lintHtml: 占位符残留', () => {
  it('should detect PLACEHOLDER and 待编辑', () => {
    const f = findRule('<p>PLACEHOLDER-COVER.png</p><p>待编辑</p>', 'placeholder-residue')
    expect(f).toBeDefined()
    expect(f?.level).toBe('error')
    expect(f?.count).toBe(2)
  })
})

describe('lintHtml: 非 mmbiz 图片', () => {
  it('should warn on local paths and external urls', () => {
    const html = '<img src="配图/cover.png"><img src="https://example.com/a.png">'
    const f = findRule(html, 'non-mmbiz-image')
    expect(f).toBeDefined()
    expect(f?.level).toBe('warn')
    expect(f?.count).toBe(2)
  })

  it('should accept mmbiz and data urls', () => {
    const html = '<img src="https://mmbiz.qpic.cn/mmbiz_png/abc/0?wx_fmt=png"><img src="data:image/png;base64,xxx">'
    expect(findRule(html, 'non-mmbiz-image')).toBeUndefined()
  })
})

describe('lintHtml: script 标签', () => {
  it('should warn on script tags', () => {
    const f = findRule('<script>alert(1)</script>', 'script-tag')
    expect(f?.level).toBe('warn')
    expect(f?.count).toBe(1)
  })
})

describe('lintHtml: SVG begin 双事件', () => {
  it('should warn when begin has single event', () => {
    const html = '<svg><animate attributeName="x" begin="touchstart"/></svg>'
    const f = findRule(html, 'svg-begin-single-event')
    expect(f).toBeDefined()
    expect(f?.level).toBe('warn')
    expect(f?.count).toBe(1)
  })

  it('should accept dual event begin', () => {
    const html = '<svg><animate attributeName="x" begin="touchstart;click"/></svg>'
    expect(findRule(html, 'svg-begin-single-event')).toBeUndefined()
  })
})

describe('lintHtml: 正文字数上限', () => {
  it('should error at limit and warn near limit', () => {
    const atLimit = '字'.repeat(20_000)
    expect(findRule(`<p>${atLimit}</p>`, 'text-char-limit')?.level).toBe('error')

    const nearLimit = '字'.repeat(19_500)
    expect(findRule(`<p>${nearLimit}</p>`, 'text-char-limit')?.level).toBe('warn')

    expect(findRule('<p>短文</p>', 'text-char-limit')).toBeUndefined()
  })

  it('should count text chars after stripping tags, not HTML chars', () => {
    const html = `<p>${'字'.repeat(100)}</p>`.repeat(10) // 文本 1000 字，HTML 字符更多
    const report = lintHtml(html)
    expect(report.text_char_count).toBe(1000)
    expect(report.html_char_count).toBeGreaterThan(1000)
  })
})

describe('lintHtml: 整体 pass 判定', () => {
  it('should fail on any error finding', () => {
    expect(lintHtml('<ul><li>x</li></ul>').pass).toBe(false)
  })

  it('should pass with only warnings', () => {
    const html = '<img src="local.png">'
    const report = lintHtml(html)
    expect(report.pass).toBe(true)
    expect(report.findings.length).toBeGreaterThan(0)
  })
})
