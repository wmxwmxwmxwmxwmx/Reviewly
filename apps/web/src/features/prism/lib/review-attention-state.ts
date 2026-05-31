import type { PullRequestListItem } from "@reviewly/shared"

const STORE_KEY = "prism:review-attention-state"
export const ATTENTION_STATE_EVENT = "prism:attention-state-changed"

export type ReviewAttentionState = "unread" | "reviewed" | "needs_revisit"

export type ReviewFingerprint = {
  lastCommitSha: string | null
  lastAnalysisId: string | null
  lastCiStatus: string | null
  lastCommentCount: number | null
  lastViewedAt: string
}

export type FingerprintInput = {
  headSha?: string | null
  analysisId?: string | null
  ciStatus?: string | null
  commentCount?: number | null
}

type AttentionStore = Record<string, ReviewFingerprint>

function readStore(): AttentionStore {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as AttentionStore
  } catch {
    return {}
  }
}

function writeStore(store: AttentionStore): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORE_KEY, JSON.stringify(store))
}

function dispatchChange(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(ATTENTION_STATE_EVENT))
}

export function getAnalysisId(pr: PullRequestListItem): string | null {
  return pr.aiSummary?.analyzedAt ?? null
}

export function getFingerprintInput(pr: PullRequestListItem): FingerprintInput {
  const text = `${pr.title} ${pr.aiSummary?.content ?? ""}`.toLowerCase()
  const ciFailed = /\b(ci|build fail|check fail|pipeline fail|tests? fail)\b/i.test(text)
  return {
    headSha: pr.headSha ?? null,
    analysisId: getAnalysisId(pr),
    ciStatus: ciFailed ? "failed" : "unknown",
    commentCount: null,
  }
}

function fingerprintChanged(
  stored: ReviewFingerprint,
  current: FingerprintInput,
): boolean {
  if (current.headSha && stored.lastCommitSha && current.headSha !== stored.lastCommitSha) {
    return true
  }
  if (
    current.analysisId &&
    stored.lastAnalysisId &&
    current.analysisId !== stored.lastAnalysisId
  ) {
    return true
  }
  if (
    current.ciStatus &&
    stored.lastCiStatus &&
    current.ciStatus !== stored.lastCiStatus &&
    current.ciStatus === "failed"
  ) {
    return true
  }
  if (
    current.commentCount != null &&
    stored.lastCommentCount != null &&
    current.commentCount > stored.lastCommentCount
  ) {
    return true
  }
  return false
}

export function getStoredFingerprint(prId: string): ReviewFingerprint | null {
  return readStore()[prId] ?? null
}

export function hasViewRecord(prId: string): boolean {
  return Boolean(readStore()[prId]?.lastViewedAt)
}

export function computeAttentionState(
  prId: string,
  current: FingerprintInput,
): ReviewAttentionState {
  const stored = readStore()[prId]
  if (!stored) return "unread"
  if (fingerprintChanged(stored, current)) return "needs_revisit"
  return "reviewed"
}

export function getAttentionState(
  prId: string,
  current: FingerprintInput,
): ReviewAttentionState {
  return computeAttentionState(prId, current)
}

export function markReviewed(prId: string, snapshot: FingerprintInput): void {
  const store = readStore()
  store[prId] = {
    lastCommitSha: snapshot.headSha ?? null,
    lastAnalysisId: snapshot.analysisId ?? null,
    lastCiStatus: snapshot.ciStatus ?? null,
    lastCommentCount: snapshot.commentCount ?? null,
    lastViewedAt: new Date().toISOString(),
  }
  writeStore(store)
  dispatchChange()
}

export function subscribeAttentionState(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined
  const handler = () => cb()
  window.addEventListener(ATTENTION_STATE_EVENT, handler)
  return () => window.removeEventListener(ATTENTION_STATE_EVENT, handler)
}

export function countAttentionStates(
  prs: PullRequestListItem[],
): { unread: number; needsRevisit: number; badge: number } {
  let unread = 0
  let needsRevisit = 0
  for (const pr of prs) {
    const input = getFingerprintInput(pr)
    const state = computeAttentionState(pr.id, input)
    if (state === "unread") unread += 1
    if (state === "needs_revisit") needsRevisit += 1
  }
  return { unread, needsRevisit, badge: unread }
}
