import { describe, expect, it } from 'vitest'
import {
  paceSeconds,
  SPEED_LEVELS,
  SPEED_PROFILES,
  speedProfile,
  type SpeedProfile,
} from '../../src/config/speed'

/**
 * 速度档位的契约。
 *
 * 这些断言不是把常量抄一遍，而是钉住三条「改了就会崩掉手感」的性质：
 * 梯度是严格的 2 倍、一条指令内部的阶段总时长必须装得进指令间隔、
 * 以及 PIPE 的单周期必须比 SEQ 的单指令更短。
 */
describe('运行速度档位', () => {
  it('三档按严格的 2 倍梯度排列', () => {
    expect(SPEED_LEVELS).toEqual([0.5, 1, 2])

    const [slow, normal, fast] = SPEED_LEVELS.map((level) => SPEED_PROFILES[level]!)
    expect(slow.instructionMs).toBe(normal.instructionMs * 2)
    expect(normal.instructionMs).toBe(fast.instructionMs * 2)

    // 阶段播放同样差一倍，否则「慢」只慢在指令之间
    expect(slow.stageMs).toBe(normal.stageMs * 2)
    expect(normal.stageMs).toBe(fast.stageMs * 2)
  })

  it('0.5× 是跟着讲一遍的速度，不是看它跑完的速度', () => {
    const slow = SPEED_PROFILES[0.5]
    expect(slow.instructionMs).toBeGreaterThanOrEqual(2000)
    expect(paceSeconds(0.5)).toBe('2.4')
  })

  it('六个阶段必须装得进一条指令的间隔里', () => {
    for (const level of SPEED_LEVELS) {
      const profile: SpeedProfile = SPEED_PROFILES[level]!
      const tail = profile.instructionMs - profile.stageMs * 6
      // 6 个阶段播完之后还要留一点时间给寄存器/内存的终值（至少半个阶段）
      expect(tail).toBeGreaterThanOrEqual(profile.stageMs / 2)
    }
  })

  it('PIPE 的单周期比 SEQ 的单指令更短', () => {
    for (const level of SPEED_LEVELS) {
      expect(SPEED_PROFILES[level]!.pipelineMs).toBeLessThan(SPEED_PROFILES[level]!.instructionMs)
      expect(SPEED_PROFILES[level]!.pipelineMs).toBeGreaterThan(0)
    }
  })

  it('遇到未知档位退回 1×，不会把界面卡进 0ms 的循环', () => {
    expect(speedProfile(99 as unknown as 1)).toEqual(SPEED_PROFILES[1])
    expect(speedProfile(undefined)).toEqual(SPEED_PROFILES[1])
  })
})
