/**
 * 条件码 ZF / SF / OF。
 *
 * 初始值全为 0：上电时没有任何运算发生过，「没有溢出」比「未知」更接近硬件事实
 * （触发器复位到 0），也让第一次 `je` 的判断是可复现的。
 */
export interface ConditionCodes {
  /** 最近一次运算结果是否为 0 */
  readonly ZF: boolean
  /** 最近一次运算结果的符号位 */
  readonly SF: boolean
  /** 最近一次运算是否发生补码溢出 */
  readonly OF: boolean
}

export const RESET_CC: ConditionCodes = Object.freeze({
  ZF: false,
  SF: false,
  OF: false,
})

export function sameConditionCodes(a: ConditionCodes, b: ConditionCodes): boolean {
  return a.ZF === b.ZF && a.SF === b.SF && a.OF === b.OF
}

/** 「ZFS O」这种紧凑写法，日志和面板都用它，比三个布尔值省地方 */
export function formatConditionCodes(cc: ConditionCodes): string {
  return `${cc.ZF ? 'Z' : '-'}${cc.SF ? 'S' : '-'}${cc.OF ? 'O' : '-'}`
}
