/**
 * 对**打包后的 exe** 跑一次自检，证明「构建产物能跑」之外还有「装进壳里也能跑」。
 * 打包目录是先决条件：npm run package:win
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const exe = path.join(ROOT, 'release', 'CPU THEATRE-win32-x64', 'CPU THEATRE.exe')

if (!existsSync(exe)) {
  console.error('找不到打包产物，请先运行：npm run package:win')
  process.exit(1)
}

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
delete env.NODE_OPTIONS

const child = spawn(exe, ['--smoke'], { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 1))
