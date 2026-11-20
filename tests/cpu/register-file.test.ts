import { describe, expect, it } from 'vitest'
import { RegisterFile } from '../../src/core/cpu/RegisterFile'
import { REGISTER_COUNT, RNONE } from '../../src/core/isa/registers'

describe('寄存器文件', () => {
  it('复位后 15 个寄存器全为 0', () => {
    const file = new RegisterFile()
    for (let id = 0; id < REGISTER_COUNT; id += 1) {
      expect(file.read(id)).toBe(0n)
    }
  })

  it('写入后可读回', () => {
    const file = new RegisterFile()
    expect(file.write(0, 42n)).toBe(true)
    expect(file.read(0)).toBe(42n)
  })

  it('写入值截断到 64 位', () => {
    const file = new RegisterFile()
    file.write(1, -1n)
    expect(file.read(1)).toBe(0xffff_ffff_ffff_ffffn)
    file.write(2, 0x1_0000_0000_0000_0005n)
    expect(file.read(2)).toBe(5n)
  })

  it('读 RNONE 返回 0——这是硬件约定，不是容错', () => {
    const file = new RegisterFile()
    expect(file.read(RNONE)).toBe(0n)
  })

  it('写 RNONE 是空操作，并返回 false 以便统计写回', () => {
    const file = new RegisterFile()
    const before = file.snapshot()
    expect(file.write(RNONE, 123n)).toBe(false)
    expect(file.snapshot()).toEqual(before)
  })

  it('越界编号是内部错误，必须抛出', () => {
    const file = new RegisterFile()
    expect(() => file.read(16)).toThrow(RangeError)
    expect(() => file.write(-1, 1n)).toThrow(RangeError)
  })

  it('快照是副本，不被后续写入污染', () => {
    const file = new RegisterFile()
    file.write(0, 7n)
    const snapshot = file.snapshot()
    file.write(0, 9n)
    expect(snapshot[0]).toBe(7n)
  })

  it('restore 恢复到快照状态', () => {
    const file = new RegisterFile()
    file.write(3, 0xdeadn)
    const snapshot = file.snapshot()
    file.reset()
    file.restore(snapshot)
    expect(file.read(3)).toBe(0xdeadn)
  })

  it('restore 拒绝长度不符的快照', () => {
    const file = new RegisterFile()
    expect(() => file.restore([1n, 2n])).toThrow(RangeError)
  })
})
