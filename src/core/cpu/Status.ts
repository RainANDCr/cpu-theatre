/**
 * 处理器状态码（Stat）与异常类型。
 *
 * 这是「程序员可见」的状态，和引擎的 running/paused 完全是两件事：
 * 前者由 CPU 写进 Stat 寄存器，后者是模拟器外壳的 UI 概念。
 */
export type Stat = 'AOK' | 'HLT' | 'ADR' | 'INS'

export const STAT_LABELS: Record<Stat, { title: string; detail: string }> = {
  AOK: { title: 'AOK', detail: '正常运行' },
  HLT: { title: 'HLT', detail: '执行了 halt，程序停止' },
  ADR: { title: 'ADR', detail: '访存地址越界' },
  INS: { title: 'INS', detail: '遇到非法指令编码' },
}

/** ADR / INS 是异常终止：引擎必须停下，而不是继续执行 */
export function isFault(status: Stat): boolean {
  return status === 'ADR' || status === 'INS'
}

/** 程序已经结束（正常停机或异常），不应再接受单步 */
export function isTerminal(status: Stat): boolean {
  return status === 'HLT' || isFault(status)
}
