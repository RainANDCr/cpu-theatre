import { Component, type ErrorInfo, type ReactNode } from 'react'
import { buttonClass } from '../ui/buttonStyles'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * 最后一道防线：任何渲染期异常都被兜住，界面不至于整片白掉。
 * 注意这只处理「视图」错误——模拟器引擎的异常走 Stat，由引擎自己报告。
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[cpu-theatre] view crashed', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-void px-6 text-center">
        <div className="font-mono text-[9.5px] uppercase tracking-[0.3em] text-err">
          view crashed
        </div>
        <h1 className="mt-3 text-[24px] font-semibold text-ink">界面出错了</h1>
        <p className="mt-2 max-w-[520px] text-[12.5px] leading-relaxed text-ink-2">
          这不是处理器异常，而是视图渲染失败。刷新页面通常可以恢复；如果反复出现，
          请把下面这行信息记下来。
        </p>
        <pre className="mt-4 max-w-[720px] overflow-x-auto rounded-lg border border-line/80 bg-panel/60 px-3 py-2 text-left font-mono text-[11px] text-err">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={buttonClass({ className: 'mt-6' })}
        >
          重新加载
        </button>
      </div>
    )
  }
}
