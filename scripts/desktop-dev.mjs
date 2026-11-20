/**
 * 用 Electron 打开 dev server（先另开一个终端跑 `npm run dev`）。
 * 用途：验证「桌面外壳 + 热更新」这条路，不必每次打包。
 */
import { spawn } from 'node:child_process'
import electronPath from 'electron'

const env = { ...process.env, CPU_THEATRE_DEV: '1' }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electronPath, ['.'], { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))
