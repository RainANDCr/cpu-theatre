/**
 * 阶段 6：更新 PC。
 *
 * 四条规则：halt 停住、ret 用 valM、跳转（条件成立）用 valC、其余用 valP。
 *
 * 注意 `ret` 用的是**内存读出**的地址，不是 valC（ret 根本没有常数段）。
 * 这一点写错，函数调用会在 ret 处跳回自己的下一条指令，看起来像死循环。
 */
import type { Word } from '../cpu/word'
import { ICODE } from '../isa/instructions'
import type { ExecuteStage, FetchStage, MemoryStage, PcUpdateStage } from './types'

export function pcUpdateStage(
  fetch: FetchStage,
  execute: ExecuteStage,
  memory: MemoryStage,
  pc: Word,
): PcUpdateStage {
  const { icode } = fetch

  if (icode === ICODE.HALT) {
    return { nextPc: pc, reason: 'halt', taken: true }
  }

  if (icode === ICODE.RET) {
    return { nextPc: memory.readValue ?? fetch.valP, reason: 'ret', taken: true }
  }

  if (icode === ICODE.JXX) {
    return {
      nextPc: execute.cnd ? fetch.valC : fetch.valP,
      reason: 'jump',
      taken: execute.cnd,
    }
  }

  if (icode === ICODE.CALL) {
    return { nextPc: fetch.valC, reason: 'call', taken: true }
  }

  return { nextPc: fetch.valP, reason: 'sequential', taken: true }
}
