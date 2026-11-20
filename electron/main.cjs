/**
 * Electron 外壳：把打包好的 `dist/` 当成一个本地站点来加载。
 *
 * 为什么不用 `file://`？
 *   Vite 产物里的资源路径是绝对的（`/assets/index-xxx.js`），`file://` 下会解析到
 *   盘符根目录；而且 file:// 属于 opaque origin，模块 Worker（Monaco 的编辑器 worker）
 *   会被同源策略挡掉。注册一个标准 scheme `cpu://app/` 后，它拥有真正的 origin，
 *   绝对路径、Worker、history API 全部按正常站点工作——不需要给 Web 版单独改 `base`。
 *
 * 为什么用 fs 读而不是 net.fetch(file://)？
 *   打包后代码在 `app.asar` 里，Chromium 的 file 加载器不认 asar；Node 的 fs 认。
 */
const { app, BrowserWindow, Menu, protocol, shell } = require('electron')
const fs = require('node:fs/promises')
const path = require('node:path')

const SCHEME = 'cpu'
/** `--smoke`：无头自检，加载首页与编辑器后退出，用于验证打包产物而不是靠肉眼 */
const SMOKE = process.argv.includes('--smoke')
const APP_ROOT = path.join(__dirname, '..', 'dist')
const DEV_URL = 'http://localhost:5173'

protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
}

function contentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function resolveInside(filePath) {
  const resolved = path.normalize(path.join(APP_ROOT, filePath))
  // 目录穿越防护：`cpu://app/../../secret` 必须被拒
  return resolved === APP_ROOT || resolved.startsWith(APP_ROOT + path.sep) ? resolved : null
}

async function serve(request) {
  const url = new URL(request.url)
  const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
  const target = resolveInside(relative)
  if (!target) return new Response('forbidden', { status: 403 })

  try {
    const data = await fs.readFile(target)
    return new Response(data, { headers: { 'content-type': contentType(target) } })
  } catch {
    // SPA 回退：`/simulator` 这类前端路由刷新时没有对应文件，交回 index.html
    if (!path.extname(relative)) {
      const index = await fs.readFile(path.join(APP_ROOT, 'index.html'))
      return new Response(index, { headers: { 'content-type': MIME_TYPES['.html'] } })
    }
    return new Response('not found', { status: 404 })
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    backgroundColor: '#0a0e17',
    autoHideMenuBar: true,
    title: 'CPU THEATRE',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  if (!SMOKE) window.once('ready-to-show', () => window.show())

  // 应用内不开新窗口；外链交给系统浏览器，别把 Electron 变成浏览器
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.CPU_THEATRE_DEV === '1' ? DEV_URL : `${SCHEME}://app/`
    if (!url.startsWith(allowed)) {
      event.preventDefault()
      if (/^https?:/i.test(url)) void shell.openExternal(url)
    }
  })

  if (process.env.CPU_THEATRE_DEV === '1') {
    void window.loadURL(DEV_URL)
  } else {
    void window.loadURL(`${SCHEME}://app/index.html`)
  }
  if (SMOKE) runSmoke(window)
  return window
}

/** 在渲染进程里轮询某个条件，避免「did-finish-load 早于 React 渲染」的假失败 */
function waitInPage(script, timeout) {
  return `new Promise((resolve) => {
    const started = Date.now()
    const timer = setInterval(() => {
      const value = (${script})()
      if (value || Date.now() - started > ${timeout}) {
        clearInterval(timer)
        resolve(value)
      }
    }, 100)
  })`
}

function runSmoke(window) {
  window.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[smoke] 页面加载失败 ${code} ${description} ${url}`)
    app.exit(1)
  })

  window.webContents.once('did-finish-load', async () => {
    try {
      const home = await window.webContents.executeJavaScript(
        waitInPage(
          `() => {
            const root = document.querySelector('#root')
            if (!root || root.childElementCount === 0) return null
            return { title: document.title, text: root.innerText.slice(0, 60).replace(/\\s+/g, ' ') }
          }`,
          8000,
        ),
      )
      console.log(`[smoke] 首页 ${JSON.stringify(home)}`)
      if (!home) throw new Error('React 根节点没有渲染内容')

      await window.loadURL(`${SCHEME}://app/editor`)
      const editor = await window.webContents.executeJavaScript(
        waitInPage(
          `() => {
            const monaco = document.querySelector('.monaco-editor')
            const lines = monaco ? monaco.querySelectorAll('.view-line').length : 0
            if (lines === 0) return null
            return { monaco: true, lines }
          }`,
          15000,
        ),
      )
      console.log(`[smoke] 编辑器 ${JSON.stringify(editor)}`)
      if (!editor) throw new Error('Monaco 没有渲染出代码行：资源或 worker 在 cpu:// 下加载失败')

      // 前端路由刷新必须回落到 index.html，否则桌面版从 /editor 启动会 404
      await window.loadURL(`${SCHEME}://app/pipeline`)
      const pipeline = await window.webContents.executeJavaScript(
        waitInPage(
          `() => {
            const heading = document.querySelector('h1')
            return heading ? heading.textContent.trim().slice(0, 40) : null
          }`,
          8000,
        ),
      )
      console.log(`[smoke] 深链 ${JSON.stringify(pipeline)}`)
      if (!pipeline) throw new Error('深链 /pipeline 没有渲染')

      console.log('[smoke] OK')
      app.exit(0)
    } catch (error) {
      console.error(`[smoke] FAIL ${error instanceof Error ? error.message : error}`)
      app.exit(1)
    }
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  if (SMOKE) app.disableHardwareAcceleration()

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    protocol.handle(SCHEME, serve)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
