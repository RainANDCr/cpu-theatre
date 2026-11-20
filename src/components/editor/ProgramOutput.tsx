import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { AssembleResult } from '../../core/assembler/assembler'
import type { Diagnostic } from '../../core/isa/diagnostics'
import { formatAddress, formatBytes } from '../../core/isa/format'
import { asSigned } from '../../core/cpu/word'
import { cn } from '../../lib/cn'
import { Tabs } from '../ui/Tabs'

export type OutputTab = 'listing' | 'symbols' | 'diagnostics'

const TABS = [
  { value: 'listing' as const, label: 'Listing' },
  { value: 'symbols' as const, label: 'Symbols' },
  { value: 'diagnostics' as const, label: 'Diagnostics' },
]

export interface ProgramOutputProps {
  result: AssembleResult | null
  /** 结果是否已因源码改动而过期 */
  stale?: boolean
  /**
   * 由外部控制当前标签页：汇编成功跳到 Listing、失败跳到 Diagnostics
   * 是「动作」的一部分，用 effect 同步反而会多渲染一帧。
   */
  tab: OutputTab
  onTabChange: (tab: OutputTab) => void
  className?: string
}

/**
 * 汇编输出面板：编码表 / 符号表 / 诊断。
 *
 * 三件事分三个标签页，而不是堆成一列——汇编失败时用户只关心诊断，
 * 汇编成功时只关心编码，同时显示两者等于都不突出。
 */
export function ProgramOutput({
  result,
  stale = false,
  tab,
  onTabChange,
  className,
}: ProgramOutputProps) {
  const errorCount = result?.diagnostics.filter((d) => d.severity === 'error').length ?? 0
  const warningCount = result?.diagnostics.filter((d) => d.severity === 'warning').length ?? 0

  const items = useMemo(
    () =>
      TABS.map((item) => ({
        ...item,
        badge:
          item.value === 'diagnostics' && result && result.diagnostics.length > 0 ? (
            <span
              className={cn(
                'ml-1.5 rounded-full px-1 font-mono text-[9px] leading-[14px]',
                errorCount > 0 ? 'bg-err/20 text-err' : 'bg-warn/20 text-warn',
              )}
            >
              {errorCount + warningCount}
            </span>
          ) : null,
      })),
    [result, errorCount, warningCount],
  )

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col border-t border-line/80 bg-shell/45',
        className,
      )}
      aria-label="汇编输出"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line/60 pr-3">
        <Tabs
          value={tab}
          items={items}
          onChange={onTabChange}
          label="汇编输出视图"
          className="border-b-0"
        />
        <div className="flex shrink-0 items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-3">
          {result ? (
            <>
              <span>{result.instructions.length} ins</span>
              {result.data.length > 0 && (
                <>
                  <span className="text-line-2">·</span>
                  <span>{result.data.length} dat</span>
                </>
              )}
              <span className="text-line-2">·</span>
              <span>{result.codeLength} B</span>
              <span className="text-line-2">·</span>
              <span className={result.ok ? 'text-ok' : 'text-err'}>
                {result.ok ? 'ok' : `${errorCount} err`}
              </span>
              {stale && (
                <>
                  <span className="text-line-2">·</span>
                  <span className="text-warn">stale</span>
                </>
              )}
            </>
          ) : (
            <span>idle</span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!result ? (
          <EmptyOutput />
        ) : tab === 'listing' ? (
          <ListingTable result={result} />
        ) : tab === 'symbols' ? (
          <SymbolTable result={result} />
        ) : (
          <DiagnosticList diagnostics={result.diagnostics} />
        )}
      </div>
    </section>
  )
}

function EmptyOutput() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-8 text-center">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-3">not compiled</p>
        <p className="mt-2 max-w-md text-[11.5px] leading-relaxed text-ink-3">
          按 <kbd className="rounded border border-line-2 px-1 font-mono text-[10px]">Ctrl</kbd>+
          <kbd className="rounded border border-line-2 px-1 font-mono text-[10px]">Enter</kbd>{' '}
          或点工具栏的「汇编」，这里会列出每条指令的地址、长度与机器码。
        </p>
      </div>
    </div>
  )
}

