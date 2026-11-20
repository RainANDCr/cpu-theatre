/**
 * 阶段 5：写回。
 *
 * 两个写端口：dstE 拿 ALU 的结果，dstM 拿内存读出的值。
 * 写入顺序是 dstE 先、dstM 后——`popq %rsp` 依赖这个顺序：
 * %rsp 先被加上 8，随后被弹出的值覆盖，最终结果与教材一致。
 */
import type { RegisterFile } from '../cpu/RegisterFile'
import type { Word } from '../cpu/word'
import { RNONE } from '../isa/registers'
import type { DecodeStage, ExecuteStage, MemoryStage, WritebackStage } from './types'

export function writebackStage(
  decode: DecodeStage,
  execute: ExecuteStage,
  memory: MemoryStage,
): WritebackStage {
  return {
    dstE: execute.dstE,
    dstM: decode.dstM,
    valE: execute.dstE === RNONE ? null : execute.valE,
    valM: memory.readValue,
  }
}

export interface RegisterWrite {
  register: number
  value: Word
}

/**
 * 真正执行写回。单独拆出来，是因为「谁被写了」这件事
 * 既影响状态，也影响界面的高亮，必须在同一处决定。
 */
export function applyWriteback(
  stage: WritebackStage,
  registers: RegisterFile,
): { written: RegisterWrite[] } {
  const written: RegisterWrite[] = []

  if (stage.dstE !== RNONE && stage.valE !== null) {
    if (registers.write(stage.dstE, stage.valE)) {
      written.push({ register: stage.dstE, value: stage.valE })
    }
  }
  if (stage.dstM !== RNONE && stage.valM !== null) {
    if (registers.write(stage.dstM, stage.valM)) {
      written.push({ register: stage.dstM, value: stage.valM })
    }
  }

  return { written }
}
