/**
 * ALU：加法 / 减法 / 与 / 异或，以及条件码的产生。
 *
 * 最容易写错的是减法方向。教材的 ALU 计算 `aluB OP aluA`，因为
 * `subq %rax, %rbx` 的语义是 `%rbx ← %rbx − %rax`：**目的寄存器在左**。
 * 所以这里的参数命名刻意用 valA / valB，而不是 ab，签名上就不给搞反的机会。
 */
import type { ConditionCodes } from '../cpu/ConditionCodes'
import { WORD_SIGN_BIT, asWord, type Word } from '../cpu/word'

export type AluOp = 'add' | 'sub' | 'and' | 'xor'

/** OPQ 的 ifun：0=add 1=sub 2=and 3=xor */
const ALU_OPS: readonly AluOp[] = ['add', 'sub', 'and', 'xor']

export function aluOpForIfun(ifun: number): AluOp | null {
  return ALU_OPS[ifun] ?? null
}

export interface AluOutcome {
  /** 已截断到 64 位的结果 */
  value: Word
  /** 本次运算产生的条件码（整体替换旧值） */
  cc: ConditionCodes
}

/**
 * 执行运算。
 * @param valA 源操作数（指令里的第一个寄存器）
 * @param valB 目的操作数（指令里的第二个寄存器）
 */
export function computeAlu(op: AluOp, valA: Word, valB: Word): AluOutcome {
  const a = asWord(valA)
  const b = asWord(valB)

  let raw: Word
  switch (op) {
    case 'add':
      raw = b + a
      break
    case 'sub':
      raw = b - a
      break
    case 'and':
      raw = b & a
      break
    case 'xor':
      raw = b ^ a
      break
  }

  const value = asWord(raw)
  const zf = value === 0n
  const sf = (value & WORD_SIGN_BIT) !== 0n

  let of = false
  if (op === 'add') {
    // 同号相加却得到异号 → 溢出
    of = ((~(a ^ b) & (b ^ value) & WORD_SIGN_BIT) as Word) !== 0n
  } else if (op === 'sub') {
    // 异号相减且结果符号与目的操作数不符 → 溢出
    of = (((a ^ b) & (b ^ value) & WORD_SIGN_BIT) as Word) !== 0n
  }
  // 逻辑运算的 OF 由 ISA 规定为 0，上面已默认 false

  return { value, cc: { ZF: zf, SF: sf, OF: of } }
}

/** 条件传送 / 条件跳转需要「不改变条件码地」算地址或值，用它做纯算术 */
export function addWord(a: Word, b: Word): Word {
  return asWord(a + b)
}
