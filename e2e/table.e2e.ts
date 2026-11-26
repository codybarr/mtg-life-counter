import AxeBuilder from '@axe-core/playwright'
import { type Page, expect, test } from '@playwright/test'

const life = (page: Page, playerId: string) => page.getByTestId(`life-${playerId}`)
const seat = (page: Page, playerId: string) => page.getByTestId(`seat-${playerId}`)
const zone = (page: Page, playerId: string, which: 'plus' | 'minus') =>
  seat(page, playerId).locator(`[data-zone=${which}]`)

const expectNoA11yViolations = async (page: Page) => {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze()
  expect(
    results.violations.map(({ id, help, nodes }) => ({
      id,
      help,
      targets: nodes.map(node => node.target.join(' ')),
    })),
  ).toEqual([])
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(life(page, 'p1')).toHaveText('40')
})

test('tapping a zone changes life by one', async ({ page }) => {
  await zone(page, 'p1', 'plus').tap()
  await zone(page, 'p1', 'plus').tap()
  await zone(page, 'p2', 'minus').tap()
  await expect(life(page, 'p1')).toHaveText('42')
  await expect(life(page, 'p2')).toHaveText('39')
})

test('holding a zone steps by ten', async ({ page }) => {
  const box = await zone(page, 'p3', 'minus').boundingBox()
  if (!box) throw new Error('zone not visible')
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(1050) // first repeat at 500ms, second at 900ms
  await page.mouse.up()
  await expect(life(page, 'p3')).toHaveText('20')
})

test('commander damage from the player dialog costs life and shows a chip', async ({ page }) => {
  await seat(page, 'p2').getByRole('button', { name: /commander damage, counters/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const fromP1 = dialog.getByRole('group', { name: 'From Player 1' })
  for (let index = 0; index < 3; index++) {
    await fromP1.getByRole('button', { name: 'Increase From Player 1' }).click()
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(life(page, 'p2')).toHaveText('37')
  await expect(
    seat(page, 'p2').getByRole('button', { name: /3 commander damage from Player 1/ }),
  ).toBeVisible()
})

test('players can rename themselves and pick a color', async ({ page }) => {
  await seat(page, 'p1').getByRole('button', { name: /commander damage, counters/ }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Name' }).fill('Ari')
  await dialog.getByRole('button', { name: 'Teal' }).click()
  await expect(dialog.getByRole('button', { name: 'Teal' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(seat(page, 'p1')).toHaveAttribute('aria-label', 'Ari')
})

test('switching to two players re-seats the table', async ({ page }) => {
  await page.getByRole('button', { name: 'Table menu' }).click()
  await page.getByRole('group', { name: 'Number of players' }).getByRole('button', { name: '2' }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-testid^=seat-]')).toHaveCount(2)
})

test('the game survives a reload', async ({ page }) => {
  await zone(page, 'p4', 'minus').tap()
  await zone(page, 'p4', 'minus').tap()
  await expect(life(page, 'p4')).toHaveText('38')
  await page.reload()
  await expect(life(page, 'p4')).toHaveText('38')
})

test('new game needs confirmation and resets totals', async ({ page }) => {
  await zone(page, 'p1', 'minus').tap()
  await page.getByRole('button', { name: 'Table menu' }).click()
  await page.getByRole('button', { name: 'New game' }).click()
  await expect(life(page, 'p1')).toHaveText('39')
  await page.getByRole('button', { name: 'Reset' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(life(page, 'p1')).toHaveText('40')
})

test.describe('accessibility', () => {
  test('the table has no axe violations', async ({ page }) => {
    await expectNoA11yViolations(page)
  })

  test('the table menu has no axe violations', async ({ page }) => {
    await page.getByRole('button', { name: 'Table menu' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(300)
    await expectNoA11yViolations(page)
  })

  test('the player dialog has no axe violations', async ({ page }) => {
    await seat(page, 'p1').getByRole('button', { name: /commander damage, counters/ }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.waitForTimeout(300)
    await expectNoA11yViolations(page)
  })

  test('life zones are reachable and operable by keyboard', async ({ page }) => {
    await zone(page, 'p1', 'plus').focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    await expect(life(page, 'p1')).toHaveText('42')
  })
})
