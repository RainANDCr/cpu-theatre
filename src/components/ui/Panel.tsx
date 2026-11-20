import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface PanelProps {
  children: ReactNode
  className?: string
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  padded?: boolean
  tone?: 'default' | 'accent' | 'quiet'
}

/**
 * 玻璃面板：全站唯一的分组容器。
 * 刻意不做多种圆角与阴影变体——仪表盘上过多层次会让数据本身失焦。
 */
export function Panel({
  children,
  className,
  title,
  subtitle,
  actions,
  padded = true,
  tone = 'default',
}: PanelProps) {
  const hasHeader = Boolean(title || actions)
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[14px] border border-line/90 bg-panel/65 shadow-panel backdrop-blur-md',
        tone === 'accent' && 'border-accent/30',
        tone === 'quiet' && 'bg-panel/35',
        className,
      )}
    >
      {hasHeader && (
        <header className="flex items-start justify-between gap-3 border-b border-line/70 px-4 py-3">
          <div className="min-w-0">
            {title && (
              <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-2">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(padded && 'p-4')}>{children}</div>
    </section>
  )
}
