import { describe, expect, it } from 'vitest'
import {
  asSigned,
  asWord,
  fitsInWord,
  isNegative,
  isZero,
  toBin,
  toDec,
  toHex,
  WORD_MASK,
  WORD_SIGN_BIT,
} from '../../src/core/cpu/word'

describe('64 位字表示层', () => {
  it('把负数截断成补码位模式', () => {
    expect(asWord(-1n)).toBe(WORD_MASK)
    expect(toHex(-1n)).toBe('0xFFFFFFFFFFFFFFFF')
    expect(toHex(asWord(-2n))).toBe('0xFFFFFFFFFFFFFFFE')
  })

  it('高位溢出被截掉，等价于寄存器位宽截断', () => {
    expect(asWord(1n << 64n)).toBe(0n)
    expect(asWord((1n << 64n) + 5n)).toBe(5n)
    expect(asWord((1n << 70n) + 0x2an)).toBe(0x2an)
  })

  it('符号位判定只看第 63 位', () => {
    expect(isNegative(asWord(WORD_SIGN_BIT))).toBe(true)
    expect(isNegative(asWord(WORD_SIGN_BIT - 1n))).toBe(false)
    expect(isNegative(0n)).toBe(false)
  })

  it('位模式可按有符号数重新解释', () => {
    expect(asSigned(asWord(WORD_SIGN_BIT))).toBe(-(1n << 63n))
    expect(toDec(asWord(-7n))).toBe('-7')
    expect(toDec(asWord(WORD_SIGN_BIT))).toBe((-9223372036854775808n).toString())
  })

  it('十六进制固定宽度、大写、带前缀', () => {
    expect(toHex(0n)).toBe('0x0000000000000000')
    expect(toHex(0x2cn, 8)).toBe('0x0000002C')
    expect(toHex(0x2cn)).toHaveLength(18)
  })

  it('二进制固定 64 位', () => {
    expect(toBin(5n)).toHaveLength(66)
    expect(toBin(5n).endsWith('0101')).toBe(true)
  })

  it('值域检查能识别 64 位装不下的数', () => {
    expect(fitsInWord(0n)).toBe(true)
    expect(fitsInWord(-(1n << 63n))).toBe(true)
    expect(fitsInWord(-(1n << 63n) - 1n)).toBe(false)
    expect(fitsInWord(1n << 64n)).toBe(false)
  })

  it('零判定基于整个 64 位', () => {
    expect(isZero(1n << 32n)).toBe(false)
    expect(isZero(asWord(1n << 64n))).toBe(true)
  })
})
