import { useEffect, useMemo } from 'react'
import { PackageCheck, Pause, Play, RotateCcw, SkipForward, StepForward } from 'lucide-react'
import { cn } from '../lib/cn'
import type { PipeSlot } from '../core/pipe/PIPEProcessor'
import { toHex } from '../core/cpu/word'
import { formatValue } from '../core/isa/format'
import { registerName } from '../core/isa/registers'
import { usePipeStore } from '../store/pipeStore'
import { useSettingsStore } from '../store/settingsStore'
import { Badge } from '../components/ui/Badge'
import { Readout } from '../components/ui/Readout'
import { T, useI18n } from '../i18n'
import { buttonClass } from '../components/ui/buttonStyles'

const STAGES = [
  { id: 'F', title: 'FETCH', tone: 'bus' },
  { id: 'D', title: 'DECODE', tone: 'reg' },
  { id: 'E', title: 'EXECUTE', tone: 'alu' },
  { id: 'M', title: 'MEMORY', tone: 'ctrl' },
  { id: 'W', title: 'WRITEBACK', tone: 'ok' },
] as const

/** 空态里代替假数据的说明：告诉用户这一段将来会显示什么 */
const STAGE_HINT: Record<string, { zh: string; en: string }> = {
  F: {
    zh: '按预测 PC 取 10 字节指令，产出 icode / ifun / valC / valP。',
    en: 'Fetch 10 bytes at the predicted PC; produce icode / ifun / valC / valP.',
  },
  D: {
    zh: '读寄存器文件，把操作数随指令一起锁进 D 寄存器。',
    en: 'Read the register file and latch operands into the D register.',
  },
  E: {
    zh: 'ALU 算结果与条件码；同时判断跳转是否真的发生。',
    en: 'The ALU computes value and flags, and decides whether the branch is really taken.',
  },
  M: {
    zh: '读或写数据内存；这里也是加载互锁被判定出来的地方。',
    en: 'Read or write data memory — and where the load-use interlock is detected.',
  },
  W: {
    zh: '把结果写回寄存器文件，指令在此退休。',
    en: 'Write the result back to the register file; the instruction retires here.',
  },
}

const TONE_RING: Record<string, string> = {
  bus: 'border-bus/40',
  reg: 'border-reg/40',
  alu: 'border-alu/40',
  ctrl: 'border-ctrl/40',
  ok: 'border-ok/40',
}

const TONE_TEXT: Record<string, string> = {
  bus: 'text-bus',
  reg: 'text-reg',
  alu: 'text-alu',
  ctrl: 'text-ctrl',
  ok: 'text-ok',
}

function reg(id: number): string {
  return registerName(id) ?? '·'
}

/** 每一段值得看的两三个字段。字段选得越少，越容易看出流水线在干什么。 */
function details(stage: string, slot: PipeSlot): Array<[string, string]> {
  if (slot.icode < 0) return []
  switch (stage) {
    case 'F':
      return [['PC', toHex(slot.predPC, 4)]]
    case 'D':
      return [
        ['srcA', reg(slot.srcA)],
        ['srcB', reg(slot.srcB)],
      ]
    case 'E':
      return [
        ['valE', formatValue(slot.valE)],
        ['dstE', reg(slot.dstE)],
        ['Cnd', slot.cnd ? '1' : '0'],
      ]
    case 'M':
      return [
        ['dstM', reg(slot.dstM)],
        ['valA', formatValue(slot.valA)],
      ]
    case 'W':
      return [
        ['dstE', reg(slot.dstE)],
        ['valE', formatValue(slot.valE)],
        ['valM', formatValue(slot.valM)],
      ]
    default:
      return []
  }
}

