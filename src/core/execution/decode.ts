/**
 * 阶段 2：译码。
 *
 * 这里的 srcA / srcB / dstE / dstM 四条规则直接来自教材 Figure 4.18 的 HCL。
 * 看起来啰嗦，但每一条都对应一个真实的硬件连接：
 *
 *   - `popq` / `ret` 读的是 %rsp，而指令里根本没有写 %rsp —— 所以 srcA 要强制为 RSP；
 *   - `call` / `pushq` 要写 %rsp，指令里也没有 —— dstE 强制为 RSP；
 *   - `mrmovq` 的目的寄存器放在 rA 字段，写回走 dstM 而不是 dstE。
 *
 * 把这些「隐式寄存器」写错，症状是栈指针莫名其妙不动。
 */
import type { RegisterFile } from '../cpu/RegisterFile'
import { ICODE } from '../isa/instructions'
import { RNONE, STACK_POINTER_ID as RSP } from '../isa/registers'
import type { DecodeStage, FetchStage } from './types'

export function decodeStage(fetch: FetchStage, registers: RegisterFile): DecodeStage {
  const { icode, rA, rB } = fetch

  let srcA = RNONE
  if (icode === ICODE.RRMOVQ || icode === ICODE.RMMOVQ || icode === ICODE.OPQ || icode === ICODE.PUSHQ) {
    srcA = rA
  } else if (icode === ICODE.POPQ || icode === ICODE.RET) {
    srcA = RSP
  }

  let srcB = RNONE
  if (
    icode === ICODE.RRMOVQ ||
    icode === ICODE.IRMOVQ ||
    icode === ICODE.OPQ ||
    icode === ICODE.RMMOVQ ||
    icode === ICODE.MRMOVQ
  ) {
    srcB = rB
  } else if (icode === ICODE.CALL || icode === ICODE.RET || icode === ICODE.PUSHQ || icode === ICODE.POPQ) {
    srcB = RSP
  }

  let dstE = RNONE
  if (icode === ICODE.RRMOVQ || icode === ICODE.IRMOVQ || icode === ICODE.OPQ) {
    dstE = rB
  } else if (icode === ICODE.PUSHQ || icode === ICODE.POPQ || icode === ICODE.CALL || icode === ICODE.RET) {
    dstE = RSP
  }

  // dstM 是「从内存读出的值写回哪个寄存器」：mrmovq 与 popq 都有这个端口
  const dstM = icode === ICODE.MRMOVQ || icode === ICODE.POPQ ? rA : RNONE

  return {
    srcA,
    srcB,
    valA: registers.read(srcA),
    valB: registers.read(srcB),
    dstE,
    dstM,
  }
}
