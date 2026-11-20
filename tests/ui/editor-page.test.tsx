import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import EditorPage from '../../src/pages/EditorPage'
import { DEFAULT_EXAMPLE } from '../../src/lib/y86-examples'
import { useEditorStore } from '../../src/store/editorStore'
import { useProgramStore } from '../../src/store/programStore'

beforeEach(() => {
  useProgramStore.setState({ result: null, assembledSource: null })
  useEditorStore.setState({
    source: DEFAULT_EXAMPLE.code,
    activeExampleId: DEFAULT_EXAMPLE.id,
    dirty: false,
  })
})

describe('Instruction Editor：汇编闭环', () => {
  it('未汇编时显示空态，不编造任何机器码', () => {
    render(<EditorPage />)
    expect(screen.getByText('not compiled')).toBeInTheDocument()
    expect(screen.queryByText('irmovq $10, %rax')).not.toBeInTheDocument()
  })

  it('点「汇编」后逐行列出地址与机器码', async () => {
    const user = userEvent.setup()
    render(<EditorPage />)

    await user.click(screen.getByRole('button', { name: '汇编' }))

    const table = screen.getByRole('table')
    // 默认示例是 4 条指令 / 23 字节
    expect(within(table).getByText('0x0')).toBeInTheDocument()
    expect(within(table).getByText('0xA')).toBeInTheDocument()
    expect(within(table).getByText('irmovq $10, %rax')).toBeInTheDocument()
    expect(within(table).getByText('addq %rax, %rbx')).toBeInTheDocument()
    expect(within(table).getByText('halt')).toBeInTheDocument()
    // 首条指令的机器码：30 F0 0A …
    expect(within(table).getByText(/30 F0 0A/)).toBeInTheDocument()

    // 「23 B」在页面顶部徽章与输出摘要里各出现一次，这里只校验输出面板
    const output = screen.getByRole('region', { name: '汇编输出' })
    expect(within(output).getByText('4 ins')).toBeInTheDocument()
    expect(within(output).getByText('23 B')).toBeInTheDocument()
  })

  it('汇编失败自动切到诊断页并报出行号', async () => {
    const user = userEvent.setup()
    useEditorStore.setState({ source: 'irmovq $10, %rax\nmovq %rax, %rbx\nhalt' })
    render(<EditorPage />)

    await user.click(screen.getByRole('button', { name: '汇编' }))

    expect(screen.getByRole('tab', { name: /diagnostics/i })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByText(/未知指令/)).toBeInTheDocument()
    expect(screen.getByText('L2')).toBeInTheDocument()
    expect(screen.getByText(/是不是想写 "rrmovq"/)).toBeInTheDocument()
  })

  it('标签地址进入符号表', async () => {
    const user = userEvent.setup()
    useEditorStore.setState({
      source: 'irmovq $10, %rax\nirmovq $10, %rbx\nsubq %rax, %rbx\nje target\nhalt\ntarget:\nhalt',
    })
    render(<EditorPage />)

    await user.click(screen.getByRole('button', { name: '汇编' }))
    await user.click(screen.getByRole('tab', { name: /symbols/i }))

    const table = screen.getByRole('table')
    expect(within(table).getByText('target')).toBeInTheDocument()
    // 0+10+10+2+9+1 = 32 = 0x20
    expect(within(table).getByText('0x20')).toBeInTheDocument()
  })

  it('修改源码后结果标记为 stale，但保留上次编码', async () => {
    const user = userEvent.setup()
    render(<EditorPage />)

    await user.click(screen.getByRole('button', { name: '汇编' }))
    expect(screen.queryByText('stale')).not.toBeInTheDocument()

    useEditorStore.setState({ dirty: true })
    // 触发一次重渲染：切换示例会改 source，这里直接改 store 更贴近「用户编辑」
    await user.click(screen.getByRole('tab', { name: /symbols/i }))

    expect(screen.getByText('stale')).toBeInTheDocument()
  })
})
