/**
 * 15 个 64 位通用寄存器。
 *
 * 关键设计：寄存器文件**同时是 RNONE 语义的落地点**。
 * 教材里读 `srcA = RNONE` 返回 0、写 `dstE = RNONE` 不生效，靠的不是每条指令各自判断，
 * 而是寄存器文件本身的这两个约定：
 *
 *   - read(RNONE)  → 0n      （`irmovq` 的 valA、`jmp` 的 valA 都需要它）
 *   - write(RNONE) → 无操作  （cmov 条件不成立时 dstE 就是 RNONE）
 *
 * 把这条规则放在这里，SEQ 与 PIPE 才能共用同一份语义，且不必在几十个分支里重复判断。
 */
import { REGISTER_COUNT, RNONE } from '../isa/registers'
import { asWord, type Word } from './word'

export class RegisterFile {
  private values: Word[]

  constructor() {
    this.values = new Array<Word>(REGISTER_COUNT).fill(0n)
  }

  /**
   * 读寄存器。
   * @param id 0–15；15（RNONE）返回 0，这正是硬件行为，不是容错。
   */
  read(id: number): Word {
    if (id === RNONE) return 0n
    if (id < 0 || id >= REGISTER_COUNT) {
      throw new RangeError(`寄存器编号越界：${id}`)
    }
    return this.values[id]!
  }

  /**
   * 写寄存器。写入值强制截断到 64 位——这是硬件里寄存器位宽的直接后果。
   * @returns 是否真正写入（RNONE 返回 false，便于引擎统计写回次数）
   */
  write(id: number, value: Word): boolean {
    if (id === RNONE) return false
    if (id < 0 || id >= REGISTER_COUNT) {
      throw new RangeError(`寄存器编号越界：${id}`)
    }
    this.values[id] = asWord(value)
    return true
  }

  reset(): void {
    this.values.fill(0n)
  }

  /** 快照是拷贝，不是引用：执行历史要能回到过去，不能被后续写入污染 */
  snapshot(): Word[] {
    return [...this.values]
  }

  restore(snapshot: readonly Word[]): void {
    if (snapshot.length !== REGISTER_COUNT) {
      throw new RangeError(`寄存器快照长度 ${snapshot.length} 应为 ${REGISTER_COUNT}`)
    }
    this.values = snapshot.map((value) => asWord(value))
  }
}
