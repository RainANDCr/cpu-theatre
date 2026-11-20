import { useState } from 'react'
import { T, useI18n } from '../../i18n'
import type { Memory } from '../../core/cpu/Memory'
import { asWord, type Word } from '../../core/cpu/word'
import { cn } from '../../lib/cn'

const ROWS = 14
const COLS = 8

export interface MemoryPanelProps {
  memory?: Memory | null
  /** 自动跟随的地址（通常是 PC）：窗口会把它放进视野 */
  anchor?: Word | null
  /** 本拍读写的起始地址，高亮它所在的 8 个字节 */
  highlight?: Word | null
  className?: string
}

function parseAddress(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const value = /^0x/i.test(trimmed) ? Number.parseInt(trimmed.slice(2), 16) : Number.parseInt(trimmed, 10)
  return Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * 内存观察器。
 *
 * 默认跟随 PC：程序跑起来之后，用户最想看的是「现在取指的位置附近」，
 * 而不是永远停在 0x0000。手动跳转一次就切到固定窗口，不再被 PC 拽走。
 */
export function MemoryPanel({ memory = null, anchor = null, highlight = null, className }: MemoryPanelProps) {
  const { t } = useI18n()
  const [manualBase, setManualBase] = useState(0)
  const [follow, setFollow] = useState(true)
  const [jumpText, setJumpText] = useState('')

  const anchorNumber = anchor === null ? 0 : Number(asWord(anchor))
  const followBase = Math.max(0, anchorNumber - anchorNumber % COLS - 4 * COLS)
  const start = follow ? followBase : manualBase

  const bytes = (address: number): number | null => (memory ? memory.peekByte(address) : null)

  const jump = () => {
    const address = parseAddress(jumpText)
    if (address === null) return
    setManualBase(address - (address % COLS))
    setFollow(false)
    setJumpText('')
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex shrink-0 items-center gap-1.5 border-b border-line/70 px-2 py-1.5">
        <input
          value={jumpText}
          onChange={(event) => setJumpText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') jump()
          }}
          aria-label={t('跳转地址', 'Jump to address')}
          placeholder="0x0000"
          className="h-6 w-[74px] rounded border border-line/80 bg-void/50 px-1.5 font-mono text-[10px] text-ink placeholder:text-ink-3/50 focus:border-accent/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={jump}
          className="h-6 rounded border border-line/80 px-2 font-mono text-[10px] text-ink-2 transition-colors hover:border-accent/40 hover:text-accent"
        >
          <T zh="跳转" en="Go" />
        </button>
        <button
          type="button"
          onClick={() => setFollow((value) => !value)}
          aria-pressed={follow}
          className={cn(
            'h-6 rounded border px-2 font-mono text-[10px] transition-colors',
            follow
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-line/80 text-ink-3 hover:text-ink-2',
          )}
        >
          <T zh="跟随 PC" en="Follow PC" />
        </button>
        <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-ink-3/70">
          64 KiB · LE
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse font-mono text-[10.5px]">
          {/* 固定列宽：否则 w-full 会把余量全塞给地址列和 ASCII 列，字节挤成一坨 */}
          <colgroup>
            <col className="w-14" />
            {Array.from({ length: COLS }).map((_, col) => (
              <col key={col} className="w-7" />
            ))}
            <col />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-shell/95 backdrop-blur">
            <tr>
              <th className="px-2 py-1 text-left text-[9px] font-normal uppercase tracking-[0.12em] text-ink-3">
                Addr
              </th>
              {Array.from({ length: COLS }).map((_, col) => (
                <th
                  key={col}
                  className="w-6 px-0.5 py-1 text-center text-[9px] font-normal text-ink-3/80"
                >
                  {col.toString(16).toUpperCase().padStart(2, '0')}
                </th>
              ))}
              <th className="px-2 py-1 text-left text-[9px] font-normal uppercase tracking-[0.12em] text-ink-3">
                ASCII
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }).map((_, row) => {
              const rowAddress = start + row * COLS
              const isAnchorRow =
                anchor !== null && anchorNumber >= rowAddress && anchorNumber < rowAddress + COLS
              return (
                <tr
                  key={rowAddress}
                  className={cn(
                    'border-t border-line/30',
                    isAnchorRow && 'bg-accent/[0.06]',
                  )}
                >
                  <td className="whitespace-nowrap px-2 py-[3px] text-ink-3/80">
                    0x{rowAddress.toString(16).toUpperCase().padStart(4, '0')}
                  </td>
                  {Array.from({ length: COLS }).map((_, col) => {
                    const address = rowAddress + col
                    const value = bytes(address)
                    const isHighlighted =
                      highlight !== null &&
                      address >= Number(highlight) &&
                      address < Number(highlight) + 8
                    return (
                      <td
                        key={col}
                        className={cn(
                          'px-0.5 py-[3px] text-center',
                          value === null
                            ? 'text-ink-3/35'
                            : isHighlighted
                              ? 'bg-alu/20 text-alu'
                              : value === 0
                                ? 'text-ink-3/45'
                                : 'text-ink',
                        )}
                      >
                        {value === null ? '··' : value.toString(16).toUpperCase().padStart(2, '0')}
                      </td>
                    )
                  })}
                  <td className="truncate px-2 py-[3px] text-ink-3/60">
                    {Array.from({ length: COLS }, (_, col) => {
                      const value = bytes(rowAddress + col)
                      if (value === null) return '·'
                      return value >= 0x20 && value <= 0x7e ? String.fromCharCode(value) : '.'
                    }).join('')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="shrink-0 border-t border-line/60 px-2.5 py-1.5 text-[10px] leading-relaxed text-ink-3">
        {memory
          ? t(
              '字节按小端序显示：一个字的最低位在最低地址。本拍访存的 8 个字节以橙色标出。',
              'Bytes are little-endian: the least significant byte sits at the lowest address. The 8 bytes touched this cycle are marked in amber.',
            )
          : t(
              '尚未装载程序。装载后这里显示真实内存内容。',
              'No program loaded. Real memory contents appear here after loading.',
            )}
      </p>
    </div>
  )
}
