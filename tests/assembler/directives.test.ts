import { describe, expect, it } from 'vitest'
import { assemble } from '../../src/core/assembler/assembler'
import { parse } from '../../src/core/isa/parser'
import { SEQProcessor } from '../../src/core/seq/SEQProcessor'
import { registerId } from '../../src/core/isa/registers'

const R = (name: string) => registerId(name)!

const errorCodesOf = (source: string): string[] =>
  assemble(source)
    .diagnostics.filter((d) => d.severity === 'error')
    .map((d) => d.code)

const DATA_PROGRAM = `irmovq data, %rax
mrmovq 0(%rax), %rbx
halt

.pos 0x40
data: .quad 123
`

describe('伪指令 .pos / .quad：布局', () => {
  const result = assemble(DATA_PROGRAM)

  it('汇编通过', () => {
    expect(result.ok, result.diagnostics.map((d) => d.message).join('; ')).toBe(true)
  })

  it('.pos 把数据摆到 0x40，镜像长度覆盖空洞', () => {
    expect(result.instructions.map((i) => Number(i.address))).toEqual([0, 10, 20])
    expect(result.data).toHaveLength(1)
    expect(Number(result.data[0]!.address)).toBe(0x40)
    expect(result.codeLength).toBe(0x48)
    expect(result.image).toHaveLength(0x48)
  })

  it('空洞填 0，数据按小端写入', () => {
    expect(Array.from(result.image.slice(0x15, 0x40))).toEqual(new Array(0x2b).fill(0))
    expect(Array.from(result.image.slice(0x40, 0x48))).toEqual([123, 0, 0, 0, 0, 0, 0, 0])
  })

  it('标签指向数据而不是下一条指令', () => {
    expect(Number(result.labels[0]!.address)).toBe(0x40)
    expect(result.instructions[0]!.symbol).toBe('data')
    expect(result.instructions[0]!.value).toBe(0x40n)
  })

  it('数据地址也进「地址 → 行号」映射', () => {
    expect(result.addressToLine.get(0x40)).toBe(6)
  })

  it('listing 按地址混排指令与数据', () => {
    expect(result.listing.map((entry) => entry.kind)).toEqual([
      'instruction',
      'instruction',
      'instruction',
      'data',
    ])
    expect(result.data[0]!.text).toBe('.quad 123')
  })

  it('装载后 mrmovq 从数据段读到 123', () => {
    const processor = new SEQProcessor({ image: result.image })
    processor.run()
    expect(processor.readRegister(R('%rbx'))).toBe(123n)
    expect(processor.currentStat).toBe('HLT')
  })
})

describe('伪指令：标签与别名', () => {
  it('.quad 里可以写标签，值是该标签的地址', () => {
    const result = assemble(`.pos 0x20
table: .quad target
.pos 0x40
target: halt
`)
    expect(result.ok).toBe(true)
    expect(result.data[0]!.values).toEqual([0x40n])
    expect(result.data[0]!.symbols).toEqual(['target'])
    expect(Array.from(result.image.slice(0x20, 0x28))).toEqual([0x40, 0, 0, 0, 0, 0, 0, 0])
  })

  it('.org 是 .pos 的别名', () => {
    const result = assemble('halt\n.org 0x10\nhalt')
    expect(result.ok).toBe(true)
    expect(result.instructions.map((i) => Number(i.address))).toEqual([0, 0x10])
  })

  it('标签挂在 .quad 同一行时指向该数据', () => {
    const result = assemble('halt\n.pos 8\npair: .quad 1, 2')
    expect(result.labels[0]!.name).toBe('pair')
    expect(Number(result.labels[0]!.address)).toBe(8)
    expect(result.codeLength).toBe(24)
  })
})

describe('伪指令：诊断', () => {
  const errorCodes = errorCodesOf

  it('.pos 往回走会报错并保持原地址', () => {
    const result = assemble('irmovq $1, %rax\n.pos 0x5\nhalt')
    expect(errorCodes('irmovq $1, %rax\n.pos 0x5\nhalt')).toContain('pos-backward')
    // 失败的 .pos 不改布局，halt 仍在 10
    expect(result.instructions.map((i) => Number(i.address))).toEqual([0, 10])
  })

  it('.pos 只接受数字字面量', () => {
    expect(errorCodes('start: halt\n.pos start\nhalt')).toContain('bad-directive')
  })

  it('未知伪指令给出可用列表', () => {
    const result = assemble('halt\n.byte 1')
    const diagnostic = result.diagnostics.find((d) => d.code === 'bad-directive')!
    expect(diagnostic.message).toContain('.byte')
    expect(diagnostic.hint).toContain('.pos')
    expect(diagnostic.hint).toContain('.string')
    expect(result.image).toHaveLength(1)
  })

  it('.quad 引用未定义标签仍占地址', () => {
    const result = assemble('halt\n.pos 8\n.quad ghost\nhalt')
    expect(result.diagnostics.map((d) => d.code)).toContain('undefined-label')
    expect(result.instructions.map((i) => Number(i.address))).toEqual([0, 16])
    expect(result.image).toHaveLength(17)
  })

  it('超出内存容量的 .pos 被拒绝，且不分配巨大镜像', () => {
    const result = assemble('.pos 0x20000\nhalt')
    expect(result.ok).toBe(false)
    expect(result.diagnostics.map((d) => d.code)).toContain('image-too-large')
    expect(result.image.length).toBeLessThan(64 * 1024)
  })

  it('.quad 数据过多也会被拒绝', () => {
    const result = assemble(`.pos 0xFFF8
.quad 1, 2
halt`)
    expect(result.diagnostics.map((d) => d.code)).toContain('image-too-large')
    expect(result.image.length).toBeLessThanOrEqual(64 * 1024)
  })

  it('只有数据没有指令时给出空程序警告', () => {
    const result = assemble('.quad 1')
    expect(result.diagnostics.map((d) => d.code)).toContain('empty-program')
  })
})

