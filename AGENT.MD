# Ops Agent 前端项目协作指南

本文为在 `ops-agent-frontend` 中工作的 AI 编程助手与开发者提供上下文、开发约定和验证要求。适用范围为当前前端项目目录；后端约定见同级仓库 `ops-ai-agent/AGENT.MD`。

## 1. 项目概览

Ops Agent 前端是面向运维场景的单页应用，提供 AI 对话（SSE 流式）、对话历史、服务与指标、告警与规则、值班、知识库（上传 / 审核 / 案例 / 检索）、通知渠道、审计与 RBAC 管理。

- 框架：Vue 3（`<script setup>` 组合式 API）、Vue Router 4、Pinia 4。
- 构建：Vite 8，Node 22 LTS。
- UI：Element Plus 2.14 + `@element-plus/icons-vue`（`main.js` 中全局注册全部图标）。
- 网络：Axios 1.20（统一封装在 `src/api/request.js`）。
- 图表与渲染：ECharts 6、markdown-it 15。
- 测试：Vitest 5 + jsdom + `@vue/test-utils`。

版本以 `package.json` / `package-lock.json` 为准，README 中的说明可能滞后。修改前先阅读当前实现与相关测试。

## 2. 目录导航

```
src/
├── api/            # 按后端业务域拆分的接口封装（chat / knowledge / service / alerts ...）
├── components/     # 可复用组件：layout、chat、service、metrics、auth、user、common
├── router/         # 路由表与全局守卫
├── stores/         # Pinia setup store：auth、chat、alert
├── styles/         # 业务样式（knowledge.css）
├── utils/          # 纯函数工具（conversation 分组与时间格式化）
├── views/          # 页面：Chat、HistoryChat、Login、ServiceManage、Metrics、AuditLog、
│                   # UserManage、knowledge/、admin/、rbac/
├── App.vue
├── main.js         # 注册 Element Plus、图标、Pinia、Router
└── style.css       # 全局 CSS 变量、滚动条、布局基础样式
```

其他重要路径：

- `vite.config.js`：`@` → `src` 别名、开发端口 5173、`/api` 代理、Vitest 配置。
- `jsconfig.json`：编辑器路径提示（`@/*` → `src/*`）。
- `.github/workflows/ci.yml`：Node 22 下 `npm ci` → `npm run test` → `npm run build`，并上传覆盖率产物。
- `.gitignore`：忽略 `node_modules`、`dist`、`*.local`、`logs`、`docs/`、`coverage/`。

## 3. 工作方式

1. 先定位涉及的页面、组件、store、API 封装和后端接口契约，再修改代码。
2. 开始前检查 `git status --short`，保留用户已有修改和未跟踪文件。
3. 尽量沿用现有组件与样式，控制改动范围；不顺带重构无关页面或升级依赖。
4. 需求明确时直接推进；涉及接口契约、权限语义或数据结构的关键信息缺失时再确认。
5. 跨层修改（页面 / 组件 / store / api）同步检查调用方、权限判断、加载与错误态、空态及相关测试。
6. 默认使用中文说明工作结果；代码标识符、注释风格保持项目现有习惯（接口函数用英文命名，注释用中文）。
7. 完成时说明修改内容、验证结果和仍存在的限制；未执行的检查须明确标注。

## 4. 编码与接口约定

- 使用 Vue 3 `<script setup>` + Composition API；props / emits 显式声明，避免隐式全局状态。
- 缩进与现有文件保持一致（JS/Vue 多用 2 空格）；文件 UTF-8 编码，避免中文乱码。
- Pinia 使用 setup store 写法（`defineStore('x', () => { ... return {...} })`），状态用 `ref`，派生值用 `computed`。
- 新增接口统一放到 `src/api/` 对应业务域文件，函数签名保持 `export async function xxx(params) { return request.get(...) }`。
- 所有请求必须走 `src/api/request.js`，禁止在组件里直接 `axios` 或硬编码后端域名/端口。
- 响应约定：后端统一返回 `{ code, message, data }`；拦截器在 `code === 0` 时直接返回 `data`，否则 `ElMessage.error` 并 reject。页面拿到的就是业务数据，不要再判断 `code`。
- 错误处理：`401` 清理本地登录态并跳转登录；`403/429/500` 已有统一提示，页面只需在需要时补充业务文案，不要重复弹同一条错误。
- 新接口封装前先确认后端路径、方法、参数与返回结构，保持与后端 Controller 一致。
- 表单校验优先使用 Element Plus 的 `rules`；提交前做前端必填校验，但不得替代后端校验。
- 组件命名 PascalCase，页面放在 `views/`，可复用组件放在 `components/` 对应域下；`utils/` 只放无副作用的纯函数。
- 样式优先复用 `src/style.css` 中的 CSS 变量（`--primary` / `--success` / `--warning` / `--danger` / `--border` / `--card-bg` 等）与既有 class，避免散落硬编码颜色。
- 知识库相关样式集中在 `src/styles/knowledge.css`，枚举 tag 样式类（`kb-tag-*`）与其映射表配套使用。

