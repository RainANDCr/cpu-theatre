import { expect, test, type Locator, type Page, waitForHeading } from './fixtures'

/** 把某个输入位驱到目标值。不假设初始状态——初始值属于产品选择，测试不该依赖它。 */
async function setBit(page: Page, name: string, value: boolean): Promise<void> {
  const bit = page.getByRole('button', { name, exact: true })
  if ((await bit.getAttribute('aria-pressed')) !== String(value)) await bit.click()
  await expect(bit).toHaveAttribute('aria-pressed', String(value))
}

function gateBench(page: Page): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'Gate bench' }) })
}

function aluBench(page: Page): Locator {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'ALU bench' }) })
}

test.describe('Logic Lab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/logic')
    await waitForHeading(page, /Logic Lab/)
  })

  test('AND 门：两个输入都为 1 才输出 1', async ({ page }) => {
    const bench = gateBench(page)

    await setBit(page, '输入 A', true)
    await setBit(page, '输入 B', true)
    await expect(bench.getByRole('button', { name: '输出 Y' })).toHaveAttribute('aria-pressed', 'true')

    // 撤掉任意一个输入，输出必须立刻回落
    await setBit(page, '输入 A', false)
    await expect(bench.getByRole('button', { name: '输出 Y' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('切换门类型会换提示与真值表', async ({ page }) => {
    const bench = gateBench(page)
    // 注意作用域：ALU 台也有 AND/OR/XOR 三个同名按钮
    await bench.getByRole('button', { name: 'OR', exact: true }).click()
    await expect(page.getByText(/有一个为 1 就输出 1/)).toBeVisible()

    await bench.getByRole('button', { name: 'XOR', exact: true }).click()
    await expect(page.getByText(/两个不同才输出 1/)).toBeVisible()

    // 真值表由 evaluate() 现算，XOR 的第三行（0,1）必须是 1
    await setBit(page, '输入 A', false)
    await setBit(page, '输入 B', true)
    await expect(bench.getByRole('button', { name: '输出 Y' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('ALU 实验台用真实的 64 位补码运算', async ({ page }) => {
    const bench = aluBench(page)

    await bench.getByRole('button', { name: 'SUB', exact: true }).click()
    await bench.getByLabel('valA').fill('3')
    await bench.getByLabel('valB').fill('5')

    // subq %rA, %rB = 目的 − 源 = 5 − 3 = 2。
    // 结果固定 16 位十六进制——这本身就是「64 位机器」的一个可见证据。
    await expect(bench.getByText('0x0000000000000002', { exact: true })).toBeVisible()

    // 反过来 0 − 1 = −1，64 位补码应为全 1
    await bench.getByLabel('valA').fill('1')
    await bench.getByLabel('valB').fill('0')
    await expect(bench.getByText('0xFFFFFFFFFFFFFFFF', { exact: true })).toBeVisible()
  })
})
