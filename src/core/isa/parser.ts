/**
 * 汇编写法解析器（第一遍之前的纯语法层）。
 *
 * 这一层**只做语法**：识别标签、助记符、操作数形态，把每个操作数归类成
 * 「寄存器编号」或「待解析的值 token」。它不解析标签地址——那需要先知道
 * 每条指令多长，属于汇编器的第二遍。把两件事混在一层里，就做不了向前引用
 * （`je target` 出现在 `target:` 之前）。
 */
import {
  ALL_MNEMONICS,
  findSpecByMnemonic,
  type InstructionSpecEntry,
  type OperandForm,
} from './instructions'
import { RNONE, registerId } from './registers'
import { closestWord, type Diagnostic } from './diagnostics'

export interface SymbolicInstruction {
  line: number
  /** 该行的原始代码（已去注释、去首尾空白），用于列表回显 */
  sourceText: string
  mnemonic: string
  spec: InstructionSpecEntry
  /** 未使用的寄存器位为 RNONE */
  rA: number
  rB: number
  /** 立即数 / 位移 / 跳转目标的原始 token；无则为 null */
  valueToken: string | null
  /** 操作数有错时置 false：地址照占，但不参与编码 */
  valid: boolean
}

export interface ParsedLabel {
  name: string
  line: number
  /** 指向 items 的下标；等于 items.length 表示标签位于代码末尾 */
  itemIndex: number
}

/**
 * 伪指令：不产生机器指令，但会改变「后续代码放在哪」或「往镜像里写数据」。
 *
 * 教材的 `yas` 用 `.pos` 把代码/数据摆到指定地址，用 `.quad` 往镜像里写 8 字节常数。
 * 没有它们，`mrmovq 0(%rax), %rbx` 这类访存程序只能先手工 `irmovq` 一个地址，
 * 学生看不到「数据在内存里、指令也在内存里」这件事。
 */
export interface ParsedDirective {
  kind: 'pos' | 'align' | 'quad' | 'string'
  line: number
  sourceText: string
  /** `.pos` 的目标地址；`.quad` 的每个待写值（数字或标签）；`.string` 为解码后的文本 */
  tokens: string[]
  /** `.string` 解码转义后的内容（其它伪指令为 undefined） */
  stringValue?: string
  valid: boolean
}

export type ParsedItem =
  | { kind: 'instruction'; line: number; instruction: SymbolicInstruction }
  | { kind: 'directive'; line: number; directive: ParsedDirective }

export interface ParseResult {
  /** 指令与伪指令按源码顺序混排：地址推进必须按真实顺序算 */
  items: ParsedItem[]
  /** 只含真指令的视图，方便调用方按「第几条指令」处理 */
  instructions: SymbolicInstruction[]
  directives: ParsedDirective[]
  labels: ParsedLabel[]
  diagnostics: Diagnostic[]
  lineCount: number
}

const LABEL_PATTERN = /^([A-Za-z_.$][A-Za-z0-9_.$]*)\s*:/
const NUMBER_PATTERN = /^[-+]?(?:0x[0-9a-fA-F]+|0b[01]+|\d+)$/
const SYMBOL_PATTERN = /^[A-Za-z_.$][A-Za-z0-9_.$]*$/

const EXPECTED_OPERANDS: Record<OperandForm, number> = {
  none: 0,
  reg: 1,
  'reg-reg': 2,
  'imm-reg': 2,
  'reg-mem': 2,
  'mem-reg': 2,
  target: 1,
}

/** 把一行拆成操作数 token。括号里不含逗号，所以直接 split 是安全的。 */
function splitOperands(text: string): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  return trimmed.split(',').map((part) => part.trim())
}

function isValueToken(token: string): boolean {
  return NUMBER_PATTERN.test(token) || SYMBOL_PATTERN.test(token)
}

/**
 * 去掉 `#` 注释，但**跳过字符串里的 `#`**。
 * 不做这件事，`.string "a # b"` 会被从中间截断，用户只会看到一个莫名其妙的引号不闭合。
 */
