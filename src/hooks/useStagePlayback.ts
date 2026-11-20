'use client'

import { useEffect, useState } from 'react'
import type { StageName } from '../core/execution/types'
import type { InstructionTrace } from '../core/seq/SEQProcessor'

/**
 * 把一条指令的六个阶段「按顺序播一遍」。
 *
 * 注意这里播的是**已经算好的**阶段列表：动画只决定「先看哪个」，
 * 不决定「发生了什么」。所以暂停在任一阶段，看到的数据都是真的。
 *
 * 新 trace 到达时不需要在 effect 里同步 setState —— 用 trace.index 做键，
 * 键变了索引自然回到 0（派生状态），effect 只负责安排下一次推进。
 */
export function useStagePlayback(
  trace: InstructionTrace | null,
  intervalMs: number,
): { stage: StageName | null; index: number; total: number } {
  const key = trace ? trace.index : -1
  const [cursor, setCursor] = useState<{ key: number; index: number }>({ key: -1, index: 0 })

  const index = cursor.key === key ? cursor.index : 0
  const total = trace?.stages.length ?? 0

  useEffect(() => {
    if (!trace || index >= trace.stages.length - 1) return
    const timer = window.setTimeout(() => {
      setCursor({ key, index: index + 1 })
    }, intervalMs)
    return () => window.clearTimeout(timer)
  }, [trace, key, index, intervalMs])

  const stage = trace ? (trace.stages[Math.min(index, total - 1)] ?? null) : null
  return { stage, index: Math.min(index, Math.max(0, total - 1)), total }
}
