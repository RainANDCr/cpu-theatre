/**
 * SEQ 数据通路的静态几何模型。
 *
 * 坐标系按「中央面板的真实尺寸」设计：约 560×380 个 viewBox 单位，
 * 缩放接近 1:1，图上 11.5px 的字就是屏幕上的 11.5px。
 * 早期版本用了 980×660，缩到实际面板里只剩 0.5 倍，字全糊了——
 * 图形尺寸必须对着它要被放进去的地方设计，而不是对着纸张。
 *
 * Phase 4 要按执行阶段点亮某几条线时，给 wire 加 `stage` 字段即可，
 * 渲染层不用改一行。
 */

export type StageTone = 'bus' | 'ctrl' | 'reg' | 'alu' | 'slate'

export type StageModuleId = 'pc' | 'imem' | 'regfile' | 'alu' | 'ctrl' | 'dmem' | 'cc' | 'stat'

export interface StageModule {
  id: StageModuleId
  title: string
  sub: string
  x: number
  y: number
  w: number
  h: number
  tone: StageTone
}

export interface StageWire {
  id: string
  d: string
  tone: StageTone
  dashed?: boolean
  /** 汇入总线的支线不画箭头 */
  arrow?: boolean
  label?: string
  labelAt?: [number, number]
  anchor?: 'start' | 'middle' | 'end'
  /** 竖排标签（贴边总线的场合） */
  vertical?: boolean
}

export const STAGE_VIEWBOX = { width: 540, height: 378 }

export const STAGE_MODULES: StageModule[] = [
  { id: 'pc', title: 'PC', sub: 'program counter', x: 16, y: 12, w: 118, h: 44, tone: 'bus' },
  {
    id: 'imem',
    title: 'INSTRUCTION MEMORY',
    sub: 'icode · ifun · valC',
    x: 16,
    y: 92,
    w: 148,
    h: 68,
    tone: 'slate',
  },
  {
    id: 'regfile',
    title: 'REGISTER FILE',
    sub: '15 × 64 bit',
    x: 16,
    y: 184,
    w: 148,
    h: 78,
    tone: 'reg',
  },
  { id: 'alu', title: 'ALU', sub: 'valE', x: 196, y: 184, w: 124, h: 70, tone: 'alu' },
  { id: 'ctrl', title: 'CONTROL LOGIC', sub: 'HCL', x: 356, y: 92, w: 148, h: 68, tone: 'ctrl' },
  {
    id: 'dmem',
    title: 'DATA MEMORY',
    sub: '8-byte words',
    x: 356,
    y: 184,
    w: 148,
    h: 70,
    tone: 'slate',
  },
  {
    id: 'cc',
    title: 'CONDITION CODES',
    sub: 'ZF · SF · OF',
    x: 196,
    y: 300,
    w: 124,
    h: 44,
    tone: 'ctrl',
  },
  {
    id: 'stat',
    title: 'STATUS',
    sub: 'AOK · HLT · ADR · INS',
    x: 356,
    y: 284,
    w: 148,
    h: 44,
    tone: 'slate',
  },
]

export const STAGE_WIRES: StageWire[] = [
  { id: 'pc-imem', d: 'M74 56 V92', tone: 'bus', dashed: true, label: 'PC', labelAt: [80, 80], anchor: 'start' },
  {
    id: 'imem-ctrl',
    d: 'M164 112 H356',
    tone: 'ctrl',
    dashed: true,
    label: 'icode · ifun',
    labelAt: [260, 105],
    anchor: 'middle',
  },
  {
    id: 'imem-reg',
    d: 'M74 160 V184',
    tone: 'reg',
    label: 'rA · rB',
    labelAt: [80, 176],
    anchor: 'start',
  },
  {
    id: 'valC',
    d: 'M164 136 H182 V170 H250 V184',
    tone: 'bus',
    label: 'valC',
    labelAt: [185, 130],
    anchor: 'start',
  },
  { id: 'valA', d: 'M164 204 H196', tone: 'reg', label: 'valA', labelAt: [180, 197], anchor: 'middle' },
  { id: 'valB', d: 'M164 232 H196', tone: 'reg', label: 'valB', labelAt: [180, 226], anchor: 'middle' },
  {
    id: 'alu-dmem',
    d: 'M320 218 H356',
    tone: 'alu',
    label: 'valE',
    labelAt: [338, 211],
    anchor: 'middle',
  },
  {
    id: 'alu-cc',
    d: 'M258 254 V300',
    tone: 'ctrl',
    dashed: true,
    label: 'Set CC',
    labelAt: [264, 292],
    anchor: 'start',
  },
  { id: 'wb-bus', d: 'M150 272 H320', tone: 'bus', arrow: false },
  {
    id: 'wb-reg',
    d: 'M150 272 V262',
    tone: 'bus',
    label: 'dstE · dstM',
    labelAt: [235, 265],
    anchor: 'middle',
  },
  {
    id: 'dmem-wb',
    d: 'M356 244 H320 V272',
    tone: 'bus',
    arrow: false,
    label: 'valM',
    labelAt: [326, 268],
    anchor: 'start',
  },
  { id: 'alu-wb', d: 'M288 254 V272', tone: 'alu', arrow: false },
  {
    id: 'ctrl-stat',
    d: 'M504 140 H520 V306 H504',
    tone: 'ctrl',
    dashed: true,
    label: 'Stat',
    labelAt: [526, 224],
    anchor: 'middle',
    vertical: true,
  },
  {
    id: 'ctrl-pc',
    d: 'M356 104 H340 V34 H134',
    tone: 'ctrl',
    dashed: true,
    label: 'PC′',
    labelAt: [296, 27],
    anchor: 'middle',
  },
]

