/**
 * 本地复现 GitHub Pages 的静态托管语义 —— `vite preview` 做不到，因为它自带 SPA 回落。
 *
 * 三条行为必须一致，否则「本地过了、线上 404」：
 *   1. 站点挂在 `/<repo>/` 下，其他前缀一律 404
 *   2. 只有真实存在的文件才返回 200
 *   3. 找不到的路径返回 404.html 的**内容**，但地址栏不变（这样 React Router 仍能看到原路径）
 *
 * 用法：CPU_BASE=cpu-theatre/ npm run build:pages && npm run preview:pages
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)), 'dist')
const PORT = Number(process.env.PORT ?? 4183)

/** 与 vite.config.ts 的规则一致：允许不带前导斜杠，容忍首尾多余斜杠 */
function resolvePrefix(raw) {
  const trimmed = raw?.trim()
  if (!trimmed || trimmed === '/') return ''
  const segment = trimmed.replace(/^[/\\]+|[/\\]+$/g, '')
  return segment ? `/${segment}` : ''
}

/**
 * 未指定 CPU_BASE 时从产物里反推前缀。
 * 产物是用 `/cpu-theatre/` 构建的，而这里按 `/` 起服务的话，页面一打开就全是 404——
 * 与其让人去猜「我刚才 build 时用了什么前缀」，不如让产物自己说。
 */
function detectPrefixFromDist() {
  try {
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    const match = /(?:src|href)="([^"]*?)\/assets\//.exec(html)
    return match?.[1] ? resolvePrefix(match[1]) : ''
  } catch {
    return ''
  }
}

const PREFIX = process.env.CPU_BASE ? resolvePrefix(process.env.CPU_BASE) : detectPrefixFromDist()
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
}

if (!existsSync(path.join(ROOT, 'index.html'))) {
  console.error('dist/index.html 不存在，请先运行 npm run build:pages')
  process.exit(1)
}

const server = createServer(async (req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)

  if (PREFIX && pathname !== PREFIX && !pathname.startsWith(`${PREFIX}/`)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`不在站点前缀 ${PREFIX} 下`)
    return
  }
  pathname = pathname.slice(PREFIX.length) || '/'
  if (pathname.endsWith('/')) pathname += 'index.html'

  try {
    const target = path.join(ROOT, pathname)
    // 目录穿越保护：静态服务器不该能把 dist 之外的文件吐出去
    if (!target.startsWith(ROOT)) throw new Error('bad path')
    const body = await readFile(target)
    res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    const body = await readFile(path.join(ROOT, '404.html'))
    res.writeHead(404, { 'content-type': TYPES['.html'] })
    res.end(body)
  }
})

server.listen(PORT, () => {
  console.log(`Pages 模拟：http://localhost:${PORT}${PREFIX || '/'}`)
  console.log('（深链会返回 404 状态 + 应用内容——与 GitHub Pages 相同）')
})
