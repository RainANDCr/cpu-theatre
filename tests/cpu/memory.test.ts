import { describe, expect, it, vi } from 'vitest'
import { Memory, DEFAULT_MEMORY_SIZE } from '../../src/core/cpu/Memory'
import { AddressError } from '../../src/core/cpu/errors'

describe('内存：小端序字节访问', () => {
  it('写 8 字节字后，低地址存放低位字节', () => {
    const memory = new Memory(256)
    memory.writeWord(100n, 123n)

    const raw = memory.peek(100n, 8)
    expect(Array.from(raw)).toEqual([0x7b, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
  })

  it('读写往返保持 64 位模式', () => {
    const memory = new Memory(256)
    const value = 0x0123_4567_89ab_cdefn
    memory.writeWord(8n, value)
    expect(memory.readWord(8n)).toBe(value)

    // 小端：地址 8 处应当是 0xEF
    expect(memory.readByte(8n)).toBe(0xef)
    expect(memory.readByte(15n)).toBe(0x01)
  })

  it('字节写入不影响相邻字节', () => {
    const memory = new Memory(16)
    memory.writeByte(3n, 0xaa)
    memory.writeByte(4n, 0xbb)
    expect(memory.readByte(3n)).toBe(0xaa)
    expect(memory.readByte(4n)).toBe(0xbb)
  })
})

describe('内存：越界检查', () => {
  it('整跨度越界必须失败，而不只看首字节', () => {
    const memory = new Memory(16)
    expect(() => memory.readWord(9n)).toThrow(AddressError)
    memory.readWord(8n) // 8..15 正好占满，合法
  })

  it('读取末尾之后的字节抛 AddressError', () => {
    const memory = new Memory(16)
    expect(() => memory.readByte(16n)).toThrow(AddressError)
  })

  it('地址按无符号解释：负数编码变成巨大地址而被拒绝', () => {
    const memory = new Memory(16)
    expect(() => memory.readByte(-1n)).toThrow(AddressError)
  })

  it('错误信息包含访问类型与地址', () => {
    const memory = new Memory(16)
    try {
      memory.readWord(16n)
      throw new Error('应当抛出异常')
    } catch (error) {
      expect(error).toBeInstanceOf(AddressError)
      const addressError = error as AddressError
      expect(addressError.access).toBe('read')
      expect(addressError.message).toContain('0x10')
    }
  })

  it('写入越界同样被拒绝', () => {
    const memory = new Memory(16)
    expect(() => memory.writeWord(10n, 1n)).toThrow(AddressError)
    expect(() => memory.writeByte(16n, 1)).toThrow(AddressError)
  })

  it('非法字节值被拒绝', () => {
    const memory = new Memory(16)
    expect(() => memory.writeByte(0n, 256)).toThrow(RangeError)
    expect(() => memory.writeByte(0n, -1)).toThrow(RangeError)
  })
})

describe('内存：装载与快照', () => {
  it('load 把机器码原样放入指定地址', () => {
    const memory = new Memory(64)
    memory.load(16n, new Uint8Array([0x30, 0xf0, 0x0a]))
    expect(memory.readByte(16n)).toBe(0x30)
    expect(memory.readByte(18n)).toBe(0x0a)
  })

  it('load 整体越界时一个字节都不写', () => {
    const memory = new Memory(8)
    expect(() => memory.load(6n, new Uint8Array([1, 2, 3]))).toThrow(AddressError)
    expect(memory.readByte(6n)).toBe(0)
  })

  it('快照是副本，后续写入不污染旧快照', () => {
    const memory = new Memory(16)
    memory.writeByte(0n, 1)
    const snapshot = memory.snapshot()
    memory.writeByte(0n, 2)
    expect(snapshot[0]).toBe(1)
    expect(memory.readByte(0n)).toBe(2)
  })

  it('restore 回到快照状态', () => {
    const memory = new Memory(16)
    memory.writeByte(5n, 0x5a)
    const snapshot = memory.snapshot()
    memory.reset()
    expect(memory.readByte(5n)).toBe(0)
    memory.restore(snapshot)
    expect(memory.readByte(5n)).toBe(0x5a)
  })

  it('默认大小为 64 KiB', () => {
    expect(new Memory().size).toBe(DEFAULT_MEMORY_SIZE)
    expect(DEFAULT_MEMORY_SIZE).toBe(0x10000)
  })
})

describe('内存：访问通知', () => {
  it('读写都会通知订阅者，取消订阅后不再收到', () => {
    const memory = new Memory(64)
    const listener = vi.fn()
    const unsubscribe = memory.onAccess(listener)

    memory.writeWord(8n, 1n)
    expect(listener).toHaveBeenCalledWith({
      kind: 'write',
      address: 8n,
      width: 8,
      value: 1n,
    })

    memory.readByte(9n)
    expect(listener).toHaveBeenLastCalledWith({
      kind: 'read',
      address: 9n,
      width: 1,
      value: 0n,
    })

    unsubscribe()
    listener.mockClear()
    memory.readByte(9n)
    expect(listener).not.toHaveBeenCalled()
  })

  it('peek 不产生访问通知（视图刷新不算真实访存）', () => {
    const memory = new Memory(64)
    const listener = vi.fn()
    memory.onAccess(listener)
    memory.peek(0n, 8)
    expect(listener).not.toHaveBeenCalled()
  })
})
