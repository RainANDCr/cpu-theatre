/**
 * 64 位字（word）的基础表示。
 *
 * 为什么不是 number？
 * Y86-64 的一个字是 64 位，而 JavaScript 的 number 只有 53 位整数精度。
 * 用 number 模拟会在 `irmovq $0x7fffffffffffffff, %rax` 这类边界值上悄悄丢失低位，
 * 之后所有条件码（尤其 OF/SF）都会跟着错。
 *
 * 所以整个模拟器内部统一用 bigint 承载「字」，并且**每次产出一个新值都过一遍
 * `asWord`**，把结果截回 64 位——这等价于硬件里寄存器的位宽截断。忘掉这一步，
 * 溢出标志就永远是错的。
 */
export type Word = bigint

export const WORD_BITS = 64
export const WORD_BYTES = 8

/** 低 64 位全 1 */
export const WORD_MASK: Word = (1n << 64n) - 1n

/** 第 63 位（符号位） */
export const WORD_SIGN_BIT: Word = 1n << 63n

/**
 * 截断到 64 位无符号表示。所有写入寄存器 / 内存的值都必须经过它。
 * bigint 的 `&` 对负数按补码语义工作，因此 `asWord(-1n) === 0xFFFF_FFFF_FFFF_FFFFn`。
 */
export function asWord(value: Word): Word {
  return value & WORD_MASK
}

/** 最高位是否为 1（按 64 位补码解释时为负数） */
export function isNegative(value: Word): boolean {
  return (asWord(value) & WORD_SIGN_BIT) !== 0n
}

/** 把 64 位位模式重新解释为有符号整数 */
export function asSigned(value: Word): Word {
  const word = asWord(value)
  return isNegative(word) ? word - (1n << 64n) : word
}

/** 该值是否能用 64 位承载（不静默丢失信息） */
export function fitsInWord(value: Word): boolean {
  return value >= -(1n << 63n) && value <= WORD_MASK
}

/** 0x000000000000001F 形式的固定宽度十六进制 */
export function toHex(value: Word, digits = 16): string {
  const hex = asWord(value).toString(16).toUpperCase().padStart(digits, '0')
  return `0x${hex}`
}

/** 0b... 形式的 64 位二进制 */
export function toBin(value: Word, digits = WORD_BITS): string {
  return `0b${asWord(value).toString(2).padStart(digits, '0')}`
}

/** 有符号十进制（教学面板默认显示它） */
export function toDec(value: Word): string {
  return asSigned(value).toString(10)
}

/** 无符号十进制（地址类数值应当用它） */
export function toUnsignedDec(value: Word): string {
  return asWord(value).toString(10)
}

/** 以低 8 位判断是否为 0，供 ZF 使用 */
export function isZero(value: Word): boolean {
  return asWord(value) === 0n
}
