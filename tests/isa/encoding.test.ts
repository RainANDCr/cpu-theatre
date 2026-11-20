import { describe, expect, it } from 'vitest'
import {
  INSTRUCTION_SPECS,
  FORM_LENGTH,
  type OperandForm,
} from '../../src/core/isa/instructions'
import { encodeInstruction, instructionLength, EncodeError } from '../../src/core/isa/encoder'
import { bytesSource, decode, disassemble } from '../../src/core/isa/decoder'
import { RNONE } from '../../src/core/isa/registers'
import { asWord } from '../../src/core/cpu/word'

function hex(bytes: ArrayLike<number>): string {
  return Array.from(bytes, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ')
}

/** 每一种操作数形态的样本值，用于往返一致性测试 */
const SAMPLE: Record<OperandForm, { rA: number; rB: number; value: bigint | null }> = {
  none: { rA: RNONE, rB: RNONE, value: null },
  reg: { rA: 3, rB: RNONE, value: null },
  'reg-reg': { rA: 1, rB: 2, value: null },
  'imm-reg': { rA: RNONE, rB: 4, value: asWord(-8n) },
  'reg-mem': { rA: 5, rB: 6, value: 0x1234n },
  'mem-reg': { rA: 7, rB: 8, value: asWord(-16n) },
  target: { rA: RNONE, rB: RNONE, value: 0x2an },
}

describe('编码器：教材 Figure 4.2 的字节序列', () => {
  const cases: Array<[string, number, number, number, number, string]> = [
    ['nop', 0x0, 0x0, RNONE, RNONE, '00'],
    ['halt', 0x1, 0x0, RNONE, RNONE, '10'],
    ['rrmovq %rcx, %rdx', 0x2, 0x0, 1, 2, '20 12'],
    ['cmovle %rcx, %rdx', 0x2, 0x1, 1, 2, '21 12'],
    ['irmovq $10, %rbx', 0x3, 0x0, RNONE, 3, '30 F3 0A 00 00 00 00 00 00 00'],
    ['rmmovq %rcx, 16(%rdx)', 0x4, 0x0, 1, 2, '40 12 10 00 00 00 00 00 00 00'],
    ['mrmovq 16(%rdx), %rcx', 0x5, 0x0, 1, 2, '50 12 10 00 00 00 00 00 00 00'],
    ['addq %rcx, %rdx', 0x6, 0x0, 1, 2, '60 12'],
    ['subq %rcx, %rdx', 0x6, 0x1, 1, 2, '61 12'],
    ['andq %rcx, %rdx', 0x6, 0x2, 1, 2, '62 12'],
    ['xorq %rcx, %rdx', 0x6, 0x3, 1, 2, '63 12'],
    ['je 0x2A', 0x7, 0x3, RNONE, RNONE, '73 2A 00 00 00 00 00 00 00'],
    ['call 0x100', 0x8, 0x0, RNONE, RNONE, '80 00 01 00 00 00 00 00 00'],
    ['ret', 0x9, 0x0, RNONE, RNONE, '90'],
    ['pushq %rcx', 0xa, 0x0, 1, RNONE, 'A0 1F'],
    ['popq %rcx', 0xb, 0x0, 1, RNONE, 'B0 1F'],
  ]

  for (const [label, icode, ifun, rA, rB, expected] of cases) {
    it(label, () => {
      const bytes = encodeInstruction({
        icode,
        ifun,
        rA,
        rB,
        value: expected.split(' ').length > 2 ? readTrailingWord(expected) : null,
      })
      expect(hex(bytes)).toBe(expected)
    })
  }

  function readTrailingWord(text: string): bigint {
    const parts = text.split(' ')
    const offset = parts.length === 9 ? 1 : 2
    return parts
      .slice(offset)
      .reverse()
      .reduce((value, byte) => (value << 8n) | BigInt(parseInt(byte, 16)), 0n)
  }
})

describe('编码 / 解码往返一致性', () => {
  for (const spec of INSTRUCTION_SPECS) {
    it(`${spec.mnemonic} 往返后字段不变`, () => {
      const sample = SAMPLE[spec.form]
      const bytes = encodeInstruction({
        icode: spec.icode,
        ifun: spec.ifun,
        rA: sample.rA,
        rB: sample.rB,
        value: sample.value,
      })

      expect(bytes).toHaveLength(FORM_LENGTH[spec.form])
      expect(instructionLength(spec.icode, spec.ifun)).toBe(FORM_LENGTH[spec.form])

      const result = decode(0n, bytesSource(bytes))
      expect(result.ok).toBe(true)
      if (!result.ok) return

      expect(result.instruction.spec).toBe(spec)
      expect(result.instruction.rA).toBe(sample.rA)
      expect(result.instruction.rB).toBe(sample.rB)
      expect(result.instruction.length).toBe(FORM_LENGTH[spec.form])
      expect(result.instruction.valP).toBe(BigInt(FORM_LENGTH[spec.form]))
      if (sample.value !== null) {
        expect(result.instruction.valC).toBe(asWord(sample.value))
      }
    })
  }
})

describe('解码器：非法输入不猜测', () => {
  it('未知 icode 报 INS', () => {
    const result = decode(0n, bytesSource(new Uint8Array([0xc0])))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe('INS')
    expect(result.message).toContain('非法指令')
  })

  it('已知 icode + 未知 ifun 报 INS（0x2F 不是 rrmovq）', () => {
    const result = decode(0n, bytesSource(new Uint8Array([0x2f, 0x12])))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe('INS')
  })

  it('取指越界报 ADR', () => {
    // irmovq 需要 10 字节，只给 3 字节
    const result = decode(0n, bytesSource(new Uint8Array([0x30, 0xf0, 0x0a])))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe('ADR')
  })

  it('完全空的内存报 ADR', () => {
    const result = decode(0n, bytesSource(new Uint8Array([])))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.status).toBe('ADR')
  })

  it('原样保留未使用的半字节（硬件会读，只是语义忽略）', () => {
    // pushq 规范编码是 A0 rA:F，这里故意把 rB 写成 3
    const result = decode(0n, bytesSource(new Uint8Array([0xa0, 0x13])))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.instruction.spec.mnemonic).toBe('pushq')
    expect(result.instruction.rA).toBe(1)
    // 解码照实记录 3，而不是替硬件「纠正」成 RNONE
    expect(result.instruction.rB).toBe(3)
  })

  it('支持非零基址的镜像', () => {
    const result = decode(0x100n, bytesSource(new Uint8Array([0x60, 0x12]), 0x100n))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.instruction.pc).toBe(0x100n)
    expect(result.instruction.valP).toBe(0x102n)
  })
})

