/**
 * Y86-64 指令集定义表 —— 全项目唯一的 ISA 事实来源。
 *
 * 汇编器、解码器、编辑器提示、教学面板都从这张表读数据。任何一处硬编码
 * `0x30` 或 `'irmovq'` 都是 bug 的种子：改一处忘另一处，机器码就会悄悄错位。
 *
 * 编码规则（教材 Figure 4.2）：
 *   - 每条指令第 1 个字节是 `icode:ifun`（各占半字节）
 *   - 2 字节指令第 2 字节是 `rA:rB`
 *   - 10 字节指令在 rA:rB 之后跟 8 字节小端常数（立即数或位移）
 *   - 9 字节指令在第 1 字节之后直接跟 8 字节小端目标地址
 */

import type { ConditionName } from './conditions'

/** 操作数形态。它同时决定语法、编码长度和 rA/rB 的角色。 */
export type OperandForm =
  | 'none' // nop / halt / ret
  | 'reg' // pushq %rA        —— 2 字节，rB 固定为 RNONE
  | 'reg-reg' // rrmovq %rA, %rB —— 2 字节
  | 'imm-reg' // irmovq $imm, %rB —— 10 字节，rA 固定为 RNONE
  | 'reg-mem' // rmmovq %rA, D(%rB) —— 10 字节
  | 'mem-reg' // mrmovq D(%rB), %rA —— 10 字节
  | 'target' // jXX / call dest —— 9 字节

/** 编码长度只由操作数形态决定，不该在别处再写一遍 */
export const FORM_LENGTH: Record<OperandForm, 1 | 2 | 9 | 10> = {
  none: 1,
  reg: 2,
  'reg-reg': 2,
  'imm-reg': 10,
  'reg-mem': 10,
  'mem-reg': 10,
  target: 9,
}

export type InstructionCategory = 'control' | 'data' | 'arithmetic' | 'stack' | 'system'

export interface InstructionSpec {
  mnemonic: string
  /** 高半字节 */
  icode: number
  /** 低半字节 */
  ifun: number
  form: OperandForm
  category: InstructionCategory
  /** cmov / jXX 才有；其余为 null。0 号条件在 rrmovq/jmp 上表现为「无条件」 */
  condition: ConditionName | null
  /** 教学用的标准写法，出错时直接回显给用户 */
  syntax: string
  summary: string
}

/** 指令码常量。写 `ICODE.PUSHQ` 比写 `0xa` 少一次翻表，也少一次笔误 */
export const ICODE = {
  NOP: 0x0,
  HALT: 0x1,
  RRMOVQ: 0x2,
  IRMOVQ: 0x3,
  RMMOVQ: 0x4,
  MRMOVQ: 0x5,
  OPQ: 0x6,
  JXX: 0x7,
  CALL: 0x8,
  RET: 0x9,
  PUSHQ: 0xa,
  POPQ: 0xb,
} as const

/**
 * 27 条指令，逐条写全而不循环生成：
 * ISA 表是要被逐行核对的东西，`cmov` + 循环虽然短，但核对时得在脑子里展开。
 * （cmov 系列 6 条 + rrmovq 同属 icode 2，按 ifun 区分，所以总数是 27 而不是 26。）
 */
