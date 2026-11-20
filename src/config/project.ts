/**
 * 项目建设内容的单一数据源：阶段路线图、架构分层、设计铁律、验收用例。
 * 这些常量同时被「总览」页与各占位页读取，避免同一份事实散落在多处文案里。
 */

export type StageStatus = 'done' | 'next' | 'planned'

export interface Stage {
  index: number
  code: string
  title: string
  english: string
  status: StageStatus
  deliverable: string
}

export const STAGES: Stage[] = [
  {
    index: 0,
    code: 'PHASE 00',
    title: '项目基础架构',
    english: 'Foundation',
    status: 'done',
    deliverable: 'Vite + React + TS 工程、路由、设计系统、Zustand、Vitest',
  },
  {
    index: 1,
    code: 'PHASE 01',
    title: '界面与视觉舞台',
    english: 'Interface & Stage',
    status: 'done',
    deliverable: '可调三栏工作区、静态数据通路、空态寄存器/内存、控制栏、编辑器外壳',
  },
  {
    index: 2,
    code: 'PHASE 02',
    title: 'Y86-64 指令集',
    english: 'Instruction Set',
    status: 'done',
    deliverable: '指令定义、解析器、编码器、寄存器文件、内存模型、条件码',
  },
  {
    index: 3,
    code: 'PHASE 03',
    title: 'SEQ 执行引擎',
    english: 'Sequential Engine',
    status: 'done',
    deliverable: '六阶段执行、ALU、访存、PC 更新、栈操作、异常状态',
  },
  {
    index: 4,
    code: 'PHASE 04',
    title: '动态可视化',
    english: 'Dataflow Visuals',
    status: 'done',
    deliverable: '总线粒子、模块高亮、寄存器变化、控制信号、执行日志',
  },
  {
    index: 5,
    code: 'PHASE 05',
    title: '调试系统',
    english: 'Debugger',
    status: 'done',
    deliverable: '单步、运行、暂停、重置、回退、断点、执行历史',
  },
  {
    index: 6,
    code: 'PHASE 06',
    title: 'PIPE 流水线引擎',
    english: 'Pipelined Engine',
    status: 'done',
    deliverable: '五阶段流水、流水线寄存器、转发、暂停、气泡、分支预测',
  },
  {
    index: 7,
    code: 'PHASE 07',
    title: '流水线可视化',
    english: 'Pipeline Visuals',
    status: 'done',
    deliverable: '阶段舞台、周期时间轴、冒险高亮、CPI 统计',
  },
  {
    index: 8,
    code: 'PHASE 08',
    title: '逻辑实验室',
    english: 'Logic Lab',
    status: 'done',
    deliverable: '门电路、组合电路、MUX、ALU 实验、HCL 展示',
  },
  {
    index: 9,
    code: 'PHASE 09',
    title: '学习中心',
    english: 'Learning Center',
    status: 'done',
    deliverable: '知识模块、交互演示、实验任务、自测题、进度记录',
  },
  {
    index: 10,
    code: 'PHASE 10',
    title: '总测与打磨',
    english: 'Hardening',
    status: 'done',
    deliverable: 'SEQ/PIPE 对拍、异常覆盖、性能与兼容性、离线验证',
  },
]

export interface ArchLayer {
  name: string
  path: string
  role: string
  /** 该层是否允许依赖 React —— 这是硬约束，不是建议 */
  reactFree: boolean
}

export const ARCHITECTURE: ArchLayer[] = [
  {
    name: 'CPU 状态',
    path: 'src/core/cpu',
    role: '寄存器文件、内存、条件码、处理器状态码，全部是不可变快照',
    reactFree: true,
  },
  {
    name: '指令集',
    path: 'src/core/isa',
    role: '指令表、编解码、汇编语法解析与诊断',
    reactFree: true,
  },
  {
    name: '执行阶段',
    path: 'src/core/execution',
    role: '取指、译码、执行、访存、写回、更新 PC 六个纯函数',
    reactFree: true,
  },
  {
    name: 'SEQ / PIPE',
    path: 'src/core/seq · core/pipe',
    role: '两套引擎共享同一份指令语义，产出可对拍的状态与信号轨迹',
    reactFree: true,
  },
  {
    name: '状态适配层',
    path: 'src/store',
    role: '把引擎输出映射成 UI 可订阅的最小状态，禁止反向写入引擎内部',
    reactFree: false,
  },
  {
    name: '视图层',
    path: 'src/components · src/pages',
    role: '只读状态、只发意图；动画订阅真实数据，不伪造执行结果',
    reactFree: false,
  },
]

export interface Invariant {
  index: string
  title: string
  detail: string
  tone: 'bus' | 'ctrl' | 'reg'
}

export const INVARIANTS: Invariant[] = [
  {
    index: '01',
    title: '引擎不认识 React',
    detail:
      'core/ 下不出现任何框架 import。引擎必须能在 Vitest 里裸跑，否则 SEQ 与 PIPE 的对拍测试无从谈起。',
    tone: 'bus',
  },
  {
    index: '02',
    title: 'UI 不写状态，只发意图',
    detail:
      '界面上的每一次寄存器变化，都必须由一次真实的引擎执行推导出来。按钮点击不能直接改寄存器值。',
    tone: 'ctrl',
  },
  {
    index: '03',
    title: '动画是状态的投影',
    detail:
      '粒子流向、模块高亮、时间轴刻度全部由执行结果计算。没有 setTimeout 编造的「看起来在跑」。',
    tone: 'reg',
  },
]

export interface AcceptanceCase {
  id: string
  title: string
  expectation: string
  /** 计划由哪个阶段保证通过 */
  phase: number
  status: 'passed' | 'pending'
}

export const ACCEPTANCE_CASES: AcceptanceCase[] = [
  {
    id: 'A',
    title: '两条 irmovq 后相加',
    expectation: '%rax = 10、%rbx = 30、Stat = HLT',
    phase: 3,
    status: 'passed',
  },
  {
    id: 'B',
    title: '写内存再读回',
    expectation: '地址 100–107 存小端 123，%rcx = 123',
    phase: 3,
    status: 'passed',
  },
  {
    id: 'C',
    title: '减法置零后条件跳转',
    expectation: '跳转生效，%rcx = 2',
    phase: 3,
    status: 'passed',
  },
  {
    id: 'D',
    title: 'SEQ 与 PIPE 终态对拍',
    expectation: '寄存器、内存、条件码、PC、状态码完全一致',
    phase: 6,
    status: 'passed',
  },
  {
    id: 'E',
    title: 'Step Back 精确回退',
    expectation: '回退后 CPU 状态与上一拍逐字段相等',
    phase: 5,
    status: 'passed',
  },
]
