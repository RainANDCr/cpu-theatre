'use client'

import { useEffect, useRef } from 'react'

export interface RunLoopOptions {
  /** 是否在连续运行。false 时定时器立刻撤掉，一拍都不多走。 */
  active: boolean
  /** 两拍之间的间隔（毫秒）。换档时排下一拍用新值，已经排好的那一拍不补跑。 */
  intervalMs: number
  /** 推进一拍。它必须是真的执行——这里只负责节奏，不负责语义。 */
  tick: () => void
  /** 拍之前的检查：返回 true 表示「该停了」（断点等）。 */
  shouldStop?: () => boolean
  /** 命中 shouldStop 时怎么停，由调用方决定（SEQ 要写 PAUSED，PIPE 不用）。 */
  onStop?: () => void
}

/**
 * 连续运行的节拍器。
 *
 * 只做三件事：等、问、推进。它不知道指令是什么、也不改任何状态，
 * 因此「暂停」只要 active 变 false 就立刻安静，「继续」只要 active 变 true 就重新起拍。
 *
 * 用自排队的 `setTimeout` 而不是 `setInterval`，是为了让换档只影响「下一拍」：
 * 已经排好的一拍不补跑、不重放。旧实现把 speed 放进 effect 依赖里重建定时器，
 * 代价是换档瞬间会顺带多执行一条指令——用户看到的是「我一按 0.5× 它就跳了一步」。
 *
 * 依赖里只有 `active` 与 `intervalMs`，`tick` / `shouldStop` 走 ref：
 * 定时器里永远调最新那份闭包，但它们的身份变化不会重建定时器。
 */
export function useRunLoop({ active, intervalMs, tick, shouldStop, onStop }: RunLoopOptions): void {
  const latest = useRef({ tick, shouldStop, onStop })
  // 这一轮运行是否已经起过拍。暂停后清零，换档时保持——换档不是重新起跑。
  const started = useRef(false)

  // 先声明、先执行：保证下面的循环拿到的是本次渲染的闭包
  useEffect(() => {
    latest.current = { tick, shouldStop, onStop }
  })

  useEffect(() => {
    if (!active) {
      started.current = false
      return
    }

    let timer = 0

    function schedule(): void {
      timer = window.setTimeout(beat, intervalMs)
    }

    function beat(): void {
      const loop = latest.current
      if (loop.shouldStop?.()) {
        loop.onStop?.()
        return
      }
      loop.tick()
      // 一拍之后可能已经停机/出错，此时 active 会变成 false，
      // React 跑 cleanup 会把下面这个 timer 清掉。
      schedule()
    }

    if (started.current) {
      // 换档：按新节奏重排下一拍，不额外执行
      schedule()
    } else {
      // 起跑：第一拍立刻走，按钮按下去界面就得有反应
      started.current = true
      beat()
    }

    return () => window.clearTimeout(timer)
  }, [active, intervalMs])
}
