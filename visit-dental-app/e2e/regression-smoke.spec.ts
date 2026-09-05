import { test, expect } from '@playwright/test'

const EMPHASIS_BARS = [
  'faxEmphasisBar',
  'svListEmphasisBar',
  'issEmphasisBar',
  'personalSheetEmphasisBar',
  'recordNotesEmBar',
]

const MODALS = [
  'faxDailyModal',
  'svListModal',
  'shareSheetModal',
  'personalSheetModal',
]

test.describe('regression smoke — DOM shell', () => {
  test('boot completes and core globals exist', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    await expect(page.locator('#screen-record')).toBeAttached()
    await page.waitForFunction(() => typeof (window as unknown as { rptEmApply_?: unknown }).rptEmApply_ === 'function')
  })

  test('emphasis bars and report modals exist', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    for (const id of EMPHASIS_BARS) {
      await expect(page.locator(`#${id}`)).toHaveCount(1)
    }
    for (const id of MODALS) {
      await expect(page.locator(`#${id}`)).toHaveCount(1)
    }
  })

  test('ISS modal shows emphasis bar with all kinds', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    await page.evaluate(() => {
      document.getElementById('shareSheetModal')?.classList.add('show')
    })
    const bar = page.locator('#issEmphasisBar')
    await expect(bar).toBeAttached()
    for (const kind of ['red', 'hl', 'box', 'boxBlack', 'clear']) {
      await expect(bar.locator(`[data-fax-em="${kind}"]`)).toHaveCount(1)
    }
  })

  test('preview inners exist for rich reports', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    for (const id of ['faxDailyPreviewInner', 'svListPreviewInner', 'issPreviewInner', 'personalSheetPreviewInner']) {
      await expect(page.locator(`#${id}`)).toHaveCount(1)
    }
  })

  test('rptEmApply_ is callable after rich cell focus (ISS sidebar)', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    await page.evaluate(() => {
      document.getElementById('shareSheetModal')?.classList.add('show')
      const ed = document.getElementById('issFreeTextEd') as HTMLElement | null
      if (ed) {
        ed.innerHTML = 'テスト文字'
        ed.focus()
        const w = window as unknown as {
          rptSetActiveRichCell_?: (el: HTMLElement) => void
          rptEmApply_?: (kind: string) => void
        }
        w.rptSetActiveRichCell_?.(ed)
        const sel = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(ed)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    })
    const ok = await page.evaluate(() => {
      const w = window as unknown as { rptEmApply_?: (kind: string) => void }
      if (typeof w.rptEmApply_ !== 'function') return false
      try {
        w.rptEmApply_('red')
        const ed = document.getElementById('issFreeTextEd')
        return !!ed?.querySelector('.fax-em-red')
      } catch {
        return false
      }
    })
    expect(ok).toBe(true)
  })

  test('rptRichMultilineToMarkers_ preserves blank lines for print', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    const ok = await page.evaluate(() => {
      const w = window as unknown as {
        rptRichMultilineToMarkers_?: (el: HTMLElement) => string
        faxMarkersToHtml_?: (raw: string) => string
      }
      if (typeof w.rptRichMultilineToMarkers_ !== 'function' || typeof w.faxMarkersToHtml_ !== 'function') return false
      const div = document.createElement('div')
      div.innerHTML = '一行目<div><br></div><span class="fax-em-box-black">A<br>B</span>'
      const markers = w.rptRichMultilineToMarkers_(div)
      const html = w.faxMarkersToHtml_(markers)
      const brCount = (html.match(/<br/gi) || []).length
      return markers.includes('\n\n') && html.includes('fax-em-box-black') && brCount >= 2
    })
    expect(ok).toBe(true)
  })
})
