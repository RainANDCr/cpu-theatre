import {
  CircuitBoard,
  Code2,
  Cpu,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  LayoutGrid,
  MemoryStick,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export type ModuleId =
  | 'overview'
  | 'simulator'
  | 'editor'
  | 'registers'
  | 'memory'
  | 'pipeline'
  | 'logic'
  | 'learning'
  | 'settings'

export interface NavModule {
  id: ModuleId
  path: string
  /** 导航栏显示名（英文保留，与界面术语一致） */
  label: string
  /** 中文副标题 */
  labelZh: string
  icon: LucideIcon
  /** 该模块所属开发阶段，便于界面如实标注「尚未构建」 */
  phase: number
  /** 一句话说明这个模块解决什么问题（中文） */
  blurb: string
  /** 同上，英文；两种语言都写在配置里，避免只有一边有文案 */
  blurbEn: string
}

export const NAV_MODULES: NavModule[] = [
  {
    id: 'overview',
    path: '/',
    label: 'Overview',
    labelZh: '总览',
    icon: LayoutDashboard,
    phase: 0,
    blurb: '项目地图、引擎状态与阶段进度',
    blurbEn: 'Project map, engine state and phase progress',
  },
  {
    id: 'simulator',
    path: '/simulator',
    label: 'CPU Simulator',
    labelZh: '处理器模拟',
    icon: Cpu,
    phase: 3,
    blurb: '六阶段数据通路与真实执行',
    blurbEn: 'Six-stage datapath with real execution',
  },
  {
    id: 'editor',
    path: '/editor',
    label: 'Instruction Editor',
    labelZh: '指令编辑器',
    icon: Code2,
    phase: 2,
    blurb: 'Y86-64 汇编、汇编结果与断点',
    blurbEn: 'Y86-64 assembly, listing and breakpoints',
  },
  {
    id: 'registers',
    path: '/registers',
    label: 'Register Lab',
    labelZh: '寄存器实验台',
    icon: LayoutGrid,
    phase: 3,
    blurb: '15 个通用寄存器与条件码',
    blurbEn: '15 general registers and condition codes',
  },
  {
    id: 'memory',
    path: '/memory',
    label: 'Memory Explorer',
    labelZh: '内存浏览器',
    icon: MemoryStick,
    phase: 3,
    blurb: '字节寻址、小端视角与读写痕迹',
    blurbEn: 'Byte addressing, little-endian view and access traces',
  },
  {
    id: 'pipeline',
    path: '/pipeline',
    label: 'Pipeline Lab',
    labelZh: '流水线实验室',
    icon: GitBranch,
    phase: 6,
    blurb: '五阶段流水、冒险与转发',
    blurbEn: 'Five-stage pipeline, hazards and forwarding',
  },
  {
    id: 'logic',
    path: '/logic',
    label: 'Logic Lab',
    labelZh: '逻辑实验室',
    icon: CircuitBoard,
    phase: 8,
    blurb: '门电路、组合逻辑与 HCL',
    blurbEn: 'Gates, combinational logic and HCL',
  },
  {
    id: 'learning',
    path: '/learning',
    label: 'Learning Center',
    labelZh: '学习中心',
    icon: GraduationCap,
    phase: 9,
    blurb: '概念、演示、自测三件套',
    blurbEn: 'Concepts, demos and self-checks',
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    labelZh: '设置',
    icon: Settings,
    phase: 0,
    blurb: '外观、动效与本地偏好',
    blurbEn: 'Appearance, motion and local preferences',
  },
]

export const findModuleByPath = (pathname: string): NavModule => {
  if (pathname === '/') return NAV_MODULES[0]!
  const match = NAV_MODULES.find((m) => m.path !== '/' && pathname.startsWith(m.path))
  return match ?? NAV_MODULES[0]!
}
