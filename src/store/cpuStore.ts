import { create } from 'zustand'
import { assemble, type AssembleResult } from '../core/assembler/assembler'
import type { ConditionCodes } from '../core/cpu/ConditionCodes'
import type { Memory } from '../core/cpu/Memory'
import { isFault, type Stat } from '../core/cpu/Status'
import { toHex, type Word } from '../core/cpu/word'
import { SEQProcessor, type InstructionTrace } from '../core/seq/SEQProcessor'
import { useEditorStore } from './editorStore'

/** 处理器实现模式：顺序（SEQ）或流水线（PIPE） */
export type SimulatorMode = 'SEQ' | 'PIPE'

/** 程序员可见的处理器状态码。别名指向 core，不在这里另立一份 */
export type ProcessorStatus = Stat

/**
 * 引擎生命周期。注意它与 ProcessorStatus 是两件事：
 * AOK/HLT 属于「处理器说什么」，running/paused 属于「引擎在不在跑」。
 */
export type EngineState = 'offline' | 'idle' | 'running' | 'paused' | 'halted' | 'fault'

export interface EngineSnapshot {
  cycle: number
  pc: Word
  status: ProcessorStatus
  engineState: EngineState
  lastInstruction: string | null
}

export interface CpuUiState {
  mode: SimulatorMode
  engineState: EngineState
  /** 是否已装载可执行的程序（不是「引擎代码存在」，是「有程序在里面」） */
  engineReady: boolean
  cycle: number | null
  pc: Word | null
  status: ProcessorStatus | null
  lastInstruction: string | null
  registers: Word[] | null
  cc: ConditionCodes | null
  /** 最近一条指令的完整阶段记录 */
  trace: InstructionTrace | null
  /** 全部已执行指令的阶段记录（只增不减，回退时截断） */
  history: InstructionTrace[]
  /** 装载或执行失败的原因 */
  error: string | null
  isRunning: boolean
  loadedSource: string | null
  /** 当前程序里 PC 地址 → 源码行号 */
  addressToLine: Map<number, number>
  breakpoints: number[]

  setMode: (mode: SimulatorMode) => void
  applyEngineSnapshot: (snapshot: EngineSnapshot) => void
  /** 装载已汇编的程序 */
  loadProgram: (result: AssembleResult, source: string) => void
  /** 若源码变了或尚未装载，则重新汇编并装载。返回是否可执行 */
  ensureLoaded: () => boolean
  step: () => void
  runToEnd: (limit?: number) => void
  startRun: () => void
  pause: () => void
  reset: () => void
  stepBack: () => void
  rewindTo: (count: number) => void
  toggleBreakpoint: (pc: number) => void
  /** 按源码行号切换断点（编辑器沟槽点一下就是这条） */
  toggleBreakpointAtLine: (line: number) => void
  /** 下一条要执行的指令是否正好是断点 */
  atBreakpoint: () => boolean
  /** 只读地拿到引擎内存，供内存观察器渲染。UI 不得写入。 */
  getMemory: () => Memory | null
  clear: () => void
}

/** 引擎实例放在模块作用域：它是可变的执行机器，不该被 React 的渲染流程碰 */
let engine: SEQProcessor | null = null

function syncFromEngine(
  set: (partial: Partial<CpuUiState>) => void,
  get: () => CpuUiState,
): void {
  if (!engine) return
  const snapshot = engine.snapshot()
  const entries = engine.historyEntries
  const trace = entries.length > 0 ? entries[entries.length - 1]!.trace : null
  const terminal = snapshot.stat === 'HLT' || isFault(snapshot.stat)

  set({
    engineReady: true,
    engineState:
      snapshot.stat === 'HLT'
        ? 'halted'
        : isFault(snapshot.stat)
          ? 'fault'
          : get().isRunning
            ? 'running'
            : 'paused',
    cycle: snapshot.cycle,
    pc: snapshot.pc,
    status: snapshot.stat,
    registers: snapshot.registers,
    cc: snapshot.cc,
    trace,
    history: entries.map((entry) => entry.trace),
    lastInstruction: trace?.text ?? null,
    error: trace && trace.stages.length < 6 ? trace.fetch.message : null,
    isRunning: terminal ? false : get().isRunning,
  })
}