export default function PipelineLab() {
  const { t } = useI18n()
  const ready = usePipeStore((s) => s.ready)
  const cycle = usePipeStore((s) => s.cycle)
  const stat = usePipeStore((s) => s.stat)
  const slots = usePipeStore((s) => s.slots)
  const trace = usePipeStore((s) => s.trace)
  const traces = usePipeStore((s) => s.traces)
  const stats = usePipeStore((s) => s.stats)
  const isRunning = usePipeStore((s) => s.isRunning)
  const error = usePipeStore((s) => s.error)
  const load = usePipeStore((s) => s.load)
  const step = usePipeStore((s) => s.step)
  const runToEnd = usePipeStore((s) => s.runToEnd)
  const startRun = usePipeStore((s) => s.startRun)
  const pause = usePipeStore((s) => s.pause)
  const reset = usePipeStore((s) => s.reset)

  const speed = useSettingsStore((s) => s.animationSpeed)

  useEffect(() => {
    if (!isRunning) return
    const timer = window.setInterval(step, Math.round(420 / speed))
    return () => window.clearInterval(timer)
  }, [isRunning, speed, step])

  const cpi = stats.instructions > 0 ? stats.cycles / stats.instructions : 0
  const terminated = stat === 'HLT' || stat === 'ADR' || stat === 'INS'

  const hazard = useMemo(() => {
    if (!trace) return null
    if (trace.stall)
      return {
        tone: 'text-alu',
        label: 'STALL',
        detail: t('加载/使用冒险：暂停取指与译码', 'load/use hazard: fetch and decode hold'),
      }
    if (trace.bubble)
      return {
        tone: 'text-ctrl',
        label: 'BUBBLE',
        detail: t('分支预测失败：丢弃已取指令', 'mispredicted branch: fetched work is discarded'),
      }
    if (trace.forwarding.a || trace.forwarding.b)
      return {
        tone: 'text-ok',
        label: 'FORWARD',
        detail: `${t('转发', 'forward')} ${[trace.forwarding.a ? 'A' : '', trace.forwarding.b ? 'B' : ''].filter(Boolean).join('+')}`,
      }
    return null
  }, [trace, t])

  return (
    <div className="flex h-[calc(100dvh-84px)] min-h-[540px] flex-col overflow-hidden">
      <h1 className="sr-only">
        {t('Pipeline Lab · 五级流水线', 'Pipeline Lab · five-stage pipeline')}
      </h1>

      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b border-line/80 bg-shell/40 px-3 py-1.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">PIPE</span>
        <Badge tone="purple">5-stage</Badge>
        <span className="h-5 w-px bg-line/80" aria-hidden="true" />

        <div className="flex items-center gap-1" role="group" aria-label={t('流水线控制', 'Pipeline controls')}>
          <button type="button" onClick={() => load()} className={buttonClass({ variant: 'subtle', size: 'sm' })}>
            <PackageCheck size={12} />
            <T zh="装载" en="Load" />
          </button>
          <button
            type="button"
            onClick={step}
            disabled={isRunning || terminated}
            className={buttonClass({ variant: 'subtle', size: 'sm' })}
          >
            <StepForward size={12} />
            <T zh="下一拍" en="Next cycle" />
          </button>
          <button
            type="button"
            onClick={startRun}
            disabled={isRunning || terminated}
            className={buttonClass({ variant: 'primary', size: 'sm' })}
          >
            <Play size={12} />
            <T zh="运行" en="Run" />
          </button>
          <button
            type="button"
            onClick={pause}
            disabled={!isRunning}
            className={buttonClass({ variant: 'subtle', size: 'sm' })}
          >
            <Pause size={12} />
            <T zh="暂停" en="Pause" />
          </button>
          <button
            type="button"
            onClick={runToEnd}
            disabled={isRunning || terminated}
            className={buttonClass({ variant: 'subtle', size: 'sm' })}
          >
            <SkipForward size={12} />
            <T zh="跑完" en="Run to end" />
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={!ready}
            className={buttonClass({ variant: 'ghost', size: 'sm' })}
          >
            <RotateCcw size={12} />
            <T zh="复位" en="Reset" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hazard && (
            <span className={cn('hidden font-mono text-[9px] tracking-[0.12em] xl:inline', hazard.tone)}>
              {hazard.label} · {hazard.detail}
            </span>
          )}
          <Readout label="CPI" value={cpi > 0 ? cpi.toFixed(2) : '—'} tone="amber" />
          <Readout label="Stall" value={String(stats.stalls)} tone="cyan" />
          <Readout label="Bubble" value={String(stats.bubbles)} tone="purple" />
          <Readout label="Fwd" value={String(stats.forwards)} tone="green" />
          <Readout label="Cycle" value={String(cycle)} tone="cyan" />
        </div>
      </div>

      {error && (
        <div className="shrink-0 border-b border-err/30 bg-err/[0.07] px-3 py-1 font-mono text-[10px] text-err">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {STAGES.map((stage) => {
            const detail = slots.find((item) => item.stage === stage.id)
            const empty = !detail || detail.slot.icode < 0
            return (
              <div
                key={stage.id}
                className={cn(
                  'flex min-h-0 flex-col rounded-xl border bg-panel/50',
                  TONE_RING[stage.tone],
                  empty && 'border-dashed opacity-80',
                )}
              >
                <div className="flex shrink-0 items-center justify-between border-b border-line/60 px-2.5 py-1.5">
                  <span className={cn('font-mono text-[10px] tracking-[0.14em]', TONE_TEXT[stage.tone])}>
                    {stage.id} · {stage.title}
                  </span>
                  <span className="font-mono text-[9px] text-ink-3/60">
                    {detail?.slot.stat && detail.slot.stat !== 'AOK' ? detail.slot.stat : ''}
                  </span>
                </div>

                <div className="flex min-h-0 flex-1 flex-col items-start gap-1 px-2.5 py-3">
                  {!ready ? (
                    <p className="text-[11px] leading-relaxed text-ink-3/70"><T zh={STAGE_HINT[stage.id]?.zh ?? ''} en={STAGE_HINT[stage.id]?.en ?? ''} /></p>
                  ) : empty ? (
                    <span className="font-mono text-[11px] italic text-ink-3/50">bubble</span>
                  ) : (
                    <>
                      <span className="break-all font-mono text-[11px] leading-snug text-ink">
                        {detail.text}
                      </span>
                      <dl className="mt-1 space-y-0.5">
                        {details(stage.id, detail.slot).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-baseline justify-between gap-2 font-mono text-[9.5px]"
                          >
                            <dt className="text-ink-3/70">{key}</dt>
                            <dd className="truncate text-ink-2">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="shrink-0 rounded-xl border border-line/80 bg-panel/40 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-3">
              Cycle log
            </span>
            <span className="font-mono text-[9px] text-ink-3/60">
              {traces.length === 0 ? t('尚未开始', 'not started') : `${traces.length} ${t('拍', 'cycles')}`}
            </span>
            <div className="ml-auto flex items-center gap-1 overflow-x-auto no-scrollbar">
              {traces.slice(-24).map((item) => (
                <span
                  key={item.cycle}
                  title={`T${item.cycle}${item.stall ? ' · stall' : ''}${item.bubble ? ' · bubble' : ''}`}
                  className={cn(
                    'flex h-6 w-8 shrink-0 items-center justify-center rounded border font-mono text-[9px] tabnums',
                    item.stall
                      ? 'border-alu/50 bg-alu/10 text-alu'
                      : item.bubble
                        ? 'border-ctrl/50 bg-ctrl/10 text-ctrl'
                        : 'border-line-2 bg-panel/60 text-ink-2',
                  )}
                >
                  {item.cycle}
                </span>
              ))}
            </div>
          </div>

          {trace ? (
            <p className="mt-1.5 truncate font-mono text-[9.5px] text-ink-3">
              {t('本拍', 'this cycle')}: new PC {toHex(trace.newPc, 4)}
              {trace.written.length > 0 &&
                ` · ${t('写回', 'write-back')} ${trace.written.map((w) => `${reg(w.register)}=${formatValue(w.value)}`).join(' ')}`}
              {trace.memory &&
                ` · ${trace.memory.kind === 'write' ? 'W' : 'R'} ${toHex(trace.memory.address, 4)}=${formatValue(trace.memory.value)}`}
            </p>
          ) : (
            <p className="mt-1.5 font-mono text-[9.5px] text-ink-3/60">
              {t(
                '程序取自 Instruction Editor。点「装载」把当前源码装进流水线。',
                'Source comes from Instruction Editor. Press Load to push it into the pipeline.',
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
