import { create } from 'zustand'
import { assemble, type AssembleResult } from '../core/assembler/assembler'

export interface ProgramState {
  /** 最近一次汇编结果（含机器码、列表、符号、诊断） */
  result: AssembleResult | null
  /** 生成该结果时的源码。用来判断结果是否已经过期 */
  assembledSource: string | null
  assemble: (source: string) => AssembleResult
  clear: () => void
}

/**
 * 存的是「程序」而不是「CPU 状态」：汇编结果是静态产物，UI 读它不会
 * 影响模拟器内部状态。Phase 3 的引擎从 image 装载，而不是从源码现编，
 * 这样「看到的机器码」与「执行的机器码」永远是同一份。
 */
export const useProgramStore = create<ProgramState>()((set) => ({
  result: null,
  assembledSource: null,

  assemble: (source) => {
    const result = assemble(source)
    set({ result, assembledSource: source })
    return result
  },

  clear: () => set({ result: null, assembledSource: null }),
}))
