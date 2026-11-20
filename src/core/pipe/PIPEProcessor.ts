/**
 * PIPE：教材第 4.5 节的五级流水线。
 *
 * 与 SEQ 最大的区别是「状态」不再只有一份：同一拍里 F/D/E/M/W 各拿着
 * 一条不同的指令，控制逻辑（暂停 / 气泡 / 转发）决定它们下一拍去哪。
 *
 * 三个必须做对的地方：
 *
 * 1. **转发不是优化，是正确性**。`addq %rax, %rbx` 后面紧跟 `addq %rbx, %rcx`，
 *    后者的 valB 在译码时还是旧值，必须从 E 或 M 阶段转发过来。
 * 2. **加载/使用冒险只能暂停**。`mrmovq 0(%rax), %rbx` 后面的指令要用 %rbx 时，
 *    值要等访存结束才有，转发帮不上——只能让 F/D 停一拍、E 插气泡。
 * 3. **分支预测错了要撤回**。本项目采用教材的「预测跳转发生」策略：
 *    取指时把 JXX/CALL 的 PC 设成 valC，执行阶段发现条件不成立时，
 *    把已经取进来的那条指令变成气泡，并把 PC 改回 valP。
 */
import { AddressError } from '../cpu/errors'
import { RESET_CC, type ConditionCodes } from '../cpu/ConditionCodes'
import { DEFAULT_MEMORY_SIZE, Memory } from '../cpu/Memory'
import { RegisterFile } from '../cpu/RegisterFile'
import { isFault, isTerminal, type Stat } from '../cpu/Status'
import { asWord, type Word } from '../cpu/word'
import { computeAlu, aluOpForIfun } from '../execution/alu'
import { conditionForIfun, evaluateCondition } from '../isa/conditions'
import { formatInstruction } from '../isa/format'
import { findSpecByOpcode, ICODE } from '../isa/instructions'
import { RNONE, STACK_POINTER_ID as RSP } from '../isa/registers'

export type PipeStageName = 'F' | 'D' | 'E' | 'M' | 'W'

/** 流水线寄存器的统一形状。icode = -1 表示气泡 */
export interface PipeSlot {
  stat: Stat
  icode: number
  ifun: number
  rA: number
  rB: number
  valC: Word
  valP: Word
  valA: Word
  valB: Word
  valE: Word
  valM: Word
  dstE: number
  dstM: number
  srcA: number
  srcB: number
  cnd: boolean
  /** 仅 F 寄存器使用：下一个取指地址 */
  predPC: Word
}

const EMPTY_SLOT: PipeSlot = {
  stat: 'AOK',
  icode: -1,
  ifun: 0,
  rA: RNONE,
  rB: RNONE,
  valC: 0n,
  valP: 0n,
  valA: 0n,
  valB: 0n,
  valE: 0n,
  valM: 0n,
  dstE: RNONE,
  dstM: RNONE,
  srcA: RNONE,
  srcB: RNONE,
  cnd: true,
  predPC: 0n,
}

export function bubble(): PipeSlot {
  return { ...EMPTY_SLOT }
}

export interface PipeSlotView {
  stage: PipeStageName
  icode: number
  text: string | null
  stat: Stat
  /** 该段在这一拍里的寄存器内容 */
  slot: PipeSlot
}

export interface PipeCycleTrace {
  cycle: number
  slots: PipeSlotView[]
  /** 本拍是否因加载/使用冒险暂停 */
  stall: boolean
  /** 本拍是否插入了气泡（分支预测失败或 ret） */
  bubble: boolean
  /** 本拍是否发生转发 */
  forwarding: { a: boolean; b: boolean }
  written: Array<{ register: number; value: Word }>
  memory: { kind: 'read' | 'write'; address: Word; value: Word } | null
  newPc: Word
  stat: Stat
}

export interface PipeStats {
  cycles: number
  instructions: number
  stalls: number
  bubbles: number
  forwards: number
}

export interface PipeStepResult {
  executed: boolean
  trace: PipeCycleTrace | null
  stat: Stat
}

export interface PIPEOptions {
  memorySize?: number
  baseAddress?: Word
  image?: Uint8Array
}

