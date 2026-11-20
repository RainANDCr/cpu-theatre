import { describe, expect, it } from 'vitest'
import {
  CONDITION_NAMES,
  conditionForIfun,
  evaluateCondition,
  type ConditionName,
} from '../../src/core/isa/conditions'
import type { ConditionCodes } from '../../src/core/cpu/ConditionCodes'

function cc(ZF: boolean, SF: boolean, OF: boolean): ConditionCodes {
  return { ZF, SF, OF }
}

/**
 * 教材 Table 4.2 的完整真值表。
 * 每一行都是 (ZF, SF, OF) 的一种组合，逐条对照可以避免
 * 「le 写成 ZF & SF」这类只错一半的 bug。
 */
const TABLE: Array<{
  flags: [boolean, boolean, boolean]
  expected: Record<Exclude<ConditionName, 'always'>, boolean>
}> = [
  { flags: [false, false, false], expected: { le: false, l: false, e: false, ne: true, ge: true, g: true } },
  { flags: [true, false, false], expected: { le: true, l: false, e: true, ne: false, ge: true, g: false } },
  { flags: [false, true, false], expected: { le: true, l: true, e: false, ne: true, ge: false, g: false } },
  { flags: [true, true, true], expected: { le: true, l: false, e: true, ne: false, ge: true, g: false } },
  { flags: [false, false, true], expected: { le: true, l: true, e: false, ne: true, ge: false, g: false } },
  { flags: [true, false, true], expected: { le: true, l: true, e: true, ne: false, ge: false, g: false } },
  { flags: [false, true, true], expected: { le: false, l: false, e: false, ne: true, ge: true, g: true } },
]

describe('条件判断真值表', () => {
  for (const row of TABLE) {
    const [ZF, SF, OF] = row.flags
    it(`ZF=${+ZF} SF=${+SF} OF=${+OF}`, () => {
      const flags = cc(ZF, SF, OF)
      for (const [condition, expected] of Object.entries(row.expected)) {
        expect(evaluateCondition(condition as ConditionName, flags), condition).toBe(expected)
      }
    })
  }

  it('always 永远成立', () => {
    expect(evaluateCondition('always', cc(false, false, false))).toBe(true)
    expect(evaluateCondition('always', cc(true, true, true))).toBe(true)
  })
})

describe('ifun → 条件', () => {
  it('0–6 依次对应 jmp/rrmovq、le、l、e、ne、ge、g', () => {
    expect(CONDITION_NAMES).toEqual(['always', 'le', 'l', 'e', 'ne', 'ge', 'g'])
    for (let ifun = 0; ifun <= 6; ifun += 1) {
      expect(conditionForIfun(ifun)).toBe(CONDITION_NAMES[ifun])
    }
  })

  it('未定义的条件编号返回 null', () => {
    expect(conditionForIfun(7)).toBeNull()
    expect(conditionForIfun(0xf)).toBeNull()
  })
})
