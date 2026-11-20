import { useState } from 'react'
import type { ConditionCodes } from '../../core/cpu/ConditionCodes'
import type { Stat } from '../../core/cpu/Status'
import { toBin, toDec, toHex, type Word } from '../../core/cpu/word'
import { REGISTER_NAMES } from '../../core/isa/registers'
import { cn } from '../../lib/cn'

const EMPTY = '—'

export interface RegisterTableProps {
  /** 未装载时为 null：显示破折号而不是 0 */
  values?: readonly Word[] | null
  /** 本拍发生变化的寄存器编号 */
  changed?: ReadonlySet<number>
  className?: string
}

/**
 * 15 个通用寄存器。行序即 ISA 编码序（%rax=0 … %r14=14），不是字母序——
 * 按字母排会让人记错编号。
 *
 * 十六进制默认省掉前导零：`0x1E` 比 `0x000000000000001E` 好读得多。
 * 完整 64 位在选中后的位模式栏里给出，那里才需要对齐。
 */
export function RegisterTable({ values = null, changed, className }: RegisterTableProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const selectedValue = selected !== null && values ? values[selected] ?? null : null

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="grid shrink-0 grid-cols-[auto_1fr_96px] items-center gap-2 border-b border-line/70 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
        <span className="w-3">#</span>
        <span>Register</span>
        <span className="text-right">Hex</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {REGISTER_NAMES.map((name, index) => {
          const active = selected === index
          const value = values ? values[index] ?? 0n : null
          const isChanged = changed?.has(index) ?? false
          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(active ? null : index)}
              className={cn(
                'grid w-full grid-cols-[auto_1fr_96px] items-center gap-2 px-2.5 py-[3px] text-left font-mono text-[11px] transition-colors',
                active ? 'bg-accent/10' : 'hover:bg-white/[0.03]',
                isChanged && !active && 'bg-ok/[0.07]',
              )}
            >
              <span className="w-3 text-[9px] tabnums text-ink-3/60">{index}</span>
              <span className={cn(active ? 'text-accent' : 'text-reg')}>{name}</span>
              <span
                className={cn(
                  'truncate text-right text-[10.5px]',
                  value === null
                    ? 'text-ink-3/60'
                    : isChanged
                      ? 'text-ok'
                      : 'text-ink',
                )}
                title={value === null ? undefined : toHex(value)}
              >
                {value === null ? EMPTY : toHex(value, 1)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="shrink-0 border-t border-line/70 px-2.5 py-2">
        <div className="flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3">
          <span>{selected === null ? 'Bin' : `${REGISTER_NAMES[selected]} · bin`}</span>
          <span className="normal-case tracking-normal text-ink-3/60">
            {selectedValue === null
              ? '选中一行查看位模式'
              : `${toDec(selectedValue)} · ${toHex(selectedValue)}`}
          </span>
        </div>
        <div className="mt-1 truncate font-mono text-[10px] text-ink-3/80" aria-label="位模式">
          {selectedValue === null ? EMPTY : toBin(selectedValue)}
        </div>
      </div>
    </div>
  )
}

const FLAGS = [
  { id: 'ZF' as const, hint: '结果为零' },
  { id: 'SF' as const, hint: '结果为负' },
  { id: 'OF' as const, hint: '有符号溢出' },
]

const STAT_TONE: Record<Stat, string> = {
  AOK: 'text-ok',
  HLT: 'text-alu',
  ADR: 'text-err',
  INS: 'text-err',
}

/** 条件码与状态码。它们是程序员可见状态的一部分，但不属于通用寄存器。 */
export function FlagPanel({
  cc = null,
  stat = null,
  className,
}: {
  cc?: ConditionCodes | null
  stat?: Stat | null
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5 p-2', className)}>
      <div className="grid grid-cols-3 gap-1.5">
        {FLAGS.map((flag) => {
          const on = cc ? cc[flag.id] : null
          return (
            <div
              key={flag.id}
              className={cn(
                'rounded-md border px-2 py-1.5 transition-colors',
                on ? 'border-ok/40 bg-ok/10' : 'border-line/80 bg-panel/50',
              )}
              title={flag.hint}
            >
              <div className="font-mono text-[9px] tracking-[0.16em] text-ctrl">{flag.id}</div>
              <div
                className={cn(
                  'mt-0.5 font-mono text-[13px] leading-none',
                  on === null ? 'text-ink-3/60' : on ? 'text-ok' : 'text-ink-2',
                )}
              >
                {on === null ? EMPTY : on ? '1' : '0'}
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-md border border-line/80 bg-panel/50 px-2 py-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">Stat</span>
          <span
            className={cn(
              'font-mono text-[11px]',
              stat === null ? 'text-ink-3/60' : STAT_TONE[stat],
            )}
          >
            {stat ?? EMPTY}
          </span>
        </div>
        <p className="mt-1 text-[9.5px] leading-relaxed text-ink-3/70">
          AOK 正常 · HLT 停机 · ADR 地址异常 · INS 非法指令
        </p>
      </div>
    </div>
  )
}