describe('伪指令 .align：向上取整', () => {
  it('未对齐时顶到下一个边界，空隙填 0', () => {
    const result = assemble('irmovq $1, %rax\nhalt\n.align 8\nirmovq $2, %rbx')
    expect(result.ok).toBe(true)
    // 10 + 1 = 0x0B → 对齐到 0x10
    expect(result.instructions.map((i) => Number(i.address))).toEqual([0, 10, 0x10])
    expect(Array.from(result.image.slice(0x0b, 0x10))).toEqual([0, 0, 0, 0, 0])
  })

  it('已经对齐时不移动', () => {
    const aligned = assemble('halt\n.align 1\nirmovq $2, %rbx')
    expect(aligned.ok).toBe(true)
    expect(aligned.instructions.map((i) => Number(i.address))).toEqual([0, 1])
  })

  it('边界必须是正整数', () => {
    for (const bad of ['0', '-8', '0x10000']) {
      const result = assemble(`halt\n.align ${bad}\nhalt`)
      expect(result.ok).toBe(false)
      expect(result.diagnostics.map((d) => d.code)).toContain('bad-directive')
    }
  })

  it('边界不接受标签', () => {
    expect(errorCodesOf('start: halt\n.align start')).toContain('bad-directive')
  })

  it('对齐推过内存上限时报错', () => {
    const result = assemble('.pos 0xFFF9\n.align 8\nhalt')
    expect(result.diagnostics.map((d) => d.code)).toContain('image-too-large')
    expect(result.image.length).toBeLessThanOrEqual(64 * 1024)
  })
})

describe('伪指令 .string：文本落盘', () => {
  it('ASCII 逐字节写入，末尾补 NUL', () => {
    const result = assemble('halt\n.pos 0x40\nmsg: .string "Hi"')
    expect(result.ok).toBe(true)
    expect(Number(result.labels[0]!.address)).toBe(0x40)
    expect(result.data[0]!.length).toBe(3)
    expect(result.data[0]!.text).toBe('.string "Hi"')
    expect(Array.from(result.image.slice(0x40, 0x43))).toEqual([0x48, 0x69, 0])
  })

  it('转义序列被解码', () => {
    const newline = assemble('.string "a\\nb"')
    expect(Array.from(newline.image)).toEqual([0x61, 0x0a, 0x62, 0])

    const mixed = assemble('.string "a\\tb\\\"c\\\\d"')
    expect(Array.from(mixed.image)).toEqual([0x61, 0x09, 0x62, 0x22, 0x63, 0x5c, 0x64, 0])

    // 字符串内嵌的 \0 与结尾的 NUL 都要保留
    const nul = assemble('.string "a\\0b"')
    expect(Array.from(nul.image)).toEqual([0x61, 0x00, 0x62, 0x00])
  })

  it('非 ASCII 按 UTF-8 编码，不是问号', () => {
    const result = assemble('.string "中"')
    expect(Array.from(result.image)).toEqual([0xe4, 0xb8, 0xad, 0])
  })

  it('字符串里的 # 不当作注释', () => {
    const result = assemble('.string "a # b"')
    expect(result.ok).toBe(true)
    expect(Array.from(result.image)).toEqual([0x61, 0x20, 0x23, 0x20, 0x62, 0])
  })

  it('空字符串只写一个 NUL', () => {
    const result = assemble('.string ""')
    expect(result.ok).toBe(true)
    expect(Array.from(result.image)).toEqual([0])
    expect(result.data).toHaveLength(1)
  })

  it('缺引号、悬空内容、未知转义都报 bad-directive', () => {
    expect(errorCodesOf('.string hello')).toContain('bad-directive')
    expect(errorCodesOf('.string "a" extra')).toContain('bad-directive')
    expect(errorCodesOf('.string "a\\q"')).toContain('bad-directive')
  })

  it('超出内存时报错且不分配巨块', () => {
    const result = assemble('.pos 0xFFFE\n.string "abc"')
    expect(result.diagnostics.map((d) => d.code)).toContain('image-too-large')
    expect(result.image.length).toBeLessThanOrEqual(64 * 1024)
  })

  it('可执行验证：mrmovq + andq 取出首字符 H', () => {
    const result = assemble(`irmovq msg, %rax
mrmovq 0(%rax), %rbx
irmovq $255, %rcx
andq %rcx, %rbx
halt

.pos 0x40
msg: .string "Hello, Y86!"
`)
    expect(result.ok).toBe(true)
    const processor = new SEQProcessor({ image: result.image })
    processor.run()
    expect(processor.readRegister(R('%rbx'))).toBe(0x48n)
  })
})

describe('伪指令：解析层', () => {
  it('items 保持源码顺序，instructions 只含真指令', () => {
    const parsed = parse('halt\n.pos 8\n.quad 1\nhalt')
    expect(parsed.items.map((item) => item.kind)).toEqual([
      'instruction',
      'directive',
      'directive',
      'instruction',
    ])
    expect(parsed.instructions).toHaveLength(2)
    expect(parsed.directives.map((d) => d.kind)).toEqual(['pos', 'quad'])
  })

  it('伪指令不污染未知助记符诊断', () => {
    const parsed = parse('.pos 8')
    expect(parsed.diagnostics).toHaveLength(0)
  })
})
