/**
 * 诊断信息。汇编期的错误不抛异常：要把**所有**问题一次报给用户，
 * 而不是遇到第一个就中断——编译器 UX 的基本要求。
 */

export type DiagnosticSeverity = 'error' | 'warning'

export type DiagnosticCode =
  | 'unknown-mnemonic'
  | 'operand-count'
  | 'bad-register'
  | 'bad-immediate'
  | 'bad-memory-operand'
  | 'bad-target'
  | 'bad-label'
  | 'bad-directive'
  | 'pos-backward'
  | 'image-too-large'
  | 'duplicate-label'
  | 'undefined-label'
  | 'value-out-of-range'
  | 'empty-program'
  | 'missing-halt'
  | 'label-shadows-mnemonic'
  | 'label-past-end'
  | 'unused-nibble'

export interface Diagnostic {
  severity: DiagnosticSeverity
  code: DiagnosticCode
  /** 1 起始行号；0 表示与具体行无关（整程序级） */
  line: number
  message: string
  /** 可选的修正建议，比纯报错更有用 */
  hint?: string
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === 'error')
}

/** 稳定的排序：先按行，再把错误排在警告前面 */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line
    if (a.severity === b.severity) return 0
    return a.severity === 'error' ? -1 : 1
  })
}

/** 编辑距离，只用于「你是不是想写 ××」这类提示 */
export function closestWord(input: string, candidates: readonly string[]): string | null {
  let best: string | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const distance = editDistance(input, candidate)
    if (distance < bestDistance) {
      bestDistance = distance
      best = candidate
    }
  }
  // 距离太远就不猜了，乱猜比不猜更烦人
  return bestDistance <= 2 ? best : null
}

function editDistance(a: string, b: string): number {
  const rows = a.length + 1
  const cols = b.length + 1
  let previous = new Array<number>(cols)
  let current = new Array<number>(cols)
  for (let j = 0; j < cols; j += 1) previous[j] = j

  for (let i = 1; i < rows; i += 1) {
    current[0] = i
    for (let j = 1; j < cols; j += 1) {
      const substitution = previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min(current[j - 1]! + 1, previous[j]! + 1, substitution)
    }
    const swap = previous
    previous = current
    current = swap
  }
  return previous[cols - 1]!
}
