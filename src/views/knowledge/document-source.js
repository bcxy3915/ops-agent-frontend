/**
 * 建立忽略空白后的文本与原始字符位置映射，兼容 CRLF、LF 和切分边界空白。
 * @param {string} text 原始文本。
 * @returns {{text: string, offsets: number[]}} 归一文本及字符在原文中的位置。
 */
function normalizeWithOffsets(text) {
  const characters = []
  const offsets = []
  for (let index = 0; index < text.length; index++) {
    if (!/\s/.test(text[index])) {
      characters.push(text[index])
      offsets.push(index)
    }
  }
  return { text: characters.join(''), offsets }
}

/**
 * 按分块顺序匹配原文范围；只允许空白差异，不以章节标题代替正文匹配。
 * @param {string} source 文档源码或已保存正文。
 * @param {Object[]} chunks 已按序号排序的分块。
 * @returns {Array<{start: number, end: number}|null>} 每个分块的原文字符范围，无法匹配时为 null。
 */
export function findChunkRanges(source, chunks) {
  let cursor = 0
  let normalized
  return chunks.map(chunk => {
    const content = chunk.content || ''
    if (!content.trim()) return null
    let start = source.indexOf(content, cursor)
    let end = start + content.length
    if (start < 0) {
      normalized ??= normalizeWithOffsets(source)
      const needle = normalizeWithOffsets(content).text
      const normalizedCursor = normalized.offsets.findIndex(offset => offset >= cursor)
      const match = normalizedCursor < 0 ? -1 : normalized.text.indexOf(needle, normalizedCursor)
      if (match < 0) return null
      start = normalized.offsets[match]
      end = normalized.offsets[match + needle.length - 1] + 1
    }
    // 从起点后继续搜索，既区分重复段落，又允许相邻分块存在重叠。
    cursor = start + 1
    return { start, end }
  })
}

/**
 * 为 Markdown 顶层渲染块添加源码范围，保证跨段落、表格及代码块均可定位。
 * @param {Object} markdown 当前详情专用的 MarkdownIt 实例。
 * @returns {void} 原地注册位置映射规则，无返回数据。
 */
export function installSourceMapping(markdown) {
  markdown.core.ruler.after('block', 'detail_source_positions', state => {
    const source = state.env.detailSource ?? state.src
    const starts = [0]
    for (const match of source.matchAll(/\r\n|\r|\n/g)) starts.push(match.index + match[0].length)
    for (const token of state.tokens) {
      if (token.level !== 0 || !token.map || token.nesting === -1) continue
      token.attrSet('data-source-start', String(starts[token.map[0]] ?? source.length))
      token.attrSet('data-source-end', String(starts[token.map[1]] ?? source.length))
    }
  })
  for (const name of ['fence', 'code_block']) {
    const original = markdown.renderer.rules[name]
    markdown.renderer.rules[name] = (tokens, index, options, env, renderer) => {
      const token = tokens[index]
      const html = original(tokens, index, options, env, renderer)
      const start = token.attrGet('data-source-start')
      const end = token.attrGet('data-source-end')
      return start === null ? html : `<div data-source-start="${start}" data-source-end="${end}">${html}</div>`
    }
  }
}
