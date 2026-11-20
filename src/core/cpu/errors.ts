/**
 * CPU 核心异常。
 *
 * 只放「硬件会真的抛出」的两类：地址越界与指令解码失败。
 * 汇编期的问题不走异常，走诊断（Diagnostic）——它们发生在用户代码里，
 * 需要按行号显示，而不是中断程序。
 */
import type { Word } from './word'

export class AddressError extends Error {
  readonly address: Word
  readonly width: number
  readonly access: 'read' | 'write'

  constructor(address: Word, width: number, access: 'read' | 'write', limit: number) {
    super(
      `${access === 'read' ? '读取' : '写入'}地址 0x${address.toString(16).toUpperCase()} ` +
        `(${width} 字节) 越界，内存范围为 0x0–0x${(limit - 1).toString(16).toUpperCase()}`,
    )
    this.name = 'AddressError'
    this.address = address
    this.width = width
    this.access = access
  }
}
