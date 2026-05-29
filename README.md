# PRism

**PRism** 是企业级 AI Pull Request 智能评审平台（Reviewly 仓库）。采用暗色 DevTools 风格 UI，覆盖 PR 评审、安全分析、性能评估、架构洞察与工程治理等维度。

> 当前阶段：前端演示 + Mock 数据 + 真实 AI 分析（配置 API Key 后可用）。

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

- **框架**：Next.js 16、React 19、TypeScript
- **样式**：Tailwind CSS 4
- **UI**：Radix UI + shadcn/ui、Framer Motion、Recharts
- **AI 代理**：`app/api/ai/chat/route.ts`，支持 Anthropic、OpenAI、Google Gemini、DeepSeek、OpenRouter、Custom

## 环境要求

- Node.js 18+（推荐 20+）
- npm

## 快速开始

```bash
# 方式 1：npm 一键启动（推荐）
npm run start:app

# 方式 2：Windows 双击
start-dev.bat

# 方式 3：手动
npm install
npm run dev
```

启动成功后访问 [http://localhost:3000](http://localhost:3000)。

## AI 配置

1. 进入 **系统设置** → **AI 模型设置**
2. 选择 Provider，填写 Model 与 API Key 并保存
3. 在 **AI 评审** 页点击分析，即可调用 `/api/ai/chat`

支持的 Provider：Anthropic、OpenAI、Google Gemini、DeepSeek、OpenRouter、Custom。

API Key 仅保存在浏览器 localStorage（`prism.ai-settings`），不会上传至服务端持久化。

## 项目结构

```
Reviewly/
├── app/                    # Next.js App Router
│   ├── page.tsx            # 主入口（PRism 布局）
│   └── api/ai/chat/        # AI 聊天代理
├── components/
│   ├── prism/              # PRism 业务组件与视图
│   └── ui/                 # shadcn/ui 基础组件
├── start.ps1               # 统一一键启动脚本
├── start-dev.bat           # Windows 双击入口
├── plan.md                 # 功能路线图（P0–P10）
└── package.json
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建 |
| `npm run start` | 生产模式启动 |
| `npm run lint` | ESLint 检查 |
| `npm run start:app` | 一键安装依赖 + 启动 + 打开浏览器 |

## 路线图

详细实施计划见 [plan.md](plan.md)，按 P0–P10 分阶段推进：

1. **P0**：前端 API 化与 URL 导航
2. **P1**：PR 评审核心闭环
3. **P2**：数据库持久化
4. **P3**：仓库管理与 GitHub 集成
5. **P4**：AI 分析引擎真实化
6. **P5–P9**：安全、性能、架构、治理、团队分析
7. **P10**：系统设置与集成

**MVP 目标**：完成 P0 + P1，形成可用的 PR 评审工作流。

## 注意事项

- 当前为演示 / Mock 阶段，PR 数据非真实 GitHub 同步
- `.next/`、`node_modules/` 不应提交（见 `.gitignore`）
