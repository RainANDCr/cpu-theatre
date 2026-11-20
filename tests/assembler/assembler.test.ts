import { describe, expect, it } from 'vitest'
import { assemble, parseNumberLiteral } from '../../src/core/assembler/assembler'

function bytes(result: ReturnType<typeof assemble>): string {
  return Array.from(result.image, (byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(
    ' ',
  )
}

const PROGRAM_A = `irmovq $10, %rax
irmovq $20, %rbx
addq %rax, %rbx
halt
`

const PROGRAM_B = `irmovq $100, %rax
irmovq $123, %rbx
rmmovq %rbx, 0(%rax)
mrmovq 0(%rax), %rcx
halt
`

const PROGRAM_C = `irmovq $10, %rax
irmovq $10, %rbx
subq %rax, %rbx
je target
irmovq $1, %rcx
halt

target:
irmovq $2, %rcx
halt
`

describe('验收程序 A：简单加法', () => {
  const result = assemble(PROGRAM_A)

  it('汇编无错误', () => {
    expect(result.ok).toBe(true)
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0)
  })

  it('机器码逐字节正确', () => {
    expect(bytes(result)).toBe(
      '30 F0 0A 00 00 00 00 00 00 00 ' +
        '30 F3 14 00 00 00 00 00 00 00 ' +
        '60 03 ' +
        '10',
    )
  })

  it('地址连续，长度 23 字节', () => {
    expect(result.instructions.map((i) => Number(i.address))).toEqual([0, 10, 20, 22])
    expect(result.codeLength).toBe(23)
    expect(result.image).toHaveLength(23)
  })

  it('规范化文本与源码等价', () => {
    expect(result.instructions[2]!.text).toBe('addq %rax, %rbx')
  })
})

describe('验收程序 B：内存读写', () => {
  const result = assemble(PROGRAM_B)

  it('汇编无错误', () => {
    expect(result.ok).toBe(true)
  })

  it('rmmovq / mrmovq 的 rA:rB 与位移正确', () => {
    // mrmovq 的 rA 是目的寄存器（%rcx=1），rB 是基址（%rax=0），所以第二字节是 0x10
    expect(bytes(result)).toBe(
      '30 F0 64 00 00 00 00 00 00 00 ' +
        '30 F3 7B 00 00 00 00 00 00 00 ' +
        '40 30 00 00 00 00 00 00 00 00 ' +
        '50 10 00 00 00 00 00 00 00 00 ' +
        '10',
    )
  })
})

describe('验收程序 C：条件跳转', () => {
  const result = assemble(PROGRAM_C)

  it('标签被解析为绝对地址 0x2A', () => {
    expect(result.ok).toBe(true)
    const target = result.labels.find((label) => label.name === 'target')!
    expect(target.address).toBe(0x2an)
  })

  it('je 的 8 字节目标地址是小端 0x2A', () => {
    const jump = result.instructions[3]!
    expect(jump.mnemonic).toBe('je')
    expect(jump.bytes).toEqual([0x73, 0x2a, 0, 0, 0, 0, 0, 0, 0])
    expect(jump.symbol).toBe('target')
    expect(jump.text).toBe('je 0x2A')
  })

  it('向前引用不要求标签先定义', () => {
    expect(result.instructions[3]!.value).toBe(0x2an)
  })
})

describe('汇编器：标签与诊断', () => {
  it('重复标签报错并保留首次定义', () => {
    const result = assemble('a: nop\na: nop\nhalt')
    expect(result.ok).toBe(false)
    const diagnostic = result.diagnostics.find((d) => d.code === 'duplicate-label')!
    expect(diagnostic.line).toBe(2)
    expect(result.labels).toHaveLength(1)
  })

  it('未定义标签报错并给出候选', () => {
    const result = assemble('start:\nje strat\nhalt')
    expect(result.ok).toBe(false)
    const diagnostic = result.diagnostics.find((d) => d.code === 'undefined-label')!
    expect(diagnostic.hint).toContain('start')
  })

  it('缺少 halt 是警告而不是错误', () => {
    const result = assemble('addq %rax, %rbx')
    expect(result.ok).toBe(true)
    expect(result.diagnostics.some((d) => d.code === 'missing-halt')).toBe(true)
  })

  it('空程序给出警告', () => {
    const result = assemble('# 什么都没有\n')
    expect(result.ok).toBe(true)
    expect(result.diagnostics.some((d) => d.code === 'empty-program')).toBe(true)
  })

  it('指向代码末尾的标签给警告', () => {
    const result = assemble('halt\nend:')
    expect(result.diagnostics.some((d) => d.code === 'label-past-end')).toBe(true)
  })

  it('有错误的指令仍占地址，后续指令地址不错位', () => {
    const result = assemble('irmovq $1, %rax\nbogus\naddq %rax, %rbx\nhalt')
    expect(result.ok).toBe(false)
    // bogus 没有 spec，无法确定长度，因此不占地址；但 addq 必须紧跟在 10 字节之后
    expect(result.instructions.map((i) => Number(i.address))).toEqual([0, 10, 12])
  })

  it('地址与行号建立映射，供编辑器高亮', () => {
    const result = assemble(PROGRAM_A)
    expect(result.addressToLine.get(0)).toBe(1)
    expect(result.addressToLine.get(20)).toBe(3)
  })

  it('支持非零基址装载', () => {
    const result = assemble('je target\nnop\ntarget: halt', { baseAddress: 0x100n })
    expect(result.instructions[0]!.address).toBe(0x100n)
    expect(result.labels[0]!.address).toBe(0x10an)
    expect(result.instructions[0]!.bytes.slice(1, 3)).toEqual([0x0a, 0x01])
  })
})

describe('数值字面量', () => {
  it('支持十进制、十六进制、二进制与负数', () => {
    expect(parseNumberLiteral('10')).toBe(10n)
    expect(parseNumberLiteral('0x1F')).toBe(31n)
    expect(parseNumberLiteral('0b1010')).toBe(10n)
    expect(parseNumberLiteral('-8')).toBe(0xffff_ffff_ffff_fff8n)
  })

  it('超出 64 位范围返回 null', () => {
    expect(parseNumberLiteral('0x1' + '0'.repeat(20))).toBeNull()
    expect(parseNumberLiteral('-0x' + '8' + '0'.repeat(16))).toBeNull()
  })
})
