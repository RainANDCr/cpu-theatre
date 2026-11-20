/**
 * 阶段 4：访存。
 *
 * 只有四类指令真的访存：
 *   - `rmmovq` 写内存（地址 valE，数据 valA）
 *   - `mrmovq` 读内存（地址 valE）
 *   - `pushq` 写内存（地址 valE = %rsp-8，数据 valA）
 *   - `call`  写内存（地址 valE = %rsp-8，数据 valP ← 返回地址）
 *   - `popq` / `ret` 读内存（地址 valA = 旧 %rsp）
 *
 * 越界在这里被捕获并转成 ADR，而不是让异常冒到调用方——
 * 「访存失败」在硬件里是一个状态码，不是一次崩溃。
 */
import { AddressError } from '../cpu/errors'
import type { Memory } from '../cpu/Memory'
import type { Word } from '../cpu/word'
import { ICODE } from '../isa/instructions'
import type { DecodeStage, ExecuteStage, FetchStage, MemoryStage } from './types'

const NO_ACCESS: MemoryStage = {
  kind: 'none',
  address: null,
  writeValue: null,
  readValue: null,
  previous: null,
  status: 'AOK',
  message: null,
}

export function memoryStage(
  fetch: FetchStage,
  decode: DecodeStage,
  execute: ExecuteStage,
  memory: Memory,
): MemoryStage {
  const { icode } = fetch
  const valE = execute.valE
  const valA = decode.valA

  let address: Word | null = null
  let writeValue: Word | null = null
  let read = false
  let write = false

  if (icode === ICODE.RMMOVQ) {
    address = valE
    writeValue = valA
    write = true
  } else if (icode === ICODE.MRMOVQ) {
    address = valE
    read = true
  } else if (icode === ICODE.PUSHQ) {
    address = valE
    writeValue = valA
    write = true
  } else if (icode === ICODE.CALL) {
    address = valE
    writeValue = fetch.valP
    write = true
  } else if (icode === ICODE.POPQ || icode === ICODE.RET) {
    address = valA
    read = true
  }

  if (!read && !write) return NO_ACCESS

  try {
    if (read) {
      const value = memory.readWord(address!)
      return {
        kind: 'read',
        address,
        writeValue: null,
        readValue: value,
        previous: null,
        status: 'AOK',
        message: null,
      }
    }

    const previous = memory.peekWord(address!)
    memory.writeWord(address!, writeValue!)
    return {
      kind: 'write',
      address,
      writeValue,
      readValue: null,
      previous,
      status: 'AOK',
      message: null,
    }
  } catch (error) {
    if (error instanceof AddressError) {
      return {
        kind: read ? 'read' : 'write',
        address,
        writeValue,
        readValue: null,
        previous: null,
        status: 'ADR',
        message: error.message,
      }
    }
    throw error
  }
}