## 5. 认证、权限与路由

- 登录态与权限持久化在 localStorage，key 统一由 `stores/auth.js` 的 `KEYS` 管理：`ops_token`、`ops_username`、`ops_role`、`ops_user_id`、`ops_tenant_id`、`ops_dept_id`、`ops_roles`、`ops_permissions`、`ops_need_bind_email`。新增字段必须同步 `persist`、`clearAuthStorage` 与恢复逻辑。
- 请求头由 `request.js` 自动带 `Authorization: Bearer <ops_token>`；不要在其他地方手动拼接 token，也不要把 token 写入日志或 URL。
- 路由 `meta` 约定：`requiresAuth`（需登录）、`permission`（所需权限码）、`platformOnly`（仅平台管理员）。守卫按顺序校验登录、`ensureProfile()`、权限（不足跳 `/admin/home`）、`platformOnly` 与角色。
- 页面内细粒度权限统一用 `auth.hasPermission()` / `hasAnyPermission()` / `hasRole()`，不要自行解析 localStorage。
- 新增路由必须同时补齐 `meta` 权限与 `AdminLayout` 的 `navGroups` 可见项，避免出现可直达但导航不可见的页面。
- `ensureProfile()` 用于刷新用户资料与权限；涉及权限变化的操作（如角色调整）后应触发刷新，避免前端权限与后端不一致。
- 退出登录统一走 `auth.logout()`，不要只清 token。

## 6. 对话与 SSE 约定

- 流式接口使用 `fetch` + `ReadableStream`（`src/api/chat.js` 的 `askStream`），**不使用 `EventSource`**，因为需要携带 Bearer 头与手动解析 SSE。
- 事件顺序：先 `event: citations`（引用来源 JSON），随后 token 数据块，最后 `[DONE]` 触发 `onDone`；异常走 `onError`。
- `askStream(sessionId, question, { onChunk, onDone, onError, onCitations })` 返回 `{ close() }`，页面卸载或用户停止时调用 `close()`。
- 会话 id 存于 localStorage `ops_current_session`，由 `stores/chat.js` 的 `ensureSessionId` / `generateSessionId` 管理；切换或新建会话时同步更新。
- 首次进入 `/chat`（`Chat.vue` 挂载且消息为空）时调用 `chatStore.restoreLatestConversation()`：优先恢复 localStorage 中的会话（须仍在历史列表），否则加载最近一条会话（后端按 `lastActiveAt` 倒序）；没有历史则保持欢迎页。带告警上下文 `?q=` 进入时优先自动提问，不恢复历史。已有消息时该方法直接返回，不得覆盖进行中的对话。
- 消息结构（`id/role/content/answer/reasoning/tools/citations`）以 `chat.js` 映射结果为准；历史消息从 `/chat/sessions/{id}/messages` 拉取，不要在前端自行拼接后端未返回的字段。
- 发送消息时先本地插入用户消息与研究中的助手占位，再通过回调增量更新；结束或失败必须把 `streaming` 复位，避免输入框永久禁用。
- 会话标题、删除、全部会话等操作走 `/chat/sessions` 系列接口；分组与时间展示复用 `src/utils/conversation.js`，不要各页面重复实现。
- 后端聊天记忆以数据库为唯一事实来源，前端不得依赖"上一次请求在同一实例"的假设；会话切换后应按 sessionId 重新拉取历史。

## 7. 知识库状态机与轮询约定

- 审核结论与索引可用性是两条独立状态，前端必须分开展示：
  - `reviewStatus`：审核结论（DRAFT / PENDING_DEPT / PENDING_TENANT / APPROVED / REJECTED）。
  - `publishStatus`：索引状态（UNPUBLISHED / BUILDING / FAILED / PUBLISHED）。
