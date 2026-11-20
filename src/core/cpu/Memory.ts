/**
 * 模拟内存：字节寻址、小端序、带越界检查。
 *
 * 为什么不用 Map 或普通对象？
 * 教学程序会做 `%rsp = 0x100; pushq` 这样的操作，地址是算出来的。
 * 用稀疏结构永远「读得到」，越界就变成了静默的 0，学生看不到 ADR——
 * 而 ADR 恰恰是教材里要讲的一个知识点。定长 Uint8Array 让越界必须显式失败。
 */
import { AddressError } from './errors'
import { WORD_BYTES, asWord, type Word } from './word'

/** 64 KiB：足够放下教学程序与 0x100 附近的栈，又不至于让快照太贵 */
export const DEFAULT_MEMORY_SIZE = 0x10000

export interface MemoryAccess {
  kind: 'read' | 'write'
  address: Word
  /** 1 = 字节访问，8 = 字访问 */
  width: 1 | 8
  value: Word
}

export type MemoryAccessListener = (access: MemoryAccess) => void

export class Memory {
  readonly size: number
  private bytes: Uint8Array
  private listeners = new Set<MemoryAccessListener>()

  constructor(size: number = DEFAULT_MEMORY_SIZE) {
    if (!Number.isInteger(size) || size <= 0) {
      throw new RangeError(`内存大小必须是正整数，收到 ${size}`)
    }
    this.size = size
    this.bytes = new Uint8Array(size)
  }

  /**
   * 检查 [address, address+width) 是否整体落在内存内。
   * 注意必须检查整个跨度：只判断首字节会让 0x7FFC 处的 8 字节读悄悄越界。
   */
  private offset(address: Word, width: number, access: 'read' | 'write'): number {
    const start = asWord(address)
    if (start + BigInt(width) > BigInt(this.size)) {
      throw new AddressError(start, width, access, this.size)
    }
    return Number(start)
  }

  readByte(address: Word): number {
    const index = this.offset(address, 1, 'read')
    const value = this.bytes[index]!
    this.emit({ kind: 'read', address: asWord(address), width: 1, value: BigInt(value) })
    return value
  }

  writeByte(address: Word, value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xff) {
      throw new RangeError(`字节值必须是 0–255，收到 ${value}`)
    }
    const index = this.offset(address, 1, 'write')
    this.bytes[index] = value
    this.emit({ kind: 'write', address: asWord(address), width: 1, value: BigInt(value) })
  }

  /** 小端读 8 字节：低地址是低位字节 */
  readWord(address: Word): Word {
    const index = this.offset(address, WORD_BYTES, 'read')
    let value = 0n
    for (let i = WORD_BYTES - 1; i >= 0; i -= 1) {
      value = (value << 8n) | BigInt(this.bytes[index + i]!)
    }
    this.emit({ kind: 'read', address: asWord(address), width: 8, value })
    return value
  }

  /** 小端写 8 字节 */
  writeWord(address: Word, value: Word): void {
    const index = this.offset(address, WORD_BYTES, 'write')
    const word = asWord(value)
    for (let i = 0; i < WORD_BYTES; i += 1) {
      this.bytes[index + i] = Number((word >> BigInt(8 * i)) & 0xffn)
    }
    this.emit({ kind: 'write', address: asWord(address), width: 8, value: word })
  }

  /** 批量写入（装载机器码）。整体预检，避免写一半才报错。 */
  load(base: Word, data: Uint8Array): void {
    const index = this.offset(base, data.length, 'write')
    this.bytes.set(data, index)
  }

  /** 读取一段连续字节（反汇编、内存视图用），不触发访问通知 */
  peek(address: Word, length: number): Uint8Array {
    const index = this.offset(address, length, 'read')
    return this.bytes.slice(index, index + length)
  }

  /** 不做边界检查的单字节读取，仅供视图层渲染固定窗口 */
  peekByte(address: number): number {
    if (address < 0 || address >= this.size) return 0
    return this.bytes[address]!
  }

  /** 读旧值但不产生访问通知：执行层写内存前要用它记录撤销信息 */
  peekWord(address: Word): Word {
    const index = this.offset(address, WORD_BYTES, 'read')
    let value = 0n
    for (let i = WORD_BYTES - 1; i >= 0; i -= 1) {
      value = (value << 8n) | BigInt(this.bytes[index + i]!)
    }
    return value
  }

  /** 不经通知的写入：只用于执行历史回滚，不是一次真实访存 */
  pokeWord(address: Word, value: Word): void {
    const index = this.offset(address, WORD_BYTES, 'write')
    const word = asWord(value)
    for (let i = 0; i < WORD_BYTES; i += 1) {
      this.bytes[index + i] = Number((word >> BigInt(8 * i)) & 0xffn)
    }
  }

  reset(): void {
    this.bytes.fill(0)
  }

  snapshot(): Uint8Array {
    return this.bytes.slice()
  }

  restore(snapshot: Uint8Array): void {
    if (snapshot.length !== this.size) {
      throw new RangeError(`快照大小 ${snapshot.length} 与内存大小 ${this.size} 不一致`)
    }
    this.bytes.set(snapshot)
  }

  /** 订阅内存访问，供调试器记录读写历史。返回取消订阅函数。 */
  onAccess(listener: MemoryAccessListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(access: MemoryAccess): void {
    for (const listener of this.listeners) listener(access)
  }
}
