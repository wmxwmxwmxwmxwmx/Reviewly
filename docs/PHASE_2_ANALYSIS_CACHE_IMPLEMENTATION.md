# Phase 2：PR 分析缓存实现说明

## 设计决策

- **缓存键**：`{full_name}#{number}:{head_sha}`，与 GitHub PR 头部提交绑定。
- **Cache hit**：返回已有 `completed` job 的 `jobId`，不调度 `run_job`；写入 `analysis_cache_events` 审计。
- **Cache miss**：创建新 `analysis_jobs` 行并后台执行；完成后记录 miss 事件。
- **强制重扫**：`POST /analysis?force=true` 绕过 lookup，始终新建 job。
- **版本过滤**：`get_latest_analysis` / `get_findings` 仅匹配 PR 当前 `analysis_version`。

## 数据库（Migration 011）

- `pull_requests`：`head_sha`, `base_sha`, `analysis_version`
- `analysis_jobs`：`analysis_version`, `head_sha`, `base_sha`, `phase`, `cache_hit`, `source_job_id`, `duration_ms`
- `analysis_cache_events`：命中率与节省时长/成本聚合

## API 契约

### `POST /api/pull-requests/{id}/analysis?force=false`

```json
{
  "jobId": "job-xxx",
  "queued": true,
  "cacheHit": false,
  "cached": false,
  "analysisVersion": "owner/repo#42:sha..."
}
```

Cache hit 时 `queued: false`, `cacheHit: true`。

### Import 响应（可选字段）

- `analysisJobId`, `analysisQueued`, `analysisCacheHit` — import 成功后非阻塞 `enqueue_analysis`。

### Dashboard

- `analysisCache`: `{ hitRate, savedTimeMs, savedTimeLabel, estimatedCostSavedUsd }`

## 分析阶段（phase）

`queued` → `fetching_diff` → `scanning` → `generating_summary` → `saving_results` → `completed`

与 `status`（pending/running/completed/failed）并存，供 UI 步骤条使用。

## Webhook / 队列

- `synchronize` / `opened`：sync PR SHA 后 `enqueue_analysis`；同 SHA 再次触发为 cache hit，不启后台线程。
- `analysis_orchestrator.enqueue_analysis` 内部在 cache hit 时不调用 `schedule_analysis_background`。
- 未来可将 `schedule_analysis_background` 换为 `AnalysisQueuePort`（Celery/RQ）。

## 前端

- `runPullRequestAnalysis`：cache hit 时直接 `loadPersistedAnalysis`，不轮询。
- 导入后自动分析：`force: false`；手动重扫：`force: true`（默认）。
- Dashboard 顶部三卡展示缓存指标。

## 配置

- `PRISM_ANALYSIS_COST_PER_RUN_USD`（默认 0.05）：用于估算节省成本。

## 回滚

1. 回滚 Alembic `011`（或保留列、停用 cache lookup）。
2. 前端可继续调用旧同步 `runPullRequestAnalysis` 行为（仍兼容）。

## 未改动

- External Repository Onboarding（`repository_onboarding.py`、`external-repo-onboard-dialog`）
- `POST /api/repos/onboard` 与 import `repositoryCreated` 契约
