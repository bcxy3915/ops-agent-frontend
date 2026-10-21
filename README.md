![Frontend CI](https://github.com/bcxy3915/ops-agent-frontend/actions/workflows/ci.yml/badge.svg)

# Ops Agent Frontend

> 面向运维场景的 AI 智能体前端 —— 用对话替代命令行，把「排查故障」变成「问一句话」。
> 集成 AI 诊断、告警闭环、知识库沉淀与可观测面板，一套界面串起从告警触发到经验沉淀的完整链路。

---

## ✨ 功能亮点

**对话工作台**

- 🤖 **AI 对话排障**：基于 SSE 流式输出，实时展示思考过程（ReasoningBlock）、工具调用（ToolCallCard）与最终回答
- 📚 **回答可溯源**：回答下方附带知识来源引用，混合检索结果可视化，点开即可查看原文片段
- 🔗 **告警上下文带入对话**：从告警详情一键跳转对话追问，URL 携带 `ref=alert:{id}`，对话顶部自动挂载告警上下文卡片（含「查看详情 / 退出上下文」）
- 💬 **会话管理**：会话按「今天 / 昨天 / 更早」分组，支持重命名、删除、查看全部历史

**管理控制台**（分组导航：监控运维 / 知识库 / 系统设置）

- 📊 **管理首页统计卡**：待处理告警、待沉淀案例、本月知识命中、知识文档总量，整卡可点直达对应页面
- 🚨 **告警中心**：告警事件列表 + 详情，完整状态机操作（确认 / 静默 / 恢复 / 认领 / 升级），支持批量确认与批量静默
- 🔔 **告警铃铛**：顶栏实时未读红点 + 摇动脉冲，点击弹出最近告警，支持「标记全部已读」（已读状态持久化）
- 🧭 **告警详情闭环**：AI 智能诊断（置信度、推断根因、证据、建议处置）+ 参考知识溯源 + 故障快照 + 通知记录 + 处置时间线 + 内嵌追问 AI
- 🛠 **服务与指标**：服务卡片管理、健康状态徽标、ECharts 指标趋势图
- 🗂 **知识库**：文档上传、案例沉淀（支持修正根因/处置）、检索测试，含概览 / 文档 / 案例 / 检索四个 Tab
- 🧱 **维护窗口**：按服务维度批量静默，维护期内新告警落库但不通知、不升级
- 👥 **值班管理**：主 / 备值班人配置，与告警升级联动（首报→主值班，L1→备值班，L2→ADMIN）
- 📋 **告警规则**：规则维护、节流配置、通知渠道绑定、多级升级策略
- 📮 **通知渠道**：邮件 / 飞书 / Webhook 渠道配置与测试
- 🔐 **审计日志 & 用户管理**：操作留痕，用户角色与启用状态管理

**工程能力**

- 🛡 **角色权限 RBAC**：ADMIN / OPERATOR / VIEWER 三级权限，路由守卫 + 菜单/按钮级动态渲染
- ✅ **单元测试**：Vitest + jsdom，覆盖 stores 与 utils，CI 自动跑测试与构建

---

## 🧱 技术栈

| 分类 | 技术 | 版本 |
| --- | --- | --- |
| 框架 | [Vue 3](https://vuejs.org/)（`<script setup>` SFC） | ^3.5 |
| 构建 | [Vite](https://vite.dev/) | ^8.3 |
| UI 组件库 | [Element Plus](https://element-plus.org/) + Icons | ^2.14 |
| 状态管理 | [Pinia](https://pinia.vuejs.org/) | ^4.0 |
| 路由 | [Vue Router](https://router.vuejs.org/) | ^4.6 |
| HTTP | [Axios](https://axios-http.com/) | ^1.20 |
| 图表 | [ECharts](https://echarts.apache.org/) | ^6.1 |
| Markdown 渲染 | [markdown-it](https://github.com/markdown-it/markdown-it) | ^15.0 |
| 测试 | [Vitest](https://vitest.dev/) + jsdom + @vue/test-utils | ^5.0 |
| 运行时 | Node.js | 22 LTS |

---

## 🖼 界面预览

> 截图占位，可在此补充实际界面图。

| 对话工作台 | 告警中心 |
| --- | --- |
| _（截图待补充）_ | _（截图待补充）_ |

| 告警详情 · AI 诊断 | 知识库 |
| --- | --- |
| _（截图待补充）_ | _（截图待补充）_ |

---

## 🚀 快速开始

### 环境要求

- Node.js ≥ 22
- 后端服务运行在 `http://localhost:8080`（Vite 已配置 `/api` 代理）

### 安装与启动

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173，自动打开浏览器）
npm run dev
```

开发服务器会将 `/api` 请求代理到后端 `http://localhost:8080`，无需额外配置跨域。

### 构建

```bash
# 生产构建（产物输出到 dist/）
npm run build

# 本地预览构建产物
npm run preview
```

---

## 📜 脚本命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务器（Vite，端口 5173，自动打开浏览器） |
| `npm run build` | 生产环境构建 |
| `npm run preview` | 预览生产构建产物 |
| `npm run test` | 运行单元测试（Vitest，单次执行） |
| `npm run test:watch` | 监听模式运行单元测试 |
| `npm run test:coverage` | 运行测试并生成覆盖率报告（v8，输出到 `coverage/`） |

---

## 📁 项目结构

```text
ops-agent-frontend/
├── .github/workflows/ci.yml     # CI：安装依赖 → 单元测试 → 构建
├── public/                      # 静态资源
├── src/
│   ├── api/                     # 后端接口封装（按域拆分）
│   │   ├── request.js           # Axios 实例：baseURL=/api、token 注入、401 处理
│   │   ├── auth.js  chat.js     # 认证 / 对话（SSE）
│   │   ├── alerts.js  diagnosis.js  snapshot.js  notifications.js
│   │   ├── knowledge.js  maintenance.js  oncall.js
│   │   └── service.js  metrics.js  audit.js  user.js
│   ├── components/
│   │   ├── layout/              # AppLayout（对话壳）/ AdminLayout（后台壳）/ Sidebar
│   │   ├── common/AlertBell.vue # 顶栏告警铃铛（未读红点 / popover / 标记已读）
│   │   ├── chat/                # ChatInput / ChatMessage / ToolCallCard / ReasoningBlock
│   │   ├── service/             # ServiceCard / ServiceFormDialog / StatusBadge
│   │   ├── metrics/             # LineChart / MetricCard
│   │   ├── auth/                # LoginDialog / LoginForm
│   │   └── user/UserFormDialog.vue
│   ├── views/
│   │   ├── Chat.vue             # 对话工作台（含告警上下文卡片）
│   │   ├── HistoryChat.vue      # 历史会话
│   │   ├── Login.vue  ServiceManage.vue  Metrics.vue
│   │   ├── AuditLog.vue  UserManage.vue
│   │   ├── admin/
│   │   │   ├── AdminHome.vue    # 管理首页（统计卡）
│   │   │   ├── alerts/          # AlertEvents / AlertDetail / AlertRules / NotificationChannels
│   │   │   └── oncall/OncallManage.vue
│   │   └── knowledge/           # Knowledge + Overview / Documents / Cases / Retrieval Tab
│   ├── stores/                  # Pinia：auth / chat / alert（含单元测试）
│   ├── utils/                   # conversation 分组等工具（含单元测试）
│   ├── router/index.js          # 路由 + 登录态/角色守卫
│   ├── App.vue  main.js  style.css
├── vite.config.js               # 别名 @、开发代理、Vitest 配置
└── package.json
```

---

## 🧭 路由一览

| 路径 | 页面 | 权限 |
| --- | --- | --- |
| `/chat` | 对话工作台 | 公开（游客可问答） |
| `/chat/history` | 历史对话 | 登录 |
| `/admin/home` | 管理首页 | 登录 |
| `/admin/services` `/admin/metrics` | 服务管理 / 指标监控 | 登录 |
| `/admin/alerts` `/admin/alerts/:id` | 告警中心 / 告警详情 | 登录 |
| `/admin/knowledge` | 知识库 | 登录 |
| `/admin/oncall` `/admin/alert-rules` | 值班管理 / 告警规则 | ADMIN、OPERATOR |
| `/admin/channels` `/admin/audit` `/admin/users` | 通知渠道 / 审计日志 / 用户管理 | ADMIN |

> 旧的顶层路径（`/services`、`/metrics` 等）已重定向到 `/admin/*`，保证旧链接可用。

---

## 🤝 贡献

1. Fork 本仓库并新建特性分支：`git checkout -b feature/your-feature`
2. 提交前请确保本地通过：

   ```bash
   npm run test
   npm run build
   ```

3. 提交 PR 到 `main` 分支，CI 会自动执行测试与构建校验。

---

## 📄 License

本项目为运维智能体平台的前端部分，暂未指定开源许可证。
