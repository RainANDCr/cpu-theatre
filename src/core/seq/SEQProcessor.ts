/**
 * SEQ：教材第 4.3 节的顺序实现。
 *
 * 一条指令 = 六个阶段依次通过，一拍完成。没有流水线寄存器，
 * 所以「当前状态」就是全部状态：PC、寄存器、条件码、Stat、内存。
 *
 * 设计上只做两件事：把六个纯函数串起来，以及记录**可回滚**的历史。
 * 回滚不重放指令，而是保存每步之前的快照 + 内存写入的旧值——
 * 重放一旦与原路径有任何偏差，Step Back 就会静默走到另一条历史上去。
 */
import { RESET_CC, type ConditionCodes } from '../cpu/ConditionCodes'
import { Memory, DEFAULT_MEMORY_SIZE } from '../cpu/Memory'
import { RegisterFile } from '../cpu/RegisterFile'
import { isTerminal, type Stat } from '../cpu/Status'
import { asWord, type Word } from '../cpu/word'
import { formatInstruction } from '../isa/format'
import { ICODE } from '../isa/instructions'
import { decodeStage } from '../execution/decode'
import { executeStage } from '../execution/execute'
import { fetchStage } from '../execution/fetch'
import { memoryStage } from '../execution/memory'
import { pcUpdateStage } from '../execution/pcUpdate'
import type {
  DecodeStage,
  ExecuteStage,
  FetchStage,
  MemoryStage,
  PcUpdateStage,
  StageName,
  WritebackStage,
} from '../execution/types'
import { applyWriteback, writebackStage, type RegisterWrite } from '../execution/writeback'

export interface MachineSnapshot {
  pc: Word
  registers: Word[]
  cc: ConditionCodes
  stat: Stat
  cycle: number
}

export interface InstructionTrace {
  /** 第几条指令（从 0 开始） */
  index: number
  cycle: number
  pc: Word
  text: string
  fetch: FetchStage
  decode: DecodeStage | null
  execute: ExecuteStage | null
  memory: MemoryStage | null
  writeback: WritebackStage | null
  pcUpdate: PcUpdateStage | null
  /** 实际走到的阶段，异常指令会在这里提前结束 */
  stages: StageName[]
  registerWrites: RegisterWrite[]
  /** 执行后的状态码，日志与时间轴直接用它 */
  statAfter: Stat
}

export interface MemoryUndo {
  address: Word
  previous: Word
}

export interface HistoryEntry {
  before: MachineSnapshot
  after: MachineSnapshot
  trace: InstructionTrace
  memoryUndo: MemoryUndo[]
}

export type StepReason = 'ok' | 'halted' | 'fault'

export interface StepResult {
  executed: boolean
  reason: StepReason
  trace: InstructionTrace | null
  before: MachineSnapshot
  after: MachineSnapshot
}

export interface SEQOptions {
  memorySize?: number
  baseAddress?: Word
  image?: Uint8Array
}

export class SEQProcessor {
  readonly memory: Memory
  private readonly registers = new RegisterFile()
  private readonly baseAddress: Word
  private readonly image: Uint8Array | null
  private cc: ConditionCodes = RESET_CC
  private pc: Word
  private stat: Stat = 'AOK'
  private cycle = 0
  private history: HistoryEntry[] = []

  constructor(options: SEQOptions = {}) {
    this.memory = new Memory(options.memorySize ?? DEFAULT_MEMORY_SIZE)
    this.baseAddress = asWord(options.baseAddress ?? 0n)
    this.pc = this.baseAddress
    this.image = options.image ? new Uint8Array(options.image) : null
    if (this.image) this.memory.load(this.baseAddress, this.image)
  }

  snapshot(): MachineSnapshot {
    return {
      pc: this.pc,
      registers: this.registers.snapshot(),
      cc: this.cc,
      stat: this.stat,
      cycle: this.cycle,
    }
  }

  get currentPc(): Word {
    return this.pc
  }

  get currentStat(): Stat {
    return this.stat
  }

  get currentCycle(): number {
    return this.cycle
  }

  get conditionCodes(): ConditionCodes {
    return this.cc
  }

  get historyEntries(): readonly HistoryEntry[] {
    return this.history
  }

  readRegister(id: number): Word {
    return this.registers.read(id)
  }

