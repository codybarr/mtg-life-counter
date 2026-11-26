import { type Page, expect, test } from '@playwright/test'

// The safe-area insets of an iPhone 17 in portrait: the status bar and
// Dynamic Island on top, the home indicator at the bottom.
const INSETS = { top: 62, bottom: 34, left: 0, right: 0 }

const seat = (page: Page, playerId: string) => page.getByTestId(`seat-${playerId}`)

const box = async (page: Page, testId: string) => {
  const found = await page.getByTestId(testId).boundingBox()
  if (!found) throw new Error(`${testId} not visible`)
  return found
}

const radii = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate(element => {
    const style = getComputedStyle(element)
    return {
      topLeft: style.borderTopLeftRadius,
      topRight: style.borderTopRightRadius,
      bottomRight: style.borderBottomRightRadius,
      bottomLeft: style.borderBottomLeftRadius,
    }
  })

const viewport = (page: Page) => {
  const size = page.viewportSize()
  if (!size) throw new Error('no viewport')
  return size
}

const pickTwoPlayers = async (page: Page, layoutLabel: 'Face-off' | 'Flanks') => {
  await page.getByRole('button', { name: 'Table menu' }).click()
  await page.getByRole('group', { name: 'Number of players' }).getByRole('button', { name: '2' }).click()
  await page.getByRole('group', { name: 'Seating layout' }).getByRole('button', { name: new RegExp(layoutLabel) }).click()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-testid^=seat-]')).toHaveCount(2)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setSafeAreaInsetsOverride' as never, { insets: INSETS } as never)
})

test('face-off tiles bleed to every screen edge they touch', async ({ page }) => {
  await pickTwoPlayers(page, 'Face-off')
  const { width, height } = viewport(page)

  const top = await box(page, 'seat-p2')
  expect(top.y).toBe(0)
  expect(top.x).toBe(0)
  expect(top.width).toBe(width)

  const bottom = await box(page, 'seat-p1')
  expect(bottom.x).toBe(0)
  expect(bottom.width).toBe(width)
  expect(bottom.y + bottom.height).toBe(height)
})

test('corners on the screen edge are left to the display curve', async ({ page }) => {
  await pickTwoPlayers(page, 'Face-off')
  const top = await radii(page, 'seat-p2')
  expect([top.topLeft, top.topRight]).toEqual(['0px', '0px'])
  expect(top.bottomLeft).not.toBe('0px')
  expect(top.bottomRight).not.toBe('0px')

  const bottom = await radii(page, 'seat-p1')
  expect([bottom.bottomLeft, bottom.bottomRight]).toEqual(['0px', '0px'])
  expect(bottom.topLeft).not.toBe('0px')
  expect(bottom.topRight).not.toBe('0px')
})

test('the tap targets stay inside the safe area', async ({ page }) => {
  await pickTwoPlayers(page, 'Face-off')
  const { height } = viewport(page)

  const topZone = await seat(page, 'p2').locator('[data-zone=plus]').boundingBox()
  const bottomZone = await seat(page, 'p1').locator('[data-zone=plus]').boundingBox()
  if (!topZone || !bottomZone) throw new Error('zones not visible')
  expect(topZone.y).toBeCloseTo(INSETS.top, 0)
  expect(bottomZone.y + bottomZone.height).toBeCloseTo(height - INSETS.bottom, 0)
})

const cogCentre = async (page: Page) => {
  const cog = await page.getByRole('button', { name: 'Table menu' }).boundingBox()
  if (!cog) throw new Error('cog not visible')
  return { x: cog.x + cog.width / 2, y: cog.y + cog.height / 2 }
}

test('the table cog sits in the middle of the gap between face-off seats', async ({ page }) => {
  await pickTwoPlayers(page, 'Face-off')
  const top = await box(page, 'seat-p2')
  const bottom = await box(page, 'seat-p1')
  const cog = await cogCentre(page)
  expect(cog.x).toBeCloseTo(top.x + top.width / 2, 0)
  expect(cog.y).toBeCloseTo((top.y + top.height + bottom.y) / 2, 0)
})

