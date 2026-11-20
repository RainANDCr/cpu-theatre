import { beforeEach, describe, expect, it } from 'vitest'
import {
  formatCycle,
  formatPc,
  PLACEHOLDER,
  useCpuStore,
  type CpuUiState,
} from '../../src/store/cpuStore'
import { useEditorStore } from '../../src/store/editorStore'

const INITIAL = {
  mode: 'SEQ' as const,
  engineState: 'offline' as const,
  engineReady: false,
  cycle: null,
  pc: null,
  status: null,
  lastInstruction: null,
  registers: null,
  cc: null,
  trace: null,
  history: [],
  error: null,
  isRunning: false,
  loadedSource: null,
  breakpoints: [],
}

const PROGRAM = `irmovq $10, %rax
irmovq $20, %rbx
addq %rax, %rbx
halt
`

beforeEach(() => {
  useCpuStore.setState(INITIAL as Pick<CpuUiState, keyof typeof INITIAL>)
  useCpuStore.getState().clear()
  useEditorStore.setState({ source: PROGRAM, activeExampleId: 'add', dirty: false })
})

describe('cpuStore：空态与格式化', () => {
  it('未装载时不伪造任何读数', () => {
    const state = useCpuStore.getState()
    expect(state.engineReady).toBe(false)
    expect(state.cycle).toBeNull()
    expect(state.pc).toBeNull()
    expect(state.status).toBeNull()
    expect(state.registers).toBeNull()
  })

  it('空读数统一渲染为破折号，而不是 0', () => {
    expect(formatCycle(null)).toBe(PLACEHOLDER)
    expect(formatPc(null)).toBe(PLACEHOLDER)
  })

  it('PC 按固定宽度十六进制显示', () => {
    expect(formatPc(0x2cn)).toBe('0x0000002C')
    expect(formatCycle(0)).toBe('0')
  })

  it('切换模式会清空上一模式遗留的状态', () => {
    useCpuStore.getState().applyEngineSnapshot({
      cycle: 12,
      pc: 0x40n,
      status: 'HLT',
      engineState: 'halted',
      lastInstruction: 'halt',
    })

    useCpuStore.getState().setMode('PIPE')

    const state = useCpuStore.getState()
    expect(state.mode).toBe('PIPE')
    expect(state.engineState).toBe('offline')
    expect(state.cycle).toBeNull()
  })
})

describe('cpuStore：装载与执行', () => {
  it('首次单步会自动汇编并装载', () => {
    useCpuStore.getState().step()
    const state = useCpuStore.getState()

    expect(state.engineReady).toBe(true)
    expect(state.cycle).toBe(1)
    expect(state.registers?.[0]).toBe(10n)
    expect(state.trace?.text).toBe('irmovq $10, %rax')
    expect(state.history).toHaveLength(1)
  })

  it('跑完到达 HLT 且寄存器正确', () => {
    useCpuStore.getState().runToEnd()
    const state = useCpuStore.getState()

    expect(state.status).toBe('HLT')
    expect(state.engineState).toBe('halted')
    expect(state.registers?.[3]).toBe(30n)
    expect(state.history).toHaveLength(4)
  })

  it('Step Back 回到上一条指令之前', () => {
    useCpuStore.getState().runToEnd()
    useCpuStore.getState().stepBack()

    const state = useCpuStore.getState()
    expect(state.cycle).toBe(3)
    expect(state.history).toHaveLength(3)
    expect(state.status).toBe('AOK')
  })

  it('回退到第 0 拍回到初始状态', () => {
    useCpuStore.getState().runToEnd()
    useCpuStore.getState().rewindTo(0)

    const state = useCpuStore.getState()
    expect(state.cycle).toBe(0)
    expect(state.history).toHaveLength(0)
    expect(state.registers?.[3]).toBe(0n)
    expect(state.trace).toBeNull()
  })

  it('源码改动后再次执行会重新装载，不跑旧机器码', () => {
    useCpuStore.getState().runToEnd()
    expect(useCpuStore.getState().status).toBe('HLT')

    useEditorStore.setState({ source: 'irmovq $1, %rax\nhalt\n' })
    useCpuStore.getState().reset()

    expect(useCpuStore.getState().cycle).toBe(0) // 复位的是已装载的那份程序
    useCpuStore.getState().runToEnd()
    expect(useCpuStore.getState().cycle).toBe(2)
    expect(useCpuStore.getState().registers?.[0]).toBe(1n)
  })

  it('汇编失败不会装载，并给出原因', () => {
    useEditorStore.setState({ source: 'bogus\nhalt\n' })
    useCpuStore.getState().ensureLoaded()

    const state = useCpuStore.getState()
    expect(state.engineReady).toBe(false)
    expect(state.error).toContain('未知指令')
  })

  it('断点按源码行落到地址上', () => {
    useCpuStore.getState().ensureLoaded()
    // 第 3 行是 addq，位于 0x14
    useCpuStore.getState().toggleBreakpointAtLine(3)
    expect(useCpuStore.getState().breakpoints).toEqual([20])
  })

  it('未装载时点行号会先汇编再下断点', () => {
    useCpuStore.getState().clear()
    expect(useCpuStore.getState().addressToLine.size).toBe(0)

    useCpuStore.getState().toggleBreakpointAtLine(3)

    // 不能静默失败：地址表由这次点击自动建立
    expect(useCpuStore.getState().breakpoints).toEqual([20])
    expect(useCpuStore.getState().engineReady).toBe(true)
  })

  it('执行到下一条指令正好是断点时命中', () => {
    useCpuStore.getState().ensureLoaded()
    useCpuStore.getState().toggleBreakpoint(10)
    expect(useCpuStore.getState().atBreakpoint()).toBe(false)

    useCpuStore.getState().step() // 执行 0x00 的 irmovq，PC 变成 0xA
    expect(useCpuStore.getState().atBreakpoint()).toBe(true)
  })

  it('断点按地址开关', () => {
    useCpuStore.getState().toggleBreakpoint(10)
    expect(useCpuStore.getState().breakpoints).toEqual([10])
    useCpuStore.getState().toggleBreakpoint(10)
    expect(useCpuStore.getState().breakpoints).toEqual([])
  })
})
