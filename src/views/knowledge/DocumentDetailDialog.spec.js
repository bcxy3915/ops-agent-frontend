import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import DocumentDetailDialog from './DocumentDetailDialog.vue'

const Dialog = defineComponent({ template: '<section><slot name="header" /><slot /></section>' })
const document = {
  id: 1, title: '测试手册.md', docType: 'MARKDOWN', layer: 'PRIVATE', publishStatus: 'PUBLISHED',
  rawContent: '# 健康检查\n\n正常段落\n\n- 检查指标\n\n| 指标 | 状态 |\n| --- | --- |\n| CPU | 正常 |\n\n```http\nGET /health\n```\n\n<script>alert(1)</script>\n\n[危险链接](javascript:alert(1))',
  chunks: [{ id: 2, ordinal: 2, section: '不存在', content: '无法匹配的内容' }, { id: 1, ordinal: 1, section: '健康检查', content: '正常段落' }]
}

/**
 * 创建隔离网络与弹窗传送行为的详情组件。
 * @param {Object} overrides 需要覆盖的组件属性。
 * @returns {Object} Vue 测试包装器。
 */
function render(overrides = {}) {
  return mount(DocumentDetailDialog, {
    props: { modelValue: true, document, ...overrides },
    global: { stubs: { ElDialog: Dialog, ElAlert: { props: ['title'], template: '<div>{{ title }}</div>' }, ElButton: { template: '<button><slot /></button>' } } }
  })
}

describe('文档详情', () => {
  it('渲染标题、列表、表格和代码，并阻止原始 HTML 与危险链接', () => {
    const wrapper = render()
    expect(wrapper.find('article h1').text()).toBe('健康检查')
    expect(wrapper.find('article li').text()).toBe('检查指标')
    expect(wrapper.find('article table').exists()).toBe(true)
    expect(wrapper.find('article pre code').text()).toContain('GET /health')
    expect(wrapper.find('article script').exists()).toBe(false)
    expect(wrapper.find('article a[href^="javascript:"]').exists()).toBe(false)
  })

  it('切换源码、隐藏分块，重开或切换文档后重置显示状态', async () => {
    const wrapper = render()
    await wrapper.findAll('.detail-mode button')[1].trigger('click')
    expect(wrapper.find('.detail-source').text()).toContain('# 健康检查')
    await wrapper.find('.detail-toggle').trigger('click')
    expect(wrapper.find('.detail-chunks').exists()).toBe(false)
    await wrapper.setProps({ document: { ...document, id: 3 } })
    expect(wrapper.find('article').exists()).toBe(true)
    expect(wrapper.find('.detail-chunks').exists()).toBe(true)
    await wrapper.find('.detail-toggle').trigger('click')
    await wrapper.setProps({ modelValue: false })
    await wrapper.setProps({ modelValue: true })
    expect(wrapper.find('.detail-chunks').exists()).toBe(true)
  })

  it('按序展示分块，准确匹配时高亮，无法定位时给出明确提示', async () => {
    const wrapper = render()
    expect(wrapper.find('.chunk-order').text()).toBe('01')
    await wrapper.findAll('.detail-locate')[0].trigger('click')
    expect(wrapper.find('.detail-highlight').text()).toBe('正常段落')
    await wrapper.findAll('.detail-locate')[1].trigger('click')
    expect(wrapper.find('.detail-caption').text()).toContain('未找到可准确定位')
    expect(wrapper.find('.detail-highlight').exists()).toBe(false)
  })

  it('非 Markdown 按纯文本展示并支持空正文和空分块', async () => {
    const wrapper = render({ document: { id: 4, docType: 'TEXT', rawContent: '<h1>纯文本</h1>', chunks: [] } })
    expect(wrapper.find('.detail-source').text()).toBe('<h1>纯文本</h1>')
    expect(wrapper.find('article').exists()).toBe(false)
    expect(wrapper.text()).toContain('暂无分块')
    await wrapper.setProps({ document: { id: 5, chunks: [] } })
    expect(wrapper.text()).toContain('暂无正文内容')
  })

  it('跨段落分块在预览和源码均可定位，切换模式保留定位且不改写源码', async () => {
    const content = '## 处置\r\n\r\n**负责人**：运维\r\n\r\n- 检查 CPU\r\n\r\n```sh\r\ncurl /health\r\n```\r\n'
    const rawContent = '# 手册\r\n\r\n' + content + '\r\n## 后续\r\n'
    const wrapper = render({ document: { id: 6, docType: 'MARKDOWN', rawContent, chunks: [{ ordinal: 1, content }] } })
    await wrapper.find('.detail-locate').trigger('click')
    expect(wrapper.findAll('.detail-highlight').length).toBeGreaterThan(2)
    expect(wrapper.find('.detail-caption').text()).toContain('已定位原文')
    await wrapper.findAll('.detail-mode button')[1].trigger('click')
    expect(wrapper.find('article').exists()).toBe(false)
    expect(wrapper.find('mark').element.textContent).toBe(content)
    expect(wrapper.find('.detail-source').element.textContent).toBe(rawContent)
    await wrapper.find('.detail-locate').trigger('click')
    expect(wrapper.find('.detail-source').exists()).toBe(true)
    await wrapper.findAll('.detail-mode button')[0].trigger('click')
    expect(wrapper.findAll('.detail-highlight').length).toBeGreaterThan(2)
  })

  it('纯文本也支持分块滚动目标与字符高亮', async () => {
    const wrapper = render({ document: { id: 7, docType: 'TXT', rawContent: '起始\n正文内容\n结束', chunks: [{ ordinal: 1, content: '正文内容' }] } })
    await wrapper.find('.detail-locate').trigger('click')
    expect(wrapper.find('mark').text()).toBe('正文内容')
    expect(wrapper.find('.detail-caption').text()).toContain('已定位原文')
  })

  it('保留入库失败原因，只有允许操作的非内置文档提供重试', async () => {
    const failed = { ...document, publishStatus: 'FAILED', publishError: '向量服务暂不可用' }
    const wrapper = render({ document: failed, canRetry: true })
    expect(wrapper.text()).toContain('向量服务暂不可用')
    await wrapper.find('.detail-error button').trigger('click')
    expect(wrapper.emitted('retry')[0]).toEqual([failed])
    await wrapper.setProps({ canRetry: false })
    expect(wrapper.find('.detail-error button').exists()).toBe(false)
    await wrapper.setProps({ canRetry: true, document: { ...failed, layer: 'BUILTIN' } })
    expect(wrapper.find('.detail-error button').exists()).toBe(false)
  })
})
