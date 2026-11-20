import { describe, expect, it } from 'vitest'
import {
  FORM_LENGTH,
  INSTRUCTION_COUNT,
  INSTRUCTION_SPECS,
  findSpecByMnemonic,
  findSpecByOpcode,
} from '../../src/core/isa/instructions'
import { CONDITION_NAMES } from '../../src/core/isa/conditions'

describe('Y86-64 指令表', () => {
  it('恰好 27 条指令（教材 Figure 4.3 全集）', () => {
    // 26 个助记符之外还有 cmov/rrmovq 共享 icode 的情形，合计 27 条
    expect(INSTRUCTION_COUNT).toBe(27)
  })

  it('(icode, ifun) 组合不重复', () => {
    const keys = INSTRUCTION_SPECS.map((spec) => `${spec.icode}:${spec.ifun}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('mnemonic 不重复', () => {
    const names = INSTRUCTION_SPECS.map((spec) => spec.mnemonic)
    expect(new Set(names).size).toBe(names.length)
  })

  it('每条指令的编码长度与操作数形态一致', () => {
    for (const spec of INSTRUCTION_SPECS) {
      expect(FORM_LENGTH[spec.form], spec.mnemonic).toBeGreaterThanOrEqual(1)
    }
    expect(FORM_LENGTH.none).toBe(1)
    expect(FORM_LENGTH.reg).toBe(2)
    expect(FORM_LENGTH['reg-reg']).toBe(2)
    expect(FORM_LENGTH['imm-reg']).toBe(10)
    expect(FORM_LENGTH['reg-mem']).toBe(10)
    expect(FORM_LENGTH['mem-reg']).toBe(10)
    expect(FORM_LENGTH.target).toBe(9)
  })

  it('cmov 与 jXX 的 ifun 对应同一套条件编码', () => {
    const cmov = INSTRUCTION_SPECS.filter((spec) => spec.mnemonic.startsWith('cmov'))
    const jumps = INSTRUCTION_SPECS.filter(
      (spec) => spec.mnemonic.startsWith('j') && spec.mnemonic !== 'jmp',
    )
    expect(cmov).toHaveLength(6)
    expect(jumps).toHaveLength(6)

    for (const spec of [...cmov, ...jumps]) {
      expect(spec.condition).toBe(CONDITION_NAMES[spec.ifun])
    }
    expect(findSpecByMnemonic('rrmovq')!.condition).toBe('always')
    expect(findSpecByMnemonic('jmp')!.condition).toBe('always')
  })

  it('按编码查表与按名字查表互相对应', () => {
    for (const spec of INSTRUCTION_SPECS) {
      expect(findSpecByOpcode(spec.icode, spec.ifun)).toBe(spec)
      expect(findSpecByMnemonic(spec.mnemonic)).toBe(spec)
    }
  })

  it('未定义的 ifun 不会被当成同 icode 的指令', () => {
    // 0x2F 是 rrmovq 的 icode + 未定义的 ifun，必须是非法指令
    expect(findSpecByOpcode(0x2, 0xf)).toBeNull()
    // 0xC0 整个 icode 都不存在
    expect(findSpecByOpcode(0xc, 0x0)).toBeNull()
  })
})
