import type { StageName } from '../../core/execution/types'
import { cn } from '../../lib/cn'

const ORDER: StageName[] = ['FETCH', 'DECODE', 'EXECUTE', 'MEMORY', 'WRITEBACK', 'PC_UPDATE']

const LABEL: Record<StageName, string> = {
  FETCH: 'FETCH',
  DECODE: 'DECODE',
  EXECUTE: 'EXECUTE',
  MEMORY: 'MEMORY',
  WRITEBACK: 'WB',
  PC_UPDATE: "PC'",
}

export interface StageRibbonProps {
  /** 本条指令实际经过的阶段（异常指令会短于 6） */
  stages: readonly StageName[]
  current: StageName | null
  className?: string
}

/**
 * 六阶段进度条。
 *
 * 数据通路图上的高亮是「细节」，这条带子是「骨架」：先看清走到第几阶段，
 * 再去看是哪几个模块在动。异常指令只走一部分，带子会跟着变短——
 * 这比任何文字解释都直观。
 */
export function StageRibbon({ stages, current, className }: StageRibbonProps) {
  const visited = new Set(stages)
  const currentIndex = current ? stages.indexOf(current) : -1

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1 border-t border-line/70 bg-void/40 px-2 py-1.5',
        className,
      )}
      aria-label="执行阶段"
    >
      {ORDER.map((stage, index) => {
        const reached = visited.has(stage)
        const active = current === stage
        const passed = currentIndex >= 0 && index < currentIndex
        return (
          <div key={stage} className="flex items-center gap-1">
            {index > 0 && (
              <span className={cn('text-[8px]', passed || active ? 'text-accent' : 'text-ink-3/40')}>
                ›
              </span>
            )}
            <span
              className={cn(
                'rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.08em] transition-colors',
                active
                  ? 'border-accent/70 bg-accent/15 text-accent'
                  : passed
                    ? 'border-accent/25 text-accent/70'
                    : reached
                      ? 'border-line-2 text-ink-2'
                      : 'border-line/50 text-ink-3/35',
              )}
            >
              {LABEL[stage]}
            </span>
          </div>
        )
      })}
    </div>
  )
}
