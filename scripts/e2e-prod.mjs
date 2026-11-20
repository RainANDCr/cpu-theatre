/**
 * 用生产构建跑 E2E（行为断言，不含像素基线）。
 *
 * 单独写一个启动器而不是在 npm script 里写 `E2E_TARGET=preview ...`：
 * Windows 的 cmd/PowerShell 不认 `KEY=value cmd` 这种前缀，装了 cross-env 才能跨平台，
 * 但为一个环境变量引入依赖不值得。
 *
 * 前置：dist/ 已存在（脚本里会先执行 build）。
 */
import { spawnSync } from 'node:child_process'

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(command, ['playwright', 'test', '--project=functional'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, E2E_TARGET: 'preview' },
})

process.exit(result.status ?? 1)
