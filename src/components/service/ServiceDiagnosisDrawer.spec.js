import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { diagnoseService, listServiceTasks, getAgentTask } from '@/api/agent-tasks'
import ServiceDiagnosisDrawer from './ServiceDiagnosisDrawer.vue'
import ServiceDiagnosisReport from './ServiceDiagnosisReport.vue'
import ServiceCard from './ServiceCard.vue'

vi.mock('@/api/agent-tasks', () => ({ diagnoseService: vi.fn(), listServiceTasks: vi.fn(), getAgentTask: vi.fn() }))
const Drawer = defineComponent({ props: ['modelValue'], template: '<section v-if="modelValue"><slot name="header"/><slot/><slot name="footer"/></section>' })
const Button = defineComponent({ props: ['disabled', 'loading'], template: '<button :disabled="disabled"><slot/></button>' })
const stubs = {
  ElDrawer: Drawer, ElButton: Button, ElTag: { template: '<span><slot/></span>' },
  ElIcon: { template: '<span><slot/></span>' },
  ElAlert: { props: ['title', 'description'], template: '<div>{{ title }} {{ description }}</div>' },
  ElCheckbox: { props: ['modelValue'], emits: ['update:modelValue'], template: '<label><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)"/><slot/></label>' },
  ElDropdown: { template: '<div><slot/><slot name="dropdown"/></div>' },
  ElDropdownMenu: { template: '<div><slot/></div>' }, ElDropdownItem: { template: '<span><slot/></span>' }, StatusBadge: true,
}
const target = { id: 'svc-todo', name: 'todo-service', env: 'test', owner: '测试运维' }
const completed = { id: 'task-1', serviceId: 'svc-todo', taskType: 'DIAGNOSIS', status: 'SUCCEEDED', outcome: 'ABNORMAL', evidence: [{ evidenceType: 'DIAGNOSIS_REPORT', diagnosisReport: {
  summary: '观察到连接池等待，尚未证实根因', limitations: '缺少数据库证据', reason: 'AGENT_FINISHED', evidenceIds: ['e0', 'e1'],
  steps: [{ number: 2, action: 'LOGS', argument: 'test-log', evidenceId: 'e1', status: 'SUCCEEDED' }],
  evidence: [{ id: 'e0', type: 'INSPECTION_REPORT', data: { status: 'ABNORMAL' } }, { id: 'e1', type: 'LOGS', data: { status: 'PARTIAL', text: '<script>示例不应执行</script>' } }],
} }] }

/**
 * 创建延迟返回，验证重复提交与晚到响应。
 * 无入参。
 * @returns {object} Promise 及其完成回调
 */
function deferred() { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }

/**
 * 使用隔离网络与 UI 传送层的组件夹具。
 * @param {object} props 属性覆盖
 * @returns {object} 测试包装器
 */
function render(props = {}) { return mount(ServiceDiagnosisDrawer, { props: { modelValue: true, service: target, ...props }, global: { stubs } }) }

/**
 * 根据可见文案取得操作按钮。
 * @param {object} wrapper 测试包装器
 * @param {string} text 完整按钮文案
 * @returns {object|undefined} 匹配的按钮
 */
function button(wrapper, text) { return wrapper.findAll('button').find(b => b.text() === text) }

beforeEach(() => {
  localStorage.clear(); setActivePinia(createPinia()); vi.resetAllMocks()
  const auth = useAuthStore(); auth.permissions = ['service:read', 'diagnosis:read', 'diagnosis:trigger']
  listServiceTasks.mockResolvedValue([])
})