/** 从流水线寄存器渲染出指令文本（气泡返回 null） */
export function slotText(slot: PipeSlot): string | null {
  if (slot.icode < 0) return null
  const spec = findSpecByIcode(slot.icode, slot.ifun)
  if (!spec) return `0x${slot.icode.toString(16).toUpperCase()}?`
  return formatInstruction({
    mnemonic: spec.mnemonic,
    form: spec.form,
    rA: slot.rA,
    rB: slot.rB,
    value: spec.form === 'none' ? null : slot.valC,
  })
}

function findSpecByIcode(icode: number, ifun: number) {
  return findSpecByOpcode(icode, ifun)
}

export class PIPEProcessor {
  readonly memory: Memory
  private readonly registers = new RegisterFile()
  private readonly baseAddress: Word
  private readonly image: Uint8Array | null

  private f: PipeSlot
  private d: PipeSlot = bubble()
  private e: PipeSlot = bubble()
  private m: PipeSlot = bubble()
  private w: PipeSlot = bubble()

  private cc: ConditionCodes = RESET_CC
  private pc: Word
  private stat: Stat = 'AOK'
  private cycle = 0
  private stats: PipeStats = { cycles: 0, instructions: 0, stalls: 0, bubbles: 0, forwards: 0 }
  private traces: PipeCycleTrace[] = []

