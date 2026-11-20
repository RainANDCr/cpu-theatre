import { formatConditionCodes } from '../../core/cpu/ConditionCodes'
import { formatAddress, formatValue } from '../../core/isa/format'
import { registerName } from '../../core/isa/registers'
import type { InstructionTrace } from '../../core/seq/SEQProcessor'
import { cn } from '../../lib/cn'

const COLUMNS = [
  { label: 'Cycle', width: 'w-12' },
  { label: 'PC', width: 'w-20' },
  { label: 'Instruction', width: 'flex-1' },
  { label: 'Reg Δ', width: 'flex-1' },
  { label: 'Mem Δ', width: 'flex-1' },
  { label: 'CC', width: 'w-12' },
  { label: 'Stat', width: 'w-12' },
]

function describeRegisterWrites(trace: InstructionTrace): string {
  if (trace.registerWrites.length === 0) return '·'
  return trace.registerWrites
    .map((write) => `${registerName(write.register) ?? `r${write.register}`}=${formatValue(write.value)}`)
    .join(' ')
}

function describeMemory(trace: InstructionTrace): string {
  const memory = trace.memory
  if (!memory || memory.kind === 'none' || memory.address === null) return '·'
  const address = formatAddress(memory.address)
  if (memory.kind === 'write') return `W ${address}←${formatValue(memory.writeValue ?? 0n)}`
  return `R ${address}→${formatValue(memory.readValue ?? 0n)}`
}

const STAT_TONE: Record<string, string> = {
  AOK: 'text-ok',
  HLT: 'text-alu',
  ADR: 'text-err',
  INS: 'text-err',
}

export interface ExecutionLogProps {
  history: readonly InstructionTrace[]
  /** 点击某一行：回退到执行完该行之后的状态 */
  onSelect?: (count: number) => void
  /** 当前停在「执行完几条指令」的位置 */
  position?: number
  className?: string
}

/**
 * 执行日志。每一拍一行，记的是「这一拍真的改了什么」——不是给动画配的字幕。
 * 空态时连示例行都不放：日志的价值就在于它只写真实发生过的事。
 */
export function ExecutionLog({ history, onSelect, position, className }: ExecutionLogProps) {
  return (
    <div
      role="region"
      aria-label="执行日志"
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-line/70 bg-shell/40 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
        {COLUMNS.map((column) => (
          <span key={column.label} className={column.width}>
            {column.label}
          </span>
        ))}
      </div>

      {history.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
          <div className="h-px w-10 bg-line-2" aria-hidden="true" />
          <p className="text-[11.5px] text-ink-2">尚无执行记录</p>
          <p className="max-w-[420px] text-[10.5px] leading-relaxed text-ink-3">
            点「单步」或「运行」后，每执行一条指令就追加一行：周期、PC、指令、寄存器与内存的变化、
            条件码、状态码。点任意一行可回看到那一拍。
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {history.map((trace, index) => (
            <button
              key={`${trace.cycle}-${trace.pc}`}
              type="button"
              onClick={() => onSelect?.(index + 1)}
              className={cn(
                'flex w-full items-center gap-2 border-b border-line/25 px-3 py-[3px] text-left font-mono text-[10.5px] transition-colors hover:bg-white/[0.03]',
                position === index + 1 && 'bg-accent/[0.08]',
              )}
            >
              <span className="w-12 tabnums text-ink-3">{trace.cycle}</span>
              <span className="w-20 text-bus">{formatAddress(trace.pc)}</span>
              <span className="flex-1 truncate text-ink">{trace.text}</span>
              <span className="flex-1 truncate text-reg">{describeRegisterWrites(trace)}</span>
              <span className="flex-1 truncate text-alu">{describeMemory(trace)}</span>
              <span className="w-12 text-ctrl">
                {trace.execute ? formatConditionCodes(trace.execute.nextCC) : '···'}
              </span>
              <span className={cn('w-12', STAT_TONE[trace.statAfter] ?? 'text-ink-3')}>
                {trace.statAfter}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
