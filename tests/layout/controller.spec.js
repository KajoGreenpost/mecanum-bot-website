import { test, expect } from '@playwright/test'

for (const [width, height] of [[852, 393], [667, 375], [568, 320], [740, 300], [932, 430], [1024, 600]]) {
  test(`landscape ${width}x${height}: all controls fit, brand hidden, no scrolling`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    await page.goto('/')
    await expect(page.locator('.arm-control')).toBeVisible()
    await expect(page.locator('.status-left')).toBeHidden()
    await page.locator('.control-page').evaluate(async node => {
      await Promise.all(node.getAnimations().map(animation => animation.finished))
    })
    const layout = await page.evaluate(() => {
      const main = document.querySelector('.main-area').getBoundingClientRect()
      const nodes = [...document.querySelectorAll('.joystick-title-row, .joystick-pad, .telemetry-card, .arm-control')]
      const rects = nodes.map(node => ({ name: node.className, rect: node.getBoundingClientRect().toJSON() }))
      const overflowing = [...document.querySelectorAll('.app-content, .main-area, .control-page, .joystick-stage')]
        .filter(node => node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1).map(node => node.className)
      return { main: main.toJSON(), rects, overflowing,
        touchAction: getComputedStyle(document.querySelector('.control-page')).touchAction }
    })
    expect(layout.overflowing).toEqual([])
    expect(layout.touchAction).toBe('none')
    for (const { name, rect } of layout.rects) {
      expect(rect.top, name).toBeGreaterThanOrEqual(layout.main.top)
      expect(rect.bottom, name).toBeLessThanOrEqual(layout.main.bottom + 1)
      expect(rect.left, name).toBeGreaterThanOrEqual(0)
      expect(rect.right, name).toBeLessThanOrEqual(width)
      if (name === 'joystick-pad') {
        expect(Math.abs(rect.width - rect.height)).toBeLessThan(1)
        expect(rect.width).toBeGreaterThanOrEqual(160)
      }
    }
    const left = layout.rects.filter(node => node.name === 'joystick-pad')[0].rect
    const right = layout.rects.filter(node => node.name === 'joystick-pad')[1].rect
    const button = layout.rects.find(node => node.name.startsWith('arm-control')).rect
    expect(left.right).toBeLessThan(button.left)
    expect(button.right).toBeLessThan(right.left)
    await page.mouse.move(width / 2, height / 2)
    await page.mouse.wheel(0, 500)
    expect(await page.locator('.control-page').evaluate(node => node.scrollTop)).toBe(0)
    await page.screenshot({ path: `test-results/controller-${width}x${height}.png` })
  })
}

test('both thumbs move independently without scrolling; portrait rotation stops control', async ({ page }) => {
  await page.setViewportSize({ width: 852, height: 393 })
  await page.goto('/')
  await page.locator('.arm-control').click()
  await expect(page.locator('.arm-title')).toHaveText('STOPP')
  const pads = await page.locator('.joystick-pad').all()
  const [left, right] = await Promise.all(pads.map(pad => pad.boundingBox()))
  const session = await page.context().newCDPSession(page)
  const points = [left, right].map((rect, id) => ({ id, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }))
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points })
  await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [
    { ...points[0], y: points[0].y - left.height * 0.3 },
    { ...points[1], x: points[1].x + right.width * 0.3 },
  ] })
  await expect(pads[0].locator('..').locator('..').locator('.telemetry-card .telem-num').last()).not.toHaveText('0')
  await expect(pads[1].locator('..').locator('..').locator('.telemetry-card .telem-num').last()).not.toHaveText('0')
  expect(await page.locator('.control-page').evaluate(node => node.scrollTop)).toBe(0)
  await page.screenshot({ path: 'test-results/controller-two-thumbs.png' })
  await page.setViewportSize({ width: 393, height: 852 })
  await expect(page.locator('.orientation-hint')).toBeVisible()
  await expect(page.locator('.joystick-stage')).toBeHidden()
  await expect(page.locator('.hud-badge.safe')).toBeVisible()
  await page.setViewportSize({ width: 852, height: 393 })
  await expect(page.locator('.arm-title')).toHaveText('AKTIVIEREN')
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
})

test('settings keep their own scrollable area', async ({ page }) => {
  await page.setViewportSize({ width: 852, height: 393 })
  await page.goto('/')
  await page.getByRole('button', { name: 'EINSTELLUNGEN', exact: true }).click()
  await expect(page.locator('.settings-scroll')).toBeVisible()
  const scroll = await page.locator('.settings-scroll').evaluate(node => {
    node.scrollTop = 400
    return { top: node.scrollTop, touchAction: getComputedStyle(node).touchAction }
  })
  expect(scroll.top).toBeGreaterThan(0)
  expect(scroll.touchAction).toBe('pan-y')
  await page.locator('.settings-scroll').evaluate(node => { node.scrollTop = 0 })
  const session = await page.context().newCDPSession(page)
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 0, x: 800, y: 280 }] })
  for (const y of [250, 220, 180, 130]) {
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 0, x: 800, y }] })
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => page.locator('.settings-scroll').evaluate(node => node.scrollTop)).toBeGreaterThan(0)
})