- 枚举文案与 tag 样式只在 `src/views/knowledge/kb-utils.js` 维护（`STATUS_MAP`、`PUBLISH_STATUS_MAP`、`publishLabel`、`publishCls` 等）；新增状态时同步后端枚举与该文件，不在页面内散写字符串映射。
- 审核通过后 `reviewStatus` 立即变为已通过，但 `publishStatus` 可能仍为 `BUILDING` 或 `FAILED`；列表必须展示索引状态，详情展示入库时间与 `publishError`。
- `FAILED` 时提供「重试入库」入口，调用 `POST /knowledge/documents/{id}/reindex`，提示用户"审核结论保持不变"。
- 存在 `BUILDING` 行时按 4s（`POLL_INTERVAL = 4000`）轮询 `GET /knowledge/documents/{id}/index-status`；只在当前页 BUILDING 行与打开详情中处于 BUILDING 的文档上轮询，全部落定后自动停止，组件 `onBeforeUnmount` 必须 `stopPolling()`。
- 轮询期间只有状态真正变化才更新行；`FAILED` 出现时提示失败原因（`publishError`）并引导重试，不要静默吞掉失败。
- 上传 / 在线沉淀 / 案例确认成功后，文案应说明"已提交后台入库"，不要承诺索引已立即可检索。
- 上传抽屉选择「直接发布」时必须调用 `POST /knowledge/documents/{id}/publish-direct`（`publishDirectKnowledgeDocument`），不得调用旧 `/publish`：后者只接受待审核文档，对上传后的草稿会返回"当前文档不处于待审核状态"。直接发布成功后文档应为 `APPROVED + BUILDING`，列表中不应再出现「提交审核」按钮；失败时文档保留草稿并提示具体原因。
- 不要在前端用轮询结果改写 `trustStatus` 或审核结论；索引失败不得表现为审核失败。
- `publishStatus === 'BUILDING'` 的文档为只读：`DocumentsTab` 的操作列只保留查看 / 检索命中 / 更新日志，隐藏提交审核、通过/驳回、重试入库、编辑、删除；版本弹窗中的「回滚」也需隐藏，`openEdit` 需二次拦截。后端会以 `KNOWLEDGE_DOCUMENT_INVALID` 拒绝这些写操作，前端隐藏只是体验层，不能替代后端校验。
- `layer === 'BUILTIN'` 的官方内置知识同样只读：操作列只保留查看 / 检索命中 / 更新日志，隐藏提交审核、重试入库、编辑、删除；后端以 `KNOWLEDGE_OPERATION_FORBIDDEN` 拒绝写入。内置文档由后端 `DocumentLoader` 从 `classpath:knowledge/` 同步，前端不提供任何维护入口。

## 8. 常用命令

以下命令在项目根目录执行（Windows PowerShell）：

```powershell
# 安装依赖（CI 使用 npm ci）
npm install

# 启动开发服务器（默认 http://localhost:5173，/api 代理到 http://localhost:8080）
npm run dev

# 生产构建
npm run build

# 预览构建产物
npm run preview

# 单元测试（单次）
npm run test

# 单元测试（监听）
npm run test:watch

# 覆盖率（v8，产物在 coverage/）
npm run test:coverage
```

启动前端前需先启动后端（默认 8080），或按需调整 `vite.config.js` 的代理目标。不要为了通过构建或测试而关闭路由守卫、权限判断或类型/规范检查。

## 9. 测试与交付

- 测试文件与被测代码同目录，命名 `*.spec.js`（如 `src/stores/auth.spec.js`、`src/stores/chat.spec.js`、`src/utils/conversation.spec.js`）；Vitest 的 include 为 `src/**/*.{test,spec}.{js,ts}`。
- 测试环境为 `jsdom`，全局开启 `globals`；`@` 别名在测试中同样可用。
- store 测试使用 `setActivePinia(createPinia())`，并在 `beforeEach` 中 `localStorage.clear()` 与 `vi.clearAllMocks()`，避免用例之间串状态。
- 外部接口一律用 `vi.mock('@/api/xxx')` 模拟，禁止测试发起真实网络请求；SSE、定时器和轮询相关逻辑应避免依赖真实时间，必要时用假定时器。
- 修复缺陷时优先补充能复现问题的回归测试；新增工具函数与 store 逻辑至少覆盖正常路径、边界与失败路径。
- 覆盖率配置只采集 `src/utils/**` 与 `src/stores/**`（`vite.config.js`），不要把页面组件纳入覆盖率门槛。
- 提交前至少执行 `npm run build` 与 `npm run test`；涉及公共封装或路由守卫时两者都必须通过。
- 交付前检查差异，避免提交 `dist/`、`coverage/`、本地配置或与任务无关的文件；不自动提交、推送或发布，除非用户明确要求。
- 纯文案或样式调整至少确认构建通过；无法执行的验证须在交付说明中标注。

## 10. 文档维护

项目结构、常用命令、接口约定、权限或知识库状态机规则变化时，同步更新本文。涉及依赖版本、接口路径与代理配置的描述，应以仓库当前文件为依据，避免复制过时说明。后端契约变化时同时检查 `ops-ai-agent/AGENT.MD` 是否需要同步。
