import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppRoutes } from '../../src/App'
import { DEFAULT_EXAMPLE } from '../../src/lib/y86-examples'
import { useCpuStore } from '../../src/store/cpuStore'
import { useEditorStore } from '../../src/store/editorStore'
import { useSettingsStore } from '../../src/store/settingsStore'

beforeEach(() => {
  useCpuStore.getState().clear()
  useEditorStore.setState({
    source: DEFAULT_EXAMPLE.code,
    activeExampleId: DEFAULT_EXAMPLE.id,
    dirty: false,
  })
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('CPU 舞台与观察器', () => {
  it('默认展示 ALU 说明，点击其他模块会切换', async () => {
    const user = userEvent.setup()
    renderAt('/simulator')

    expect(screen.getByText('算术逻辑单元')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'PC · 程序计数器' }))

    expect(screen.getByText(/保存「下一条要取的指令在哪」/)).toBeInTheDocument()
    expect(screen.queryByText('算术逻辑单元')).not.toBeInTheDocument()
  })

  it('寄存器表按 ISA 编码序排，首尾与数量都对，且没有任何数值', () => {
    renderAt('/simulator')

    const panel = screen.getByRole('tabpanel', { name: '寄存器' })
    const rows = within(panel).getAllByRole('button')

    expect(rows).toHaveLength(15)
    expect(rows[0]).toHaveTextContent('%rax')
    expect(rows[4]).toHaveTextContent('%rsp')
    expect(rows[14]).toHaveTextContent('%r14')

    // 空态：不能出现 0，只能出现破折号
    expect(within(rows[0]).getByText('—')).toBeInTheDocument()
    expect(panel).not.toHaveTextContent(/\b0x0000/)
  })

  it('切到内存页显示空态说明，而不是一屏 00', async () => {
    const user = userEvent.setup()
    renderAt('/simulator')

    await user.click(screen.getByRole('tab', { name: 'Memory' }))

    const panel = screen.getByRole('tabpanel', { name: '内存' })
    expect(within(panel).getByText(/尚未装载程序/)).toBeInTheDocument()
    expect(panel).not.toHaveTextContent('00 00 00')
  })

  it('未装载时只有「能自己装载」的按钮可用', () => {
    renderAt('/simulator')

    const controls = screen.getByRole('group', { name: '执行控制' })
    const buttons = within(controls).getAllByRole('button')
    expect(buttons).toHaveLength(6)

    expect(screen.getByRole('button', { name: '单步' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '运行' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '跑完' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '回退' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '暂停' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '重置' })).toBeDisabled()

    // PIPE 现在会跳到独立的流水线实验室，所以是可用状态
    expect(screen.getByRole('button', { name: 'PIPE' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'SEQ' })).not.toBeDisabled()
  })

  it('时间轴与日志都保持空态', () => {
    renderAt('/simulator')
    expect(screen.getAllByText('尚无执行记录').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/点「单步」或「运行」后/)).toBeInTheDocument()
  })

  it('单步后寄存器与日志出现真实数值', async () => {
    const user = userEvent.setup()
    renderAt('/simulator')

    await user.click(screen.getByRole('button', { name: '单步' }))

    const panel = screen.getByRole('tabpanel', { name: '寄存器' })
    // %rax = 10 → 0xA
    expect(within(panel).getByText('0xA')).toBeInTheDocument()
    expect(screen.getAllByText('irmovq $10, %rax').length).toBeGreaterThanOrEqual(1)
  })

  it('跑完后 Stat 显示 HLT，%rbx = 30', async () => {
    const user = userEvent.setup()
    renderAt('/simulator')

    await user.click(screen.getByRole('button', { name: '跑完' }))

    const panel = screen.getByRole('tabpanel', { name: '寄存器' })
    expect(within(panel).getByText('0x1E')).toBeInTheDocument()
    expect(within(panel).getByText('HLT')).toBeInTheDocument()
  })

  it('分隔条支持键盘调整宽度，并写回设置', () => {
    renderAt('/simulator')
    const handle = screen.getByRole('separator', { name: '源码面板' })
    const before = useSettingsStore.getState().left

    fireEvent.keyDown(handle, { key: 'ArrowRight' })

    expect(useSettingsStore.getState().left).toBe(before + 16)
  })

  it('没有 Worker 的环境里编辑器降级为只读源码视图，而不是崩溃', () => {
    renderAt('/editor')
    expect(screen.getByText('read-only surface')).toBeInTheDocument()
    expect(screen.getAllByText('irmovq').length).toBeGreaterThan(0)
  })
})
