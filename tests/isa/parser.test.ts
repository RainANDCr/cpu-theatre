import { describe, expect, it } from 'vitest'
import { parse } from '../../src/core/isa/parser'
import { RNONE, registerId } from '../../src/core/isa/registers'

describe('汇编解析器：基本行结构', () => {
  it('忽略空行与注释', () => {
    const result = parse(`
# 全是注释
   
nop
`)
    expect(result.instructions).toHaveLength(1)
    expect(result.instructions[0]!.mnemonic).toBe('nop')
    expect(result.diagnostics).toHaveLength(0)
  })

  it('行尾注释被剥离', () => {
    const result = parse('irmovq $10, %rax   # 送 10 到 rax')
    expect(result.instructions[0]!.valueToken).toBe('10')
    expect(result.instructions[0]!.sourceText).toBe('irmovq $10, %rax')
  })

  it('独立标签行指向下一条指令', () => {
    const result = parse('loop:\naddq %rax, %rbx')
    expect(result.labels).toEqual([{ name: 'loop', line: 1, itemIndex: 0 }])
    expect(result.instructions).toHaveLength(1)
  })

  it('标签与指令可同行', () => {
    const result = parse('target: irmovq $2, %rcx')
    expect(result.labels[0]!.itemIndex).toBe(0)
    expect(result.instructions[0]!.mnemonic).toBe('irmovq')
  })

  it('一行可挂多个标签', () => {
    const result = parse('a: b: halt')
    expect(result.labels.map((label) => label.name)).toEqual(['a', 'b'])
    expect(result.labels.every((label) => label.itemIndex === 0)).toBe(true)
  })

  it('文件末尾的标签指向代码之后', () => {
    const result = parse('halt\nend:')
    expect(result.labels[0]!.itemIndex).toBe(1)
  })
})

describe('汇编解析器：操作数', () => {
  it('寄存器编号与 ISA 编码一致', () => {
    const result = parse('addq %rax, %rbx')
    const instruction = result.instructions[0]!
    expect(instruction.rA).toBe(registerId('%rax'))
    expect(instruction.rB).toBe(registerId('%rbx'))
    expect(instruction.rB).toBe(3)
    expect(result.diagnostics).toHaveLength(0)
  })

  it('irmovq 的 rA 固定为 RNONE，立即数去掉 $ 前缀', () => {
    const instruction = parse('irmovq $0x1F, %r8').instructions[0]!
    expect(instruction.rA).toBe(RNONE)
    expect(instruction.rB).toBe(8)
    expect(instruction.valueToken).toBe('0x1F')
  })

  it('rmmovq 的位移与基址分离', () => {
    const instruction = parse('rmmovq %rbx, -8(%rsp)').instructions[0]!
    expect(instruction.rA).toBe(registerId('%rbx'))
    expect(instruction.rB).toBe(registerId('%rsp'))
    expect(instruction.valueToken).toBe('-8')
  })

  it('省略位移按 0 处理', () => {
    const instruction = parse('mrmovq (%rax), %rcx').instructions[0]!
    expect(instruction.valueToken).toBe('0')
  })

  it('跳转目标是符号时原样保留', () => {
    const instruction = parse('je target').instructions[0]!
    expect(instruction.valueToken).toBe('target')
    expect(instruction.rA).toBe(RNONE)
    expect(instruction.rB).toBe(RNONE)
  })

  it('pushq 只有 rA，rB 为 RNONE', () => {
    const instruction = parse('pushq %rax').instructions[0]!
    expect(instruction.rA).toBe(0)
    expect(instruction.rB).toBe(RNONE)
  })
})

describe('汇编解析器：诊断', () => {
  it('未知助记符给出拼写建议', () => {
    const result = parse('movq %rax, %rbx')
    expect(result.instructions).toHaveLength(0)
    const diagnostic = result.diagnostics[0]!
    expect(diagnostic.code).toBe('unknown-mnemonic')
    expect(diagnostic.hint).toContain('rrmovq')
  })

  it('寄存器缺少 % 前缀时明确提示', () => {
    const result = parse('addq rax, %rbx')
    const diagnostic = result.diagnostics[0]!
    expect(diagnostic.code).toBe('bad-register')
    expect(diagnostic.hint).toContain('%')
    expect(result.instructions[0]!.valid).toBe(false)
  })

  it('不存在的寄存器被拒绝', () => {
    const result = parse('addq %rax, %r15')
    expect(result.diagnostics[0]!.message).toContain('%r15')
  })

  it('操作数个数不符时报出正确写法', () => {
    const result = parse('addq %rax')
    const diagnostic = result.diagnostics[0]!
    expect(diagnostic.code).toBe('operand-count')
    expect(diagnostic.hint).toBe('正确写法：addq %rA, %rB')
    // 占位仍然保留，否则后续地址会整体错位
    expect(result.instructions).toHaveLength(1)
  })

  it('立即数缺少 $ 前缀被拒绝', () => {
    const result = parse('irmovq 10, %rax')
    expect(result.diagnostics[0]!.code).toBe('bad-immediate')
  })

  it('内存操作数格式错误被拒绝', () => {
    const result = parse('rmmovq %rax, 8%rbx')
    expect(result.diagnostics[0]!.code).toBe('bad-memory-operand')
  })

  it('语法错误不影响后续行继续解析', () => {
    const result = parse('bogus\ngood:\nhalt')
    expect(result.diagnostics).toHaveLength(1)
    expect(result.instructions).toHaveLength(1)
    expect(result.labels[0]!.name).toBe('good')
  })
})
