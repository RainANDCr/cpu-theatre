/**
 * 两遍扫描汇编器。
 *
 * 第一遍：按指令/伪指令长度推进地址，建标签表（此时才可能知道 `target` 在哪）。
 * 第二遍：解析符号、编码、生成列表。
 *
 * 为什么必须两遍？因为 Y86-64 的跳转指令是 9 字节定长、立即数是 10 字节定长，
 * 长度**不依赖**于符号值——这正是「定长编码」的好处：第一遍就能算出所有地址。
 * 若换成变长指令集（如 x86），两遍就不够了，需要迭代收敛。
 *
 * 伪指令 `.pos` 会打乱「地址连续」这个前提，但不会打乱「一遍算得出地址」：
 * `.pos` 只接受数字字面量，所以第一遍照样一次走完。
 */
import { ALL_MNEMONICS, FORM_LENGTH } from '../isa/instructions'
import { parse } from '../isa/parser'
import { encodeInstruction } from '../isa/encoder'
import { formatInstruction, formatValue } from '../isa/format'
import { hasErrors, sortDiagnostics, closestWord, type Diagnostic } from '../isa/diagnostics'
import { asWord, fitsInWord, type Word } from '../cpu/word'
import { DEFAULT_MEMORY_SIZE } from '../cpu/Memory'
import { buildLabelTable, type LabelDefinition } from './labels'

export interface AssembledInstruction {
  address: Word
  line: number
  /** 用户写的原文（已去注释） */
  sourceText: string
  /** 规范化后的汇编文本，标签已替换为地址 */
  text: string
  mnemonic: string
  icode: number
  ifun: number
  rA: number
  rB: number
  length: number
  bytes: number[]
  /** 本条指令引用的标签名；无则为 null */
  symbol: string | null
  /** 已解析的立即数 / 位移 / 目标地址 */
  value: Word
  valid: boolean
}

/** `.quad` 在镜像里产生的一行数据（不是可执行指令，但占地址） */
export interface AssembledData {
  address: Word
  line: number
  sourceText: string
  /** `.quad 10, 20` 形式，取值已解析 */
  text: string
  /** 每个 8 字节字的值 */
  values: Word[]
  /** 每个值引用的标签名；数字为 null */
  symbols: (string | null)[]
  length: number
  bytes: number[]
  valid: boolean
}

/** Listing 面板的混排条目：指令与数据按地址顺序展示 */
export type ListingEntry =
  | { kind: 'instruction'; instruction: AssembledInstruction }
  | { kind: 'data'; data: AssembledData }

export interface AssembleOptions {
  /** 代码起始地址，默认 0 */
  baseAddress?: Word
  /**
   * 镜像上限，默认与模拟内存（64 KiB）一致。
   * 没有这个上限，一句 `.pos 0xFFFFFFFFFF` 就会让汇编器分配几百 GB。
   */
  memorySize?: number
}

export interface AssembleResult {
  ok: boolean
  instructions: AssembledInstruction[]
  /** `.quad` 数据行，按地址升序 */
  data: AssembledData[]
  /** 指令 + 数据的混排列表，供 Listing 面板直接渲染 */
  listing: ListingEntry[]
  labels: LabelDefinition[]
  diagnostics: Diagnostic[]
  /** 连续机器码镜像，可直接 load 进内存（空洞填 0） */
  image: Uint8Array
  /** 代码占用字节数（含 `.pos` 跳过与 `.quad` 数据） */
  codeLength: number
  lineCount: number
  /** 地址 → 源行号，供「当前指令高亮」使用 */
  addressToLine: Map<number, number>
}

const NUMBER_PATTERN = /^[-+]?(?:0x[0-9a-fA-F]+|0b[01]+|\d+)$/

