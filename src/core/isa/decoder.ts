/**
 * 解码器：机器码 → 指令。
 *
 * 两条原则：
 *
 * 1. **不猜测。** `(icode, ifun)` 组合不在指令表里就是非法指令（INS），
 *    绝不回退到「同 icode 的第一条」。否则 `0x2F` 会被当成 rrmovq 静默执行，
 *    而它本该是 INS —— 这类静默容错会让调试变得毫无线索。
 *
 * 2. **原样保留未使用的半字节。** 例如 `irmovq` 的 rA 按 ISA 应为 RNONE，
 *    但若内存里是别的值，解码结果照实记录。硬件确实会读那个字段（只是没用上），
 *    这正好是教学中「未定义字段不影响语义」的活例子。语义层会忽略它。
 */
import { FORM_LENGTH, findSpecByOpcode, type InstructionSpecEntry } from './instructions'
import { RNONE } from './registers'
import { formatAddress, formatInstruction } from './format'
import { AddressError } from '../cpu/errors'
import { WORD_BYTES, asWord, type Word } from '../cpu/word'

/** 只要能按地址给字节即可：内存、字节数组、甚至测试里的假对象都能喂进来 */
export interface ByteSource {
  readByte(address: Word): number
}

export interface DecodedInstruction {
  pc: Word
  icode: number
  ifun: number
  /** 未使用的位置为 RNONE */
  rA: number
  rB: number
  /** 立即数 / 位移 / 跳转目标；无则为 0n */
  valC: Word
  /** 下一条顺序指令的地址 */
  valP: Word
  length: number
  spec: InstructionSpecEntry
}

export interface DecodeFailure {
  ok: false
  pc: Word
  icode: number
  ifun: number
  /** ADR：取指越界；INS：非法编码 */
  status: 'ADR' | 'INS'
  message: string
}

export type DecodeResult = { ok: true; instruction: DecodedInstruction } | DecodeFailure

/** 把一段镜像包装成 ByteSource，越界返回 null 而不是抛异常 */
export function bytesSource(image: Uint8Array, base: Word = 0n): ByteSource {
  const origin = Number(asWord(base))
  return {
    readByte(address: Word): number {
      const index = Number(asWord(address)) - origin
      if (index < 0 || index >= image.length) {
        throw new AddressError(asWord(address), 1, 'read', origin + image.length)
      }
      return image[index]!
    },
  }
}

class FetchError extends Error {}

function fetchByte(source: ByteSource, address: Word): number {
  try {
    return source.readByte(address) & 0xff
  } catch (error) {
    if (error instanceof AddressError) throw new FetchError(error.message)
    throw error
  }
}

function fetchWord(source: ByteSource, address: Word): Word {
  let value = 0n
  for (let i = WORD_BYTES - 1; i >= 0; i -= 1) {
    value = (value << 8n) | BigInt(fetchByte(source, asWord(address + BigInt(i))))
  }
  return value
}

export function decode(pc: Word, source: ByteSource): DecodeResult {
  const start = asWord(pc)

  let first: number
  try {
    first = fetchByte(source, start)
  } catch {
    return {
      ok: false,
      pc: start,
      icode: 0,
      ifun: 0,
      status: 'ADR',
      message: `取指越界：地址 ${formatAddress(start)} 不在内存范围内`,
    }
  }

  const icode = first >> 4
  const ifun = first & 0x0f
  const spec = findSpecByOpcode(icode, ifun)
  if (!spec) {
    return {
      ok: false,
      pc: start,
      icode,
      ifun,
      status: 'INS',
      message: `非法指令编码 ${hex2(first)}（icode=${icode.toString(16).toUpperCase()}, ifun=${ifun.toString(16).toUpperCase()}）`,
    }
  }

  const length = FORM_LENGTH[spec.form]
  let rA = RNONE
  let rB = RNONE
  let valC = 0n

  try {
    // 只有 2 字节与 10 字节形态才有 rA:rB 字节。
    // jXX / call 虽然是 9 字节，但第 2 字节就是目标地址的最低字节，不能当寄存器读。
    const hasRegisterByte = spec.form !== 'none' && spec.form !== 'target'
    if (hasRegisterByte) {
      const second = fetchByte(source, asWord(start + 1n))
      rA = second >> 4
      rB = second & 0x0f
    }
    if (spec.form === 'target') {
      valC = fetchWord(source, asWord(start + 1n))
    } else if (length === 10) {
      valC = fetchWord(source, asWord(start + 2n))
    }
  } catch {
    return {
      ok: false,
      pc: start,
      icode,
      ifun,
      status: 'ADR',
      message: `取指越界：${spec.mnemonic} 需要 ${length} 字节，越过内存末尾`,
    }
  }

  return {
    ok: true,
    instruction: {
      pc: start,
      icode,
      ifun,
      rA,
      rB,
      valC,
      valP: asWord(start + BigInt(length)),
      length,
      spec,
    },
  }
}

/** 反汇编一条已解码指令 */
export function disassemble(instruction: DecodedInstruction): string {
  return formatInstruction({
    mnemonic: instruction.spec.mnemonic,
    form: instruction.spec.form,
    rA: instruction.rA,
    rB: instruction.rB,
    value: instruction.spec.form === 'none' ? null : instruction.valC,
  })
}

function hex2(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(2, '0')}`
}
