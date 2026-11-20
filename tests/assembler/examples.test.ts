import { describe, expect, it } from 'vitest'
import { assemble } from '../../src/core/assembler/assembler'
import { EXAMPLES } from '../../src/lib/y86-examples'

/**
 * 示例程序是「会腐坏的内容」：ISA 或伪指令一改，编辑器里的按钮就可能悄悄失效，
 * 而没有任何一条单测会发现。这里对每个示例做一次真实汇编。
 */
describe('内置示例：全部可汇编', () => {
  it.each(EXAMPLES.map((example) => [example.title, example] as const))(
    '%s 汇编通过且地址落在镜像内',
    (_title, example) => {
      const result = assemble(example.code)
      const errors = result.diagnostics.filter((d) => d.severity === 'error')
      expect(errors, errors.map((d) => `${d.line}: ${d.message}`).join('; ')).toEqual([])
      expect(result.ok).toBe(true)
      expect(result.instructions.length).toBeGreaterThan(0)

      for (const instruction of result.instructions) {
        expect(Number(instruction.address) + instruction.length).toBeLessThanOrEqual(
          result.codeLength,
        )
      }
      for (const row of result.data) {
        expect(Number(row.address) + row.length).toBeLessThanOrEqual(result.codeLength)
      }
    },
  )

  it('id 与标题不重复（示例按钮的 key 与查找都依赖它们）', () => {
    expect(new Set(EXAMPLES.map((example) => example.id)).size).toBe(EXAMPLES.length)
    expect(new Set(EXAMPLES.map((example) => example.title)).size).toBe(EXAMPLES.length)
  })
})