/** 解析数值字面量；超出 64 位可表示范围时返回 null，由调用方报错 */
export function parseNumberLiteral(token: string): Word | null {
  const negative = token.startsWith('-')
  const body = token.replace(/^[-+]/, '')
  let magnitude: bigint
  try {
    if (/^0x/i.test(body)) magnitude = BigInt(`0x${body.slice(2)}`)
    else if (/^0b/i.test(body)) magnitude = BigInt(`0b${body.slice(2)}`)
    else magnitude = BigInt(body)
  } catch {
    return null
  }
  const value = negative ? -magnitude : magnitude
  return fitsInWord(value) ? asWord(value) : null
}

export function assemble(source: string, options: AssembleOptions = {}): AssembleResult {
  const base = asWord(options.baseAddress ?? 0n)
  const memorySize = options.memorySize ?? DEFAULT_MEMORY_SIZE
  const parsed = parse(source)
  const diagnostics: Diagnostic[] = [...parsed.diagnostics]

  // ---- 第一遍：地址 ----
  const itemAddresses: Word[] = []
  const itemLengths: number[] = []
  let cursor = base

  const hold = (): void => {
    itemAddresses.push(cursor)
    itemLengths.push(0)
  }
  const place = (target: Word): void => {
    itemAddresses.push(target)
    itemLengths.push(0)
    cursor = target
  }

  parsed.items.forEach((item) => {
    if (item.kind === 'instruction') {
      const length = FORM_LENGTH[item.instruction.spec.form]
      // 内存是定长数组：越界的指令不能「先编码再说」，否则 load 时整块镜像都会失败
      if (cursor + BigInt(length) > BigInt(memorySize)) {
        diagnostics.push(tooLarge(item.line, cursor + BigInt(length), memorySize))
        hold()
        return
      }
      itemAddresses.push(cursor)
      itemLengths.push(length)
      cursor = asWord(cursor + BigInt(length))
      return
    }

    const directive = item.directive
    if (directive.kind === 'pos' || directive.kind === 'align') {
      // 语法层已报错的伪指令不再改地址，避免一处笔误让后面全部错位
      if (!directive.valid) {
        hold()
        return
      }
      const value = parseNumberLiteral(directive.tokens[0]!)
      if (value === null) {
        diagnostics.push({
          severity: 'error',
          code: 'value-out-of-range',
          line: directive.line,
          message: `数值 ${directive.tokens[0]} 超出 64 位可表示范围`,
          hint: '范围是 -2^63 到 2^64-1',
        })
        hold()
        return
      }

      let target: Word
      if (directive.kind === 'pos') {
        target = value
        if (target < cursor) {
          diagnostics.push({
            severity: 'error',
            code: 'pos-backward',
            line: directive.line,
            message: `.pos 0x${target.toString(16).toUpperCase()} 落在当前位置 0x${cursor
              .toString(16)
              .toUpperCase()} 之前`,
            hint: '汇编器只向前布局：已有内容不会被覆盖，请把 .pos 的地址改大',
          })
          hold()
          return
        }
      } else {
        // .align：向上取到 boundary 的整数倍；已经对齐时不动
        if (value <= 0n || value > 0x1000n) {
          diagnostics.push({
            severity: 'error',
            code: 'bad-directive',
            line: directive.line,
            message: `.align 的边界必须是 1–4096 之间的正整数，收到 ${directive.tokens[0]}`,
            hint: '常用 .align 8（8 字节对齐）',
          })
          hold()
          return
        }
        const remainder = cursor % value
        target = remainder === 0n ? cursor : asWord(cursor + (value - remainder))
      }

      if (target > BigInt(memorySize)) {
        diagnostics.push(tooLarge(directive.line, target, memorySize))
        hold()
        return
      }
      place(target)
      return
    }

    if (directive.kind === 'string') {
      // 语法层已报错的 .string 不占地址
      if (!directive.valid) {
        hold()
        return
      }
      // UTF-8 字节 + 结尾 NUL：读字符串的程序要靠这个 0 判断结束
      const wanted = BigInt(encodeStringUtf8(directive.stringValue ?? '').length + 1)
      if (cursor + wanted > BigInt(memorySize)) {
        diagnostics.push(tooLarge(directive.line, cursor + wanted, memorySize))
        hold()
        return
      }
      itemAddresses.push(cursor)
      itemLengths.push(Number(wanted))
      cursor = asWord(cursor + wanted)
      return
    }

    // .quad：每个值 8 字节，小端写进镜像
    const wanted = BigInt(directive.tokens.length * 8)
    if (cursor + wanted > BigInt(memorySize)) {
      diagnostics.push(tooLarge(directive.line, cursor + wanted, memorySize))
      itemAddresses.push(cursor)
      itemLengths.push(0)
      return
    }
    itemAddresses.push(cursor)
    itemLengths.push(Number(wanted))
    cursor = asWord(cursor + wanted)
  })

  const endAddress = cursor
  const codeLength = Number(endAddress - base)

  const labelTable = buildLabelTable(parsed.labels, itemAddresses, endAddress)
  diagnostics.push(...labelTable.diagnostics)
  const labelsByName = labelTable.byName

  // ---- 第二遍：解析符号并编码 ----
  const assembled: AssembledInstruction[] = []
  const data: AssembledData[] = []
  const listing: ListingEntry[] = []
  const addressToLine = new Map<number, number>()

  const resolve = (
    token: string,
    line: number,
  ): { value: Word; symbol: string | null } | null => {
    if (NUMBER_PATTERN.test(token)) {
      const value = parseNumberLiteral(token)
      if (value === null) {
        diagnostics.push({
          severity: 'error',
          code: 'value-out-of-range',
          line,
          message: `数值 ${token} 超出 64 位可表示范围`,
          hint: '范围是 -2^63 到 2^64-1',
        })
        return null
      }
      return { value, symbol: null }
    }

    const label = labelsByName.get(token)
    if (!label) {
      const suggestion = closestWord(token, [...labelsByName.keys(), ...ALL_MNEMONICS])
      diagnostics.push({
        severity: 'error',
        code: 'undefined-label',
        line,
        message: `未定义的标签 "${token}"`,
        hint: suggestion ? `是不是想写 "${suggestion}"？` : '检查标签拼写，或确认它已在本程序中定义',
      })
      return null
    }
    return { value: label.address, symbol: token }
  }

  parsed.items.forEach((item, index) => {
    const address = itemAddresses[index]!
    const length = itemLengths[index]!

    if (item.kind === 'directive') {
      const directive = item.directive

      if (directive.kind === 'string') {
        const value = directive.stringValue ?? ''
        const bytes = length > 0 ? [...encodeStringUtf8(value), 0] : []
        const row: AssembledData = {
          address,
          line: directive.line,
          sourceText: directive.sourceText,
          text: `.string ${quoteString(value)}`,
          values: [],
          symbols: [],
          length,
          bytes,
          valid: directive.valid,
        }
        data.push(row)
        listing.push({ kind: 'data', data: row })
        addressToLine.set(Number(address), directive.line)
        return
      }

      if (directive.kind !== 'quad') return

      const values: Word[] = []
      const symbols: (string | null)[] = []
      let valid = directive.valid
      for (const token of directive.tokens) {
        const resolved = resolve(token, directive.line)
        if (resolved) {
          values.push(resolved.value)
          symbols.push(resolved.symbol)
        } else {
          values.push(0n)
          symbols.push(null)
          valid = false
        }
      }

      const bytes: number[] = []
      if (length > 0) {
        bytes.length = length
        bytes.fill(0)
        values.forEach((value, slot) => {
          for (let i = 0; i < 8; i += 1) {
            bytes[slot * 8 + i] = Number((value >> BigInt(8 * i)) & 0xffn)
          }
        })
      }

      const row: AssembledData = {
        address,
        line: directive.line,
        sourceText: directive.sourceText,
        text: `.quad ${values.map((value) => formatValue(value)).join(', ')}`,
        values,
        symbols,
        length,
        bytes,
        valid,
      }
      data.push(row)
      listing.push({ kind: 'data', data: row })
      addressToLine.set(Number(address), directive.line)
      return
    }

    const instruction = item.instruction
    let value: Word = 0n
    let symbol: string | null = null
    let valid = instruction.valid

    if (valid && instruction.valueToken !== null) {
      const resolved = resolve(instruction.valueToken, instruction.line)
      if (resolved) {
        value = resolved.value
        symbol = resolved.symbol
      } else {
        valid = false
      }
    }

    const bytes = new Array<number>(length).fill(0)
    if (valid) {
      const encoded = encodeInstruction({
        icode: instruction.spec.icode,
        ifun: instruction.spec.ifun,
        rA: instruction.rA,
        rB: instruction.rB,
        // 只有 target / imm-reg / reg-mem / mem-reg 需要数值字段
        value: instruction.valueToken !== null ? value : null,
      })
      for (let i = 0; i < length; i += 1) bytes[i] = encoded[i]!
    }

    const row: AssembledInstruction = {
      address,
      line: instruction.line,
      sourceText: instruction.sourceText,
      text: formatInstruction({
        mnemonic: instruction.spec.mnemonic,
        form: instruction.spec.form,
        rA: instruction.rA,
        rB: instruction.rB,
        value: instruction.valueToken !== null ? value : null,
      }),
      mnemonic: instruction.spec.mnemonic,
      icode: instruction.spec.icode,
      ifun: instruction.spec.ifun,
      rA: instruction.rA,
      rB: instruction.rB,
      length,
      bytes,
      symbol,
      value,
      valid,
    }

    assembled.push(row)
    listing.push({ kind: 'instruction', instruction: row })
    addressToLine.set(Number(address), instruction.line)
  })

  const image = new Uint8Array(codeLength)
  for (const entry of listing) {
    const row = entry.kind === 'instruction' ? entry.instruction : entry.data
    image.set(row.bytes, Number(row.address - base))
  }

  // ---- 整程序级提醒 ----
  if (parsed.instructions.length === 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'empty-program',
      line: 0,
      message: '程序里没有任何指令',
      hint: '至少需要一条可执行指令，例如 halt',
    })
  } else if (!parsed.instructions.some((instruction) => instruction.mnemonic === 'halt')) {
    diagnostics.push({
      severity: 'warning',
      code: 'missing-halt',
      line: 0,
      message: '程序没有 halt 指令',
      hint: '执行会越过代码末尾，继续解释后面的零字节（0x00 = nop）',
    })
  }

  const sorted = sortDiagnostics(diagnostics)
  return {
    ok: !hasErrors(sorted),
    instructions: assembled,
    data,
    listing,
    labels: labelTable.labels,
    diagnostics: sorted,
    image,
    codeLength,
    lineCount: parsed.lineCount,
    addressToLine,
  }
}

const textEncoder = new TextEncoder()

/** `.string` 的落盘字节：UTF-8（ASCII 与之兼容，写中文也不会变成乱码问号） */
export function encodeStringUtf8(value: string): number[] {
  return Array.from(textEncoder.encode(value))
}

/** 回显时把控制字符转回转义形式，Listing 里能直接看出写了什么 */
function quoteString(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    .replace(/\0/g, '\\0')
  return `"${escaped}"`
}

function tooLarge(line: number, end: bigint, memorySize: number): Diagnostic {
  return {
    severity: 'error',
    code: 'image-too-large',
    line,
    message: `这段内容会把地址推到 0x${end.toString(16).toUpperCase()}，超出内存末尾`,
    hint: `模拟内存是 ${DEFAULT_MEMORY_SIZE / 1024} KiB（到 0x${memorySize.toString(
      16,
    ).toUpperCase()}），请把 .pos 地址、数据量或基址改小`,
  }
}
