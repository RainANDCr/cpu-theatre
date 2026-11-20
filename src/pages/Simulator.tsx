import { useMemo, useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { ExecutionControls } from '../components/controls/ExecutionControls'
import { AssemblyEditor } from '../components/editor/AssemblyEditor'
import { PaneHeader } from '../components/layout/PaneHeader'
import { SplitWorkspace } from '../components/layout/SplitWorkspace'
import { MemoryPanel } from '../components/memory/MemoryPanel'
import { FlagPanel, RegisterTable } from '../components/registers/RegisterPanel'
import { CPUStage } from '../components/stage/CPUStage'
import { ModuleInspector } from '../components/stage/ModuleInspector'
import { StageRibbon } from '../components/stage/StageRibbon'
import type { StageModuleId } from '../components/stage/stageModel'
import { CycleTimeline } from '../components/timeline/CycleTimeline'
import { ExecutionLog } from '../components/timeline/ExecutionLog'
import { Badge } from '../components/ui/Badge'
import { Tabs } from '../components/ui/Tabs'
import { useStagePlayback } from '../hooks/useStagePlayback'
import { useCpuStore } from '../store/cpuStore'
import { useEditorStore } from '../store/editorStore'

type ObserverTab = 'registers' | 'memory'

/* 顶栏 56 + 状态条 28 + 控制栏 48 = 132，工作区正好占满剩余高度 */
const WORKSPACE_HEIGHT = 'h-[calc(100dvh-132px)]'

export default function Simulator() {
  const source = useEditorStore((state) => state.source)
  const setSource = useEditorStore((state) => state.setSource)

  const registers = useCpuStore((s) => s.registers)
  const cc = useCpuStore((s) => s.cc)
  const status = useCpuStore((s) => s.status)
  const pc = useCpuStore((s) => s.pc)
  const trace = useCpuStore((s) => s.trace)
  const history = useCpuStore((s) => s.history)
  const error = useCpuStore((s) => s.error)
  const engineReady = useCpuStore((s) => s.engineReady)
  const loadedSource = useCpuStore((s) => s.loadedSource)
  const ensureLoaded = useCpuStore((s) => s.ensureLoaded)
  const getMemory = useCpuStore((s) => s.getMemory)
  const rewindTo = useCpuStore((s) => s.rewindTo)
  const isRunning = useCpuStore((s) => s.isRunning)
  const addressToLine = useCpuStore((s) => s.addressToLine)
  const breakpoints = useCpuStore((s) => s.breakpoints)
  const toggleBreakpointAtLine = useCpuStore((s) => s.toggleBreakpointAtLine)

  const [selectedModule, setSelectedModule] = useState<StageModuleId | null>('alu')
  const [tab, setTab] = useState<ObserverTab>('registers')

  const memory = getMemory()
  const changed = useMemo(
    () => new Set(trace?.registerWrites.map((write) => write.register) ?? []),
    [trace],
  )
  const stale = engineReady && loadedSource !== source
  const memoryAnchor = trace?.memory?.address ?? pc

  // 阶段播放：连续运行时压缩每阶段时长，否则动画追不上指令节奏
  const playback = useStagePlayback(trace, isRunning ? 80 : 150)

  const activeLine = pc === null ? null : (addressToLine.get(Number(pc)) ?? null)
  const breakpointLines = useMemo(
    () =>
      breakpoints
        .map((address) => addressToLine.get(address))
        .filter((line): line is number => line !== undefined),
    [breakpoints, addressToLine],
  )

  return (
    <div className={`flex ${WORKSPACE_HEIGHT} min-h-[540px] flex-col overflow-hidden`}>
      {/* 工作台没有可见大标题，但每个页面仍需要一个 h1 供读屏与语义使用 */}
      <h1 className="sr-only">CPU Simulator · Y86-64 顺序执行数据通路</h1>
      <ExecutionControls />

      {error && (
        <div className="flex shrink-0 items-center gap-2 border-b border-err/30 bg-err/[0.07] px-3 py-1 font-mono text-[10px] text-err">
          <span className="uppercase tracking-[0.14em]">assemble/exec</span>
          <span className="truncate">{error}</span>
        </div>
      )}

      <SplitWorkspace
        left={
          <div className="flex min-h-0 flex-1 flex-col bg-abyss/40">
            <PaneHeader
              title="Source"
              meta="program.y86"
              actions={
                <>
                  <Badge tone={stale ? 'amber' : engineReady ? 'green' : 'slate'}>
                    {stale ? 'stale' : engineReady ? 'loaded' : '未装载'}
                  </Badge>
                  {breakpoints.length > 0 && (
                    <Badge tone="red">{breakpoints.length} bp</Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => ensureLoaded()}
                    className="inline-flex h-6 items-center gap-1 rounded border border-line-2 px-1.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-2 transition-colors hover:border-accent/45 hover:text-accent"
                  >
                    <PackageCheck size={11} />
                    装载
                  </button>
                </>
              }
            />
            <div className="min-h-0 flex-1">
              <AssemblyEditor
                value={source}
                onChange={setSource}
                onSubmit={() => ensureLoaded()}
                breakpointLines={breakpointLines}
                activeLine={activeLine}
                onToggleBreakpointLine={toggleBreakpointAtLine}
                ariaLabel="Y86-64 源码"
              />
            </div>
            <div className="flex h-7 shrink-0 items-center justify-between border-t border-line/70 px-2.5 font-mono text-[9.5px] text-ink-3">
              <span className="tabnums">{source.replace(/\n$/, '').split('\n').length} lines</span>
              <span className="text-ink-3/60">点行号下断点 · Ctrl+Enter 装载</span>
            </div>
          </div>
        }
        center={
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line/70 bg-shell/30 px-2.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-3">
                SEQ data path
              </span>
              <Badge tone={trace ? 'green' : 'slate'}>
                {trace ? (playback.stage ?? 'live') : 'idle'}
              </Badge>
              <span className="ml-auto hidden font-mono text-[9px] text-ink-3/60 sm:inline">
                点击模块查看输入输出
              </span>
            </div>
            <div className="min-h-0 flex-1 p-1.5">
              <CPUStage
                selected={selectedModule}
                onSelect={setSelectedModule}
                stage={playback.stage}
              />
            </div>
            <StageRibbon stages={trace?.stages ?? []} current={playback.stage} />
            <ModuleInspector moduleId={selectedModule} trace={trace} />
          </div>
        }
        right={
          <div className="flex min-h-0 flex-1 flex-col bg-abyss/30">
            <Tabs<ObserverTab>
              label="观察器"
              value={tab}
              onChange={setTab}
              items={[
                { value: 'registers', label: 'Registers' },
                { value: 'memory', label: 'Memory' },
              ]}
            />
            {tab === 'registers' ? (
              <div
                role="tabpanel"
                aria-label="寄存器"
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <RegisterTable values={registers} changed={changed} className="min-h-0 flex-1" />
                <FlagPanel cc={cc} stat={status} className="shrink-0 border-t border-line/70" />
              </div>
            ) : (
              <div
                role="tabpanel"
                aria-label="内存"
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
              >
                <MemoryPanel
                  memory={memory}
                  anchor={memoryAnchor}
                  highlight={trace?.memory?.address ?? null}
                  className="min-h-0 flex-1"
                />
              </div>
            )}
          </div>
        }
        bottom={
          <div className="flex min-h-0 flex-1 flex-col bg-abyss/20">
            <CycleTimeline history={history} onSeek={rewindTo} />
            <ExecutionLog history={history} onSelect={rewindTo} position={history.length} />
          </div>
        }
      />
    </div>
  )
}
