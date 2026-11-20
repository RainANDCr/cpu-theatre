import { create } from 'zustand'
import { assemble } from '../core/assembler/assembler'
import { isFault, type Stat } from '../core/cpu/Status'
import {
  PIPEProcessor,
  type PipeCycleTrace,
  type PipeSlotView,
  type PipeStats,
} from '../core/pipe/PIPEProcessor'
import { useEditorStore } from './editorStore'

export interface PipeUiState {
  ready: boolean
  cycle: number
  stat: Stat
  slots: PipeSlotView[]
  trace: PipeCycleTrace | null
  traces: PipeCycleTrace[]
  stats: PipeStats
  isRunning: boolean
  error: string | null
  loadedSource: string | null

  load: (source?: string) => boolean
  step: () => void
  runToEnd: () => void
  startRun: () => void
  pause: () => void
  reset: () => void
  getProcessor: () => PIPEProcessor | null
}

const EMPTY_STATS: PipeStats = { cycles: 0, instructions: 0, stalls: 0, bubbles: 0, forwards: 0 }

let engine: PIPEProcessor | null = null

function sync(set: (partial: Partial<PipeUiState>) => void, get: () => PipeUiState): void {
  if (!engine) return
  const traces = engine.cycleTraces
  const last = traces.length > 0 ? traces[traces.length - 1]! : null
  set({
    ready: true,
    cycle: engine.currentCycle,
    stat: engine.currentStat,
    // 有轨迹时用轨迹里的五列（本拍视角），否则用当前寄存器
    slots: last ? last.slots : engine.slotViews(),
    trace: last,
    traces: [...traces],
    stats: { ...engine.statistics },
    isRunning: isFault(engine.currentStat) ? false : get().isRunning,
  })
}

export const usePipeStore = create<PipeUiState>()((set, get) => ({
  ready: false,
  cycle: 0,
  stat: 'AOK',
  slots: [],
  trace: null,
  traces: [],
  stats: EMPTY_STATS,
  isRunning: false,
  error: null,
  loadedSource: null,

  load: (source) => {
    const text = source ?? useEditorStore.getState().source
    const result = assemble(text)
    if (!result.ok) {
      engine = null
      set({
        ready: false,
        error: result.diagnostics.find((d) => d.severity === 'error')?.message ?? '汇编失败',
        traces: [],
        slots: [],
        trace: null,
        cycle: 0,
        stat: 'AOK',
        stats: EMPTY_STATS,
        isRunning: false,
        loadedSource: null,
      })
      return false
    }
    engine = new PIPEProcessor({ image: result.image })
    set({ loadedSource: text, error: null, isRunning: false, traces: [] })
    sync(set, get)
    return true
  },

  step: () => {
    if (!engine) {
      if (!get().load()) return
    }
    if (!engine) return
    engine.step()
    sync(set, get)
  },

  runToEnd: () => {
    if (!engine && !get().load()) return
    if (!engine) return
    engine.run()
    set({ isRunning: false })
    sync(set, get)
  },

  startRun: () => {
    if (!engine && !get().load()) return
    if (isFault(get().stat) || get().stat === 'HLT') return
    set({ isRunning: true })
  },

  pause: () => set({ isRunning: false }),

  reset: () => {
    if (!engine) return
    engine.reset()
    set({ isRunning: false })
    sync(set, get)
  },

  getProcessor: () => engine,
}))
