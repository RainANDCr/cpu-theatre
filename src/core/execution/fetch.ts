/**
 * 阶段 1：取指。
 *
 * 只做一件事：从 PC 处读出 icode/ifun/rA/rB/valC，并算出 valP。
 * 指令合法性在这里判定——因为「字节读出来是什么」是取指的职责，
 * 而「它意味着什么」才是译码的职责。我们复用 ISA 解码器，两者共用一张表。
 */
import { decode, type ByteSource } from '../isa/decoder'
import { RNONE } from '../isa/registers'
import type { Word } from '../cpu/word'
import type { FetchStage } from './types'

export function fetchStage(pc: Word, source: ByteSource): FetchStage {
  const result = decode(pc, source)

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      message: result.message,
      icode: result.icode,
      ifun: result.ifun,
      rA: RNONE,
      rB: RNONE,
      valC: 0n,
      valP: pc,
      spec: null,
      length: 0,
    }
  }

  const instruction = result.instruction
  return {
    ok: true,
    status: 'AOK',
    message: null,
    icode: instruction.icode,
    ifun: instruction.ifun,
    rA: instruction.rA,
    rB: instruction.rB,
    valC: instruction.valC,
    valP: instruction.valP,
    spec: instruction.spec,
    length: instruction.length,
  }
}