function stripComment(line: string): string {
  let inString = false
  let escaped = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '#') return line.slice(0, i)
  }
  return line
}

export function parse(source: string): ParseResult {
  const diagnostics: Diagnostic[] = []
  const items: ParsedItem[] = []
  const instructions: SymbolicInstruction[] = []
  const directives: ParsedDirective[] = []
  const labels: ParsedLabel[] = []
  const lines = source.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')

  const pushInstruction = (instruction: SymbolicInstruction): void => {
    instructions.push(instruction)
    items.push({ kind: 'instruction', line: instruction.line, instruction })
  }

  lines.forEach((rawLine, index) => {
    const line = index + 1
    const code = stripComment(rawLine).trim()
    if (!code) return

    // 1. 行首标签，允许一行挂多个标签（`a: b: nop`）
    let rest = code
    for (;;) {
      const match = LABEL_PATTERN.exec(rest)
      if (!match) break
      const name = match[1]!
      if (registerId(name) !== null) {
        diagnostics.push({
          severity: 'error',
          code: 'bad-label',
          line,
          message: `标签 "${name}" 与寄存器同名，无法区分`,
          hint: '换个名字，例如 "start" 或 "L1"',
        })
      } else {
        if (findSpecByMnemonic(name)) {
          diagnostics.push({
            severity: 'warning',
            code: 'label-shadows-mnemonic',
            line,
            message: `标签 "${name}" 与指令助记符同名`,
            hint: '语法上合法，但阅读时容易混淆',
          })
        }
        labels.push({ name, line, itemIndex: items.length })
      }
      rest = rest.slice(match[0].length).trim()
      if (!rest) break
    }

    // 纯标签行
    if (!rest) return

    // 2. 助记符
    const head = /^(\S+)\s*(.*)$/.exec(rest)
    const rawHead = head?.[1] ?? ''
    const operandText = head?.[2] ?? ''

    // 以点开头的是伪指令，不是机器指令：单独一条支路，别混进 ISA 表
    if (rawHead.startsWith('.')) {
      const directive = parseDirective(rawHead, operandText, code, line, diagnostics)
      if (directive) {
        directives.push(directive)
        items.push({ kind: 'directive', line, directive })
      }
      return
    }

    const mnemonic = rawHead.toLowerCase()
    const spec = findSpecByMnemonic(mnemonic)

    if (!spec) {
      const suggestion = closestWord(mnemonic, ALL_MNEMONICS)
      diagnostics.push({
        severity: 'error',
        code: 'unknown-mnemonic',
        line,
        message: `未知指令 "${head?.[1] ?? rest}"`,
        hint: suggestion ? `是不是想写 "${suggestion}"？` : '可用指令见指令表（Learning Center → ISA）',
      })
      return // 没有 spec 就无法确定长度，这条指令不占地址
    }

    // 3. 操作数
    const operands = splitOperands(operandText)
    const expected = EXPECTED_OPERANDS[spec.form]
    const instruction: SymbolicInstruction = {
      line,
      sourceText: code,
      mnemonic: spec.mnemonic,
      spec,
      rA: RNONE,
      rB: RNONE,
      valueToken: null,
      valid: true,
    }

    if (operands.length !== expected) {
      diagnostics.push({
        severity: 'error',
        code: 'operand-count',
        line,
        message: `${spec.mnemonic} 需要 ${expected} 个操作数，收到 ${operands.length} 个`,
        hint: `正确写法：${spec.syntax}`,
      })
      instruction.valid = false
      pushInstruction(instruction)
      return
    }

    const fail = (message: string, hint?: string, code: Diagnostic['code'] = 'bad-register') => {
      diagnostics.push({ severity: 'error', code, line, message, hint })
      instruction.valid = false
    }

    const readRegister = (token: string, position: string): number => {
      if (!token) {
        fail(`${position}操作数为空`)
        return RNONE
      }
      if (!token.startsWith('%')) {
        fail(`"${token}" 不是寄存器`, `寄存器需要 % 前缀，例如 %rax`, 'bad-register')
        return RNONE
      }
      const id = registerId(token)
      if (id === null) {
        fail(`不存在的寄存器 "${token}"`, 'Y86-64 只有 %rax–%r14 共 15 个寄存器', 'bad-register')
        return RNONE
      }
      return id
    }

    switch (spec.form) {
      case 'none':
        break

      case 'reg':
        instruction.rA = readRegister(operands[0]!, '')
        break

      case 'reg-reg':
        instruction.rA = readRegister(operands[0]!, '第一个')
        instruction.rB = readRegister(operands[1]!, '第二个')
        break

      case 'imm-reg': {
        const immediate = operands[0]!
        if (immediate.startsWith('$')) {
          const token = immediate.slice(1).trim()
          if (!isValueToken(token)) {
            fail(`无法解析的立即数 "${token}"`, '支持十进制、0x 十六进制、0b 二进制或标签名', 'bad-immediate')
          } else {
            instruction.valueToken = token
          }
        } else if (SYMBOL_PATTERN.test(immediate)) {
          // 教材 yas 的写法：`irmovq stack, %rsp` —— 裸标签表示「地址」，不加 $
          instruction.valueToken = immediate
        } else {
          fail(`"${immediate}" 不是立即数`, `立即数需要 $ 前缀，例如 $10；标签可以直接写，例如 data`, 'bad-immediate')
        }
        instruction.rB = readRegister(operands[1]!, '第二个')
        break
      }

      case 'reg-mem': {
        instruction.rA = readRegister(operands[0]!, '第一个')
        const memory = parseMemoryOperand(operands[1]!, fail)
        if (memory) {
          instruction.rB = memory.base
          instruction.valueToken = memory.displacement
        }
        break
      }

      case 'mem-reg': {
        const memory = parseMemoryOperand(operands[0]!, fail)
        if (memory) {
          instruction.rB = memory.base
          instruction.valueToken = memory.displacement
        }
        instruction.rA = readRegister(operands[1]!, '第二个')
        break
      }

      case 'target': {
        const token = operands[0]!.trim()
        if (!isValueToken(token)) {
          fail(`无法解析的跳转目标 "${token}"`, '可以是标签名或绝对地址', 'bad-target')
        } else {
          instruction.valueToken = token
        }
        break
      }
    }

    pushInstruction(instruction)
  })

  return {
    items,
    instructions,
    directives,
    labels,
    diagnostics,
    lineCount: lines.length,
  }
}

