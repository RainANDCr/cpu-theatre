import { cn } from '../../lib/cn'
import type { StageName } from '../../core/execution/types'
import { useSettingsStore } from '../../store/settingsStore'
import {
  MODULE_DOCS,
  STAGE_HIGHLIGHTS,
  STAGE_JUNCTIONS,
  STAGE_MODULES,
  STAGE_VIEWBOX,
  STAGE_WIRES,
  type StageModuleId,
  type StageTone,
} from './stageModel'

const STROKE: Record<StageTone, string> = {
  bus: 'stroke-bus',
  ctrl: 'stroke-ctrl',
  reg: 'stroke-reg',
  alu: 'stroke-alu',
  slate: 'stroke-line-2',
}

const FILL: Record<StageTone, string> = {
  bus: 'fill-bus',
  ctrl: 'fill-ctrl',
  reg: 'fill-reg',
  alu: 'fill-alu',
  slate: 'fill-line-2',
}

const LEGEND: { tone: StageTone; label: string }[] = [
  { tone: 'bus', label: '数据 / 地址' },
  { tone: 'ctrl', label: '控制信号' },
  { tone: 'reg', label: '寄存器读写' },
  { tone: 'alu', label: 'ALU 结果' },
]

export interface CPUStageProps {
  selected: StageModuleId | null
  onSelect: (id: StageModuleId) => void
  /** 当前正在执行的阶段；由真实 trace 提供，不是动画脚本 */
  stage?: StageName | null
  className?: string
}

/**
 * 数据通路。
 *
 * 高亮完全由 `stage` 决定：它来自引擎这一拍实际走到的阶段。
 * 「数据在流动」的效果是 CSS 的虚线偏移动画——被点亮的线才动，
 * 没参与这一拍的线保持静止。这样看到的东西和真实执行永远一致。
 */
export function CPUStage({ selected, onSelect, stage = null, className }: CPUStageProps) {
  const highlight = stage ? STAGE_HIGHLIGHTS[stage] : null
  const activeModules = new Set<StageModuleId>(highlight?.modules ?? [])
  const activeWires = new Set<string>(highlight?.wires ?? [])
  // 减少动效时不放粒子：总线上还有虚线流动，信息不会丢
  const reduceMotion = useSettingsStore((state) => state.reduceMotion)

  return (
    <svg
      viewBox={`0 0 ${STAGE_VIEWBOX.width} ${STAGE_VIEWBOX.height}`}
      className={cn('mx-auto block h-full w-full max-w-[780px]', className)}
      role="group"
      aria-label="Y86-64 顺序执行数据通路"
    >
      <defs>
        {(Object.keys(STROKE) as StageTone[]).map((tone) => (
          <marker
            key={tone}
            id={`stage-arrow-${tone}`}
            viewBox="0 0 10 10"
            refX="8.5"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L9 5 L0 10 Z" className={FILL[tone]} />
          </marker>
        ))}
      </defs>

      {stage && (
        <text
          x={STAGE_VIEWBOX.width - 16}
          y={20}
          textAnchor="end"
          fontSize={9.5}
          letterSpacing={0.8}
          className="fill-accent font-mono"
        >
          ▸ {stage}
        </text>
      )}

      {/* 连线 */}
      <g>
        {STAGE_WIRES.map((wire) => {
          const live = activeWires.has(wire.id)
          return (
            <g key={wire.id}>
              <path
                d={wire.d}
                fill="none"
                strokeWidth={live ? 2 : 1.4}
                strokeDasharray={wire.dashed ? '4 4' : undefined}
                markerEnd={wire.arrow === false ? undefined : `url(#stage-arrow-${wire.tone})`}
                className={cn(
                  STROKE[wire.tone],
                  live ? 'trace-flow opacity-100' : 'opacity-50',
                )}
              />
              {live && !reduceMotion && (
                <>
                  {/* 粒子沿总线运动：位置由路径决定，颜色由数据类型决定 */}
                  <circle r={2.1} className={FILL[wire.tone]}>
                    <animateMotion dur="1.05s" repeatCount="indefinite" path={wire.d} />
                  </circle>
                  <circle r={1.3} className={FILL[wire.tone]} opacity={0.5}>
                    <animateMotion dur="1.05s" begin="0.52s" repeatCount="indefinite" path={wire.d} />
                  </circle>
                </>
              )}
              {wire.label && wire.labelAt && (
                <text
                  x={wire.labelAt[0]}
                  y={wire.labelAt[1]}
                  textAnchor={wire.anchor ?? 'middle'}
                  fontSize={8.2}
                  transform={
                    wire.vertical ? `rotate(-90 ${wire.labelAt[0]} ${wire.labelAt[1]})` : undefined
                  }
                  className={cn('font-mono', live ? 'fill-ink' : 'fill-ink-3')}
                >
                  {wire.label}
                </text>
              )}
            </g>
          )
        })}
      </g>

      {/* 总线汇合点 */}
      <g>
        {STAGE_JUNCTIONS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.4} className="fill-bus opacity-80" />
        ))}
      </g>

      {/* 硬件模块 */}
      <g>
        {STAGE_MODULES.map((module) => {
          const active = selected === module.id
          const live = activeModules.has(module.id)
          return (
            <g
              key={module.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`${module.title} · ${MODULE_DOCS[module.id].name}`}
              onClick={() => onSelect(module.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(module.id)
                }
              }}
              className="group cursor-pointer outline-none"
            >
              <rect
                x={module.x}
                y={module.y}
                width={module.w}
                height={module.h}
                rx={8}
                fillOpacity={active ? 0.1 : 1}
                strokeWidth={active ? 1.8 : live ? 1.6 : 1}
                className={cn(
                  'transition-colors',
                  active
                    ? 'fill-accent stroke-accent'
                    : live
                      ? 'fill-accent/[0.07] stroke-accent/75'
                      : 'fill-panel-2/70 stroke-line-2 group-hover:fill-panel-2 group-focus-visible:stroke-accent',
                )}
              />
              <rect
                x={module.x + 10}
                y={module.y + 9}
                width={16}
                height={2}
                rx={1}
                className={cn(active || live ? 'fill-accent' : FILL[module.tone], 'opacity-90')}
              />
              <text
                x={module.x + 10}
                y={module.y + (module.h < 60 ? 21 : 24)}
                fontSize={11}
                letterSpacing={0.2}
                className={cn('font-mono', active || live ? 'fill-accent' : 'fill-ink')}
              >
                {module.title}
              </text>
              <text
                x={module.x + 10}
                y={module.y + (module.h < 60 ? 33 : 38)}
                fontSize={8.2}
                className="fill-ink-3 font-mono"
              >
                {module.sub}
              </text>
            </g>
          )
        })}
      </g>

      {/* 图例 */}
      <g transform="translate(16, 362)">
        {LEGEND.map((item, index) => (
          <g key={item.tone} transform={`translate(${index * 132}, 0)`}>
            <circle cx={0} cy={-2.5} r={2.6} className={FILL[item.tone]} />
            <text x={9} y={0} fontSize={8.2} className="fill-ink-3 font-mono">
              {item.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}