  constructor(options: PIPEOptions = {}) {
    this.memory = new Memory(options.memorySize ?? DEFAULT_MEMORY_SIZE)
    this.baseAddress = asWord(options.baseAddress ?? 0n)
    this.pc = this.baseAddress
    this.image = options.image ? new Uint8Array(options.image) : null
    if (this.image) this.memory.load(this.baseAddress, this.image)
    this.f = { ...EMPTY_SLOT, predPC: this.baseAddress }
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

  get statistics(): Readonly<PipeStats> {
    return this.stats
  }

  get cycleTraces(): readonly PipeCycleTrace[] {
    return this.traces
  }

  readRegister(id: number): Word {
    return this.registers.read(id)
  }

  /** 原始流水线寄存器快照，供界面展示各段细节 */
  rawSlots(): Array<{ stage: PipeStageName; slot: PipeSlot }> {
    return [
      { stage: 'F', slot: { ...this.f } },
      { stage: 'D', slot: { ...this.d } },
      { stage: 'E', slot: { ...this.e } },
      { stage: 'M', slot: { ...this.m } },
      { stage: 'W', slot: { ...this.w } },
    ]
  }

  /** 当前五个流水段里各是哪条指令（用于界面） */
  slotViews(): PipeSlotView[] {
    return this.rawSlots().map(({ stage, slot }) => ({
      stage,
      icode: slot.icode,
      text: slotText(slot),
      stat: slot.stat,
      slot,
    }))
  }

  /** 推进一个时钟周期 */
  step(): PipeStepResult {
    if (isTerminal(this.stat)) {
      return { executed: false, trace: null, stat: this.stat }
    }

    const cycle = this.cycle + 1
    const w = this.w
    const m = this.m
    const e = this.e
    const d = this.d

    // ---- W：写回 ----
    const written: Array<{ register: number; value: Word }> = []
    if (w.icode >= 0) {
      if (w.dstE !== RNONE) {
        this.registers.write(w.dstE, w.valE)
        written.push({ register: w.dstE, value: w.valE })
      }
      if (w.dstM !== RNONE) {
        this.registers.write(w.dstM, w.valM)
        written.push({ register: w.dstM, value: w.valM })
      }
      // 退休指令计数含 nop 与 halt：CPI 的分母是「完成了多少条指令」
      this.stats.instructions += 1
      if (w.icode === ICODE.HALT) {
        this.stat = 'HLT'
      }
    }

    // ---- M：访存 ----
    let mValM = 0n
    let mStat = m.stat
    let memoryAccess: PipeCycleTrace['memory'] = null

    if (m.icode >= 0 && !isFault(mStat)) {
      const read =
        m.icode === ICODE.MRMOVQ || m.icode === ICODE.POPQ || m.icode === ICODE.RET
      const write =
        m.icode === ICODE.RMMOVQ || m.icode === ICODE.PUSHQ || m.icode === ICODE.CALL
      const address = read && (m.icode === ICODE.POPQ || m.icode === ICODE.RET) ? m.valA : m.valE

      try {
        if (read && m.icode === ICODE.MRMOVQ) {
          mValM = this.memory.readWord(address)
          memoryAccess = { kind: 'read', address, value: mValM }
        } else if (read) {
          mValM = this.memory.readWord(address)
          memoryAccess = { kind: 'read', address, value: mValM }
        } else if (write) {
          const value =
            m.icode === ICODE.CALL ? m.valP : m.icode === ICODE.PUSHQ ? m.valA : m.valA
          this.memory.writeWord(address, value)
          memoryAccess = { kind: 'write', address, value }
        }
      } catch (error) {
        if (error instanceof AddressError) {
          mStat = 'ADR'
        } else {
          throw error
        }
      }
    }

    // ---- E：执行（含转发） ----
    let eValE = 0n
    let eCnd = true
    let eDstE = RNONE
    let eStat = e.stat
    let forwarding = { a: false, b: false }

    if (e.icode >= 0 && !isFault(eStat)) {
      const fwdA = forward(
        e.srcA,
        [
          [m.dstE, m.valE],
          [m.dstM, mValM],
          [w.dstE, w.valE],
          [w.dstM, w.valM],
        ],
        e.valA,
      )
      const fwdB = forward(
        e.srcB,
        [
          [m.dstE, m.valE],
          [m.dstM, mValM],
          [w.dstE, w.valE],
          [w.dstM, w.valM],
        ],
        e.valB,
      )
      forwarding = { a: fwdA.used, b: fwdB.used }
      if (fwdA.used || fwdB.used) this.stats.forwards += 1

      let aluA = 0n
      if (e.icode === ICODE.RRMOVQ || e.icode === ICODE.OPQ) aluA = fwdA.value
      else if (e.icode === ICODE.IRMOVQ || e.icode === ICODE.RMMOVQ || e.icode === ICODE.MRMOVQ)
        aluA = e.valC
      else if (e.icode === ICODE.CALL || e.icode === ICODE.PUSHQ) aluA = asWord(-8n)
      else if (e.icode === ICODE.RET || e.icode === ICODE.POPQ) aluA = 8n

      let aluB = 0n
      if (
        e.icode === ICODE.RMMOVQ ||
        e.icode === ICODE.MRMOVQ ||
        e.icode === ICODE.OPQ ||
        e.icode === ICODE.CALL ||
        e.icode === ICODE.PUSHQ ||
        e.icode === ICODE.RET ||
        e.icode === ICODE.POPQ
      ) {
        aluB = fwdB.value
      }

      const setCC = e.icode === ICODE.OPQ
      const outcome = computeAlu(setCC ? (aluOpForIfun(e.ifun) ?? 'add') : 'add', aluA, aluB)
      eValE = outcome.value
      if (setCC) this.cc = outcome.cc

      if (e.icode === ICODE.RRMOVQ || e.icode === ICODE.JXX) {
        const condition = conditionForIfun(e.ifun)
        eCnd = condition ? evaluateCondition(condition, this.cc) : false
      }
      eDstE = e.icode === ICODE.RRMOVQ && !eCnd ? RNONE : e.dstE
    }

    // ---- D：译码（含转发） ----
    let dSrcA = RNONE
    let dSrcB = RNONE
    let dDstE = RNONE
    let dDstM = RNONE
    let dValA = 0n
    let dValB = 0n

    if (d.icode >= 0) {
      dSrcA = sourceA(d.icode, d.rA)
      dSrcB = sourceB(d.icode, d.rB)
      dDstE = destE(d.icode, d.rB)
      dDstM = d.icode === ICODE.MRMOVQ || d.icode === ICODE.POPQ ? d.rA : RNONE

      const rawA = d.icode === ICODE.JXX || d.icode === ICODE.CALL ? d.valP : this.registers.read(dSrcA)
      const rawB = this.registers.read(dSrcB)

      dValA = forward(
        dSrcA,
        [
          [eDstE, eValE],
          [m.dstM, mValM],
          [m.dstE, m.valE],
          [w.dstE, w.valE],
          [w.dstM, w.valM],
        ],
        rawA,
      ).value
      dValB = forward(
        dSrcB,
        [
          [eDstE, eValE],
          [m.dstM, mValM],
          [m.dstE, m.valE],
          [w.dstE, w.valE],
          [w.dstM, w.valM],
        ],
        rawB,
      ).value
    }

    // ---- 控制：暂停 / 气泡 ----
    // 加载/使用冒险：值要等访存结束才有，转发帮不上，只能停一拍
    const loadUse =
      e.icode >= 0 &&
      (e.icode === ICODE.MRMOVQ || e.icode === ICODE.POPQ) &&
      e.dstM !== RNONE &&
      (e.dstM === dSrcA || e.dstM === dSrcB)

    // ret 的返回地址要到 W 阶段才从内存里读出来，这期间不能取指
    const retInFlight =
      d.icode === ICODE.RET || e.icode === ICODE.RET || m.icode === ICODE.RET

    // 预测「跳转发生」，结果没跳 → 已经取进来的那条指令作废
    const mispredicted = e.icode === ICODE.JXX && !eCnd

    const fStall = loadUse || retInFlight
    const dStall = loadUse
    const dBubble = mispredicted || (retInFlight && !loadUse)
    const eBubble = loadUse
    const mBubble = isFault(mStat)

    if (fStall) this.stats.stalls += 1
    if (dBubble || eBubble) this.stats.bubbles += 1

    // ---- F：取指 ----
    const fetchAddress = this.f.predPC
    let fetchSlot: PipeSlot = bubble()
    let fetchOk = true
    try {
      const byte = this.memory.readByte(fetchAddress)
      const icode = byte >> 4
      const ifun = byte & 0x0f
      const spec = findSpecByIcode(icode, ifun)
      if (!spec) {
        fetchSlot = { ...EMPTY_SLOT, stat: 'INS' }
        fetchOk = false
      } else {
        const length = FORM_LENGTH_OF(spec.form)
        const bytes: number[] = [byte]
        for (let i = 1; i < length; i += 1) {
          bytes.push(this.memory.readByte(asWord(fetchAddress + BigInt(i))))
        }
        fetchSlot = decodeFetched(fetchAddress, bytes, icode, ifun, spec, length)
      }
    } catch {
      fetchSlot = { ...EMPTY_SLOT, stat: 'ADR' }
      fetchOk = false
    }

    const predictedNextPc =
      fetchOk && (fetchSlot.icode === ICODE.JXX || fetchSlot.icode === ICODE.CALL)
        ? fetchSlot.valC
        : fetchSlot.valP

    // ---- 更新流水线寄存器 ----
    const newW: PipeSlot = { ...m, valM: mValM, stat: mStat }
    const newM: PipeSlot = { ...e, valE: eValE, cnd: eCnd, dstE: eDstE, stat: eStat }

    const newE: PipeSlot = eBubble
      ? bubble()
      : {
          ...d,
          srcA: dSrcA,
          srcB: dSrcB,
          dstE: dDstE,
          dstM: dDstM,
          valA: dValA,
          valB: dValB,
        }

    const newD: PipeSlot = dStall ? d : dBubble ? bubble() : { ...fetchSlot }

    // PC：ret 到达 W 时用 valM；预测失败时用 E 里的 fall-through（JXX 的 valA = valP）
    let nextPc: Word
    if (w.icode === ICODE.RET) nextPc = w.valM
    else if (mispredicted) nextPc = e.valA
    else nextPc = predictedNextPc

    this.w = mBubble ? bubble() : newW
    this.m = mBubble ? bubble() : newM
    this.e = newE
    this.d = newD
    // 暂停时冻结取指地址
    this.f = { ...this.f, predPC: fStall ? this.f.predPC : nextPc }

    this.pc = fetchAddress
    this.cycle = cycle
    this.stats.cycles = cycle

    if (!fetchOk) this.stat = fetchSlot.stat
    if (isFault(mStat)) this.stat = mStat

    // 五个格子统一描述「这一拍各段在做什么」：
    // F 用本拍取到的指令，D/E/M/W 用**更新前**的寄存器。
    // 混用更新前后的值会让五列错开一拍，看起来像流水线在倒着走。
    const view = (stage: PipeStageName, slot: PipeSlot): PipeSlotView => ({
      stage,
      icode: slot.icode,
      text: slotText(slot),
      stat: slot.stat,
      slot,
    })

    const trace: PipeCycleTrace = {
      cycle,
      slots: [
        view('F', fetchSlot),
        view('D', d),
        view('E', e),
        view('M', m),
        view('W', w),
      ],
      stall: fStall,
      bubble: dBubble || eBubble,
      forwarding,
      written,
      memory: memoryAccess,
      newPc: nextPc,
      stat: this.stat,
    }
    this.traces.push(trace)

    return { executed: true, trace, stat: this.stat }
  }

  run(maxCycles = 20_000): void {
    for (let i = 0; i < maxCycles; i += 1) {
      const result = this.step()
      if (!result.executed || isTerminal(this.stat)) break
    }
  }

  reset(): void {
    this.registers.reset()
    this.cc = RESET_CC
    this.pc = this.baseAddress
    this.stat = 'AOK'
    this.cycle = 0
    this.stats = { cycles: 0, instructions: 0, stalls: 0, bubbles: 0, forwards: 0 }
    this.traces = []
    this.f = { ...EMPTY_SLOT, predPC: this.baseAddress }
    this.d = bubble()
    this.e = bubble()
    this.m = bubble()
    this.w = bubble()
    this.memory.reset()
    if (this.image) this.memory.load(this.baseAddress, this.image)
  }

  get currentPc(): Word {
    return this.pc
  }

  get registersRef(): RegisterFile {
    return this.registers
  }
}

/* ------------------------------------------------------------------ */
/* 纯函数：译码规则与转发                                             */
/* ------------------------------------------------------------------ */

function sourceA(icode: number, rA: number): number {
  if (
    icode === ICODE.RRMOVQ ||
    icode === ICODE.RMMOVQ ||
    icode === ICODE.OPQ ||
    icode === ICODE.PUSHQ
  ) {
    return rA
  }
  if (icode === ICODE.POPQ || icode === ICODE.RET) return RSP
  return RNONE
}

function sourceB(icode: number, rB: number): number {
  if (
    icode === ICODE.RRMOVQ ||
    icode === ICODE.IRMOVQ ||
    icode === ICODE.OPQ ||
    icode === ICODE.RMMOVQ ||
    icode === ICODE.MRMOVQ
  ) {
    return rB
  }
  if (
    icode === ICODE.CALL ||
    icode === ICODE.RET ||
    icode === ICODE.PUSHQ ||
    icode === ICODE.POPQ
  ) {
    return RSP
  }
  return RNONE
}

function destE(icode: number, rB: number): number {
  if (icode === ICODE.RRMOVQ || icode === ICODE.IRMOVQ || icode === ICODE.OPQ) return rB
  if (
    icode === ICODE.PUSHQ ||
    icode === ICODE.POPQ ||
    icode === ICODE.CALL ||
    icode === ICODE.RET
  ) {
    return RSP
  }
  return RNONE
}

/**
 * 转发选择器。候选按优先级排列，第一个命中且写过寄存器者生效。
 * 返回 `used` 是为了统计——「这一拍有没有转发」本身就是教学信息。
 */
function forward(
  source: number,
  candidates: Array<[number, Word]>,
  fallback: Word,
): { value: Word; used: boolean } {
  if (source !== RNONE) {
    for (const [dst, value] of candidates) {
      if (dst !== RNONE && dst === source) return { value, used: true }
    }
  }
  return { value: fallback, used: false }
}

function FORM_LENGTH_OF(form: string): number {
  switch (form) {
    case 'none':
      return 1
    case 'reg':
    case 'reg-reg':
      return 2
    case 'target':
      return 9
    default:
      return 10
  }
}

function decodeFetched(
  pc: Word,
  bytes: number[],
  icode: number,
  ifun: number,
  spec: { form: string },
  length: number,
): PipeSlot {
  let rA = RNONE
  let rB = RNONE
  if (spec.form !== 'none' && spec.form !== 'target') {
    rA = bytes[1]! >> 4
    rB = bytes[1]! & 0x0f
  }
  let valC = 0n
  if (spec.form === 'target') {
    valC = readWordFrom(bytes, 1)
  } else if (length === 10) {
    valC = readWordFrom(bytes, 2)
  }
  return {
    ...EMPTY_SLOT,
    stat: 'AOK',
    icode,
    ifun,
    rA,
    rB,
    valC,
    valP: asWord(pc + BigInt(length)),
  }
}

function readWordFrom(bytes: number[], offset: number): Word {
  let value = 0n
  for (let i = 7; i >= 0; i -= 1) {
    value = (value << 8n) | BigInt(bytes[offset + i] ?? 0)
  }
  return value
}