export const INSTRUCTION_SPECS = [
  {
    mnemonic: 'nop',
    icode: 0x0,
    ifun: 0x0,
    form: 'none',
    category: 'system',
    condition: null,
    syntax: 'nop',
    summary: '空操作：只推进 PC',
  },
  {
    mnemonic: 'halt',
    icode: 0x1,
    ifun: 0x0,
    form: 'none',
    category: 'system',
    condition: null,
    syntax: 'halt',
    summary: '停止处理器，Stat 置为 HLT',
  },
  {
    mnemonic: 'rrmovq',
    icode: 0x2,
    ifun: 0x0,
    form: 'reg-reg',
    category: 'data',
    condition: 'always',
    syntax: 'rrmovq %rA, %rB',
    summary: '寄存器到寄存器传送（恒成立的条件传送）',
  },
  {
    mnemonic: 'cmovle',
    icode: 0x2,
    ifun: 0x1,
    form: 'reg-reg',
    category: 'data',
    condition: 'le',
    syntax: 'cmovle %rA, %rB',
    summary: '小于等于时传送（ZF=1 或 SF≠OF）',
  },
  {
    mnemonic: 'cmovl',
    icode: 0x2,
    ifun: 0x2,
    form: 'reg-reg',
    category: 'data',
    condition: 'l',
    syntax: 'cmovl %rA, %rB',
    summary: '小于时传送（SF≠OF）',
  },
  {
    mnemonic: 'cmove',
    icode: 0x2,
    ifun: 0x3,
    form: 'reg-reg',
    category: 'data',
    condition: 'e',
    syntax: 'cmove %rA, %rB',
    summary: '等于时传送（ZF=1）',
  },
  {
    mnemonic: 'cmovne',
    icode: 0x2,
    ifun: 0x4,
    form: 'reg-reg',
    category: 'data',
    condition: 'ne',
    syntax: 'cmovne %rA, %rB',
    summary: '不等于时传送（ZF=0）',
  },
  {
    mnemonic: 'cmovge',
    icode: 0x2,
    ifun: 0x5,
    form: 'reg-reg',
    category: 'data',
    condition: 'ge',
    syntax: 'cmovge %rA, %rB',
    summary: '大于等于时传送（SF=OF）',
  },
  {
    mnemonic: 'cmovg',
    icode: 0x2,
    ifun: 0x6,
    form: 'reg-reg',
    category: 'data',
    condition: 'g',
    syntax: 'cmovg %rA, %rB',
    summary: '大于时传送（SF=OF 且 ZF=0）',
  },
  {
    mnemonic: 'irmovq',
    icode: 0x3,
    ifun: 0x0,
    form: 'imm-reg',
    category: 'data',
    condition: null,
    syntax: 'irmovq $imm, %rB',
    summary: '立即数送入寄存器（rA 编码为 RNONE）',
  },
  {
    mnemonic: 'rmmovq',
    icode: 0x4,
    ifun: 0x0,
    form: 'reg-mem',
    category: 'data',
    condition: null,
    syntax: 'rmmovq %rA, D(%rB)',
    summary: '寄存器写入内存，地址 = D + %rB',
  },
  {
    mnemonic: 'mrmovq',
    icode: 0x5,
    ifun: 0x0,
    form: 'mem-reg',
    category: 'data',
    condition: null,
    syntax: 'mrmovq D(%rB), %rA',
    summary: '内存读入寄存器，地址 = D + %rB',
  },
  {
    mnemonic: 'addq',
    icode: 0x6,
    ifun: 0x0,
    form: 'reg-reg',
    category: 'arithmetic',
    condition: null,
    syntax: 'addq %rA, %rB',
    summary: '%rB ← %rB + %rA，并更新条件码',
  },
  {
    mnemonic: 'subq',
    icode: 0x6,
    ifun: 0x1,
    form: 'reg-reg',
    category: 'arithmetic',
    condition: null,
    syntax: 'subq %rA, %rB',
    summary: '%rB ← %rB − %rA，并更新条件码',
  },
  {
    mnemonic: 'andq',
    icode: 0x6,
    ifun: 0x2,
    form: 'reg-reg',
    category: 'arithmetic',
    condition: null,
    syntax: 'andq %rA, %rB',
    summary: '%rB ← %rB & %rA，OF 清零',
  },
  {
    mnemonic: 'xorq',
    icode: 0x6,
    ifun: 0x3,
    form: 'reg-reg',
    category: 'arithmetic',
    condition: null,
    syntax: 'xorq %rA, %rB',
    summary: '%rB ← %rB ^ %rA，OF 清零',
  },
  {
    mnemonic: 'jmp',
    icode: 0x7,
    ifun: 0x0,
    form: 'target',
    category: 'control',
    condition: 'always',
    syntax: 'jmp dest',
    summary: '无条件跳转',
  },
  {
    mnemonic: 'jle',
    icode: 0x7,
    ifun: 0x1,
    form: 'target',
    category: 'control',
    condition: 'le',
    syntax: 'jle dest',
    summary: '小于等于时跳转',
  },
  {
    mnemonic: 'jl',
    icode: 0x7,
    ifun: 0x2,
    form: 'target',
    category: 'control',
    condition: 'l',
    syntax: 'jl dest',
    summary: '小于时跳转',
  },
  {
    mnemonic: 'je',
    icode: 0x7,
    ifun: 0x3,
    form: 'target',
    category: 'control',
    condition: 'e',
    syntax: 'je dest',
    summary: '等于时跳转',
  },
  {
    mnemonic: 'jne',
    icode: 0x7,
    ifun: 0x4,
    form: 'target',
    category: 'control',
    condition: 'ne',
    syntax: 'jne dest',
    summary: '不等于时跳转',
  },
  {
    mnemonic: 'jge',
    icode: 0x7,
    ifun: 0x5,
    form: 'target',
    category: 'control',
    condition: 'ge',
    syntax: 'jge dest',
    summary: '大于等于时跳转',
  },
  {
    mnemonic: 'jg',
    icode: 0x7,
    ifun: 0x6,
    form: 'target',
    category: 'control',
    condition: 'g',
    syntax: 'jg dest',
    summary: '大于时跳转',
  },
  {
    mnemonic: 'call',
    icode: 0x8,
    ifun: 0x0,
    form: 'target',
    category: 'control',
    condition: null,
    syntax: 'call dest',
    summary: '压入返回地址并跳转',
  },
  {
    mnemonic: 'ret',
    icode: 0x9,
    ifun: 0x0,
    form: 'none',
    category: 'control',
    condition: null,
    syntax: 'ret',
    summary: '从栈顶弹出返回地址',
  },
  {
    mnemonic: 'pushq',
    icode: 0xa,
    ifun: 0x0,
    form: 'reg',
    category: 'stack',
    condition: null,
    syntax: 'pushq %rA',
    summary: '%rsp − 8 后压入 %rA',
  },
  {
    mnemonic: 'popq',
    icode: 0xb,
    ifun: 0x0,
    form: 'reg',
    category: 'stack',
    condition: null,
    syntax: 'popq %rA',
    summary: '从栈顶弹出到 %rA，再 %rsp + 8',
  },
] as const satisfies readonly InstructionSpec[]

