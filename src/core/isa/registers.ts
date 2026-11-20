/**
 * Y86-64 的寄存器编号。这份顺序不是随手排的，而是 ISA 规定的编码值：
 * %rax=0, %rcx=1, %rdx=2, %rbx=3, %rsp=4, %rbp=5, %rsi=6, %rdi=7,
 * %r8..%r14 = 8..14。任何一位写错，汇编出来的机器码就指向另一个寄存器。
 *
 * 0xF 是 RNONE：表示「没有寄存器」。它在指令编码里占一个半字节，
 * 但**不属于**程序员可见的 15 个寄存器。
 */
export const REGISTER_NAMES = [
  '%rax',
  '%rcx',
  '%rdx',
  '%rbx',
  '%rsp',
  '%rbp',
  '%rsi',
  '%rdi',
  '%r8',
  '%r9',
  '%r10',
  '%r11',
  '%r12',
  '%r13',
  '%r14',
] as const

export type RegisterName = (typeof REGISTER_NAMES)[number]

export const REGISTER_COUNT = REGISTER_NAMES.length // 15

/** 「无寄存器」编码，只出现在指令的 rA:rB 半字节里 */
export const RNONE = 15

export const STACK_POINTER: RegisterName = '%rsp'
export const STACK_POINTER_ID = 4

export function isValidRegisterId(id: number): boolean {
  return Number.isInteger(id) && id >= 0 && id < REGISTER_COUNT
}

/** 编号 → 名字；非法编号返回 null，由调用方决定报错还是静默（不要静默） */
export function registerName(id: number): RegisterName | null {
  return isValidRegisterId(id) ? REGISTER_NAMES[id]! : null
}

/** 名字 → 编号；接受带不带 % 两种写法，便于解析用户输入 */
export function registerId(name: string): number | null {
  const normalized = name.trim().toLowerCase()
  const withPercent = normalized.startsWith('%') ? normalized : `%${normalized}`
  const index = REGISTER_NAMES.indexOf(withPercent as RegisterName)
  return index === -1 ? null : index
}
