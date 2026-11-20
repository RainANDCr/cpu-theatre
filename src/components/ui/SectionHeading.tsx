import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SectionHeadingProps {
  eyebrow: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="h-px w-6 bg-accent/60" />
          <span className="font-mono text-[9.5px] uppercase tracking-[0.26em] text-ink-3">
            {eyebrow}
          </span>
        </div>
        <h2 className="mt-2 text-[19px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description && (
          <p className="mt-1.5 max-w-[640px] text-[12px] leading-relaxed text-ink-3">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}
