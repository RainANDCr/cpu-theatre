import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { BadgeTone } from './Badge'

const TONE_TEXT: Record<BadgeTone, string> = {
  slate: 'text-ink-2',
  blue: 'text-bus',
  purple: 'text-ctrl',
  cyan: 'text-reg',
  amber: 'text-alu',
  green: 'text-ok',
  red: 'text-err',
}

export interface ReadoutProps {
  label: string
  value: ReactNode
  tone?: BadgeTone
  /** 数值暂时无意义时（例如引擎未接入）置灰，避免误读 */
  muted?: boolean
  className?: string
}

/** 顶栏用的紧凑读数条：一个标签 + 一个等宽数值。 */
export function Readout({ label, value, tone = 'slate', muted = false, className }: ReadoutProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-line/80 bg-panel/55 px-2.5 py-1.5',
        className,
      )}
    >
      <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">{label}</span>
      <span
        className={cn(
          'font-mono text-[11px] leading-none tabnums',
          muted ? 'text-ink-3' : TONE_TEXT[tone],
        )}
      >
        {value}
      </span>
    </div>
  )
}

export interface MetricProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  unit?: string
  tone?: BadgeTone
  className?: string
}

/** 统计卡片：值大、标签小、提示更小，一眼能扫完。 */
export function Metric({ label, value, hint, unit, tone = 'slate', className }: MetricProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line/80 bg-panel/50 px-3 py-2.5',
        className,
      )}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className={cn('font-mono text-[19px] leading-none tabnums', TONE_TEXT[tone])}>
          {value}
        </span>
        {unit && <span className="font-mono text-[10px] text-ink-3">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[10.5px] leading-relaxed text-ink-3">{hint}</div>}
    </div>
  )
}
