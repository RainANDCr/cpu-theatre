/**
 * 用 Electron 打开构建产物（先 `npm run build`）。
 *
 * 注意 `ELECTRON_RUN_AS_NODE`：某些 Electron 宿主环境会把它设成 1，
 * 那样 electron.exe 会退化成 Node 进程，`require('electron')` 只返回一个路径字符串。
 * 这里显式清掉，保证拿到的永远是真正的桌面运行时。
 */
import { spawn } from 'node:child_process'
import electronPath from 'electron'

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electronPath, ['.', ...process.argv.slice(2)], { stdio: 'inherit', env })
child.on('exit', (code) => process.exit(code ?? 0))
