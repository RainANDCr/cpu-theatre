import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface PaneHeaderProps {
  title: string
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

/** 面板顶部的窄条：左边标题，右边状态或操作。三栏共用，保证高度一致。 */
export function PaneHeader({ title, meta, actions, className }: PaneHeaderProps) {
  return (
    <div
      className={cn(
        'flex h-8 shrink-0 items-center gap-2 border-b border-line/70 bg-shell/30 px-2.5',
        className,
      )}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">{title}</span>
      {meta && <span className="truncate font-mono text-[9.5px] text-ink-3/70">{meta}</span>}
      {actions && <div className="ml-auto flex items-center gap-1.5">{actions}</div>}
    </div>
  )
}