describe('反汇编', () => {
  const cases: Array<[number[], string]> = [
    [[0x00], 'nop'],
    [[0x10], 'halt'],
    [[0x20, 0x12], 'rrmovq %rcx, %rdx'],
    [[0x30, 0xf3, 0x0a, 0, 0, 0, 0, 0, 0, 0], 'irmovq $10, %rbx'],
    [[0x40, 0x12, 0x10, 0, 0, 0, 0, 0, 0, 0], 'rmmovq %rcx, 16(%rdx)'],
    [[0x50, 0x12, 0x10, 0, 0, 0, 0, 0, 0, 0], 'mrmovq 16(%rdx), %rcx'],
    [[0xa0, 0x1f], 'pushq %rcx'],
    [[0x73, 0x2a, 0, 0, 0, 0, 0, 0, 0], 'je 0x2A'],
  ]

  for (const [bytes, expected] of cases) {
    it(expected, () => {
      const result = decode(0n, bytesSource(new Uint8Array(bytes)))
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(disassemble(result.instruction)).toBe(expected)
    })
  }
})

describe('编码器参数校验', () => {
  it('半字节越界直接抛错，而不是悄悄截断', () => {
    expect(() =>
      encodeInstruction({ icode: 0x2, ifun: 0x0, rA: 16, rB: 0, value: null }),
    ).toThrow(EncodeError)
  })

  it('未知指令编码抛错', () => {
    expect(() =>
      encodeInstruction({ icode: 0xc, ifun: 0x0, rA: 0, rB: 0, value: null }),
    ).toThrow(EncodeError)
  })
})