/** 支持的伪指令名（`.org` 是 yas 对 `.pos` 的别名，教材两种写法都出现过） */
export const DIRECTIVE_NAMES = ['.pos', '.org', '.align', '.quad', '.string'] as const

/**
 * 解析一条伪指令。语法错误照样记诊断并返回对象（占位但 valid=false），
 * 这样后续指令的地址不会因为一行写错而整体错位。
 */
function parseDirective(
  rawHead: string,
  operandText: string,
  sourceText: string,
  line: number,
  diagnostics: Diagnostic[],
): ParsedDirective | null {
  const name = rawHead.toLowerCase()
  if (!DIRECTIVE_NAMES.includes(name as (typeof DIRECTIVE_NAMES)[number])) {
    const suggestion = closestWord(name, DIRECTIVE_NAMES)
    diagnostics.push({
      severity: 'error',
      code: 'bad-directive',
      line,
      message: `未知伪指令 "${rawHead}"`,
      hint: suggestion
        ? `是不是想写 "${suggestion}"？`
        : '可用伪指令：.pos <地址>、.align <边界>、.quad <值>、.string "文本"',
    })
    return null
  }

  const kind: ParsedDirective['kind'] =
    name === '.quad'
      ? 'quad'
      : name === '.align'
        ? 'align'
        : name === '.string'
          ? 'string'
          : 'pos'
  const tokens = splitOperands(operandText)
  const directive: ParsedDirective = { kind, line, sourceText, tokens, valid: true }

  const fail = (message: string, hint?: string): void => {
    diagnostics.push({ severity: 'error', code: 'bad-directive', line, message, hint })
    directive.valid = false
  }

  if (kind === 'string') {
    const raw = operandText.trim()
    const quoted = /^"((?:[^"\\]|\\.)*)"$/.exec(raw)
    if (!quoted) {
      fail(`.string 需要一个用双引号包起来的文本`, '例如 .string "Hello" 或 .string ""')
      return directive
    }
    const decoded = decodeEscapes(quoted[1]!)
    if (decoded === null) {
      fail(`字符串里有无法识别的转义`, '支持 \\n \\t \\r \\0 \\\\ 与 \\"')
      return directive
    }
    directive.stringValue = decoded
    directive.tokens = [decoded]
    return directive
  }

  if (tokens.length === 0) {
    fail(
      `${name} 缺少参数`,
      kind === 'quad' ? '例如 .quad 1234' : kind === 'align' ? '例如 .align 8' : '例如 .pos 0x100',
    )
    return directive
  }

  if (kind === 'pos' || kind === 'align') {
    if (tokens.length !== 1) {
      fail(
        `${name} 只接受 1 个参数，收到 ${tokens.length} 个`,
        kind === 'pos' ? '例如 .pos 0x100' : '例如 .align 8',
      )
      return directive
    }
    const token = tokens[0]!
    // .pos 用绝对地址，不接受标签：标签地址依赖 .pos 本身，会形成循环
    if (!NUMBER_PATTERN.test(token)) {
      fail(
        kind === 'pos'
          ? `.pos 的地址必须是数字字面量，"${token}" 不是`
          : `.align 的边界必须是数字字面量，"${token}" 不是`,
        kind === 'pos' ? '例如 .pos 0x100 或 .pos 256' : '例如 .align 8',
      )
    }
    return directive
  }

  // .quad：允许一个或多个 8 字节值，每个都可以是数字或标签
  for (const token of tokens) {
    if (!isValueToken(token)) {
      fail(`.quad 的值 "${token}" 无法解析`, '可以是数字字面量或已定义的标签')
      break
    }
  }
  return directive
}

