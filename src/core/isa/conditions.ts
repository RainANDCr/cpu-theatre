/**
 * Y86-64 的条件判断。
 *
 * 教材把 cmovXX 与 jXX 的 ifun 定义成同一套条件编码，这不是巧合：
 * 两者都只是「拿条件码去选一个结果」，一个是选寄存器值，一个是选下一条 PC。
 * 共用一个求值函数可以保证 `je` 与 `cmove` 永远不会给出不一致的判断。
 */
import type { ConditionCodes } from '../cpu/ConditionCodes'

export type ConditionName = 'always' | 'le' | 'l' | 'e' | 'ne' | 'ge' | 'g'

/** 下标即 ifun：0 是无条件，1..6 与教材 Figure 4.3 完全对应 */
export const CONDITION_NAMES: readonly ConditionName[] = [
  'always',
  'le',
  'l',
  'e',
  'ne',
  'ge',
  'g',
]

export function conditionForIfun(ifun: number): ConditionName | null {
  return CONDITION_NAMES[ifun] ?? null
}

/**
 * 条件成立吗？
 *
 * OF 与 SF 的比较必须用「异或」的语义：只有当符号位与溢出位**不一致**时，
 * 减法结果才真正为负（溢出把符号位翻反了）。
 */
export function evaluateCondition(condition: ConditionName, cc: ConditionCodes): boolean {
  switch (condition) {
    case 'always':
      return true
    case 'le':
      return cc.ZF || cc.SF !== cc.OF
    case 'l':
      return cc.SF !== cc.OF
    case 'e':
      return cc.ZF
    case 'ne':
      return !cc.ZF
    case 'ge':
      return cc.SF === cc.OF
    case 'g':
      return cc.SF === cc.OF && !cc.ZF
  }
}
