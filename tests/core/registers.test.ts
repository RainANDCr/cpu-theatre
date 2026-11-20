import { describe, expect, it } from 'vitest'
import {
  REGISTER_COUNT,
  REGISTER_NAMES,
  RNONE,
  isValidRegisterId,
  registerId,
  registerName,
} from '../../src/core/isa/registers'

describe('Y86-64 寄存器编号', () => {
  it('15 个通用寄存器，顺序即编码值', () => {
    expect(REGISTER_COUNT).toBe(15)
    expect(REGISTER_NAMES[0]).toBe('%rax')
    expect(REGISTER_NAMES[4]).toBe('%rsp')
    expect(REGISTER_NAMES[14]).toBe('%r14')
  })

  it('%rsp 必须是 4 号，%rbp 是 5 号', () => {
    expect(REGISTER_NAMES.indexOf('%rsp')).toBe(4)
    expect(REGISTER_NAMES.indexOf('%rbp')).toBe(5)
  })

  it('RNONE 是 0xF，不属于可见寄存器', () => {
    expect(RNONE).toBe(15)
    expect(isValidRegisterId(RNONE)).toBe(false)
    expect(registerName(RNONE)).toBeNull()
  })

  it('编号越界不会被当成合法寄存器', () => {
    expect(registerName(-1)).toBeNull()
    expect(registerName(1.5)).toBeNull()
    expect(registerName(REGISTER_COUNT)).toBeNull()
  })

  it('名字解析接受带不带 % 两种写法', () => {
    expect(registerId('%rsp')).toBe(4)
    expect(registerId('rsp')).toBe(4)
    expect(registerId('%RAX')).toBe(0) // 大小写不敏感
    expect(registerId('%nope')).toBeNull()
  })
})
