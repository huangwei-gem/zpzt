# AI Interview - 智能招聘管理系统

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-646CFF.svg)
![Backend](https://img.shields.io/badge/backend-Cloudflare%20Workers-F38020.svg)
![Database](https://img.shields.io/badge/database-Cloudflare%20D1- F38020.svg)
![AI](https://img.shields.io/badge/AI-Workers%20AI-7C3AED.svg)

线上地址: https://ai-interview-22u.pages.dev

AI Interview 是一个面向招聘团队的全链路智能招聘管理系统。系统以 Cloudflare Pages + Workers + D1 为基础设施，集成了简历 AI 解析、岗位匹配评分、简历初筛自动化、AI 面试助手、在线笔试、Offer 管理、招聘漏斗和可视化工作流等能力，并深度融合了「小七」简历初筛自动化引擎。

---

## 目录

- [技术栈](#技术栈)
- [功能模块总览](#功能模块总览)
- [小七简历初筛集成](#小七简历初筛集成)
- [快速开始](#快速开始)
- [构建与部署](#构建与部署)
- [API 接口](#api-接口)
- [数据库结构](#数据库结构)
- [使用指南](#使用指南)
- [项目结构](#项目结构)
- [配置说明](#配置说明)

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19、Vite、TypeScript、Ant Design、React Router、Recharts、React Flow |
| 后端 | Cloudflare Workers (Hono 框架)、TypeScript |
| 数据库 | Cloudflare D1 (SQLite 兼容) |
| AI 引擎 | Cloudflare Workers AI (Llama 3.3 70B / Llama 3.1 8B) |
| 部署 | Cloudflare Pages (前端 + Worker 统一部署) |
| 认证 | JWT (Bearer Token) |

---

## 功能模块总览

左侧菜单栏包含以下模块，每个模块都已填充测试数据，可直接登录体验：

| 菜单 | 路由 | 说明 |
| --- | --- | --- |
| 仪表盘 | `/dashboard` | 招聘漏斗、岗位分析、面试官分析、时间线趋势 |
| 需求管理 | `/requisitions` | 招聘需求创建、审批、状态流转 |
| 岗位管理 | `/positions` | 岗位创建、公开发布、JD AI 生成、岗位统计 |
| 渠道管理 | `/channels` | 招聘渠道维护、渠道效果分析 |
| 简历管理 | `/resumes` | 简历上传、PDF 预览、AI 解析、匹配评分、转岗重评 |
| 人才库 | `/talent-pool` | 入库候选人管理、标签、状态跟踪 |
| 面试管理 | `/interviews` | 多轮面试、面试小组、AI 题目生成、评分、综合分析 |
| 笔试管理 | `/coding-tests` | 算法题、选择题、问答题、AI 评价 |
| 背调管理 | `/background-checks` | 背景调查记录与状态 |
| Offer 管理 | `/offers` | Offer 发送、接受/拒绝确认、状态流转 |
| Offer 模板 | `/offers/templates` | Offer 模板维护、AI 生成内容 |
| 入职管理 | `/onboarding` | 入职记录、入职状态跟踪 |
| 试用期管理 | `/probation` | 试用期跟踪、转正评估 |
| 简历初筛 | `/resume-screening` | 小七引擎 - AI 简历初筛、卡片审核、入库/淘汰 |
| 招聘日报 | `/daily-reports` | AI 生成日报/周报、面试统计、数据汇总 |
| 题库管理 | `/question-banks` | 题库上传、分类管理 |
| 工作流 | `/workflows` | React Flow 可视化编排，LLM/条件/邮件/HTTP 节点 |
| 岗位映射 | `/settings/position-mappings` | 小七引擎 - 飞书岗位名到标准岗位名映射 |
| 能力维度 | `/settings/capability-dimensions` | 小七引擎 - 各岗位能力维度要求配置 |

---

## 小七简历初筛集成

「小七」原本是一个基于飞书的简历初筛自动化系统，通过 163 邮箱扫描、AI 分析、飞书卡片审核和 Base 入库完成招聘初筛流程。本次集成将其核心能力迁移到 Web 平台，用 D1 数据库替代飞书 Base，用 Web UI 替代飞书卡片，用 Workers AI 替代原有 LLM 调用。

### 完整链路

```
简历上传 / 邮件导入
    |
    v
小七 AI 分析引擎
  - 读取简历文本
  - 岗位名映射 (position_mappings)
  - 获取能力维度 (capability_dimensions)
  - 获取岗位 JD (job_requisitions)
  - Workers AI 生成分析报告
    |
    v
简历初筛页面 (卡片审核)
  - 匹配分数 0-5
  - 优势分析
  - 风险点
  - 能力维度逐项评分
  - 建议面试问题
    |
    v
人工审核
  |          |
  v          v
入库        淘汰
  |          |
  v          v
人才库     归档
  |
  v
招聘任务匹配 (recruitment_tasks)
  - 匹配岗位
  - 推送面试官
  |
  v
面试评价 -> 日报统计
```

### 新增数据表

| 表名 | 用途 |
| --- | --- |
| `resume_screening_queue` | 简历初筛队列，存储候选人信息、AI 分析结果、审核状态 |
| `position_mappings` | 岗位名映射表（飞书原始名 -> 标准岗位名），已预置 21 条映射 |
| `capability_dimensions` | 岗位能力维度表，已预置 38 条岗位维度定义 |
| `daily_reports` | 招聘日报/周报/面试统计 |
| `recruitment_tasks` | 招聘任务表，关联需求、面试官、负责人 |

### 新增 API 端点

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| `GET` | `/api/resume-screening` | 获取初筛队列列表 |
| `GET` | `/api/resume-screening/:id` | 获取单条初筛记录 |
| `POST` | `/api/resume-screening` | 手动创建初筛记录 |
| `POST` | `/api/resume-screening/:id/ai-analyze` | AI 分析单条记录 |
| `POST` | `/api/resume-screening/:id/approve` | 审核通过（入库到人才库） |
| `POST` | `/api/resume-screening/:id/reject` | 审核拒绝（淘汰） |
| `POST` | `/api/resume-screening/batch-analyze` | 批量 AI 分析所有待审记录 |
| `POST` | `/api/resume-screening/from-resume/:resumeId` | 从已有简历创建初筛记录 |
| `GET` | `/api/daily-reports` | 获取日报列表 |
| `POST` | `/api/daily-reports/generate` | AI 生成日报 |
| `DELETE` | `/api/daily-reports/:id` | 删除日报 |
| `GET/POST/PUT/DELETE` | `/api/position-mappings` | 岗位映射 CRUD |
| `GET/POST/PUT/DELETE` | `/api/capability-dimensions` | 能力维度 CRUD |
| `GET/POST/PUT/DELETE` | `/api/recruitment-tasks` | 招聘任务 CRUD |

---

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+
- Cloudflare 账号（已配置 Pages 项目和 D1 数据库）

### 1. 安装依赖

```bash
cd frontend
npm install
```

```bash
cd worker
npm install
```

### 2. 本地开发

前端开发服务器：

```bash
cd frontend
npm run dev
```

打开 http://localhost:5173

Worker 本地开发（需要 `.dev.vars` 或 wrangler.toml 配置）：

```bash
cd worker
npx wrangler dev
```

### 3. 登录

线上地址: https://ai-interview-22u.pages.dev

本地开发地址: http://localhost:5173

登录后在左侧菜单栏浏览各功能模块。所有模块均已填充测试数据。

---

## 构建与部署

### 前提条件

- 已安装 `wrangler` CLI 并完成 `wrangler login` 认证
- Cloudflare 项目名: `ai-interview`
- D1 数据库名: `ai-interview-db`

### 步骤 1: 构建 Worker

```bash
cd worker
.\node_modules\.bin\esbuild src/index.ts --bundle --format=esm --target=es2022 --outfile=../frontend/public/_worker.js
```

这会将 Hono Worker 打包为 ESM 格式，输出到 `frontend/public/_worker.js`。Cloudflare Pages 会自动识别该文件作为 Pages Functions 的 Worker。

### 步骤 2: 构建前端

```bash
cd frontend
npm run build
```

构建产物输出到 `frontend/dist/`。`tsc -b` 负责类型检查，`vite build` 负责打包。

### 步骤 3: 复制 Worker 到 dist

```bash
Copy-Item frontend/public/_worker.js frontend/dist/_worker.js -Force
```

确保 Worker 文件随前端产物一起部署。

### 步骤 4: 部署到 Cloudflare Pages

```bash
cd frontend
npx wrangler pages deploy dist --project-name=ai-interview --branch=main --commit-dirty
```

部署完成后会输出预览地址，正式地址为 https://ai-interview-22u.pages.dev

### 步骤 5: 数据库迁移（仅首次或表结构变更时）

```bash
npx wrangler d1 execute ai-interview-db --remote --file=scripts/migration_xiaoqi.sql
```

### 步骤 6: 填充种子数据（可选）

```bash
# 岗位名映射（21 条）
npx wrangler d1 execute ai-interview-db --remote --file=scripts/seed_position_mappings.sql

# 能力维度（38 条）
npx wrangler d1 execute ai-interview-db --remote --file=scripts/seed_capability_dims.sql

# 初筛队列 + 招聘任务 + 日报测试数据
npx wrangler d1 execute ai-interview-db --remote --file=scripts/seed_xiaoqi_data.sql
```

### 一键构建部署（PowerShell）

```powershell
cd worker; .\node_modules\.bin\esbuild src/index.ts --bundle --format=esm --target=es2022 --outfile=../frontend/public/_worker.js
cd ..\frontend; npm run build
Copy-Item public/_worker.js dist/_worker.js -Force
npx wrangler pages deploy dist --project-name=ai-interview --branch=main --commit-dirty
```

---

## API 接口

所有 API 均需认证，请求头携带 `Authorization: Bearer <token>`。未认证返回 `{"detail":"Not authenticated"}`。

### 认证

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| `POST` | `/api/auth/login` | 登录，返回 JWT |

### 核心 CRUD

系统使用 `registerCrud(prefix, table, filters)` 模式为以下资源注册标准 CRUD 路由（GET 列表 / GET 单条 / POST 创建 / PUT 更新 / DELETE 删除）：

- `/api/requisitions` - 招聘需求
- `/api/positions` - 岗位
- `/api/resumes` - 简历
- `/api/talent-pool` - 人才库
- `/api/interviews` - 面试
- `/api/coding-tests` - 笔试
- `/api/offers` - Offer
- `/api/offer-templates` - Offer 模板
- `/api/onboarding-records` - 入职记录
- `/api/probation-records` - 试用期记录
- `/api/background-checks` - 背调
- `/api/channels` - 渠道
- `/api/question-banks` - 题库
- `/api/workflows` - 工作流
- `/api/users` - 用户
- `/api/system-configs` - 系统配置
- `/api/position-mappings` - 岗位映射
- `/api/capability-dimensions` - 能力维度
- `/api/recruitment-tasks` - 招聘任务

### AI 相关端点

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| `POST` | `/api/resumes/:id/parse` | AI 解析简历 |
| `POST` | `/api/resumes/:id/match` | AI 岗位匹配评分 |
| `POST` | `/api/positions/:id/generate-jd-stream` | AI 生成岗位描述 |
| `POST` | `/api/coding-tests/:id/generate-questions` | AI 生成笔试题 |
| `POST` | `/api/coding-tests/generate-questions` | AI 批量生成笔试题 |
| `POST` | `/api/interviews/:id/ai-analysis` | 面试综合 AI 分析 |
| `POST` | `/api/offers/:id/ai-generate` | AI 生成 Offer 内容 |
| `POST` | `/api/requisitions/:id/ai-generate-jd` | AI 从需求生成 JD |
| `POST` | `/api/resume-screening/:id/ai-analyze` | 小七 AI 简历初筛分析 |
| `POST` | `/api/resume-screening/batch-analyze` | 批量 AI 初筛 |
| `POST` | `/api/daily-reports/generate` | AI 生成招聘日报 |

### AI 引擎说明

系统使用 Cloudflare Workers AI，主模型为 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`，备用模型为 `@cf/meta/llama-3.1-8b-instruct`。通过 `callAI(env, systemPrompt, userPrompt)` 统一调用，返回文本结果。

---

## 数据库结构

系统使用 Cloudflare D1（SQLite 兼容），共 28 张表：

| 表名 | 用途 |
| --- | --- |
| `users` | 用户与认证 |
| `job_requisitions` | 招聘需求 |
| `positions` | 岗位 |
| `resumes` | 简历（含 raw_text、parsed_data、ai_review） |
| `talent_pool` | 人才库 |
| `interviews` | 面试记录 |
| `interview_panels` | 面试小组 |
| `coding_tests` | 笔试 |
| `coding_submissions` | 笔试提交 |
| `offers` | Offer |
| `offer_templates` | Offer 模板 |
| `onboarding_records` | 入职记录 |
| `probation_records` | 试用期记录 |
| `background_checks` | 背调 |
| `recruitment_channels` | 招聘渠道 |
| `question_banks` | 题库 |
| `workflows` | 工作流定义 |
| `workflow_nodes` | 工作流节点 |
| `workflow_edges` | 工作流连线 |
| `workflow_executions` | 工作流执行记录 |
| `workflow_node_executions` | 节点执行记录 |
| `system_configs` | 系统配置 |
| `department_reviews` | 部门评审 |
| `resume_screening_queue` | 小七 - 简历初筛队列 |
| `position_mappings` | 小七 - 岗位名映射 |
| `capability_dimensions` | 小七 - 能力维度 |
| `daily_reports` | 小七 - 招聘日报 |
| `recruitment_tasks` | 小七 - 招聘任务 |

---

## 使用指南

### 简历初筛流程

1. 进入「简历初筛」页面，可以看到所有待审简历卡片
2. 每张卡片显示候选人姓名、申请岗位、匹配分数、AI 分析摘要
3. 点击「AI 分析」按钮，系统会调用 Workers AI 生成详细分析报告
4. 分析报告包含：初筛结果、匹配分数、优势分析、风险点、能力维度逐项评分、建议面试问题
5. 点击「入库」将候选人加入人才库，或点击「不入库」淘汰
6. 可以使用「批量分析」按钮一次性分析所有待审记录

### 招聘日报

1. 进入「招聘日报」页面
2. 点击「生成日报」按钮，AI 会自动汇总当天数据生成报告
3. 报告包含：新简历数、面试安排数、面试完成数、Offer 数、人才库新增数等统计
4. 支持日报、周报、面试统计三种类型

### 岗位映射配置

1. 进入「设置 > 岗位映射」页面
2. 可以添加、编辑、删除飞书原始岗位名到标准岗位名的映射
3. 这些映射用于 AI 分析时自动识别候选人申请的岗位

### 能力维度配置

1. 进入「设置 > 能力维度」页面
2. 可以为每个标准岗位配置能力维度（维度名、定义、行为指标）
3. AI 分析时会按这些维度逐项评分

### 招聘任务管理

1. 招聘任务关联招聘需求和面试官
2. 简历入库后，系统会尝试匹配对应的招聘任务
3. 匹配成功后可以推送候选人到面试官审核

---

## 项目结构

```text
ai-interview/
├── frontend/                    # 前端应用
│   ├── src/
│   │   ├── pages/               # 页面组件
│   │   │   ├── Dashboard/       # 仪表盘
│   │   │   ├── Requisitions/    # 需求管理
│   │   │   ├── Positions/       # 岗位管理
│   │   │   ├── Channels/        # 渠道管理
│   │   │   ├── Resumes/         # 简历管理
│   │   │   ├── TalentPool/      # 人才库
│   │   │   ├── Interviews/      # 面试管理
│   │   │   ├── CodingTests/     # 笔试管理
│   │   │   ├── BackgroundChecks/ # 背调管理
│   │   │   ├── Offers/          # Offer管理 + 模板
│   │   │   ├── Onboarding/      # 入职管理
│   │   │   ├── Probation/       # 试用期管理
│   │   │   ├── ResumeScreening/ # 简历初筛（小七）
│   │   │   ├── DailyReports/    # 招聘日报（小七）
│   │   │   ├── QuestionBanks/   # 题库管理
│   │   │   ├── Workflows/       # 工作流
│   │   │   ├── Settings/        # 系统设置
│   │   │   │   ├── Users.tsx
│   │   │   │   ├── Profile.tsx
│   │   │   │   ├── System.tsx
│   │   │   │   ├── PositionMappings.tsx       # 岗位映射（小七）
│   │   │   │   └── CapabilityDimensions.tsx    # 能力维度（小七）
│   │   │   └── ...
│   │   ├── components/
│   │   │   └── Layout/          # 布局与侧边栏
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx  # 认证上下文
│   │   ├── router/
│   │   │   └── index.tsx        # 路由配置
│   │   └── utils/
│   │       └── request.ts       # Axios 请求封装
│   ├── public/
│   │   └── _worker.js           # 编译后的 Worker（部署用）
│   └── package.json
│
├── worker/                      # Cloudflare Worker 后端
│   ├── src/
│   │   └── index.ts             # Hono 应用（路由 + 业务逻辑 + AI 调用）
│   ├── wrangler.toml            # Worker 配置（D1 绑定、AI 绑定）
│   └── package.json
│
├── scripts/                     # 数据库迁移与种子数据
│   ├── migration_xiaoqi.sql     # 小七集成建表迁移
│   ├── seed_position_mappings.sql  # 岗位映射种子数据
│   ├── seed_capability_dims.sql    # 能力维度种子数据
│   └── seed_xiaoqi_data.sql     # 初筛队列+招聘任务+日报测试数据
│
├── .env.example
├── .gitignore
└── README.md
```

---

## 配置说明

### wrangler.toml (Worker)

```toml
name = "ai-interview-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[vars]
SECRET_KEY = "<your-jwt-secret>"

[[d1_databases]]
binding = "DB"
database_name = "ai-interview-db"
database_id = "<your-d1-database-id>"
```

Workers AI 绑定 (`AI`) 在 Cloudflare Dashboard 的 Pages 项目设置中配置，无需在 wrangler.toml 中声明。

### 环境变量

| 变量 | 说明 |
| --- | --- |
| `SECRET_KEY` | JWT 签名密钥 |
| `DB` | D1 数据库绑定（自动注入） |
| `AI` | Workers AI 绑定（Cloudflare Dashboard 配置） |

---

## 安全建议

- 生产环境务必修改 `SECRET_KEY` 和管理员密码
- 不要提交 `.env`、`.dev.vars` 或包含密钥的配置文件
- AI 解析简历和面试内容时，请遵守候选人隐私和数据保留法规
- Cloudflare D1 的 SQL 查询避免使用超过 4 个表的 UNION ALL，系统已拆分为独立 COUNT 查询

---

## License

MIT