test('the table cog sits in the middle of the gap between flanking seats', async ({ page }) => {
  await pickTwoPlayers(page, 'Flanks')
  const left = await box(page, 'seat-p1')
  const right = await box(page, 'seat-p2')
  const cog = await cogCentre(page)
  expect(cog.x).toBeCloseTo((left.x + left.width + right.x) / 2, 0)
  expect(cog.y).toBeCloseTo(left.y + left.height / 2, 0)
})

for (const layoutLabel of ['Face-off', 'Flanks'] as const) {
  test(`the table cog never covers a player's name (${layoutLabel})`, async ({ page }) => {
    await pickTwoPlayers(page, layoutLabel)
    const cog = await page.getByRole('button', { name: 'Table menu' }).boundingBox()
    if (!cog) throw new Error('cog not visible')
    for (const playerId of ['p1', 'p2']) {
      const name = await box(page, `name-${playerId}`)
      const overlaps =
        name.x < cog.x + cog.width && cog.x < name.x + name.width &&
        name.y < cog.y + cog.height && cog.y < name.y + name.height
      expect(overlaps, `${playerId}'s name is under the cog`).toBe(false)
    }
  })
}

test('the player dialog clears the status bar and home indicator', async ({ page }) => {
  await pickTwoPlayers(page, 'Face-off')
  await page.getByTestId('life-p1').click()
  const panel = page.getByRole('dialog').locator('div.overflow-y-auto')
  await expect(panel).toBeVisible()
  await page.waitForTimeout(300)
  const found = await panel.boundingBox()
  if (!found) throw new Error('panel not visible')
  const { height } = viewport(page)
  expect(found.y).toBeGreaterThanOrEqual(INSETS.top)
  expect(found.y + found.height).toBeLessThanOrEqual(height - INSETS.bottom)
})

test('the high roll hides the life total and rings the winner along the screen curve', async ({ page }) => {
  await pickTwoPlayers(page, 'Face-off')
  await page.getByRole('button', { name: 'Table menu' }).click()
  await page.getByRole('button', { name: 'High roll' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  for (const playerId of ['p1', 'p2']) {
    const life = await box(page, `life-${playerId}`)
    // The overlay ignores pointers, so hit-test with them switched on.
    const onTop = await page.evaluate(
      ({ x, y }) => {
        const overlays = [...document.querySelectorAll<HTMLElement>('.high-roll')]
        for (const overlay of overlays) overlay.style.pointerEvents = 'auto'
        const hit = document.elementFromPoint(x, y)?.closest('.high-roll') != null
        for (const overlay of overlays) overlay.style.pointerEvents = ''
        return hit
      },
      { x: life.x + life.width / 2, y: life.y + life.height / 2 },
    )
    expect(onTop, `${playerId}'s life total is above the roll`).toBe(true)
    const background = await page
      .getByTestId(`high-roll-${playerId}`)
      .evaluate(element => getComputedStyle(element).backgroundColor)
    expect(background, `${playerId}'s roll is see-through`).not.toMatch(/\/\s*0?\.\d|rgba\(.*,\s*0?\.\d+\)|transparent/)
  }

  const frame = page.locator('.high-roll-frame')
  await expect(frame).toHaveCount(1)
  const winner = await frame.evaluate(element => element.closest('[data-testid^=seat-]')?.getAttribute('data-testid'))
  const style = await frame.evaluate(element => {
    const computed = getComputedStyle(element)
    return [computed.borderTopLeftRadius, computed.borderBottomLeftRadius]
  })
  // The winner's screen-edge corners follow the display (the top inset);
  // the corners facing the other seat keep the seat's own radius.
  const [screenSide, innerSide] = winner === 'seat-p2' ? style : [...style].reverse()
  expect(screenSide).toBe(`${INSETS.top}px`)
  expect(innerSide).not.toBe(`${INSETS.top}px`)
})
