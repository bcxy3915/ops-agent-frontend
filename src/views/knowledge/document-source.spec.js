import MarkdownIt from 'markdown-it'
import { findChunkRanges, installSourceMapping } from './document-source'

describe('分块源码位置映射', () => {
  it('匹配包含标题、强调、列表、表格和代码的完整分块', () => {
    const chunk = '## 检查\n\n**负责人**：运维\n\n- 检查 CPU\n\n| 指标 |\n| --- |\n| CPU |\n\n```sh\ncurl /health\n```'
    const source = '# 手册\n\n' + chunk + '\n\n## 后续章节'
    const [range] = findChunkRanges(source, [{ content: chunk }])
    expect(source.slice(range.start, range.end)).toBe(chunk)
  })

  it('重复文本按分块顺序匹配，同时允许相邻块重叠', () => {
    const source = '第一次\n重复段落\n中间\n重复段落\n结束'
    const ranges = findChunkRanges(source, [{ content: '重复段落\n中间' }, { content: '中间\n重复段落' }, { content: '重复段落' }])
    expect(ranges.map(range => range.start)).toEqual([4, 9, 12])
  })

  it('兼容 CRLF 和边界空白差异，并返回原始字符范围', () => {
    const source = '# 手册\r\n\r\n正文一\r\n正文二\r\n'
    const [range] = findChunkRanges(source, [{ content: '正文一\n正文二' }])
    expect(source.slice(range.start, range.end)).toBe('正文一\r\n正文二')
  })

  it('不使用相同章节标题掩盖正文不一致，空分块也不伪造位置', () => {
    expect(findChunkRanges('# 检查\n原文', [{ section: '检查', content: '错误内容' }, { content: ' ' }])).toEqual([null, null])
  })

  it('渲染块的源码范围保留 CRLF 长度，覆盖表格、围栏与缩进代码', () => {
    const markdown = new MarkdownIt({ html: false })
    installSourceMapping(markdown)
    const source = '# 标题\r\n\r\n段落 **强调**\r\n\r\n| A |\r\n| --- |\r\n| B |\r\n\r\n```sh\r\ncurl /health\r\n```\r\n\r\n    缩进代码\r\n'
    const root = document.createElement('div')
    root.innerHTML = markdown.render(source, { detailSource: source })
    const paragraph = root.querySelector('p')
    expect(source.slice(Number(paragraph.dataset.sourceStart), Number(paragraph.dataset.sourceEnd))).toContain('段落 **强调**')
    const table = root.querySelector('table')
    expect(source.slice(Number(table.dataset.sourceStart), Number(table.dataset.sourceEnd))).toContain('| B |')
    expect(root.querySelectorAll('div[data-source-start]')).toHaveLength(2)
  })
})
