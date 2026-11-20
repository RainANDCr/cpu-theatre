/**
 * 编码器：指令 → 机器码。
 *
 * 与解码器严格对称。`encodeInstruction` 只负责「把给定的字段摆进字节」，
 * 不替调用方补 RNONE 之类的规范值——那是汇编器的责任。这样
 * `decode(encode(x)) === x` 这条性质才对任意半字节成立，往返测试才有意义。
 */
import { FORM_LENGTH, findSpecByOpcode } from './instructions'
import { asWord, type Word } from '../cpu/word'

export class EncodeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EncodeError'
  }
}

export interface EncodableInstruction {
  icode: number
  ifun: number
  rA: number
  rB: number
  /** 立即数 / 位移 / 跳转目标；1 字节与 2 字节指令传 null */
  value: Word | null
}

function checkNibble(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 0x0f) {
    throw new EncodeError(`${name} 必须是 0–15 的半字节，收到 ${value}`)
  }
  return value
}

export function instructionLength(icode: number, ifun: number): number {
  const spec = findSpecByOpcode(icode, ifun)
  if (!spec) {
    throw new EncodeError(`未定义的指令编码 icode=${icode}, ifun=${ifun}`)
  }
  return FORM_LENGTH[spec.form]
}

export function encodeInstruction(instruction: EncodableInstruction): Uint8Array {
  const spec = findSpecByOpcode(instruction.icode, instruction.ifun)
  if (!spec) {
    throw new EncodeError(`未定义的指令编码 icode=${instruction.icode}, ifun=${instruction.ifun}`)
  }

  const length = FORM_LENGTH[spec.form]
  const bytes = new Uint8Array(length)
  bytes[0] = (checkNibble('icode', instruction.icode) << 4) | checkNibble('ifun', instruction.ifun)

  if (length >= 2) {
    bytes[1] =
      (checkNibble('rA', instruction.rA) << 4) | checkNibble('rB', instruction.rB)
  }

  if (spec.form === 'target') {
    writeWord(bytes, 1, instruction.value ?? 0n)
  } else if (length === 10) {
    writeWord(bytes, 2, instruction.value ?? 0n)
  }

  return bytes
}

/** 小端写入 8 字节 */
function writeWord(bytes: Uint8Array, offset: number, value: Word): void {
  const word = asWord(value)
  for (let i = 0; i < 8; i += 1) {
    bytes[offset + i] = Number((word >> BigInt(8 * i)) & 0xffn)
  }
}

/** 把多条已编码指令拼成连续镜像 */
export function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const image = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    image.set(chunk, offset)
    offset += chunk.length
  }
  return image
}
