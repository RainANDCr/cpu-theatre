/**
 * 汇编器与反汇编器共用的文本格式化。
 *
 * 反汇编输出必须是**可再次汇编回去**的形式，所以这里只做「规范化」，
 * 不做美化：不留多余空格，不猜测用户原意，十六进制统一大写前缀。
 */
import { registerName } from './registers'
import { asSigned, toHex, type Word } from '../cpu/word'
import type { OperandForm } from './instructions'

/** 立即数 / 位移：小数值用十进制（贴近示例源码），大数值退回十六进制 */
export function formatValue(value: Word): string {
  const signed = asSigned(value)
  if (signed >= -0x8000_0000n && signed <= 0x7fff_ffffn) return signed.toString(10)
  return toHex(value)
}

/** 地址一律十六进制，且不补零——PC 在日志里要一眼能对比 */
export function formatAddress(value: Word): string {
  return `0x${value.toString(16).toUpperCase()}`
}

/** `30 F0 0A 00` 形式，长度超过 limit 时截断并标注省略字节数 */
export function formatBytes(bytes: readonly number[], limit = 8): string {
  const shown = bytes.slice(0, limit).map((byte) => byte.toString(16).toUpperCase().padStart(2, '0'))
  const rest = bytes.length - shown.length
  return rest > 0 ? `${shown.join(' ')} …(+${rest})` : shown.join(' ')
}

function regLabel(id: number): string {
  return registerName(id) ?? `%r?${id}`
}

export interface InstructionText {
  mnemonic: string
  form: OperandForm
  rA: number
  rB: number
  /** 立即数 / 位移 / 跳转目标；无则为 null */
  value: Word | null
}

/** 把一条指令渲染成标准汇编文本（反汇编、日志、列表共用） */
export function formatInstruction(instruction: InstructionText): string {
  const { mnemonic, form, rA, rB, value } = instruction
  const imm = value ?? 0n

  switch (form) {
    case 'none':
      return mnemonic
    case 'reg':
      return `${mnemonic} ${regLabel(rA)}`
    case 'reg-reg':
      return `${mnemonic} ${regLabel(rA)}, ${regLabel(rB)}`
    case 'imm-reg':
      return `${mnemonic} $${formatValue(imm)}, ${regLabel(rB)}`
    case 'reg-mem':
      return `${mnemonic} ${regLabel(rA)}, ${formatValue(imm)}(${regLabel(rB)})`
    case 'mem-reg':
      return `${mnemonic} ${formatValue(imm)}(${regLabel(rB)}), ${regLabel(rA)}`
    case 'target':
      return `${mnemonic} ${formatAddress(imm)}`
  }
}
