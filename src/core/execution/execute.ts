/**
 * 阶段 3：执行。
 *
 * ALU 的两个输入不是随手取的，它们按指令类型从不同来源选择（教材 Figure 4.18）：
 *
 *   aluA: 算术运算取 valA；带常数的取 valC；压栈类取 -8；出栈类取 +8
 *   aluB: 大多数取 valB；`rrmovq` / `irmovq` 取 0
 *
 * 「给 rrmovq 的 aluB 接 0」是 SEQ 的一个巧妙之处：传送变成了 `0 + valA`，
 * 不需要为它单独开一条数据通路。
 */
import type { ConditionCodes } from '../cpu/ConditionCodes'
import { asWord } from '../cpu/word'
import { ICODE } from '../isa/instructions'
import { RNONE } from '../isa/registers'
import { conditionForIfun, evaluateCondition } from '../isa/conditions'
import { computeAlu, aluOpForIfun, type AluOp } from './alu'
import type { DecodeStage, ExecuteStage, FetchStage } from './types'

const MINUS_EIGHT = asWord(-8n)
const EIGHT = 8n

export function executeStage(
  fetch: FetchStage,
  decode: DecodeStage,
  cc: ConditionCodes,
): ExecuteStage {
  const { icode, ifun, valC } = fetch
  const { valA, valB } = decode

  let aluA = 0n
  if (icode === ICODE.RRMOVQ || icode === ICODE.OPQ) aluA = valA
  else if (icode === ICODE.IRMOVQ || icode === ICODE.RMMOVQ || icode === ICODE.MRMOVQ) aluA = valC
  else if (icode === ICODE.CALL || icode === ICODE.PUSHQ) aluA = MINUS_EIGHT
  else if (icode === ICODE.RET || icode === ICODE.POPQ) aluA = EIGHT

  let aluB = 0n
  if (
    icode === ICODE.RMMOVQ ||
    icode === ICODE.MRMOVQ ||
    icode === ICODE.OPQ ||
    icode === ICODE.CALL ||
    icode === ICODE.PUSHQ ||
    icode === ICODE.RET ||
    icode === ICODE.POPQ
  ) {
    aluB = valB
  }

  const setCC = icode === ICODE.OPQ
  const aluOp: AluOp | null = setCC ? aluOpForIfun(ifun) : 'add'
  // 解码器已保证 OPQ 的 ifun ∈ 0..3，`?? 'add'` 只是给类型收窄兜底
  const outcome = computeAlu(aluOp ?? 'add', aluA, aluB)

  // 条件判断用的是**旧**条件码：cmov/jXX 自己不产生条件码
  let cnd = true
  if (icode === ICODE.RRMOVQ || icode === ICODE.JXX) {
    const condition = conditionForIfun(ifun)
    cnd = condition ? evaluateCondition(condition, cc) : false
  }

  const dstE =
    icode === ICODE.RRMOVQ && !cnd ? RNONE : decode.dstE

  return {
    aluA: asWord(aluA),
    aluB: asWord(aluB),
    aluOp,
    valE: outcome.value,
    cnd,
    setCC,
    nextCC: setCC ? outcome.cc : cc,
    dstE,
  }
}