export type InstructionSpecEntry = (typeof INSTRUCTION_SPECS)[number]
export type Mnemonic = InstructionSpecEntry['mnemonic']

export const INSTRUCTION_COUNT = INSTRUCTION_SPECS.length

const BY_MNEMONIC = new Map<string, InstructionSpecEntry>(
  INSTRUCTION_SPECS.map((spec) => [spec.mnemonic, spec]),
)

/** opcode key：把 icode 与 ifun 拼成一个数字，方便 O(1) 查表 */
function opcodeKey(icode: number, ifun: number): number {
  return icode * 16 + ifun
}

const BY_OPCODE = new Map<number, InstructionSpecEntry>(
  INSTRUCTION_SPECS.map((spec) => [opcodeKey(spec.icode, spec.ifun), spec]),
)

/** 只由 mnemonic 判断，大小写不敏感：汇编语言本来就不区分 */
export function findSpecByMnemonic(mnemonic: string): InstructionSpecEntry | null {
  return BY_MNEMONIC.get(mnemonic.trim().toLowerCase()) ?? null
}

/**
 * 由编码查指令。查不到就是非法指令——**不做任何猜测性回退**，
 * 否则 `0x2F`（rrmovq 的 ifun=15）会被当成 rrmovq 静默执行。
 */
export function findSpecByOpcode(icode: number, ifun: number): InstructionSpecEntry | null {
  return BY_OPCODE.get(opcodeKey(icode, ifun)) ?? null
}

export const ALL_MNEMONICS: readonly string[] = INSTRUCTION_SPECS.map((spec) => spec.mnemonic)

/** 供编辑器补全/提示：按类别分组 */
export const MNEMONICS_BY_CATEGORY: Record<InstructionCategory, readonly string[]> = {
  control: INSTRUCTION_SPECS.filter((s) => s.category === 'control').map((s) => s.mnemonic),
  data: INSTRUCTION_SPECS.filter((s) => s.category === 'data').map((s) => s.mnemonic),
  arithmetic: INSTRUCTION_SPECS.filter((s) => s.category === 'arithmetic').map((s) => s.mnemonic),
  stack: INSTRUCTION_SPECS.filter((s) => s.category === 'stack').map((s) => s.mnemonic),
  system: INSTRUCTION_SPECS.filter((s) => s.category === 'system').map((s) => s.mnemonic),
}