function ListingTable({ result }: { result: AssembleResult }) {
  if (result.listing.length === 0) {
    return <Notice>程序里没有可汇编的指令。</Notice>
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead className="sticky top-0 z-10 bg-shell/95 backdrop-blur">
        <tr className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
          <th className="w-[74px] py-1.5 pl-3 font-normal">addr</th>
          <th className="w-[38px] font-normal">len</th>
          <th className="w-[228px] font-normal">bytes</th>
          <th className="w-[46px] font-normal">line</th>
          <th className="pr-3 font-normal">instruction</th>
        </tr>
      </thead>
      <tbody>
        {result.listing.map((entry) => {
          const row = entry.kind === 'instruction' ? entry.instruction : entry.data
          const isData = entry.kind === 'data'
          return (
            <tr
              key={`${row.address}-${row.line}`}
              className={cn(
                'border-t border-line/40',
                row.valid ? 'hover:bg-white/[0.02]' : 'bg-err/[0.06]',
                isData && 'bg-bus/[0.05]',
              )}
            >
              <td className="py-1 pl-3 font-mono text-[10.5px] text-bus">
                {formatAddress(row.address)}
              </td>
              <td className="font-mono text-[10px] text-ink-3">{row.length}</td>
              <td className="font-mono text-[10px] text-alu">
                {/* 10 字节整条显示：立即数被截掉会让「编码对不对」无从核对 */}
                {row.valid && row.length > 0 ? formatBytes(row.bytes, 10) : '—'}
              </td>
              <td className="font-mono text-[10px] text-ink-3">L{row.line}</td>
              <td className="py-1 pr-3 font-mono text-[11px] text-ink">
                {row.text}
                {entry.kind === 'instruction' && entry.instruction.symbol && (
                  <span className="ml-2 text-[9.5px] text-ink-3">
                    → {entry.instruction.symbol}
                  </span>
                )}
                {isData && (
                  <>
                    {entry.data.symbols.some((symbol) => symbol !== null) && (
                      <span className="ml-2 text-[9.5px] text-ink-3">
                        → {entry.data.symbols.filter(Boolean).join(', ')}
                      </span>
                    )}
                    <span className="ml-2 rounded bg-bus/15 px-1 font-mono text-[9px] uppercase tracking-[0.1em] text-bus">
                      data
                    </span>
                  </>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function SymbolTable({ result }: { result: AssembleResult }) {
  if (result.labels.length === 0) {
    return <Notice>这段程序没有定义标签。</Notice>
  }

  return (
    <table className="w-full border-collapse text-left">
      <thead className="sticky top-0 z-10 bg-shell/95 backdrop-blur">
        <tr className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
          <th className="w-[180px] py-1.5 pl-3 font-normal">label</th>
          <th className="w-[92px] font-normal">address</th>
          <th className="w-[70px] font-normal">decimal</th>
          <th className="pr-3 font-normal">defined at</th>
        </tr>
      </thead>
      <tbody>
        {result.labels.map((label) => (
          <tr key={label.name} className="border-t border-line/40">
            <td className="py-1 pl-3 font-mono text-[11px] text-ctrl">{label.name}</td>
            <td className="font-mono text-[10.5px] text-bus">{formatAddress(label.address)}</td>
            <td className="font-mono text-[10px] text-ink-3">
              {asSigned(label.address).toString(10)}
            </td>
            <td className="pr-3 font-mono text-[10px] text-ink-3">L{label.line}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function DiagnosticList({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-3 text-[11.5px] text-ok">
        <CheckCircle2 size={13} />
        汇编通过，没有错误或警告。
      </div>
    )
  }

  return (
    <ul>
      {diagnostics.map((diagnostic, index) => {
        const isError = diagnostic.severity === 'error'
        return (
          <li
            key={`${diagnostic.line}-${diagnostic.code}-${index}`}
            className="flex gap-2.5 border-b border-line/40 px-3 py-1.5"
          >
            <span className={isError ? 'mt-0.5 text-err' : 'mt-0.5 text-warn'}>
              {isError ? <XCircle size={12} /> : <AlertTriangle size={12} />}
            </span>
            <span className="mt-0.5 w-8 shrink-0 font-mono text-[10px] text-ink-3">
              {diagnostic.line > 0 ? `L${diagnostic.line}` : '—'}
            </span>
            <div className="min-w-0">
              <p className={cn('text-[11.5px] leading-snug', isError ? 'text-ink' : 'text-ink-2')}>
                {diagnostic.message}
              </p>
              {diagnostic.hint && (
                <p className="mt-0.5 text-[10.5px] leading-snug text-ink-3">{diagnostic.hint}</p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function Notice({ children }: { children: string }) {
  return <p className="px-3 py-3 text-[11.5px] text-ink-3">{children}</p>
}
