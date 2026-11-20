import { useEffect } from 'react'
import { Pause, Play, RotateCcw, SkipForward, StepBack, StepForward } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { formatCycle, useCpuStore, type SimulatorMode } from '../../store/cpuStore'
import { useSettingsStore, type AnimationSpeed } from '../../store/settingsStore'
import { Readout } from '../ui/Readout'
import { Segmented } from '../ui/Segmented'
import { T, useI18n } from '../../i18n'

interface ControlButtonProps {
  icon: typeof Play
  /** 两种语言的标签与提示；aria-label 取当前语言，不用双语拼串（朗读器会念两遍） */
  labelZh: string
  labelEn: string
  hintZh: string
  hintEn: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}

function ControlButton({
  icon: Icon,
  labelZh,
  labelEn,
  hintZh,
  hintEn,
  onClick,
  disabled,
  active,
}: ControlButtonProps) {
  const { t } = useI18n()
  const label = t(labelZh, labelEn)
  return (
    <span title={`${label} · ${t(hintZh, hintEn)}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] transition-colors',
          active
            ? 'border-accent/60 bg-accent/15 text-accent'
            : 'border-line/80 bg-panel/50 text-ink-2 hover:border-line-2 hover:text-ink',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
      >
        <Icon size={13.5} strokeWidth={1.9} />
        <span className="hidden sm:inline">
          <T zh={labelZh} en={labelEn} />
        </span>
      </button>
    </span>
  )
}

export function ExecutionControls() {
  const mode = useCpuStore((s) => s.mode)
  const setMode = useCpuStore((s) => s.setMode)
  const cycle = useCpuStore((s) => s.cycle)
  const engineReady = useCpuStore((s) => s.engineReady)
  const isRunning = useCpuStore((s) => s.isRunning)
  const historyLength = useCpuStore((s) => s.history.length)
  const status = useCpuStore((s) => s.status)

  const step = useCpuStore((s) => s.step)
  const stepBack = useCpuStore((s) => s.stepBack)
  const startRun = useCpuStore((s) => s.startRun)
  const pause = useCpuStore((s) => s.pause)
  const reset = useCpuStore((s) => s.reset)
  const runToEnd = useCpuStore((s) => s.runToEnd)

  const speed = useSettingsStore((s) => s.animationSpeed)
  const setSpeed = useSettingsStore((s) => s.setAnimationSpeed)
  const navigate = useNavigate()
  const { t } = useI18n()

  const terminated = status === 'HLT' || status === 'ADR' || status === 'INS'

  // 运行循环：节奏由设置决定，结果仍然来自引擎的 step()。
  // 每拍之前检查断点——「停在断点」是执行语义，不是界面装饰。
  useEffect(() => {
    if (!isRunning) return
    const delay = Math.round(520 / speed)
    const tick = () => {
      const state = useCpuStore.getState()
      if (state.atBreakpoint()) {
        state.pause()
        return
      }
      state.step()
    }
    tick()
    const timer = window.setInterval(tick, delay)
    return () => window.clearInterval(timer)
  }, [isRunning, speed])

  return (
    <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line/80 bg-shell/40 px-3">
      <div className="flex items-center gap-2">
        <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3 md:inline">
          Mode
        </span>
        <Segmented<SimulatorMode>
          label={t('处理器模式', 'Processor mode')}
          value={mode}
          onChange={(next) => {
            // PIPE 有独立的五级流水线视图，切过去比在这里塞两套界面更清楚
            if (next === 'PIPE') {
              navigate('/pipeline')
              return
            }
            setMode(next)
          }}
          options={[
            {
              value: 'SEQ',
              label: 'SEQ',
              title: t(
                '顺序执行：一个时钟周期执行一条完整指令',
                'Sequential: one complete instruction per clock cycle',
              ),
            },
            {
              value: 'PIPE',
              label: 'PIPE',
              title: t('打开 Pipeline Lab 查看五级流水线', 'Open Pipeline Lab for the five-stage pipeline'),
            },
          ]}
        />
      </div>

      <span className="h-5 w-px bg-line/80" aria-hidden="true" />

      <div className="flex items-center gap-1" role="group" aria-label={t('执行控制', 'Execution controls')}>
        <ControlButton
          icon={StepBack}
          labelZh="回退"
          labelEn="Step back"
          hintZh="恢复到上一条指令执行前的状态"
          hintEn="Restore the state before the last instruction"
          onClick={stepBack}
          disabled={historyLength === 0 || isRunning}
        />
        <ControlButton
          icon={StepForward}
          labelZh="单步"
          labelEn="Step"
          hintZh="执行一条指令"
          hintEn="Execute one instruction"
          onClick={step}
          disabled={isRunning || terminated}
        />
        <ControlButton
          icon={Play}
          labelZh="运行"
          labelEn="Run"
          hintZh="按当前速度连续执行"
          hintEn="Run continuously at the current speed"
          onClick={startRun}
          disabled={isRunning || terminated}
          active={isRunning}
        />
        <ControlButton
          icon={Pause}
          labelZh="暂停"
          labelEn="Pause"
          hintZh="停在当前指令之后"
          hintEn="Stop after the current instruction"
          onClick={pause}
          disabled={!isRunning}
        />
        <ControlButton
          icon={SkipForward}
          labelZh="跑完"
          labelEn="Run to end"
          hintZh="不带动画，直接执行到停机或异常"
          hintEn="Execute to halt or fault without animation"
          onClick={() => runToEnd()}
          disabled={isRunning || terminated}
        />
        <ControlButton
          icon={RotateCcw}
          labelZh="重置"
          labelEn="Reset"
          hintZh="清空寄存器、内存与执行历史"
          hintEn="Clear registers, memory and history"
          onClick={reset}
          disabled={!engineReady}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span
          className={cn(
            'hidden items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] lg:flex',
            engineReady ? 'text-ok' : 'text-alu',
          )}
        >
          <span className={cn('size-1 rounded-full', engineReady ? 'bg-ok' : 'bg-alu')} aria-hidden />
          {engineReady ? t('引擎就绪', 'engine ready') : t('未装载程序', 'no program')}
        </span>

        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">Speed</span>
          <Segmented<AnimationSpeed>
            label={t('动画速度', 'Animation speed')}
            value={speed}
            onChange={setSpeed}
            options={[
              { value: 0.5, label: '0.5×' },
              { value: 1, label: '1×' },
              { value: 2, label: '2×' },
            ]}
          />
        </div>

        <Readout label="Cycle" value={formatCycle(cycle)} tone="cyan" muted={cycle === null} />
      </div>
    </div>
  )
}