/** 只认这几种转义；未知转义返回 null，交给调用方报错而不是悄悄吞掉 */
export function decodeEscapes(text: string): string | null {
  let result = ''
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!
    if (char !== '\\') {
      result += char
      continue
    }
    const next = text[i + 1]
    if (next === undefined) return null
    i += 1
    if (next === 'n') result += '\n'
    else if (next === 't') result += '\t'
    else if (next === 'r') result += '\r'
    else if (next === '0') result += '\0'
    else if (next === '\\') result += '\\'
    else if (next === '"') result += '"'
    else return null
  }
  return result
}

interface MemoryOperand {
  base: number
  displacement: string
}

function parseMemoryOperand(
  token: string,
  fail: (message: string, hint?: string, code?: Diagnostic['code']) => void,
): MemoryOperand | null {
  const match = /^(.*)\(\s*([^()]*)\s*\)$/.exec(token.trim())
  if (!match) {
    fail(`"${token}" 不是内存操作数`, '形如 0(%rax)、-8(%rsp) 或 16(%rbx)', 'bad-memory-operand')
    return null
  }

  const displacementText = match[1]!.trim()
  const baseToken = match[2]!
  if (!baseToken.startsWith('%')) {
    fail(`内存操作数的基址必须是寄存器`, `形如 0(%rax)，收到 "(${baseToken})"`, 'bad-memory-operand')
    return null
  }
  const base = registerId(baseToken)
  if (base === null) {
    fail(`不存在的基址寄存器 "${baseToken}"`, undefined, 'bad-memory-operand')
    return null
  }

  if (displacementText && !isValueToken(displacementText)) {
    fail(`无法解析的位移 "${displacementText}"`, '位移可以是数字或标签', 'bad-memory-operand')
    return null
  }

  return { base, displacement: displacementText || '0' }
}
