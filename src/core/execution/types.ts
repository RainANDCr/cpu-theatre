/**
 * 六阶段的输出类型。
 *
 * 每个阶段都是一个纯函数：拿到上游产物，返回自己的输出，不碰处理器状态。
 * 这样做的直接好处是——每个阶段都能单独测，而且 Phase 4 的动画可以
 * 直接消费这些结构，不需要再从状态反推「刚才发生了什么」。
 */
import type { ConditionCodes } from '../cpu/ConditionCodes'
import type { Stat } from '../cpu/Status'
import type { Word } from '../cpu/word'
import type { InstructionSpec } from '../isa/instructions'
import type { AluOp } from './alu'

export type StageName = 'FETCH' | 'DECODE' | 'EXECUTE' | 'MEMORY' | 'WRITEBACK' | 'PC_UPDATE'

export interface FetchStage {
  ok: boolean
  /** 取指失败时直接给出 Stat（INS / ADR） */
  status: Stat
  message: string | null
  icode: number
  ifun: number
  rA: number
  rB: number
  valC: Word
  valP: Word
  spec: InstructionSpec | null
  length: number
}

export interface DecodeStage {
  srcA: number
  srcB: number
  valA: Word
  valB: Word
  /** 候选写回目标；cmov 是否真的写要等执行阶段的条件判断 */
  dstE: number
  dstM: number
}

export interface ExecuteStage {
  aluA: Word
  aluB: Word
  aluOp: AluOp | null
  valE: Word
  /** 条件是否成立（仅 cmov / jXX 有意义） */
  cnd: boolean
  setCC: boolean
  nextCC: ConditionCodes
  /** 已应用 cnd 的最终写回目标 */
  dstE: number
}

export interface MemoryStage {
  kind: 'none' | 'read' | 'write'
  address: Word | null
  writeValue: Word | null
  readValue: Word | null
  /** 写操作前该地址的旧值：Step Back 靠它把内存改回去 */
  previous: Word | null
  status: Stat
  message: string | null
}

export interface WritebackStage {
  dstE: number
  dstM: number
  valE: Word | null
  valM: Word | null
}

export type PcUpdateReason = 'sequential' | 'jump' | 'call' | 'ret' | 'halt'

export interface PcUpdateStage {
  nextPc: Word
  reason: PcUpdateReason
  /** 跳转条件是否成立（非 jXX 恒为 true） */
  taken: boolean
}
