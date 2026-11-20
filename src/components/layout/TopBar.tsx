import { Link, useLocation } from 'react-router-dom'
import { Menu, Settings } from 'lucide-react'
import { NAV_MODULES, findModuleByPath } from '../../config/nav'
import { cn } from '../../lib/cn'
import { isFault } from '../../core/cpu/Status'
import { formatCycle, formatPc, useCpuStore } from '../../store/cpuStore'
import { usePipeStore } from '../../store/pipeStore'
import { Readout } from '../ui/Readout'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { useUiStore } from '../../store/uiStore'

const ENGINE_LABEL: Record<string, string> = {
  offline: 'OFFLINE',
  idle: 'READY',
  running: 'RUNNING',
  paused: 'PAUSED',
  halted: 'HALTED',
  fault: 'FAULT',
}

export function TopBar() {
  const pathname = useLocation().pathname
  const module = findModuleByPath(pathname)
  const moduleIndex = NAV_MODULES.findIndex((item) => item.id === module.id) + 1

  const seqMode = useCpuStore((state) => state.mode)
  const engineState = useCpuStore((state) => state.engineState)
  const engineReady = useCpuStore((state) => state.engineReady)
  const seqCycle = useCpuStore((state) => state.cycle)
  const seqPc = useCpuStore((state) => state.pc)

  // 流水线实验室跑的是另一台引擎：顶栏必须读它自己的状态，
  // 否则页面上五列都在动、右上角却写着 OFFLINE / CYCLE —（这是截图里抓到的真问题）
  const isPipeline = pathname.startsWith('/pipeline')
  const pipeReady = usePipeStore((state) => state.ready)
  const pipeCycle = usePipeStore((state) => state.cycle)
  const pipeStat = usePipeStore((state) => state.stat)

  const mode = isPipeline ? 'PIPE' : seqMode
  const ready = isPipeline ? pipeReady : engineReady
  const cycle = isPipeline ? (pipeReady ? pipeCycle : null) : seqCycle
  const pc = isPipeline ? null : seqPc

  const isWide = useMediaQuery('(min-width: 1024px)')
  const navOpen = useUiStore((state) => state.mobileNavOpen)
  const toggleNav = useUiStore((state) => state.toggleMobileNav)

  const statusLabel = isPipeline
    ? !pipeReady
      ? 'OFFLINE'
      : pipeStat === 'HLT'
        ? 'HALTED'
        : isFault(pipeStat)
          ? 'FAULT'
          : 'READY'
    : engineReady
      ? ENGINE_LABEL[engineState]
      : 'OFFLINE'

  const engineTone = isPipeline
    ? pipeStat === 'HLT'
      ? 'green'
      : isFault(pipeStat)
        ? 'red'
        : 'slate'
    : engineState === 'running'
      ? 'green'
      : engineState === 'fault'
        ? 'red'
        : engineState === 'paused'
          ? 'amber'
          : 'slate'

  return (
    <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b border-line/80 bg-void/60 px-4 backdrop-blur-xl lg:gap-4 lg:px-6">
      {!isWide && (
        <button
          type="button"
          onClick={toggleNav}
          aria-label={navOpen ? '关闭模块导航' : '打开模块导航'}
          aria-expanded={navOpen}
          aria-controls="mobile-nav"
          className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg border border-line/80 text-ink-2 transition-colors hover:border-accent/40 hover:text-accent"
        >
          <Menu size={16} strokeWidth={1.9} />
        </button>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-3">
          <span className="hidden whitespace-nowrap sm:inline">
            Module {String(moduleIndex).padStart(2, '0')}
          </span>
          <span className="hidden text-line-2 sm:inline">/</span>
          <span className="whitespace-nowrap text-ink-2">{module.label}</span>
          <span className="hidden text-line-2 md:inline">/</span>
          <span className="hidden whitespace-nowrap text-ink-3 md:inline">{module.labelZh}</span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-ink-3">{module.blurb}</div>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <Readout label="Mode" value={mode} tone="purple" className="hidden md:flex" />
        <Readout
          label="Status"
          value={statusLabel}
          tone={engineTone as 'green' | 'red' | 'amber' | 'slate'}
          muted={!ready}
          className="hidden sm:flex"
        />
        <Readout label="Cycle" value={formatCycle(cycle)} tone="cyan" muted={cycle === null} />
        <Readout label="PC" value={formatPc(pc)} tone="blue" muted={pc === null} className="hidden lg:flex" />

        <Link
          to="/settings"
          aria-label="打开设置"
          title="设置"
          className={cn(
            'ml-1 flex size-8 items-center justify-center rounded-lg border border-line/80 text-ink-3 transition-colors hover:border-accent/40 hover:text-accent',
            pathname.startsWith('/settings') && 'border-accent/40 text-accent',
          )}
        >
          <Settings size={15} strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  )
}
