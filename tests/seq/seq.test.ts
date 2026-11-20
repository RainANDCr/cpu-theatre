import { describe, expect, it } from 'vitest'
import { assemble } from '../../src/core/assembler/assembler'
import { SEQProcessor } from '../../src/core/seq/SEQProcessor'
import { registerId } from '../../src/core/isa/registers'

function create(source: string): SEQProcessor {
  const result = assemble(source)
  expect(result.ok, result.diagnostics.map((d) => d.message).join('; ')).toBe(true)
  return new SEQProcessor({ image: result.image })
}

function runToEnd(processor: SEQProcessor) {
  processor.run()
  return processor
}

const R = (name: string) => registerId(name)!

describe('SEQ：验收程序 A（简单加法）', () => {
  const processor = runToEnd(
    create(`irmovq $10, %rax
irmovq $20, %rbx
addq %rax, %rbx
halt
`),
  )

  it('%rax = 10，%rbx = 30', () => {
    expect(processor.readRegister(R('%rax'))).toBe(10n)
    expect(processor.readRegister(R('%rbx'))).toBe(30n)
  })

  it('Stat = HLT，周期数 = 指令数', () => {
    expect(processor.currentStat).toBe('HLT')
    expect(processor.currentCycle).toBe(4)
  })

  it('halt 之后不再推进', () => {
    const result = processor.step()
    expect(result.executed).toBe(false)
    expect(result.reason).toBe('halted')
    expect(processor.currentCycle).toBe(4)
  })

  it('addq 的六个阶段都有真实数据', () => {
    const trace = processor.historyEntries[2]!.trace
    expect(trace.text).toBe('addq %rax, %rbx')
    expect(trace.stages).toEqual([
      'FETCH',
      'DECODE',
      'EXECUTE',
      'MEMORY',
      'WRITEBACK',
      'PC_UPDATE',
    ])
    expect(trace.decode!.srcA).toBe(R('%rax'))
    expect(trace.decode!.srcB).toBe(R('%rbx'))
    expect(trace.execute!.aluOp).toBe('add')
    expect(trace.execute!.valE).toBe(30n)
    expect(trace.memory!.kind).toBe('none')
    expect(trace.writeback!.dstE).toBe(R('%rbx'))
    expect(trace.registerWrites).toEqual([{ register: R('%rbx'), value: 30n }])
  })
})

describe('SEQ：验收程序 B（内存读写）', () => {
  const processor = runToEnd(
    create(`irmovq $100, %rax
irmovq $123, %rbx
rmmovq %rbx, 0(%rax)
mrmovq 0(%rax), %rcx
halt
`),
  )

  it('内存 100–107 是小端 123', () => {
    expect(Array.from(processor.memory.peek(100n, 8))).toEqual([
      0x7b, 0, 0, 0, 0, 0, 0, 0,
    ])
  })

  it('%rcx = 123', () => {
    expect(processor.readRegister(R('%rcx'))).toBe(123n)
  })

  it('写内存阶段记录了旧值，供回退使用', () => {
    const store = processor.historyEntries[2]!
    expect(store.trace.memory!.kind).toBe('write')
    expect(store.trace.memory!.address).toBe(100n)
    expect(store.trace.memory!.previous).toBe(0n)
    expect(store.memoryUndo).toEqual([{ address: 100n, previous: 0n }])
  })
})

describe('SEQ：验收程序 C（条件跳转）', () => {
  it('相等时跳到 target，%rcx = 2', () => {
    const processor = runToEnd(
      create(`irmovq $10, %rax
irmovq $10, %rbx
subq %rax, %rbx
je target
irmovq $1, %rcx
halt

target:
irmovq $2, %rcx
halt
`),
    )
    expect(processor.readRegister(R('%rcx'))).toBe(2n)
    expect(processor.historyEntries[2]!.trace.execute!.nextCC.ZF).toBe(true)
    expect(processor.historyEntries[3]!.trace.pcUpdate!.reason).toBe('jump')
    expect(processor.historyEntries[3]!.trace.pcUpdate!.taken).toBe(true)
  })

  it('条件不成立时顺序执行', () => {
    const processor = runToEnd(
      create(`irmovq $10, %rax
irmovq $20, %rbx
subq %rax, %rbx
je target
irmovq $1, %rcx
halt

target:
irmovq $2, %rcx
halt
`),
    )
    expect(processor.readRegister(R('%rcx'))).toBe(1n)
    expect(processor.historyEntries[3]!.trace.pcUpdate!.taken).toBe(false)
  })
})

