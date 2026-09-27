import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
const runtimeErrors = new WeakMap<object, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  runtimeErrors.set(page, errors)
  page.on('pageerror', (error) => errors.push(error.message))
})
test.afterEach(({ page }) => {
  expect(runtimeErrors.get(page), 'No runtime or hydration errors').toEqual([])
})
for (const width of [390, 1440]) {
  test(`prerendered query links hydrate cleanly at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/timeline?view=read&from=4000BCE&to=2026CE&regions=africa')
    await expect(page.getByRole('button', { name: 'Read', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('textbox', { name: 'From date', exact: true })).toHaveValue(
      '4000BCE',
    )
    await page.reload()
    await expect(page.getByRole('button', { name: 'Read', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.goto('/timeline?view=compare&regions=africa,east-asia&from=1000CE&to=1400CE')
    await expect(page.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'Expand East Asia', exact: true })).toBeVisible()
    await page.goto('/search?q=Gutenberg')
    await expect(page.locator('main')).toContainText('1 matches')
    await page.goto('/timeline?view=read&selected=evt_000001')
    await expect(page.getByRole('dialog', { name: 'Event details' })).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Close event details' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
}
test('landing, search, detail sources and a deep refresh', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('History didn’t happen')
  await page.getByRole('link', { name: 'Search the atlas', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search all history' }).fill('Gutenberg')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.locator('main')).toContainText('1 matches')
  await page.getByRole('link', { name: 'The Gutenberg Bible is completed at Mainz' }).click()
  await expect(page.locator('h1')).toContainText('Gutenberg')
  await page.reload()
  await expect(page.locator('h1')).toContainText('Gutenberg')
  await page.getByRole('link', { name: /Source 000064/ }).count()
  await page.locator('ol li a').first().click()
  await expect(page.getByRole('link', { name: 'Read the original source' })).toHaveAttribute(
    'href',
    /loc.gov/,
  )
  expect(errors).toEqual([])
})
test('expanded museum records are searchable and retain uncertainty and source links', async ({
  page,
}) => {
  await page.goto('/search?q=Ardabil')
  await page.getByRole('link', { name: 'The Ardabil carpets receive dated inscriptions' }).click()
  await expect(page.locator('main')).toContainText('1539–1540 CE (AH 946)')
  await expect(page.locator('main')).toContainText('not a two-year weaving duration')
  await page.reload()
  await expect(page.locator('h1')).toContainText('Ardabil')
  await page.goto('/sources/src_000106')
  await expect(page.getByRole('link', { name: 'Read the original source' })).toHaveAttribute(
    'href',
    'https://www.vam.ac.uk/articles/the-ardabil-carpet/',
  )
  await page.goto('/search?q=Nataraja')
  await page.getByRole('link', { name: 'Chola artists cast Shiva as Lord of Dance' }).click()
  await expect(page.locator('main')).toContainText('late 12th–early 13th century CE')
  await page.goto('/sources/src_000108')
  await expect(page.getByRole('link', { name: 'Read the original source' })).toHaveAttribute(
    'href',
    'https://www.metmuseum.org/art/collection/search/39329',
  )
})
test('URL state, filters, synchronized compare and browser history', async ({ page }) => {
  await page.goto('/timeline?from=1000CE&to=1400CE&regions=africa,east-asia,americas&view=compare')
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: 'Expand Africa', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expand East Asia', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expand The Americas', exact: true })).toBeVisible()
  const tracks = await page
    .locator('[class*="laneTrack_"]')
    .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().x))
  expect(new Set(tracks).size).toBe(1)
  await page.getByRole('button', { name: 'Read', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Read', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.goBack()
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('textbox', { name: 'From date', exact: true })).toHaveValue('1000CE')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
test('drawer keyboard focus, closure and save persistence', async ({ page }) => {
  await page.goto('/timeline?view=read')
  const opener = page.getByRole('button', {
    name: 'Angkor’s cities and water networks grow',
    exact: true,
  })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Event details' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('h1')).toContainText('Angkor')
  await dialog
    .getByRole('button', { name: 'Bookmark Angkor’s cities and water networks grow', exact: true })
    .click()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(opener).toBeFocused()
  await page.goto('/bookmarks')
  await expect(
    page.getByRole('link', { name: 'Angkor’s cities and water networks grow', exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('link', { name: 'Angkor’s cities and water networks grow', exact: true }),
  ).toBeVisible()
})
test('clusters disclose records and expanded lanes remain accessible', async ({ page }) => {
  await page.goto('/timeline?from=4000BCE&to=2026CE&density=sparse')
  const cluster = page.getByRole('button', { name: /Show \d+ clustered records in Africa/ }).first()
  await cluster.click()
  await expect(page.getByRole('region', { name: 'Cluster contents' })).toBeVisible()
  await page.getByRole('button', { name: 'Close cluster' }).click()
  await page.getByRole('button', { name: 'Expand Africa', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Collapse Africa', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
  await page.getByRole('button', { name: 'Move Africa down', exact: true }).click()
  await page.reload()
  const names = await page.locator('button[aria-label^="Expand "]').allTextContents()
  expect(names[0]).toContain('West Asia')
})
test('journeys navigate and restore reading progress', async ({ page }) => {
  await page.goto('/journeys/jrn_000004')
  await expect(page.locator('main').getByRole('heading', { level: 1 }).first()).toContainText(
    'Words, blocks',
  )
  await page.getByRole('button', { name: 'Next journey step' }).click()
  await expect(page.locator('main')).toContainText('STOP 2 OF 8')
  await page.reload()
  await expect(page.locator('main')).toContainText('STOP 2 OF 8')
})
test('invalid URL reset, BCE search and missing assets', async ({ page, request }) => {
  await page.goto('/timeline?from=0CE&to=500BCE&regions=imaginary&v=99')
  await expect(page.getByRole('status')).toContainText('invalid')
  await page.goto('/search?q=1200%20BCE')
  await expect(page.getByRole('link', { name: /Explore 1200 BCE on/ })).toBeVisible()
  await page.getByRole('link', { name: /Explore 1200 BCE on/ }).click()
  await expect(page.getByRole('textbox', { name: 'From date', exact: true })).toHaveValue('1200BCE')
  for (const url of ['/data/missing.json', '/assets/missing.js', '/events/evt_999999']) {
    const r = await request.get(url)
    expect(r.status()).toBe(404)
    expect(r.headers()['content-type']).not.toContain('text/html')
  }
})
test('bookmark import validates and offers merge or replace', async ({ page }) => {
  await page.goto('/bookmarks')
  const json = JSON.stringify({
    schemaVersion: 1,
    bookmarks: [
      { schemaVersion: 1, id: 'evt_000001', label: 'Caral', savedAt: '2026-09-26T12:00:00.000Z' },
    ],
  })
  await page.getByLabel('Import bookmark file').setInputFiles({
    name: 'bookmarks.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  })
  await expect(
    page.getByRole('heading', { name: '1 validated bookmarks ready to import' }),
  ).toBeVisible()
  await page.getByLabel('Replace existing bookmarks').check()
  await page.getByRole('button', { name: 'Import bookmarks', exact: true }).click()
  await expect(
    page.getByRole('link', { name: 'Caral’s monumental city takes shape' }),
  ).toBeVisible()
  await page.getByLabel('Import bookmark file').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":1,"bookmarks":[{"id":"bad"}]}'),
  })
  await expect(page.getByRole('status')).toContainText('Error')
})
for (const width of [320, 390, 768, 1440])
  test(`responsive layout and accessibility at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const home = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(home.violations).toEqual([])
    await page.goto('/timeline?view=read')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(result.violations).toEqual([])
    if (info.project.name === 'chromium')
      await page.screenshot({ path: `docs/screenshots/read-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Atlas', exact: true }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    if (width < 700)
      await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeVisible()
  })
test('mobile first visit defaults to Read, explicit Atlas wins', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/timeline')
  await expect(page.getByRole('button', { name: 'Read', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.goto('/timeline?view=atlas')
  await expect(page.getByRole('button', { name: 'Atlas', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
for (const theme of ['dark', 'contrast'])
  test(`appearance ${theme}, keyboard access and readable zoom`, async ({ page }) => {
    await page.goto('/')
    await page.getByRole('combobox', { name: 'Appearance' }).selectOption(theme)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const audit = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(audit.violations).toEqual([])
    await page.goto('/timeline?view=atlas')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const pane = page.getByLabel('Pan timeline', { exact: true })
    await pane.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('textbox', { name: 'From date', exact: true })).toHaveValue(
      '1200CE',
    )
    await page.getByRole('button', { name: 'Read', exact: true }).click()
    // A 1440px browser at 200% desktop zoom exposes a 720 CSS-pixel viewport.
    await page.setViewportSize({ width: 720, height: 500 })
    await expect(page.getByRole('button', { name: 'Read', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
