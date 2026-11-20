/**
 * 生成 README 用的截图。
 *
 * 这些图不是「设计稿」：脚本会真的起 preview、点按钮、等真实执行完，再截图。
 * 任何一张图里的寄存器值、机器码、流水线内容都来自一次真实运行。
 *
 * 用法：npm run build && node scripts/capture-docs.mjs
 */
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = path.join(ROOT, 'docs', 'images')
const PORT = 4188
const BASE = `http://localhost:${PORT}`

const SETTINGS = {
  state: {
    accent: 'blue',
    reduceMotion: true,
    showGrid: true,
    animationSpeed: 2,
    sidebarCollapsed: false,
    left: 430,
    right: 342,
    bottom: 196,
  },
  version: 1,
}

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(BASE)
      if (response.ok) return
    } catch {
      // 还没起来
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error('preview 服务没有起来')
}

async function main() {
  await mkdir(OUT, { recursive: true })

  const server = spawn('npm', ['run', 'preview', '--', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
  })

  try {
    await waitForServer()

    let browser
    try {
      browser = await chromium.launch({ channel: 'msedge' })
    } catch {
      browser = await chromium.launch()
    }

    const context = await browser.newContext({
      viewport: { width: 1600, height: 1000 },
      deviceScaleFactor: 1,
      locale: 'zh-CN',
      reducedMotion: 'reduce',
    })
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      ['cpu-theatre:settings', JSON.stringify(SETTINGS)],
    )

    const page = await context.newPage()
    const settle = async () => {
      await page.evaluate(() => document.fonts.ready.then(() => true))
      await page.waitForTimeout(150)
    }

    // 1. 总览
    await page.goto(`${BASE}/`)
    await settle()
    await page.screenshot({ path: path.join(OUT, 'overview.png') })

    // 2. 模拟器：跑完内置加法示例，寄存器与日志都填满真实值
    await page.goto(`${BASE}/simulator`)
    await settle()
    await page.getByRole('button', { name: '跑完' }).click()
    await page.getByText('HALTED').first().waitFor()
    await settle()
    await page.screenshot({ path: path.join(OUT, 'simulator.png') })

    // 3. 编辑器：用教材 Figure 4.7 的 asum，Listing 里同时有指令与数据行
    await page.goto(`${BASE}/editor`)
    await settle()
    await page.getByRole('button', { name: '数组求和' }).click()
    await page.getByRole('button', { name: '汇编' }).click()
    await page.getByRole('region', { name: '汇编输出' }).getByText('18 ins').waitFor()
    await settle()
    await page.screenshot({ path: path.join(OUT, 'editor.png') })

    // 4. 流水线：推进五拍，五列同时装着不同指令。
    //    五列本身很高，用矮一点的视口让它们自然收口，比裁图干净。
    await page.setViewportSize({ width: 1600, height: 760 })
    await page.goto(`${BASE}/pipeline`)
    await settle()
    await page.getByRole('button', { name: '装载' }).click()
    for (let i = 0; i < 5; i += 1) {
      await page.getByRole('button', { name: '下一拍' }).click()
    }
    await settle()
    await page.screenshot({ path: path.join(OUT, 'pipeline.png') })

    await browser.close()
    console.log(`已生成：${OUT}`)
  } finally {
    server.kill()
  }
}

await main()