describe('SEQ：栈与函数调用', () => {
  const processor = runToEnd(
    create(`irmovq $0x100, %rsp
irmovq $7, %rax
pushq %rax
call double
popq %rbx
halt

double:
addq %rax, %rax
ret
`),
  )

  it('call 压入返回地址，ret 弹出后 %rsp 复原', () => {
    expect(processor.readRegister(R('%rsp'))).toBe(0x100n)
  })

  it('被调用者修改了 %rax，调用者取回 %rbx = 7', () => {
    expect(processor.readRegister(R('%rax'))).toBe(14n)
    expect(processor.readRegister(R('%rbx'))).toBe(7n)
  })

  it('栈内存保留最后写入的值', () => {
    // pushq 在 0xF8 写入 7；call 覆盖 0xF0
    expect(processor.memory.peekWord(0xf8n)).toBe(7n)
    expect(processor.memory.peekWord(0xf0n)).toBeGreaterThan(0n)
  })

  it('popq %rsp 以弹出的值为准（dstE 先写、dstM 后写）', () => {
    const special = runToEnd(
      create(`irmovq $0x100, %rsp
irmovq $0x200, %rax
pushq %rax
popq %rsp
halt
`),
    )
    expect(special.readRegister(R('%rsp'))).toBe(0x200n)
  })
})

describe('SEQ：异常', () => {
  it('非法指令编码置 INS 并立即停机', () => {
    const processor = new SEQProcessor({ image: new Uint8Array([0xc0]) })
    const result = processor.step()
    expect(result.reason).toBe('fault')
    expect(processor.currentStat).toBe('INS')
    expect(result.trace!.stages).toEqual(['FETCH'])
    expect(result.trace!.decode).toBeNull()
  })

  it('访存越界置 ADR，且不写回、不更新 PC', () => {
    const processor = create(`irmovq $0xFFFFFFFFFF, %rax
mrmovq 0(%rax), %rcx
halt
`)
    processor.step() // irmovq
    const pcBefore = processor.currentPc
    const result = processor.step()

    expect(result.reason).toBe('fault')
    expect(processor.currentStat).toBe('ADR')
    expect(processor.currentPc).toBe(pcBefore)
    expect(processor.readRegister(R('%rcx'))).toBe(0n)
    expect(result.trace!.stages).toEqual(['FETCH', 'DECODE', 'EXECUTE', 'MEMORY'])
    expect(result.trace!.writeback).toBeNull()
  })
})

describe('SEQ：Step Back', () => {
  const source = `irmovq $100, %rax
irmovq $123, %rbx
rmmovq %rbx, 0(%rax)
addq %rbx, %rbx
halt
`

  it('回退一步后所有字段与执行前相同', () => {
    const processor = create(source)
    processor.step()
    processor.step()
    const snapshot = processor.snapshot()

    processor.step()
    expect(processor.readRegister(R('%rbx'))).toBe(123n)

    expect(processor.stepBack()).toBe(true)
    expect(processor.snapshot()).toEqual(snapshot)
  })

  it('回退会撤销内存写入', () => {
    const processor = create(source)
    processor.step()
    processor.step()
    processor.step()
    expect(processor.memory.peekWord(100n)).toBe(123n)

    processor.stepBack()
    expect(processor.memory.peekWord(100n)).toBe(0n)
  })

  it('初始状态回退返回 false', () => {
    const processor = create(source)
    expect(processor.stepBack()).toBe(false)
  })

  it('rewindTo(0) 回到刚装载的状态', () => {
    const processor = create(source)
    processor.run()
    processor.rewindTo(0)
    const fresh = create(source)
    expect(processor.snapshot()).toEqual(fresh.snapshot())
    expect(processor.memory.snapshot()).toEqual(fresh.memory.snapshot())
  })

  it('回退后重新执行得到相同结果', () => {
    const processor = create(source)
    processor.run()
    const final = processor.snapshot()
    processor.rewindTo(1)
    processor.run()
    expect(processor.snapshot()).toEqual(final)
  })
})

describe('SEQ：复位', () => {
  it('reset 清空寄存器、内存与历史', () => {
    const processor = create(`irmovq $1, %rax
irmovq $0x200, %rsp
rmmovq %rax, 0(%rsp)
halt
`)
    processor.run()
    expect(processor.memory.peekWord(0x200n)).toBe(1n)
    processor.reset()
    expect(processor.currentCycle).toBe(0)
    expect(processor.currentStat).toBe('AOK')
    expect(processor.readRegister(R('%rax'))).toBe(0n)
    expect(processor.historyEntries).toHaveLength(0)
    expect(processor.memory.peekWord(0x200n)).toBe(0n)
  })
})
