/**
 * 标签表：把「标签名」映射到「地址」。
 *
 * 必须在指令长度全部确定之后才建这张表，否则向前引用（`je target` 写在
 * `target:` 之前）无从解析。这也是两遍扫描存在的唯一理由。
 */
import type { ParsedLabel } from '../isa/parser'
import type { Diagnostic } from '../isa/diagnostics'
import type { Word } from '../cpu/word'

export interface LabelDefinition {
  name: string
  address: Word
  line: number
  /** 指向 items 下标；等于条目数表示标签在全部内容之后 */
  itemIndex: number
}

export interface LabelTable {
  labels: LabelDefinition[]
  byName: Map<string, LabelDefinition>
  diagnostics: Diagnostic[]
}

export function buildLabelTable(
  parsedLabels: readonly ParsedLabel[],
  addresses: readonly Word[],
  endAddress: Word,
): LabelTable {
  const diagnostics: Diagnostic[] = []
  const labels: LabelDefinition[] = []
  const byName = new Map<string, LabelDefinition>()

  for (const label of parsedLabels) {
    const atEnd = label.itemIndex >= addresses.length
    const address = atEnd ? endAddress : addresses[label.itemIndex]!

    const existing = byName.get(label.name)
    if (existing) {
      diagnostics.push({
        severity: 'error',
        code: 'duplicate-label',
        line: label.line,
        message: `标签 "${label.name}" 重复定义`,
        hint: `首次定义在第 ${existing.line} 行`,
      })
      continue
    }

    const definition: LabelDefinition = {
      name: label.name,
      address,
      line: label.line,
      itemIndex: label.itemIndex,
    }
    byName.set(label.name, definition)
    labels.push(definition)

    if (atEnd) {
      diagnostics.push({
        severity: 'warning',
        code: 'label-past-end',
        line: label.line,
        message: `标签 "${label.name}" 指向代码末尾之后（0x${address.toString(16).toUpperCase()}）`,
        hint: '跳转到这里会继续执行内存中的后续字节，通常不是本意',
      })
    }
  }

  return { labels, byName, diagnostics }
}
