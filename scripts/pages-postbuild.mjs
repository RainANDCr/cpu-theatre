/**
 * GitHub Pages 只托管静态文件，没有「未匹配路径回落到 index.html」这种服务器行为。
 * 因此深链（直接打开 /editor、刷新页面）会拿到 404。
 *
 * 官方推荐的补救办法就是放一份 404.html：Pages 在找不到文件时返回它的内容，
 * 但浏览器地址栏仍停在原路径，于是 React Router 拿到的还是 /editor，
 * 页面照常渲染——不是重定向，用户看不出发生过 404。
 *
 * `.nojekyll` 则是关掉 Pages 默认的 Jekyll 处理：以 `_` 开头的目录/文件会被它忽略，
 * 我们的产物目前没有，但一旦有（比如某些 sourcemap 或资源名）就会静默 404。
 *
 * 只在 Pages 构建里做（`npm run build:pages`），本地与桌面产物保持原样：
 * 桌面版没有 404 这个概念，多一个文件只会让人误会。
 */
import { copyFile, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const dist = path.join(ROOT, 'dist')

try {
  await access(path.join(dist, 'index.html'))
} catch {
  console.error('dist/index.html 不存在，请先运行 npm run build')
  process.exit(1)
}

await copyFile(path.join(dist, 'index.html'), path.join(dist, '404.html'))
await writeFile(path.join(dist, '.nojekyll'), '', 'utf8')

console.log('pages: dist/404.html 与 dist/.nojekyll 已生成')
