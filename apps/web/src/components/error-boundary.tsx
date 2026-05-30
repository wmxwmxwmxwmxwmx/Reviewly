"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RotateCcw } from "lucide-react"

interface ErrorBoundaryProps {
  children: ReactNode
  /** Short label for the failed section (shown in fallback). */
  section?: string
  onReset?: () => void
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.section ? `: ${this.props.section}` : ""}]`,
      error,
      info.componentStack,
    )
  }

  private handleReset = () => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center min-h-[200px]">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[oklch(0.55_0.22_27/0.12)]">
            <AlertTriangle className="h-5 w-5 text-risk-high" />
          </div>
          <div className="space-y-1 max-w-md">
            <p className="text-sm font-medium text-foreground">
              {this.props.section ? `${this.props.section}加载失败` : "页面区域加载失败"}
            </p>
            <p className="text-xs text-muted-foreground">
              {this.state.error.message || "发生了意外错误，请重试。"}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-foreground hover:bg-surface-3 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
