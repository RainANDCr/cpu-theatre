import { Link, NavLink, useLocation } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV_MODULES, findModuleByPath } from '../../config/nav'
import { cn } from '../../lib/cn'
import { useCpuStore } from '../../store/cpuStore'
import { usePipeStore } from '../../store/pipeStore'
import { isFault } from '../../core/cpu/Status'
import { useSettingsStore } from '../../store/settingsStore'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { ChipMark } from './ChipMark'

export interface SidebarProps {
  /** rail = 常驻栏（桌面）；drawer = 窄屏抽屉里的那一份 */
  variant?: 'rail' | 'drawer'
  /** 抽屉里点链接后要收起，由外层决定「收起」意味着什么 */
  onNavigate?: () => void
}

export function Sidebar({ variant = 'rail', onNavigate }: SidebarProps) {
  const pathname = useLocation().pathname
  const activeModule = findModuleByPath(pathname)
  const storedCollapsed = useSettingsStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useSettingsStore((state) => state.toggleSidebar)
  const isWide = useMediaQuery('(min-width: 1024px)')
  // 1500 以下自动收成图标栏：数据通路需要横向空间，工作台优先于导航文字
  const isRoomForLabels = useMediaQuery('(min-width: 1500px)')
  const isDrawer = variant === 'drawer'
  // 抽屉里永远展开：它就是「展开态」本身
  const collapsed = isDrawer ? false : storedCollapsed || !isWide || !isRoomForLabels
  /** 窄屏是强制收起，此时不该给一个点了没反应的按钮 */
  const canToggle = !isDrawer && isWide && isRoomForLabels

  return (
    <aside
      className={cn(
        'relative z-20 flex h-full shrink-0 flex-col border-r border-line/80 bg-shell/75 backdrop-blur-xl transition-[width] duration-300 ease-out',
        isDrawer ? 'w-full' : collapsed ? 'w-[78px]' : 'w-[258px]',
        // 小于 1024 时常驻栏让位给抽屉，否则会白白吃掉 78px 的内容宽度
        !isDrawer && 'hidden lg:flex',
      )}
      aria-label={isDrawer ? '模块导航（抽屉）' : '模块导航'}
    >
      <Link
        to="/"
        onClick={onNavigate}
        className={cn(
          'flex h-16 items-center gap-3 border-b border-line/70 px-4 transition-colors hover:bg-white/[0.02]',
          collapsed && 'justify-center px-0',
        )}
      >
        <ChipMark size={collapsed ? 30 : 34} />
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold tracking-[0.16em] text-ink">
              CPU THEATRE
            </div>
            <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-3">
              Y86-64 visual lab
            </div>
          </div>
        )}
      </Link>

      <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 py-3">
        {NAV_MODULES.map((module, index) => {
          const isActive = module.id === activeModule.id
          const Icon = module.icon
          return (
            <NavLink
              key={module.id}
              to={module.path}
              end={module.path === '/'}
              title={collapsed ? `${module.label} · ${module.labelZh}` : undefined}
              aria-current={isActive ? 'page' : undefined}
              onClick={onNavigate}
              className={cn(
                'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] transition-colors',
                isActive
                  ? 'bg-accent/[0.09] text-ink'
                  : 'text-ink-3 hover:bg-white/[0.035] hover:text-ink-2',
                collapsed && 'justify-center px-0',
              )}
            >
              <span
                className={cn(
                  'absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-accent transition-opacity duration-200',
                  isActive ? 'opacity-100' : 'opacity-0',
                )}
                aria-hidden="true"
              />
              <Icon
                size={16}
                strokeWidth={1.7}
                className={cn('shrink-0', isActive ? 'text-accent' : 'text-ink-3')}
              />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{module.label}</span>
                  <span className="font-mono text-[9.5px] tabnums text-ink-3/70">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="space-y-2 border-t border-line/70 p-2.5">
        {!collapsed && <EngineCard />}
        {canToggle && (
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[11px] text-ink-3 transition-colors hover:bg-white/[0.04] hover:text-ink-2',
            collapsed && 'justify-center px-0',
          )}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          title={collapsed ? '展开侧栏' : '收起侧栏'}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          {!collapsed && <span>收起侧栏</span>}
        </button>
        )}
      </div>
    </aside>
  )
}

/**
 * 侧栏底部的小状态卡。它读的是真实引擎状态——
 * 「有没有装载程序」「跑到第几拍」都必须和顶栏一致，不能各说各话。
 */
function EngineCard() {
  const pathname = useLocation().pathname
  const isPipeline = pathname.startsWith('/pipeline')

  const seqReady = useCpuStore((state) => state.engineReady)
  const engineState = useCpuStore((state) => state.engineState)
  const seqCycle = useCpuStore((state) => state.cycle)
  const seqRunning = useCpuStore((state) => state.isRunning)

  const pipeReady = usePipeStore((state) => state.ready)
  const pipeCycle = usePipeStore((state) => state.cycle)
  const pipeStat = usePipeStore((state) => state.stat)
  const pipeRunning = usePipeStore((state) => state.isRunning)

  // 侧栏状态卡和顶栏一样，必须跟着当前页面的引擎走
  const engineReady = isPipeline ? pipeReady : seqReady
  const cycle = isPipeline ? pipeCycle : seqCycle
  const running = isPipeline ? pipeRunning : seqRunning || engineState === 'running'
  const halted = isPipeline ? pipeStat === 'HLT' : engineState === 'halted'
  const fault = isPipeline ? isFault(pipeStat) : engineState === 'fault'
  const engineName = isPipeline ? 'PIPE' : 'SEQ'

  const title = running
    ? 'Engine running'
    : halted
      ? 'Program halted'
      : fault
        ? 'Program fault'
        : engineReady
          ? 'Program loaded'
          : 'No program'

  const dot = running || halted ? 'bg-ok' : fault ? 'bg-err' : engineReady ? 'bg-accent' : 'bg-alu'

  return (
    <div className="rounded-lg border border-line/80 bg-panel/50 px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span
          className={cn('size-1.5 rounded-full', dot, running && 'animate-pulse-soft')}
          aria-hidden="true"
        />
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-2">{title}</span>
      </div>
      <p className="mt-1 text-[10.5px] leading-snug text-ink-3">
        {engineReady
          ? `${engineName} · cycle ${cycle ?? 0}${halted ? ' · 已停机' : ''}`
          : isPipeline
            ? '在 Pipeline Lab 里点「装载」即可开始。'
            : '在 CPU Simulator 里点「单步」即可装载并执行。'}
      </p>
    </div>
  )
}
