/**
 * 打包成 Windows 免安装目录（release/CPU THEATRE-win32-x64/CPU THEATRE.exe）。
 *
 * 为什么先做「免安装目录」而不是 NSIS 安装包？
 *   NSIS 要额外下载 winCodeSign / nsis 二进制，离线或代理环境下经常失败；
 *   免安装目录只用已经装好的 Electron 运行时，产物双击即用，也便于核对文件。
 */
import { packager } from '@electron/packager'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

/** 本地已下载的 Electron 压缩包（有就用，省一次 150 MB 下载；没有就让 packager 自己下） */
const zipDir = path.join(ROOT, '.cache', 'electron')

/** 只保留运行必需的三样：产物、外壳、清单；源码与测试不进包 */
const KEEP = new Set(['dist', 'electron', 'package.json'])

const paths = await packager({
  dir: ROOT,
  name: 'CPU THEATRE',
  appVersion: pkg.version,
  platform: 'win32',
  arch: 'x64',
  out: 'release',
  overwrite: true,
  asar: true,
  prune: true,
  ...(existsSync(zipDir) ? { electronZipDir: zipDir } : {}),
  ignore: (filePath) => {
    const top = filePath.split('/')[1]
    return top !== undefined && top !== '' && !KEEP.has(top)
  },
})

console.log(`\n打包完成：${paths.join(', ')}`)
console.log('双击其中的 "CPU THEATRE.exe" 即可运行；整个目录可以拷到任意 Windows 机器。')
