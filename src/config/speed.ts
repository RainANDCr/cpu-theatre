import type { AnimationSpeed } from '../store/settingsStore'

/**
 * 运行节奏的唯一来源。
 *
 * 一个档位必须同时决定两件事，否则「慢」只慢在指令之间：
 * 一条指令内部的六个阶段若仍然一闪而过，界面上你只会看到寄存器的数字在跳，
 * 看不见数据是怎么走过去的——这正是之前 0.5× 依然嫌快的真正原因
 * （旧实现里阶段播放固定 80ms/阶段，与速度档位完全无关）。
 *
 * - `instructionMs`：SEQ 中两条指令之间的间隔
 * - `stageMs`：一条指令内部每个阶段的停留时长，数据通路动画的节奏
 * - `pipelineMs`：PIPE 视图单周期的间隔。一个周期只做 1/5 条指令，
 *   所以按 0.75 的比例比 SEQ 略快，两个实验室的手感才对得上
 *
 * 三档按严格的 2 倍梯度排（2.4s / 1.2s / 0.6s），档位名字仍然诚实：
 * 2× 确实是一半时间，0.5× 确实是两倍时间。
 *
 * 0.5× 定在 2.4 s/指令：六阶段 6 × 320ms = 1.92s 播完，末尾留 0.48s
 * 让视线落在寄存器与内存的终值上。这是「跟着讲一遍」的速度，
 * 不是「看它跑完」的速度——后者用 2× 或「跑完」。
 */
export interface SpeedProfile {
  instructionMs: number
  stageMs: number
  pipelineMs: number
}

export const SPEED_PROFILES: Record<AnimationSpeed, SpeedProfile> = {
  0.5: { instructionMs: 2400, stageMs: 320, pipelineMs: 1800 },
  1: { instructionMs: 1200, stageMs: 160, pipelineMs: 900 },
  2: { instructionMs: 600, stageMs: 80, pipelineMs: 450 },
}

/** 档位顺序，界面控件按这个顺序渲染，避免两处各写一份名单 */
export const SPEED_LEVELS: readonly AnimationSpeed[] = [0.5, 1, 2]

/**
 * 读一个档位的节奏。
 * 存档里出现未知值时退回 1×：宁可慢一点，也不要把界面卡在 0ms 的死循环里。
 */
export function speedProfile(speed: AnimationSpeed | undefined): SpeedProfile {
  return SPEED_PROFILES[speed ?? 1] ?? SPEED_PROFILES[1]
}

/** 一档的节拍（秒），用于文案里的「每 x 秒一条指令」 */
export function paceSeconds(speed: AnimationSpeed): string {
  return (speedProfile(speed).instructionMs / 1000).toFixed(1)
}
