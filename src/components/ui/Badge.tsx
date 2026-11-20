import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export type BadgeTone = 'slate' | 'blue' | 'purple' | 'cyan' | 'amber' | 'green' | 'red'

const BADGE_TONES: Record<BadgeTone, { chip: string; dot: string }> = {
  slate: { chip: 'border-line-2/70 bg-ink/[0.04] text-ink-3', dot: 'bg-ink-3' },
  blue: { chip: 'border-bus/30 bg-bus/10 text-bus', dot: 'bg-bus' },
  purple: { chip: 'border-ctrl/30 bg-ctrl/10 text-ctrl', dot: 'bg-ctrl' },
  cyan: { chip: 'border-reg/30 bg-reg/10 text-reg', dot: 'bg-reg' },
  amber: { chip: 'border-alu/30 bg-alu/10 text-alu', dot: 'bg-alu' },
  green: { chip: 'border-ok/30 bg-ok/10 text-ok', dot: 'bg-ok' },
  red: { chip: 'border-err/30 bg-err/10 text-err', dot: 'bg-err' },
}

export interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  dot?: boolean
  className?: string
}

export function Badge({ children, tone = 'slate', dot = false, className }: BadgeProps) {
  const style = BADGE_TONES[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] whitespace-nowrap',
        style.chip,
        className,
      )}
    >
      {dot && <span className={cn('size-1 rounded-full', style.dot)} />}
      {children}
    </span>
  )
}