  /** 执行一条指令。停机或异常之后不再推进，返回 executed=false */
  step(): StepResult {
    const before = this.snapshot()

    if (isTerminal(this.stat)) {
      return {
        executed: false,
        reason: this.stat === 'HLT' ? 'halted' : 'fault',
        trace: null,
        before,
        after: before,
      }
    }

    const pc = this.pc
    const cycle = this.cycle + 1
    const fetch = fetchStage(pc, this.memory)
    const stages: StageName[] = ['FETCH']

    // 取指失败：非法指令或取指越界，直接终止
    if (!fetch.ok) {
      this.stat = fetch.status
      this.cycle = cycle
      const trace = this.buildTrace({
        index: this.history.length,
        cycle,
        pc,
        text: fetch.message ?? '非法指令',
        fetch,
        stages,
      })
      return this.commit(before, trace, [], 'fault')
    }

    const decode = decodeStage(fetch, this.registers)
    stages.push('DECODE')

    const execute = executeStage(fetch, decode, this.cc)
    stages.push('EXECUTE')

    const memory = memoryStage(fetch, decode, execute, this.memory)
    stages.push('MEMORY')

    // 访存越界：不写回、不更新 PC，处理器带着 ADR 停下
    if (memory.status === 'ADR') {
      this.stat = 'ADR'
      this.cycle = cycle
      const trace = this.buildTrace({
        index: this.history.length,
        cycle,
        pc,
        text: this.formatFetchText(fetch),
        fetch,
        decode,
        execute,
        memory,
        stages,
      })
      return this.commit(before, trace, [], 'fault')
    }

    const writeback = writebackStage(decode, execute, memory)
    stages.push('WRITEBACK')
    const { written } = applyWriteback(writeback, this.registers)
    this.cc = execute.nextCC

    const pcUpdate = pcUpdateStage(fetch, execute, memory, pc)
    stages.push('PC_UPDATE')
    this.pc = pcUpdate.nextPc

    const halted = fetch.icode === ICODE.HALT
    if (halted) this.stat = 'HLT'
    this.cycle = cycle

    const trace = this.buildTrace({
      index: this.history.length,
      cycle,
      pc,
      text: this.formatFetchText(fetch),
      fetch,
      decode,
      execute,
      memory,
      writeback,
      pcUpdate,
      stages,
      registerWrites: written,
    })

    const memoryUndo: MemoryUndo[] =
      memory.kind === 'write' && memory.address !== null && memory.previous !== null
        ? [{ address: memory.address, previous: memory.previous }]
        : []

    return this.commit(before, trace, memoryUndo, halted ? 'halted' : 'ok')
  }

  /** 连续执行，直到停机 / 异常 / 步数用尽 */
  run(maxSteps = 10_000): StepResult[] {
    const results: StepResult[] = []
    for (let i = 0; i < maxSteps; i += 1) {
      const result = this.step()
      results.push(result)
      if (!result.executed || result.reason !== 'ok') break
      if (isTerminal(this.stat)) break
    }
    return results
  }

  /**
   * 回到上一步。不是把动画倒放，而是把 PC / 寄存器 / 条件码 / Stat / 内存
   * 逐字段还原成执行前的快照。
   */
  stepBack(): boolean {
    const entry = this.history.pop()
    if (!entry) return false

    this.pc = entry.before.pc
    this.registers.restore(entry.before.registers)
    this.cc = entry.before.cc
    this.stat = entry.before.stat
    this.cycle = entry.before.cycle

    for (let i = entry.memoryUndo.length - 1; i >= 0; i -= 1) {
      const undo = entry.memoryUndo[i]!
      this.memory.pokeWord(undo.address, undo.previous)
    }
    return true
  }

  /** 回退到「执行了 count 条指令」的状态。count=0 即初始状态 */
  rewindTo(count: number): void {
    const target = Math.max(0, Math.min(count, this.history.length))
    while (this.history.length > target) this.stepBack()
  }

  reset(): void {
    this.registers.reset()
    this.cc = RESET_CC
    this.pc = this.baseAddress
    this.stat = 'AOK'
    this.cycle = 0
    this.history = []
    this.memory.reset()
    if (this.image) this.memory.load(this.baseAddress, this.image)
  }

  private commit(
    before: MachineSnapshot,
    trace: InstructionTrace,
    memoryUndo: MemoryUndo[],
    reason: StepReason,
  ): StepResult {
    const after = this.snapshot()
    this.history.push({ before, after, trace, memoryUndo })
    return { executed: true, reason, trace, before, after }
  }

  private buildTrace(fields: Partial<InstructionTrace> & Pick<InstructionTrace, 'index' | 'cycle' | 'pc' | 'text' | 'fetch' | 'stages'>): InstructionTrace {
    return {
      decode: null,
      execute: null,
      memory: null,
      writeback: null,
      pcUpdate: null,
      registerWrites: [],
      statAfter: this.stat,
      ...fields,
    }
  }

  private formatFetchText(fetch: FetchStage): string {
    if (!fetch.spec) return `0x${fetch.icode.toString(16).toUpperCase()}?`
    return formatInstruction({
      mnemonic: fetch.spec.mnemonic,
      form: fetch.spec.form,
      rA: fetch.rA,
      rB: fetch.rB,
      value: fetch.spec.form === 'none' ? null : fetch.valC,
    })
  }
}
