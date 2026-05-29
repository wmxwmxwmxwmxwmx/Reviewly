# PRism

**PRism** 是企业级 AI Pull Request 智能评审平台（Reviewly 仓库）。采用暗色 DevTools 风格 UI，覆盖 PR 评审、安全分析、性能评估、架构洞察与工程治理等维度。

> 当前阶段：Monorepo 前后端分离架构；前端演示 + Mock 数据 + 真实 AI 分析（配置 API Key 后可用）。

## 功能模块

| 模块 | 说明 | 数据状态 |
|------|------|----------|
| 总览面板 | 质量指标与趋势 | Mock |
| Pull Request | PR 列表与筛选 | Mock |
| AI 评审 | Diff 展示 + AI 摘要/分析 | Mock diff + 真实 AI（需 API Key） |
| 安全中心 | 漏洞与 CWE 分类 | Mock |
| 性能分析 | 性能风险识别 | Mock |
| 架构分析 | 模块影响与依赖 | Mock |
| 工程治理 | 质量门禁规则 | Mock |
| 仓库管理 | GitHub 仓库接入（规划中） | Mock |
| 团队分析 | 评审效率与质量贡献 | Mock |
| 系统设置 | AI 模型 / API Key 配置 | localStorage 持久化 |

## 技术栈

- **Monorepo**：npm workspaces（`apps/web` + `apps/api` + `packages/shared`）
- **前端**：Next.js 16、React 19、TypeScript、Tailwind CSS 4、Radix UI + shadcn/ui
- **后端**：Next.js API 应用（`apps/api`，端口 3001）
- **共享包**：`@reviewly/shared`（类型与常量）
- **AI 代理**：`POST /api/ai/chat`，支持 Anthropic、OpenAI、Google Gemini、DeepSeek、OpenRouter、Custom

## 环境要求

- Node.js 18+（推荐 20+）
- npm 9+

## 快速开始

```bash
# 在仓库根目录安装所有 workspace 依赖
npm install

# 同时启动 Web（:3000）与 API（:3001）
npm run dev

# 或一键启动（自动打开浏览器）
npm run start:app

# Windows 也可双击
start-dev.bat
```

- **Web 前端**：http://localhost:3000
- **API 后端**：http://localhost:3001

## AI 配置

1. 打开 Web 应用，进入 **系统设置** → **AI 模型设置**
2. 选择 Provider，填写 Model 与 API Key 并保存
3. 在 **AI 评审** 页点击分析

Web 通过 rewrite 将 `/api/*` 转发至 API 服务，前端仍使用 `fetch("/api/ai/chat")`。

API Key 仅保存在浏览器 localStorage（`prism.ai-settings`），不会上传至服务端持久化。

## 项目结构

```
Reviewly/
├── apps/
│   ├── web/                          # 前端 Next.js（仅 UI）
│   │   ├── public/
│   │   └── src/
│   │       ├── app/                  # App Router 页面
│   │       ├── components/ui/        # shadcn/ui 基础组件
│   │       ├── features/prism/       # PRism 业务域
│   │       │   ├── components/       # header, sidebar, diff-viewer...
│   │       │   ├── views/            # 各功能页面
│   │       │   ├── contexts/         # AI 设置、导航上下文
│   │       │   └── data/             # mock-data.ts
│   │       ├── hooks/
│   │       └── lib/
│   └── api/                          # 后端 Next.js API
│       └── src/
│           ├── app/api/ai/chat/      # AI 聊天代理
│           └── lib/ai/               # 模型调用逻辑
├── packages/
│   └── shared/                       # 共享类型 @reviewly/shared
│       └── src/types/
├── scripts/
│   ├── start.ps1                     # 一键启动
│   ├── start-dev.ps1
│   └── start-dev.bat
├── docs/
│   └── plan.md                       # 功能路线图 P0–P10
├── package.json                      # workspaces 根配置
├── start-dev.bat                     # 根目录快捷入口
└── README.md
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动 Web + API |
| `npm run build` | 构建所有 workspace |
| `npm run start:app` | 一键安装依赖、启动、打开浏览器 |
| `npm run dev -w @reviewly/web` | 仅启动前端 |
| `npm run dev -w @reviewly/api` | 仅启动 API |
| `npm run build -w @reviewly/web` | 仅构建前端 |

## 环境变量

| 变量 | 应用 | 说明 |
|------|------|------|
| `API_URL` | `apps/web` | API 服务地址，默认 `http://localhost:3001` |

## 路线图

详细计划见 [docs/plan.md](docs/plan.md)。

**MVP 目标**：P0（API 化 + URL 导航）+ P1（PR 评审核心闭环）。

## 注意事项

- 当前 PR 数据为 Mock，非真实 GitHub 同步
- `.next/`、`node_modules/`、`.npm-cache/` 不应提交
