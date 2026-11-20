import type { InstructionTrace } from '../../core/seq/SEQProcessor'
import { cn } from '../../lib/cn'

export interface CycleTimelineProps {
  history: readonly InstructionTrace[]
  /** 点击某个周期回退到那一拍之前（count = 第几条指令之后） */
  onSeek?: (count: number) => void
  className?: string
}

/**
 * 周期轴。SEQ 下「一拍 = 一条指令」，所以刻度与指令记录一一对应。
 * 没执行过的位置画虚线空槽——它是坐标轴，不是数据。
 */
export function CycleTimeline({ history, onSeek, className }: CycleTimelineProps) {
  const ticks = Math.max(18, history.length + 1)

  return (
    <div
      className={cn('flex shrink-0 items-center gap-2 border-b border-line/70 px-3 py-2', className)}
    >
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
        Cycle
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => onSeek?.(0)}
          className="flex h-7 w-9 shrink-0 items-center justify-center rounded border border-line/80 bg-panel/40 font-mono text-[9px] tabnums text-ink-3 transition-colors hover:text-ink"
          title="回到初始状态"
        >
          T0
        </button>
        {Array.from({ length: ticks }).map((_, index) => {
          const entry = history[index]
          const filled = Boolean(entry)
          return (
            <button
              key={index}
              type="button"
              disabled={!filled}
              onClick={() => onSeek?.(index + 1)}
              title={entry ? `${entry.text} @ ${entry.cycle}` : '尚未执行'}
              className={cn(
                'flex h-7 w-9 shrink-0 items-center justify-center rounded border font-mono text-[9px] tabnums transition-colors',
                filled
                  ? 'border-line-2 bg-panel/70 text-ink-2 hover:border-accent/40 hover:text-accent'
                  : 'border-dashed border-line-2/50 text-ink-3/40',
              )}
            >
              T{index + 1}
            </button>
          )
        })}
      </div>
      <span className="hidden shrink-0 font-mono text-[9px] text-ink-3/60 sm:inline">
        {history.length === 0 ? '尚无执行记录' : `${history.length} cycles`}
      </span>
    </div>
  )
}
