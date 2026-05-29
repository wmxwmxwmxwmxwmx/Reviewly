const GITHUB_PR_URL_RE =
  /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/i

const GITHUB_PR_MISSING_NUMBER_RE =
  /(?:https?:\/\/)?(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+\/pull\/?(?:[?#].*)?$/i

export function isValidGitHubPrUrl(url: string): boolean {
  return GITHUB_PR_URL_RE.test(url.trim())
}

/** Client-side validation before calling import API. */
export function validateGitHubPrUrl(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) {
    return "请输入 GitHub PR 链接"
  }
  if (GITHUB_PR_MISSING_NUMBER_RE.test(trimmed)) {
    return "链接缺少 PR 编号，请使用完整链接，例如 https://github.com/owner/repo/pull/123"
  }
  if (!isValidGitHubPrUrl(trimmed)) {
    return "请输入有效的 GitHub PR 链接（需包含 /pull/数字）"
  }
  return null
}