export const useCpuStore = create<CpuUiState>()((set, get) => ({
  mode: 'SEQ',
  engineState: 'offline',
  engineReady: false,
  cycle: null,
  pc: null,
  status: null,
  lastInstruction: null,
  registers: null,
  cc: null,
  trace: null,
  history: [],
  error: null,
  isRunning: false,
  loadedSource: null,
  addressToLine: new Map<number, number>(),
  breakpoints: [],

  setMode: (mode) => {
    if (mode === get().mode) return
    engine = null
    set({
      mode,
      engineState: 'offline',
      engineReady: false,
      cycle: null,
      pc: null,
      status: null,
      lastInstruction: null,
      registers: null,
      cc: null,
      trace: null,
      history: [],
      error: null,
      isRunning: false,
      loadedSource: null,
      addressToLine: new Map<number, number>(),
      breakpoints: [],
    })
  },

  applyEngineSnapshot: (snapshot) =>
    set({
      engineReady: true,
      cycle: snapshot.cycle,
      pc: snapshot.pc,
      status: snapshot.status,
      engineState: snapshot.engineState,
      lastInstruction: snapshot.lastInstruction,
    }),

  loadProgram: (result, source) => {
    if (!result.ok) {
      engine = null
      set({
        engineReady: false,
        engineState: 'offline',
        error: result.diagnostics.find((d) => d.severity === 'error')?.message ?? '汇编失败',
        history: [],
        trace: null,
        registers: null,
        cc: null,
        cycle: null,
        pc: null,
        status: null,
        loadedSource: null,
      })
      return
    }
    engine = new SEQProcessor({ image: result.image })
    set({
      loadedSource: source,
      addressToLine: result.addressToLine,
      error: null,
      isRunning: false,
    })
    syncFromEngine(set, get)
  },

  ensureLoaded: () => {
    const source = useEditorStore.getState().source
    if (engine && get().loadedSource === source) return true

    const result = assemble(source)
    if (!result.ok) {
      get().loadProgram(result, source)
      return false
    }
    get().loadProgram(result, source)
    return true
  },

  step: () => {
    // 必须无条件检查：引擎存在但源码已改时，继续跑就是跑旧机器码
    if (!get().ensureLoaded()) return
    if (!engine) return
    const result = engine.step()
    if (!result.executed) {
      set({ isRunning: false })
      syncFromEngine(set, get)
      return
    }
    syncFromEngine(set, get)
  },

  runToEnd: (limit = 10_000) => {
    if (!get().ensureLoaded()) return
    if (!engine) return
    engine.run(limit)
    set({ isRunning: false })
    syncFromEngine(set, get)
  },

  startRun: () => {
    if (!get().ensureLoaded()) return
    const stat = get().status
    if (stat === 'HLT' || (stat && isFault(stat))) return
    // 正停在断点上：先跨过它，否则「运行」会原地不动
    if (get().atBreakpoint()) get().step()
    set({ isRunning: true, engineState: 'running' })
  },

  pause: () => set({ isRunning: false, engineState: get().status === 'AOK' ? 'paused' : get().engineState }),

  reset: () => {
    if (!engine) {
      set({ engineState: 'offline', history: [], trace: null })
      return
    }
    engine.reset()
    set({ isRunning: false })
    syncFromEngine(set, get)
  },

  stepBack: () => {
    if (!engine) return
    engine.stepBack()
    set({ isRunning: false })
    syncFromEngine(set, get)
  },

  rewindTo: (count) => {
    if (!engine) return
    engine.rewindTo(count)
    set({ isRunning: false })
    syncFromEngine(set, get)
  },

  toggleBreakpoint: (pc) =>
    set((state) => ({
      breakpoints: state.breakpoints.includes(pc)
        ? state.breakpoints.filter((value) => value !== pc)
        : [...state.breakpoints, pc].sort((a, b) => a - b),
    })),

  toggleBreakpointAtLine: (line) => {
    // 装载前 addressToLine 是空的。此时点行号如果什么都不做，用户会以为「断点没用」——
    // 所以先汇编一次，让断点有一个地址可落。
    if (get().addressToLine.size === 0 && !get().ensureLoaded()) return

    for (const [address, sourceLine] of get().addressToLine) {
      if (sourceLine === line) {
        get().toggleBreakpoint(address)
        return
      }
    }
  },

  atBreakpoint: () => {
    const { pc, breakpoints } = get()
    return pc !== null && breakpoints.includes(Number(pc))
  },

  getMemory: () => engine?.memory ?? null,

  clear: () => {
    engine = null
    set({
      engineState: 'offline',
      engineReady: false,
      cycle: null,
      pc: null,
      status: null,
      lastInstruction: null,
      registers: null,
      cc: null,
      trace: null,
      history: [],
      error: null,
      isRunning: false,
      loadedSource: null,
      addressToLine: new Map<number, number>(),
      breakpoints: [],
    })
  },
}))

export const PLACEHOLDER = '—'

/** PC 用 8 位十六进制显示足够覆盖教学程序的地址空间，又不至于把顶栏撑爆 */
export function formatPc(pc: Word | null, digits = 8): string {
  return pc === null ? PLACEHOLDER : toHex(pc, digits)
}

export function formatCycle(cycle: number | null): string {
  return cycle === null ? PLACEHOLDER : String(cycle)
}
