/** Time-of-day greeting prefix in Chinese */
export function getGreetingPrefix(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return "早上好"
  if (hour < 18) return "下午好"
  return "晚上好"
}

export function getDisplayName(user: {
  name?: string | null
  username?: string
  login?: string
} | null | undefined): string {
  if (!user) return "访客"
  const name = user.name?.trim()
  if (name) return name
  return user.username?.trim() || user.login?.trim() || "用户"
}

export function formatWorkspaceGreeting(
  user: { name?: string | null; username?: string; login?: string } | null | undefined,
  date = new Date(),
): string {
  return `${getGreetingPrefix(date)}，${getDisplayName(user)}`
}
