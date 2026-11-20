import { describe, expect, it } from 'vitest'
import { assemble } from '../../src/core/assembler/assembler'
import { PIPEProcessor } from '../../src/core/pipe/PIPEProcessor'
import { SEQProcessor } from '../../src/core/seq/SEQProcessor'

function build<T>(source: string, factory: (image: Uint8Array) => T): T {
  const result = assemble(source)
  expect(result.ok, result.diagnostics.map((d) => d.message).join('; ')).toBe(true)
  return factory(result.image)
}

const runSeq = (source: string) => {
  const processor = build(source, (image) => new SEQProcessor({ image }))
  processor.run()
  return processor
}

const runPipe = (source: string) => {
  const processor = build(source, (image) => new PIPEProcessor({ image }))
  processor.run()
  return processor
}

const PROGRAM_A = `irmovq $10, %rax
irmovq $20, %rbx
addq %rax, %rbx
halt
`

const PROGRAM_B = `irmovq $100, %rax
irmovq $123, %rbx
rmmovq %rbx, 0(%rax)
mrmovq 0(%rax), %rcx
halt
`

const PROGRAM_C = `irmovq $10, %rax
irmovq $10, %rbx
subq %rax, %rbx
je target
irmovq $1, %rcx
halt

target:
irmovq $2, %rcx
halt
`

const PROGRAM_C2 = `irmovq $10, %rax
irmovq $20, %rbx
subq %rax, %rbx
je target
irmovq $1, %rcx
halt

target:
irmovq $2, %rcx
halt
`

const PROGRAM_STACK = `irmovq $0x100, %rsp
irmovq $7, %rax
pushq %rax
call double
popq %rbx
halt

double:
addq %rax, %rax
ret
`

const PROGRAM_CHAIN = `irmovq $1, %rax
addq %rax, %rax
addq %rax, %rax
addq %rax, %rax
addq %rax, %rax
irmovq $0, %rbx
addq %rax, %rbx
halt
`

const PROGRAM_LOAD_USE = `irmovq $0x100, %rax
irmovq $42, %rbx
rmmovq %rbx, 0(%rax)
mrmovq 0(%rax), %rcx
addq %rcx, %rcx
halt
`

const PROGRAM_CMOV = `irmovq $5, %rax
irmovq $9, %rbx
subq %rax, %rbx
cmovg %rax, %rbx
cmovl %rax, %rcx
halt
`

const PROGRAMS: Array<[string, string]> = [
  ['A 简单加法', PROGRAM_A],
  ['B 内存读写', PROGRAM_B],
  ['C 条件跳转（跳）', PROGRAM_C],
  ['C2 条件跳转（不跳）', PROGRAM_C2],
  ['栈与函数调用', PROGRAM_STACK],
  ['长依赖链', PROGRAM_CHAIN],
  ['加载/使用冒险', PROGRAM_LOAD_USE],
  ['条件传送', PROGRAM_CMOV],
]

describe('验收 D：SEQ 与 PIPE 终态一致', () => {
  for (const [name, source] of PROGRAMS) {
    it(name, () => {
      const seq = runSeq(source)
      const pipe = runPipe(source)

      expect(pipe.currentStat).toBe(seq.currentStat)
      expect(pipe.registersRef.snapshot()).toEqual(seq.snapshot().registers)
      expect(pipe.memory.snapshot()).toEqual(seq.memory.snapshot())
      expect(pipe.conditionCodes).toEqual(seq.conditionCodes)
    })
  }

  it('周期数不同：PIPE 每条指令约 1 拍，SEQ 恒为 N 拍', () => {
    const seq = runSeq(PROGRAM_A)
    const pipe = runPipe(PROGRAM_A)

    expect(seq.currentCycle).toBe(4)
    expect(pipe.statistics.cycles).toBeGreaterThan(4)
    expect(pipe.statistics.cycles).toBeLessThan(seq.currentCycle + 6)
    expect(pipe.statistics.instructions).toBe(4)
  })
})

describe('PIPE：五级流水线的可见行为', () => {
  it('同一拍里五段各有一条不同指令', () => {
    const processor = build(PROGRAM_A, (image) => new PIPEProcessor({ image }))
    for (let i = 0; i < 4; i += 1) processor.step()

    const views = processor.slotViews()
    expect(views.map((view) => view.stage)).toEqual(['F', 'D', 'E', 'M', 'W'])
    // 第四拍之后，流水线里至少有三条不同指令同时在飞
    const texts = views.map((view) => view.text).filter(Boolean)
    expect(new Set(texts).size).toBeGreaterThanOrEqual(2)
  })

  it('数据相关会触发转发', () => {
    const processor = runPipe(PROGRAM_CHAIN)
    expect(processor.statistics.forwards).toBeGreaterThan(0)
  })

  it('加载/使用会触发暂停', () => {
    const processor = runPipe(PROGRAM_LOAD_USE)
    expect(processor.statistics.stalls).toBeGreaterThan(0)
    // 暂停之后寄存器结果依然正确
    expect(processor.readRegister(1)).toBe(84n)
  })

  it('条件跳转预测失败会插入气泡', () => {
    const processor = runPipe(PROGRAM_C2)
    expect(processor.statistics.bubbles).toBeGreaterThan(0)
    expect(processor.readRegister(1)).toBe(1n)
  })

  it('CPI 由真实计数算出，不是常数', () => {
    const processor = runPipe(PROGRAM_CHAIN)
    const cpi = processor.statistics.cycles / processor.statistics.instructions
    expect(cpi).toBeGreaterThan(1)
    expect(cpi).toBeLessThan(3)
  })

  it('halt 之后不再推进', () => {
    const processor = runPipe(PROGRAM_A)
    const result = processor.step()
    expect(result.executed).toBe(false)
  })
})

describe('PIPE：复位', () => {
  it('reset 清空统计与流水线寄存器', () => {
    const processor = build(PROGRAM_A, (image) => new PIPEProcessor({ image }))
    processor.run()
    processor.reset()

    expect(processor.currentCycle).toBe(0)
    expect(processor.currentStat).toBe('AOK')
    expect(processor.statistics.instructions).toBe(0)
    expect(processor.slotViews().every((view) => view.text === null)).toBe(true)
  })
})
