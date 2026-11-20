import { describe, expect, it } from 'vitest'
import { computeAlu, aluOpForIfun } from '../../src/core/execution/alu'
import { WORD_MASK, asWord } from '../../src/core/cpu/word'

const INT64_MAX = 0x7fff_ffff_ffff_ffffn
const INT64_MIN = 0x8000_0000_0000_0000n

describe('ALU 运算与条件码', () => {
  it('ifun 映射到四种运算，其余为 null', () => {
    expect(aluOpForIfun(0)).toBe('add')
    expect(aluOpForIfun(1)).toBe('sub')
    expect(aluOpForIfun(2)).toBe('and')
    expect(aluOpForIfun(3)).toBe('xor')
    expect(aluOpForIfun(4)).toBeNull()
    expect(aluOpForIfun(0xf)).toBeNull()
  })

  it('减法方向是「目的 − 源」：subq %rax, %rbx 即 rbx − rax', () => {
    const { value } = computeAlu('sub', 10n, 30n)
    expect(value).toBe(20n)
  })

  it('加法结果截断到 64 位并置 OF', () => {
    const { value, cc } = computeAlu('add', INT64_MAX, 1n)
    expect(value).toBe(INT64_MIN)
    expect(cc.OF).toBe(true)
    expect(cc.SF).toBe(true)
    expect(cc.ZF).toBe(false)
  })

  it('负数相加不溢出时不置 OF', () => {
    const { value, cc } = computeAlu('add', asWord(-5n), asWord(-7n))
    expect(value).toBe(asWord(-12n))
    expect(cc.OF).toBe(false)
    expect(cc.SF).toBe(true)
    expect(cc.ZF).toBe(false)
  })

  it('减法溢出：INT64_MIN − 1 回绕成正数', () => {
    // 对应汇编：irmovq $1, %rax; irmovq $0x8000000000000000, %rbx; subq %rax, %rbx
    const { value, cc } = computeAlu('sub', 1n, INT64_MIN)
    expect(value).toBe(INT64_MAX)
    expect(cc.OF).toBe(true)
    expect(cc.SF).toBe(false) // 结果符号位为 0，但真值是负的 → 正是 OF 要表达的矛盾
  })

  it('相等相减：ZF=1，SF=0，OF=0', () => {
    const { value, cc } = computeAlu('sub', 42n, 42n)
    expect(value).toBe(0n)
    expect(cc).toEqual({ ZF: true, SF: false, OF: false })
  })

  it('逻辑运算的 OF 恒为 0，即使结果符号位为 1', () => {
    const anded = computeAlu('and', 0x8000_0000_0000_0000n, WORD_MASK)
    expect(anded.cc).toEqual({ ZF: false, SF: true, OF: false })

    const xored = computeAlu('xor', WORD_MASK, 0n)
    expect(xored.value).toBe(WORD_MASK)
    expect(xored.cc.OF).toBe(false)
  })

  it('xor 自身得到 0 并置 ZF', () => {
    const { value, cc } = computeAlu('xor', 0xdead_beefn, 0xdead_beefn)
    expect(value).toBe(0n)
    expect(cc.ZF).toBe(true)
    expect(cc.SF).toBe(false)
  })

  it('输入超过 64 位时先截断再运算', () => {
    const { value } = computeAlu('add', 0x1_0000_0000_0000_0001n, 0n)
    expect(value).toBe(1n)
  })
})