describe('服务自主诊断', () => {
  it('打开只查询历史，点击开始仅提交一次，返回后展示真实报告及证据局限', async () => {
    const pending = deferred(); diagnoseService.mockReturnValue(pending.promise)
    const wrapper = render(); await flushPromises()
    expect(diagnoseService).not.toHaveBeenCalled()
    const start = button(wrapper, '开始诊断'); await start.trigger('click'); await start.trigger('click')
    expect(diagnoseService).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('正在诊断 todo-service')
    expect(wrapper.text()).not.toContain('观察到连接池等待')
    pending.resolve(completed); await flushPromises()
    expect(wrapper.text()).toContain('执行完成'); expect(wrapper.text()).toContain('发现异常')
    expect(wrapper.text()).toContain('缺少数据库证据')
    expect(wrapper.text()).toContain('证据不完整或不可用')
    wrapper.unmount()
  })

  it('引用展开当前报告的证据，日志文本安全转义', async () => {
    const wrapper = mount(ServiceDiagnosisReport, { props: { task: completed }, global: { stubs } })
    await button(wrapper, 'e1').trigger('click')
    expect(wrapper.findAll('details')[1].element.open).toBe(true)
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.text()).toContain('<script>示例不应执行</script>')
    wrapper.unmount()
  })

  it('切换目标使旧创建请求失效，不把旧服务报告显示到新服务', async () => {
    const pending = deferred(); diagnoseService.mockReturnValue(pending.promise)
    const wrapper = render(); await button(wrapper, '开始诊断').trigger('click')
    await wrapper.setProps({ service: { ...target, id: 'svc-other', name: '另一个服务' } })
    pending.resolve(completed); await flushPromises()
    expect(wrapper.text()).not.toContain('观察到连接池等待'); expect(wrapper.text()).toContain('另一个服务')
    wrapper.unmount()
  })

  it('切换租户关闭抽屉并拒绝旧详情回写', async () => {
    listServiceTasks.mockResolvedValue([{ id: 'task-1', status: 'SUCCEEDED' }])
    const pending = deferred(); getAgentTask.mockReturnValue(pending.promise)
    const wrapper = render(); await flushPromises(); await wrapper.find('.history-row').trigger('click')
    useAuthStore().tenantId = 'another-tenant'; await nextTick()
    pending.resolve(completed); await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toContainEqual([false])
    expect(wrapper.text()).not.toContain('观察到连接池等待')
    wrapper.unmount()
  })

  it('仅查询权限可回看但不能发起，不依赖服务修改权限', async () => {
    useAuthStore().permissions = ['service:read', 'diagnosis:read']
    listServiceTasks.mockResolvedValue([{ id: 'task-1', status: 'SUCCEEDED' }]); getAgentTask.mockResolvedValue(completed)
    const wrapper = render(); await flushPromises(); await wrapper.find('.history-row').trigger('click'); await flushPromises()
    expect(button(wrapper, '开始诊断')).toBeUndefined(); expect(button(wrapper, '返回发起页')).toBeUndefined()
    expect(wrapper.text()).toContain('观察到连接池等待'); expect(diagnoseService).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('仅触发权限不查询历史，仍展示创建接口返回的当次报告', async () => {
    useAuthStore().permissions = ['service:read', 'diagnosis:trigger']
    diagnoseService.mockResolvedValue(completed)
    const wrapper = render(); await button(wrapper, '开始诊断').trigger('click'); await flushPromises()
    expect(listServiceTasks).not.toHaveBeenCalled(); expect(wrapper.text()).toContain('观察到连接池等待')
    wrapper.unmount()
  })

  it('超时不自动重发，关闭再打开保留结果待核实提醒', async () => {
    diagnoseService.mockRejectedValue(new Error('timeout'))
    const wrapper = render(); await button(wrapper, '开始诊断').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('暂未获取到诊断结果'); expect(diagnoseService).toHaveBeenCalledTimes(1)
    expect(button(wrapper, '返回发起页').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ modelValue: false }); await wrapper.setProps({ modelValue: true }); await flushPromises()
    expect(wrapper.text()).toContain('结果待确认'); expect(button(wrapper, '开始诊断').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('429 拒绝不标成后台运行，不自动重试创建', async () => {
    diagnoseService.mockRejectedValue(Object.assign(new Error('请求频繁'), { response: { status: 429 } }))
    const wrapper = render(); await button(wrapper, '开始诊断').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('诊断请求未完成'); expect(wrapper.text()).not.toContain('该服务有一次结果待确认')
    expect(diagnoseService).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('列表失败显示错误而不是暂无任务，详情目标不匹配不展示报告', async () => {
    listServiceTasks.mockRejectedValue(new Error('查询失败'))
    const wrapper = render(); await flushPromises(); expect(wrapper.text()).toContain('任务列表加载失败')
    expect(wrapper.text()).not.toContain('暂无任务记录')
    listServiceTasks.mockResolvedValue([{ id: 'task-2', status: 'SUCCEEDED' }]); await button(wrapper, '刷新任务').trigger('click'); await flushPromises()
    getAgentTask.mockResolvedValue({ ...completed, serviceId: 'other-service' })
    await wrapper.find('.history-row').trigger('click'); await flushPromises()
    expect(wrapper.text()).toContain('任务不属于当前服务'); expect(wrapper.text()).not.toContain('观察到连接池等待')
    wrapper.unmount()
  })

  it('运行中任务、失败记录和规则巡检不伪造完整诊断报告', async () => {
    const wrapper = mount(ServiceDiagnosisReport, { props: { task: { ...completed, status: 'RUNNING', evidence: [] } }, global: { stubs } })
    expect(wrapper.text()).toContain('完整步骤和报告尚未生成')
    await wrapper.setProps({ task: { ...completed, status: 'FAILED', errorCode: 'TEST_FAILED', evidence: [] } })
    expect(wrapper.text()).toContain('TEST_FAILED'); expect(wrapper.text()).not.toContain('观察到连接池等待')
    await wrapper.setProps({ task: { ...completed, taskType: 'INSPECTION', evidence: [] } })
    expect(wrapper.text()).toContain('本条为规则巡检记录')
    wrapper.unmount()
  })

  it('服务卡片保留管理菜单，诊断入口只按独立权限增加', async () => {
    const wrapper = mount(ServiceCard, { props: { service: target }, global: { stubs } })
    expect(button(wrapper, '自主诊断')).toBeDefined(); expect(wrapper.text()).not.toContain('触发健康检查')
    await button(wrapper, '自主诊断').trigger('click'); expect(wrapper.emitted('diagnose')[0]).toEqual([target])
    useAuthStore().permissions = ['service:read', 'service:manage']; await nextTick()
    expect(button(wrapper, '自主诊断')).toBeUndefined(); expect(wrapper.text()).toContain('触发健康检查'); expect(wrapper.text()).toContain('编辑')
    wrapper.unmount()
  })
})
