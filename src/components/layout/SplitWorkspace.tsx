import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { cn } from '../../lib/cn'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import {
  DEFAULT_SETTINGS,
  PANE_LIMITS,
  useSettingsStore,
  type PaneKey,
  type PaneSizes,
} from '../../store/settingsStore'

export interface SplitWorkspaceProps {
  left: ReactNode
  center: ReactNode
  right: ReactNode
  bottom: ReactNode
  leftLabel?: string
  rightLabel?: string
  bottomLabel?: string
}

type DragState = {
  key: PaneKey
  start: number
  base: number
  span: number
  axis: 'x' | 'y'
  /** 拖拽过程中的最新尺寸，只在这个 ref 里滚动更新，避免渲染期读写 ref */
  sizes: PaneSizes
}

/** 中央舞台的最小宽度：低于它，数据通路就糊了 */
const CENTER_MIN = 440

const AXIS: Record<PaneKey, 'x' | 'y'> = { left: 'x', right: 'x', bottom: 'y' }

/**
 * 三栏 + 底栏的可调工作区。
 *
 * 两个约束：
 * 1. 拖拽过程中只改本地尺寸，松手才写回 store —— 否则每一帧都往 localStorage 写一次。
 * 2. 尺寸上限跟容器宽度联动（最多占一半），所以窗口缩小时不会把中间舞台挤没。
 *
 * 窄屏（< 1280）直接放弃三栏，改成纵向堆叠：把三个面板压进 360px 宽，
 * 舞台就只剩一条缝，还不如让它单列占满。
 */
