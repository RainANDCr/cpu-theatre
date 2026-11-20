import { describe, expect, it } from 'vitest'
import { assemble } from '../../src/core/assembler/assembler'
import { asWord } from '../../src/core/cpu/word'
import { SEQProcessor } from '../../src/core/seq/SEQProcessor'
import { PIPEProcessor } from '../../src/core/pipe/PIPEProcessor'
import { registerId } from '../../src/core/isa/registers'

/**
 * 教材 Figure 4.7 的 asum.ys 原样重排。
 *
 * 这不是「又一段能跑的程序」，而是对教材印刷地址的逐行对拍：
 * 如果 `.align 8`、`.quad`、`call` 的定长编码有任何一处偏差，
 * 下表里的地址就会整体错位——这是比单元断言更硬的证据。
 */
const ASUM = `# Execution begins at address 0
    .pos 0
init:   irmovq stack, %rsp      # Set up stack pointer
        call main               # Execute main program
        halt                    # Terminate program

# Array of 4 elements
        .align 8
array:  .quad 0x000d000d000d000d
        .quad 0x00c000c000c000c0
        .quad 0x0b000b000b000b00
        .quad 0xa000a000a000a000

main:   irmovq array, %rdi
        irmovq $4, %rsi
        call sum
        ret

# long sum(long *start, long count)
# start in %rdi, count in %rsi
sum:    irmovq $8, %r8          # Constant 8
        irmovq $1, %r9          # Constant 1
        xorq %rax, %rax         # sum = 0
        andq %rsi, %rsi         # Set flags
        jmp test
loop:   mrmovq (%rdi), %r10     # Get *start
        addq %r10, %rax         # Add to sum
        addq %r8, %rdi          # start++
        subq %r9, %rsi          # count--
test:   jne loop                # Stop when 0
        ret

# Stack starts here and grows to lower addresses
    .pos 0x200
stack:
`

const ARRAY = [0x000d000d000d000dn, 0x00c000c000c000c0n, 0x0b000b000b000b00n, 0xa000a000a000a000n]
const SUM = asWord(ARRAY.reduce((total, value) => total + value, 0n))

/** Figure 4.7 左栏印刷的地址（0x018–0x030 是数据行，不算指令） */
const FIGURE_4_7 = [
  0x000, 0x00a, 0x013, // init / call main / halt
  0x038, 0x042, 0x04c, 0x055, // main
  0x056, 0x060, 0x06a, 0x06c, 0x06e, // sum 前半
  0x077, 0x081, 0x083, 0x085, 0x087, 0x090, // 循环与 test
]

const result = assemble(ASUM)

describe('教材 Figure 4.7：asum.ys', () => {
  it('汇编无错误（stack 标签在末尾只给警告）', () => {
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([])
    expect(result.diagnostics.map((d) => d.code)).toContain('label-past-end')
  })

  it('每条指令的地址与教材印刷值完全一致', () => {
    expect(result.instructions.map((i) => Number(i.address))).toEqual(FIGURE_4_7)
  })

  it('.align 8 把 array 从 0x014 顶到 0x018，空隙为 0', () => {
    const array = result.labels.find((label) => label.name === 'array')!
    expect(Number(array.address)).toBe(0x18)
    expect(Array.from(result.image.slice(0x14, 0x18))).toEqual([0, 0, 0, 0])
  })

  it('array 的 4 个常量按小端连续落盘', () => {
    const bytes = Array.from(result.image.slice(0x18, 0x38))
    ARRAY.forEach((value, index) => {
      for (let i = 0; i < 8; i += 1) {
        expect(bytes[index * 8 + i]).toBe(Number((value >> BigInt(8 * i)) & 0xffn))
      }
    })
  })

  it('stack 标签落在 0x200，镜像正是 512 字节', () => {
    expect(Number(result.labels.find((label) => label.name === 'stack')!.address)).toBe(0x200)
    expect(result.codeLength).toBe(0x200)
    expect(result.image).toHaveLength(0x200)
  })

  it('前两条指令的机器码与教材一致', () => {
    // irmovq stack, %rsp → 30 f4 00 02 00 00 00 00 00 00
    expect(Array.from(result.image.slice(0, 10))).toEqual([
      0x30, 0xf4, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ])
    // call main → 80 38 00 00 00 00 00 00 00
    expect(Array.from(result.image.slice(0x0a, 0x13))).toEqual([
      0x80, 0x38, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ])
  })
})

describe('asum 在两台机器上的终态一致', () => {
  const R = (name: string) => registerId(name)!

  it('SEQ：%rax 是四个常量的和，%rsp = 0x200', () => {
    const processor = new SEQProcessor({ image: result.image })
    processor.run()
    expect(processor.currentStat).toBe('HLT')
    expect(processor.readRegister(R('%rax'))).toBe(SUM)
    expect(processor.readRegister(R('%rsp'))).toBe(0x200n)
    expect(processor.readRegister(R('%rsi'))).toBe(0n)
    // array 在 0x18，4 次 +8 之后指针停在数组末尾
    expect(processor.readRegister(R('%rdi'))).toBe(0x38n)
  })

  it('PIPE：终态与 SEQ 逐寄存器相同', () => {
    const processor = new PIPEProcessor({ image: result.image })
    processor.run()
    expect(processor.currentStat).toBe('HLT')
    expect(processor.readRegister(R('%rax'))).toBe(SUM)
    expect(processor.readRegister(R('%rsp'))).toBe(0x200n)
    expect(processor.readRegister(R('%rsi'))).toBe(0n)
    // array 在 0x18，4 次 +8 之后指针停在数组末尾
    expect(processor.readRegister(R('%rdi'))).toBe(0x38n)
  })
})