/** 总线汇合点，画小圆点表明三条支线并成一条 */
export const STAGE_JUNCTIONS: [number, number][] = [
  [320, 272],
  [288, 272],
  [150, 272],
]

/**
 * 阶段 → 被点亮的模块与连线。
 *
 * 这张表是 Phase 4 的核心：动画不再由「定时器按顺序切换高亮」驱动，
 * 而是由真实 trace 的 stages 数组决定点亮什么。改执行语义时，
 * 这里会自动跟着变，不会出现「动画演的是 addq，实际执行的是 subq」。
 */
export const STAGE_HIGHLIGHTS: Record<
  'FETCH' | 'DECODE' | 'EXECUTE' | 'MEMORY' | 'WRITEBACK' | 'PC_UPDATE',
  { modules: StageModuleId[]; wires: string[] }
> = {
  FETCH: { modules: ['pc', 'imem'], wires: ['pc-imem', 'imem-ctrl', 'imem-reg', 'valC'] },
  DECODE: { modules: ['regfile'], wires: ['imem-reg', 'valA', 'valB'] },
  EXECUTE: { modules: ['alu', 'cc'], wires: ['valA', 'valB', 'valC', 'alu-cc', 'alu-dmem', 'alu-wb'] },
  MEMORY: { modules: ['dmem'], wires: ['alu-dmem', 'dmem-wb'] },
  WRITEBACK: { modules: ['regfile'], wires: ['wb-bus', 'wb-reg', 'alu-wb', 'dmem-wb'] },
  PC_UPDATE: { modules: ['pc', 'ctrl', 'stat'], wires: ['ctrl-pc', 'ctrl-stat'] },
}

export interface ModuleDoc {
  name: string
  role: string
  inputs: string[]
  outputs: string[]
}

/**
 * 点开模块时显示的解释。全部为本项目重写，不复述教材原文。
 * Phase 3 之后，这里的「当前值」会由真实执行结果填充；现在是空。
 */
export const MODULE_DOCS: Record<StageModuleId, ModuleDoc> = {
  pc: {
    name: '程序计数器',
    role: '保存「下一条要取的指令在哪」。SEQ 的每一拍都从这里出发，也在这一拍结束时被改写。',
    inputs: ['PC′：来自 valC、valM 或 valP 中的一个'],
    outputs: ['PC：作为指令内存的地址'],
  },
  imem: {
    name: '指令内存',
    role: '只读。按 PC 取出一条最多 10 字节的指令，并把它切成字段交给后续阶段。',
    inputs: ['PC：指令地址'],
    outputs: [
      'icode / ifun：指令类型与功能',
      'rA / rB：源与目的寄存器编号',
      'valC：8 字节立即数',
      'valP：下一条指令地址',
    ],
  },
  regfile: {
    name: '寄存器文件',
    role: '两个读端口、两个写端口。同一拍里可以读两个、写两个，这是 Y86-64 数据通路的基本形状。',
    inputs: ['srcA / srcB：读哪个寄存器', 'dstE / dstM：写哪个寄存器', 'valE / valM：写入的值'],
    outputs: ['valA / valB：读出的值'],
  },
  alu: {
    name: '算术逻辑单元',
    role: '按 ALUfun 做加法、减法、按位与、异或；也负责算内存地址（valE = valB + valC）。',
    inputs: ['valA / valB：操作数', 'valC：立即数', 'ALUfun：做哪一种运算'],
    outputs: ['valE：结果（既可能写回寄存器，也可能当地址用）'],
  },
  ctrl: {
    name: '控制逻辑',
    role: '整个数据通路的指挥。它读指令字段与条件码，产生所有控制信号——用 HCL 描述，不是软件分支。',
    inputs: ['icode / ifun：这是什么指令', 'ZF / SF / OF：条件是否成立'],
    outputs: [
      'srcA / srcB / dstE / dstM',
      'ALUfun / SetCC',
      'mem_read / mem_write',
      'Cnd：条件传送与跳转的结论',
    ],
  },
  dmem: {
    name: '数据内存',
    role: '读写 8 字节字，按小端序落字节。读与写不会在同一拍同时发生。',
    inputs: ['valE：地址', 'valA：要写入的值', 'mem_read / mem_write'],
    outputs: ['valM：读出的值'],
  },
  cc: {
    name: '条件码',
    role: '记住最近一次算术的三种性质：结果是否为 0、是否为负、是否溢出。jXX 与 cmovXX 全靠它。',
    inputs: ['ALU 的结果与操作数宽度（由 SetCC 决定是否更新）'],
    outputs: ['ZF / SF / OF：给控制逻辑判断条件'],
  },
  stat: {
    name: '状态码',
    role: '程序为什么停下。正常结束是 HLT，取到非法指令是 INS，访存越界是 ADR。',
    inputs: ['icode：是否遇到 halt 或非法指令', '内存访问结果：是否越界'],
    outputs: ['Stat：AOK / HLT / ADR / INS'],
  },
}
