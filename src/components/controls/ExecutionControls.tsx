import { useEffect } from 'react'
import { Pause, Play, RotateCcw, SkipForward, StepBack, StepForward } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { formatCycle, useCpuStore, type SimulatorMode } from '../../store/cpuStore'
import { useSettingsStore, type AnimationSpeed } from '../../store/settingsStore'
import { Readout } from '../ui/Readout'
import { Segmented } from '../ui/Segmented'

interface ControlButtonProps {
  icon: typeof Play
  label: string
  hint: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}

function ControlButton({ icon: Icon, label, hint, onClick, disabled, active }: ControlButtonProps) {
  return (
    <span title={`${label} · ${hint}`}>
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
        <span className="hidden sm:inline">{label}</span>
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
          label="处理器模式"
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
            { value: 'SEQ', label: 'SEQ', title: '顺序执行：一个时钟周期执行一条完整指令' },
            { value: 'PIPE', label: 'PIPE', title: '打开 Pipeline Lab 查看五级流水线' },
          ]}
        />
      </div>

      <span className="h-5 w-px bg-line/80" aria-hidden="true" />

      <div className="flex items-center gap-1" role="group" aria-label="执行控制">
        <ControlButton
          icon={StepBack}
          label="回退"
          hint="恢复到上一条指令执行前的状态"
          onClick={stepBack}
          disabled={historyLength === 0 || isRunning}
        />
        <ControlButton
          icon={StepForward}
          label="单步"
          hint="执行一条指令"
          onClick={step}
          disabled={isRunning || terminated}
        />
        <ControlButton
          icon={Play}
          label="运行"
          hint="按当前速度连续执行"
          onClick={startRun}
          disabled={isRunning || terminated}
          active={isRunning}
        />
        <ControlButton
          icon={Pause}
          label="暂停"
          hint="停在当前指令之后"
          onClick={pause}
          disabled={!isRunning}
        />
        <ControlButton
          icon={SkipForward}
          label="跑完"
          hint="不带动画，直接执行到停机或异常"
          onClick={() => runToEnd()}
          disabled={isRunning || terminated}
        />
        <ControlButton
          icon={RotateCcw}
          label="重置"
          hint="清空寄存器、内存与执行历史"
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
          {engineReady ? 'engine ready' : 'no program'}
        </span>

        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">Speed</span>
          <Segmented<AnimationSpeed>
            label="动画速度"
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