export function SplitWorkspace({
  left,
  center,
  right,
  bottom,
  leftLabel = '源码面板',
  rightLabel = '观察器面板',
  bottomLabel = '时间轴与日志面板',
}: SplitWorkspaceProps) {
  const isWide = useMediaQuery('(min-width: 1440px)')
  const storedLeft = useSettingsStore((s) => s.left)
  const storedRight = useSettingsStore((s) => s.right)
  const storedBottom = useSettingsStore((s) => s.bottom)
  const setPaneSize = useSettingsStore((s) => s.setPaneSize)

  const stored: PaneSizes = { left: storedLeft, right: storedRight, bottom: storedBottom }
  // 拖拽期间用 draft，松手后丢弃：常态下尺寸只有一个来源（store），不需要镜像同步
  const [draft, setDraft] = useState<PaneSizes | null>(null)
  const [dragging, setDragging] = useState<PaneKey | null>(null)
  const [span, setSpan] = useState(0)
  const shellRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const live = draft ?? stored

  // 容器宽度决定两侧面板能否按记录值摆放：中间舞台必须留够。
  // 读 DOM 尺寸只能发生在挂载后，这是布局测量，不是可以「推导」出来的状态。
  useEffect(() => {
    const element = shellRef.current
    if (!element) return
    // eslint-disable-next-line react/set-state-in-effect -- 首次挂载后测量容器宽度
    setSpan(element.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setSpan(width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const clamp = useCallback((key: PaneKey, value: number, span: number) => {
    const { min, max } = PANE_LIMITS[key]
    const dynamicMax = AXIS[key] === 'x' ? Math.min(max, Math.round(span * 0.5)) : max
    return Math.max(min, Math.min(dynamicMax, Math.round(value)))
  }, [])

  const startDrag = (key: PaneKey) => (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const rect = shellRef.current?.getBoundingClientRect()
    dragRef.current = {
      key,
      start: AXIS[key] === 'x' ? event.clientX : event.clientY,
      base: live[key],
      // 容器不可见时 rect 为 0：回落到一个典型宽度，避免把上限算成 0
      span: (AXIS[key] === 'x' ? rect?.width : rect?.height) || 1280,
      axis: AXIS[key],
      sizes: { ...live },
    }
    setDraft({ ...live })
    setDragging(key)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (event: globalThis.PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const current = drag.axis === 'x' ? event.clientX : event.clientY
      const delta = current - drag.start
      // 右栏与底栏的把手在它们的前缘，往左/上拖是变宽
      const raw = drag.key === 'left' ? drag.base + delta : drag.base - delta
      drag.sizes = { ...drag.sizes, [drag.key]: clamp(drag.key, raw, drag.span) }
      setDraft(drag.sizes)
    }
    const onUp = () => {
      const sizes = dragRef.current?.sizes
      if (sizes) {
        for (const key of ['left', 'right', 'bottom'] as PaneKey[]) {
          if (sizes[key] !== useSettingsStore.getState()[key]) setPaneSize(key, sizes[key])
        }
      }
      setDraft(null)
      setDragging(null)
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, clamp, setPaneSize])

  const nudge = (key: PaneKey) => (event: KeyboardEvent<HTMLDivElement>) => {
    const horizontal = AXIS[key] === 'x'
    const decrease = horizontal ? 'ArrowLeft' : 'ArrowUp'
    const increase = horizontal ? 'ArrowRight' : 'ArrowDown'
    if (event.key !== decrease && event.key !== increase) return
    event.preventDefault()
    const span = shellRef.current?.getBoundingClientRect().width || 1280
    // 右栏的把手在左缘：按左键应该变宽
    const outward = event.key === increase
    const step = key === 'right' ? (outward ? -16 : 16) : outward ? 16 : -16
    setPaneSize(key, clamp(key, live[key] + step, span))
  }

  const resetPane = (key: PaneKey) => () => {
    setPaneSize(key, DEFAULT_SETTINGS[key])
  }

  const handle = (key: PaneKey, label: string) => (
    <div
      role="separator"
      aria-orientation={AXIS[key] === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuenow={live[key]}
      aria-valuemin={PANE_LIMITS[key].min}
      aria-valuemax={PANE_LIMITS[key].max}
      tabIndex={0}
      onPointerDown={startDrag(key)}
      onKeyDown={nudge(key)}
      onDoubleClick={resetPane(key)}
      title={`${label}（拖动调整，双击复位）`}
      className={cn(
        'group relative z-20 flex shrink-0 items-center justify-center outline-none',
        AXIS[key] === 'x' ? 'w-1.5 cursor-col-resize' : 'h-1.5 w-full cursor-row-resize',
        'hover:bg-accent/5 focus-visible:bg-accent/10',
      )}
    >
      <span
        className={cn(
          'rounded-full bg-line-2 transition-colors',
          AXIS[key] === 'x' ? 'h-8 w-[2px]' : 'h-[2px] w-8',
          'group-hover:bg-accent/70 group-focus-visible:bg-accent',
          dragging === key && 'bg-accent',
        )}
      />
    </div>
  )

  if (!isWide) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <div className="h-[420px] shrink-0 border-b border-line/70">{center}</div>
        <div className="h-[340px] shrink-0 border-b border-line/70">{left}</div>
        <div className="shrink-0 border-b border-line/70">{right}</div>
        <div className="shrink-0">{bottom}</div>
      </div>
    )
  }

  // 窗口变窄时按比例收两侧，保证中间至少 440px；不改写用户存的尺寸
  const available = span || 1440
  const sides = live.left + live.right
  const roomForSides = Math.max(560, available - CENTER_MIN - 12)
  const ratio = sides > roomForSides ? roomForSides / sides : 1
  const leftWidth = Math.round(live.left * ratio)
  const rightWidth = Math.round(live.right * ratio)

  return (
    <div ref={shellRef} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <div style={{ width: leftWidth }} className="flex min-h-0 shrink-0 flex-col overflow-hidden">
          {left}
        </div>
        {handle('left', leftLabel)}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{center}</div>
        {handle('right', rightLabel)}
        <div style={{ width: rightWidth }} className="flex min-h-0 shrink-0 flex-col overflow-hidden">
          {right}
        </div>
      </div>
      {handle('bottom', bottomLabel)}
      <div style={{ height: live.bottom }} className="flex min-h-0 shrink-0 flex-col overflow-hidden">
        {bottom}
      </div>
    </div>
  )
}
