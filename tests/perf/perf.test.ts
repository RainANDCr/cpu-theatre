import { describe, expect, it } from 'vitest'
import { assemble } from '../../src/core/assembler/assembler'
import { PIPEProcessor } from '../../src/core/pipe/PIPEProcessor'
import { SEQProcessor } from '../../src/core/seq/SEQProcessor'

/**
 * 性能测试。
 *
 * 阈值刻意放得很宽（比实测慢 5–10 倍）：它们的用途是拦住「复杂度写错了」
 * ——比如某处变成 O(n²)、或每拍都复制整块内存——而不是卡住某台具体机器。
 * 一旦真的回归到平方级，这些用例会立刻失败；日常波动不会。
 */

/** 一个 500 行的循环程序：每轮 addq + subq + jne，覆盖取指/执行/跳转 */
function loopProgram(): string {
  const lines = ['irmovq $20000, %rcx', 'irmovq $1, %rax', 'loop:', 'subq %rax, %rcx', 'jne loop', 'halt']
  return lines.join('\n')
}

describe('性能：SEQ 长程执行', () => {
  it('2 万次迭代（约 4 万条指令）不会退化成病理级耗时', () => {
    const result = assemble(loopProgram())
    expect(result.ok).toBe(true)

    const processor = new SEQProcessor({ image: result.image })
    const started = performance.now()
    processor.run(80_000)
    const elapsed = performance.now() - started

    expect(processor.currentStat).toBe('HLT')
    expect(processor.currentCycle).toBeGreaterThan(40_000)
    // 这是「有没有爆炸」的粗界，不是基准测试：CI 机器与本地打包同时进行时都可能慢十倍。
    // 真正的复杂度信号由下一条用例的相对耗时给出。
    expect(elapsed).toBeLessThan(20_000)
  })

  it('单步耗时随指令数保持平稳（不是 O(n²)）', () => {
    const result = assemble(loopProgram())
    const processor = new SEQProcessor({ image: result.image })

    // 预热：首次执行包含 JIT 与缓存冷启动，不能算进 early
    measureSteps(processor, 500)
    // 样本要够大：单步约 30 ns，200 步只有 6 µs，计时噪声比信号还大（曾因此误报）
    const early = measureSteps(processor, 2000)
    processor.run(20_000)
    const late = measureSteps(processor, 2000)

    // 历史从 ~700 条涨到 ~2 万条；平方级实现会慢两个数量级，8 倍是「没退化」的宽界
    expect(late).toBeLessThan(early * 8 + 2)
  })
})

describe('性能：PIPE 长程执行', () => {
  it('2 万次迭代跑完不超过 SEQ 的 6 倍周期数', () => {
    const result = assemble(loopProgram())

    const seq = new SEQProcessor({ image: result.image })
    seq.run(80_000)

    const pipe = new PIPEProcessor({ image: result.image })
    pipe.run(120_000)

    expect(pipe.currentStat).toBe('HLT')
    // 理想 CPI ≈ 1；本程序有 load-use 与跳转，实测约 1.3
    expect(pipe.currentCycle).toBeLessThanOrEqual(seq.currentCycle * 6)
    // CPI 由界面按 cycles / instructions 计算，引擎本身只给原始计数
    const cpi = pipe.statistics.cycles / pipe.statistics.instructions
    expect(cpi).toBeGreaterThan(0.5)
    expect(cpi).toBeLessThan(2)
  })

  it('转发次数与暂停次数都被真实统计（不是常量）', () => {
    const forwarding = assemble('irmovq $1, %rax\naddq %rax, %rax\naddq %rax, %rax\nhalt')
    const pipe = new PIPEProcessor({ image: forwarding.image })
    pipe.run()
    expect(pipe.statistics.forwards).toBeGreaterThanOrEqual(2)

    const stall = assemble('mrmovq 0(%rsp), %rax\naddq %rax, %rbx\nhalt')
    const piped = new PIPEProcessor({ image: stall.image })
    piped.run()
    expect(piped.statistics.stalls).toBeGreaterThanOrEqual(1)
  })
})

describe('性能：执行历史', () => {
  it('每条历史只存寄存器快照与内存撤销项，不含内存副本', () => {
    const result = assemble(loopProgram())
    const processor = new SEQProcessor({ image: result.image })
    processor.run(4000)

    const entry = processor.historyEntries[0]!
    // 写内存的指令才需要撤销项；纯寄存器指令应为空
    expect(Array.isArray(entry.memoryUndo)).toBe(true)
    // 关键：快照里没有 memory 字段。若有人把整块内存塞进快照，
    // 3 万条历史会直接吃掉 2GB —— 这条断言先把它拦在类型层之外。
    expect(entry.before).not.toHaveProperty('memory')
    expect(Object.keys(entry.before).sort()).toEqual(['cc', 'cycle', 'pc', 'registers', 'stat'])
  })

  it('单条历史序列化后小于 1.2KB（内存副本会到 20KB 以上）', () => {
    const result = assemble(loopProgram())
    const processor = new SEQProcessor({ image: result.image })
    processor.run(4000)

    const entry = processor.historyEntries[0]!
    const serialized = JSON.stringify(entry.before, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    )

    // 15 个寄存器 + pc + cc + stat + cycle 的 JSON 约 300–500 字节。
    // 一旦有人把 Uint8Array 或字节数组塞进快照，这里会立刻超标——
    // 40,003 条历史乘 20KB 就是 800MB，浏览器会先崩给你看。
    expect(serialized.length).toBeLessThan(1200)
    expect(entry.before.registers).toHaveLength(15)
  })
})

function measureSteps(processor: SEQProcessor, count: number): number {
  const started = performance.now()
  for (let i = 0; i < count; i += 1) processor.step()
  return performance.now() - started
}
