import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from '../../src/App'
import { DEFAULT_EXAMPLE } from '../../src/lib/y86-examples'
import { useCpuStore } from '../../src/store/cpuStore'
import { useEditorStore } from '../../src/store/editorStore'
import { useSettingsStore } from '../../src/store/settingsStore'

/**
 * 连续运行的节奏。
 *
 * 时间用假定时器走：这里要验证的正是「多久走一拍」，真等 2.4 秒不现实。
 * 断言全部落在 store 的历史长度上——那是引擎真实执行过的指令数，
 * 不是界面上的动画帧。
 */
const executed = (): number => useCpuStore.getState().history.length

function renderSimulator() {
  return render(
    <MemoryRouter initialEntries={['/simulator']}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  useCpuStore.getState().clear()
  useEditorStore.setState({
    source: DEFAULT_EXAMPLE.code,
    activeExampleId: DEFAULT_EXAMPLE.id,
    dirty: false,
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('运行速度与执行语义', () => {
  it('0.5× 每 2.4 秒才走一条指令', () => {
    useSettingsStore.setState({ animationSpeed: 0.5 })
    renderSimulator()

    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    // 起跑的第一拍是立刻的：按下去界面就得有反应
    expect(executed()).toBe(1)

    advance(2399)
    expect(executed()).toBe(1)
    advance(1)
    expect(executed()).toBe(2)

    advance(2400)
    expect(executed()).toBe(3)
  })

  it('1× 与 2× 各自快一倍，梯度是连续的', () => {
    useSettingsStore.setState({ animationSpeed: 1 })
    renderSimulator()

    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    advance(1199)
    expect(executed()).toBe(1)
    advance(1)
    expect(executed()).toBe(2)

    // 中途换到 2×：下一拍就按新节奏走
    fireEvent.click(screen.getByRole('button', { name: '2×' }))
    advance(599)
    expect(executed()).toBe(2)
    advance(1)
    expect(executed()).toBe(3)
  })

  it('运行中换档不会顺带多执行一条指令', () => {
    useSettingsStore.setState({ animationSpeed: 0.5 })
    renderSimulator()

    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    expect(executed()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: '2×' }))
    expect(executed()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: '1×' }))
    expect(executed()).toBe(1)
  })

  it('暂停之后一拍都不走，继续之后从原地接着跑', () => {
    useSettingsStore.setState({ animationSpeed: 2 })
    renderSimulator()

    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    expect(executed()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: '暂停' }))
    expect(useCpuStore.getState().isRunning).toBe(false)

    advance(5000)
    expect(executed()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    expect(executed()).toBe(2)
    advance(600)
    expect(executed()).toBe(3)
  })

  it('暂停后单步仍然只执行一条，不受速度档位影响', () => {
    useSettingsStore.setState({ animationSpeed: 0.5 })
    renderSimulator()

    fireEvent.click(screen.getByRole('button', { name: '单步' }))
    expect(executed()).toBe(1)

    // 单步不启动定时器：等多久都不会自己再走
    advance(10_000)
    expect(executed()).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: '单步' }))
    expect(executed()).toBe(2)
  })

  it('跑到 HLT 之后定时器自己停下，不会在停机后继续空转', () => {
    useSettingsStore.setState({ animationSpeed: 2 })
    renderSimulator()

    fireEvent.click(screen.getByRole('button', { name: '运行' }))
    advance(600 * 10)

    const state = useCpuStore.getState()
    expect(state.status).toBe('HLT')
    expect(state.isRunning).toBe(false)

    const done = executed()
    advance(10_000)
    expect(executed()).toBe(done)
  })
})
