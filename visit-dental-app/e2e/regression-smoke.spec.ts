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
  'facilityHandoverModal',
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

  test('report modals have mobile scroll shell (scroll body + fixed foot)', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    for (const modalId of ['faxDailyModal', 'svListModal', 'personalSheetModal', 'patientPpsModal', 'facilityHandoverModal']) {
      const modal = page.locator(`#${modalId}`)
      await expect(modal.locator('.fax-daily-modal-scroll-body')).toHaveCount(1)
      await expect(modal.locator('.fax-daily-modal-foot')).toHaveCount(1)
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
        buildPersonalSheetPatientBodyFromVisits_?: (p: unknown) => string
        buildPersonalSheetGridDocumentHtml_?: (ctx: unknown, forPrint: boolean) => string
      }
      if (typeof w.rptRichMultilineToMarkers_ !== 'function' || typeof w.faxMarkersToHtml_ !== 'function') return false
      const div = document.createElement('div')
      div.innerHTML = '一行目<div><br></div><span class="fax-em-box-black">A<br>B</span>'
      const markers = w.rptRichMultilineToMarkers_(div)
      const html = w.faxMarkersToHtml_(markers)
      const brCount = (html.match(/<br/gi) || []).length
      const lines = document.createElement('div')
      lines.innerHTML = '<div>1行目</div><div>2行目</div><div><span class="fax-em-box">枠</span></div>'
      const packed = w.rptRichMultilineToMarkers_(lines)
      const shoshin = typeof w.buildPersonalSheetPatientBodyFromVisits_ === 'function'
        ? w.buildPersonalSheetPatientBodyFromVisits_({
            patient_id: 'p-shoshin',
            visits: [{ visit_date: '2026-09-29', treatments: '初診、口腔ケア', notes: '', visit_time_start: '', visit_time_end: '' }],
          })
        : ''
      const shoshinOk = shoshin.includes('《赤》初診《/赤》') && !shoshin.includes('【枠】初診') && (shoshin.match(/初診/g) || []).length === 1
      const grid = w.buildPersonalSheetGridDocumentHtml_
      const noteOn = grid ? grid({
        facility_name: '施設', ym: '2026-09',
        patients: [{ patient_id: '1', room: '1', name: 'A', body: shoshin }],
        _show_facility_note: true, facility_note: '連絡です',
      }, false) : ''
      const notePrint = grid ? grid({
        facility_name: '施設', ym: '2026-09',
        patients: [{ patient_id: '1', room: '1', name: 'A', body: '本文' }],
        facility_note: '',
      }, true) : ''
      const noteOk = noteOn.includes('その他の連絡事項') && noteOn.includes('連絡です') && noteOn.includes('ps-facility-note-del')
        && noteOn.includes('fax-em-red') && noteOn.includes('初診')
        && !notePrint.includes('その他の連絡事項')
      return markers.includes('\n\n') && html.includes('fax-em-box-black') && brCount >= 2
        && packed === '1行目\n2行目\n【枠】枠【/枠】'
        && shoshinOk && noteOk
    })
    expect(ok).toBe(true)
  })

  test('WYSIWYG print helpers exist for all rich preview reports', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    const fns = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      return [
        'rptPreviewHtmlForPrint_',
        'faxDailyHtmlForPrint_',
        'svListHtmlForPrint_',
        'issHtmlForPrint_',
        'personalSheetHtmlForPrint_',
      ].map(n => typeof w[n] === 'function')
    })
    expect(fns.every(Boolean)).toBe(true)
  })

  test('patientPhotoDisplaySrc_ prefers Drive URL over broken driveimg', async ({ page }) => {
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
        patientPhotoDisplaySrc_?: (p: {
          id?: string
          dataUrl?: string
          driveUrl?: string
        }) => string
      }
      if (typeof w.patientPhotoDisplaySrc_ !== 'function') return false
      const src = w.patientPhotoDisplaySrc_({
        id: 'abc123FILE',
        driveUrl: 'https://script.google.com/macros/s/xxx/exec?driveimg=abc123FILE',
      })
      return (
        !!src &&
        src.indexOf('driveimg=') < 0 &&
        (src.indexOf('thumbnail') >= 0 || src.indexOf('drive.google.com') >= 0)
      )
    })
    expect(ok).toBe(true)
  })

  test('treatment history screen has back, print, and mgmt helpers', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    await expect(page.locator('#historyBackBtn')).toHaveCount(1)
    await expect(page.locator('#historySummaryBar')).toHaveCount(1)
    const fns = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      return [
        'openHistoryFromMgmt_',
        'closeHistoryScreen_',
        'printTreatmentHistory_',
        'buildTreatmentHistoryPrintHtml_',
      ].map(n => typeof w[n] === 'function')
    })
    expect(fns.every(Boolean)).toBe(true)
  })

  test('background save helpers and save-now hint exist', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    await expect(page.locator('#dataSyncBanner')).toHaveCount(1)
    await expect(page.locator('#screen-record .save-now-hint')).toHaveCount(1)
    const fns = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>
      return [
        'enqueueBgSaveJob_',
        'retryBgSaveJob_',
        'renderBgSaveBanner_',
        'hasPendingBgSaveJobs_',
      ].map(n => typeof w[n] === 'function')
    })
    expect(fns.every(Boolean)).toBe(true)
  })

  test('facility handover course starts at first visit and omits hitokoto heading', async ({ page }) => {
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
        fhBuildCourseText_?: (records: unknown[], firstVisitYmd: string) => string
        buildFacilityHandoverPrintHtml_?: (ctx: unknown) => string
      }
      if (typeof w.fhBuildCourseText_ !== 'function' || typeof w.buildFacilityHandoverPrintHtml_ !== 'function') return false
      const course = w.fhBuildCourseText_([
        { visit_date: '2024-01-10', treatments: '口腔ケア', notes: '初診より前' },
        { visit_date: '2024-04-01', treatments: '初診、口腔ケア', notes: '《赤》初診メモ《/赤》' },
        { visit_date: '2024-05-01', treatments: '義歯調整', notes: '' },
      ], '2024-04-01')
      const courseOk = course.includes('2024年4月1日') && course.includes('初診、口腔ケア')
        && course.includes('初診メモ') && !course.includes('《赤》')
        && course.includes('2024年5月1日') && course.includes('義歯調整')
        && !course.includes('初診より前') && !course.includes('2024年1月10日')
      const all = w.fhBuildCourseText_([
        { visit_date: '2024-01-10', treatments: '口腔ケア', notes: '' },
      ], '')
      const html = w.buildFacilityHandoverPrintHtml_({
        facility_name: 'ペルソレイユ市川',
        report_title: '施設申し送り（歯科）',
        facility_note: '令和8年10月30日をもって訪問診療を終了します。',
        patients: [{
          included: true,
          room: '101',
          name: '山田',
          course_text: '2024年4月1日　初診',
          comment_text: 'まとめ',
          special_rows: [],
        }],
      })
      const emptyCourse = w.buildFacilityHandoverPrintHtml_({
        facility_name: '施設',
        facility_note: '',
        patients: [{ included: true, name: '山田', course_text: '   ', comment_text: '' }],
      })
      const printOk = html.includes('令和8年10月30日をもって訪問診療を終了します。')
        && !html.includes('ひとこと')
        && html.includes('治療経過')
        && html.includes('2024年4月1日　初診')
        && html.includes('コメント')
        && html.includes('まとめ')
        && !emptyCourse.includes('治療経過')
      return courseOk && all.includes('2024年1月10日') && printOk
    })
    expect(ok).toBe(true)
  })

  test('facility handover hides excluded patient body on the screen', async ({ page }) => {
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
        fhFacilityHandoverListHtml_?: (patients: unknown[]) => string
        buildFacilityHandoverPrintHtml_?: (ctx: unknown) => string
      }
      if (typeof w.fhFacilityHandoverListHtml_ !== 'function' || typeof w.buildFacilityHandoverPrintHtml_ !== 'function') return false
      const html = w.fhFacilityHandoverListHtml_([
        { patient_id: 'a', included: true, room: '1', name: '印刷する人', denture_text: '上 総義歯', course_text: '', comment_text: '', special_rows: [] },
        { patient_id: 'b', included: false, room: '2', name: '外した人', denture_text: '下の義歯だけ', course_text: '秘密の経過', comment_text: 'まとめコメント', special_rows: [] },
      ])
      const cardCount = (html.match(/data-fh-card=/g) || []).length
      const screenOk = cardCount === 1
        && html.includes('data-fh-card="a"')
        && !html.includes('data-fh-card="b"')
        && html.includes('印刷する人')
        && html.includes('上 総義歯')
        && html.includes('data-fh-hidden="b"')
        && html.includes('外した人')
        && html.includes('戻す')
        && !html.includes('下の義歯だけ')
        && !html.includes('秘密の経過')
        && !html.includes('まとめコメント')
      const print = w.buildFacilityHandoverPrintHtml_({
        facility_name: '施設',
        facility_note: '',
        patients: [
          { included: true, name: '印刷する人', room: '1', course_text: '', comment_text: '', special_rows: [] },
          { included: false, name: '外した人', room: '2', denture_text: '下の義歯だけ', course_text: '秘密の経過', comment_text: 'まとめコメント', special_rows: [] },
        ],
      })
      const printOk = print.includes('印刷する人') && !print.includes('外した人') && !print.includes('秘密の経過')
      return screenOk && printOk
    })
    expect(ok).toBe(true)
  })

  test('visit timetable keeps screening patients and labels 無料検診', async ({ page }) => {
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
        visitTimetablePatientOnRoster_?: (p: { status?: string; fac?: string; intake_stage?: string }, facId: string) => boolean
        visitTimetablePatientNeedsMushoLabel_?: (p: { intake_stage?: string }, records: { treatments?: string }[]) => boolean
        visitTimetableDefaultTreat_?: (p: { id?: string; intake_stage?: string; in_hospital?: string }) => string
      }
      if (
        typeof w.visitTimetablePatientOnRoster_ !== 'function' ||
        typeof w.visitTimetablePatientNeedsMushoLabel_ !== 'function' ||
        typeof w.visitTimetableDefaultTreat_ !== 'function'
      ) return false
      const onList = w.visitTimetablePatientOnRoster_(
        { status: 'active', fac: 'f1', intake_stage: 'musho_kenshin' },
        'f1',
      )
      const offList = w.visitTimetablePatientOnRoster_(
        { status: 'left', fac: 'f1', intake_stage: 'musho_kenshin' },
        'f1',
      )
      const tagOnly = w.visitTimetablePatientNeedsMushoLabel_({ intake_stage: 'musho_kenshin' }, [])
      const recordOnly = w.visitTimetablePatientNeedsMushoLabel_(
        { intake_stage: '' },
        [{ treatments: '無料検診' }],
      )
      const afterShoshin = w.visitTimetablePatientNeedsMushoLabel_(
        { intake_stage: 'musho_kenshin' },
        [{ treatments: '初診、口腔ケア' }],
      )
      const regular = w.visitTimetablePatientNeedsMushoLabel_(
        { intake_stage: '' },
        [{ treatments: '口腔ケア' }],
      )
      const treat = w.visitTimetableDefaultTreat_({ id: 'e2e-musho-only', intake_stage: 'musho_kenshin' })
      const treatHosp = w.visitTimetableDefaultTreat_({
        id: 'e2e-musho-hosp',
        intake_stage: 'musho_kenshin',
        in_hospital: '1',
      })
      return onList && !offList && tagOnly && recordOnly && !afterShoshin && !regular
        && treat === '無料検診'
        && treatHosp === '無料検診、入院中'
    })
    expect(ok).toBe(true)
  })

  test('personal sheet print uses the same tooth box width as the bridge lines', async ({ page }) => {
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
        renderTeethChartHtml_?: (data: unknown, opts: unknown) => string
        getPatientPpsPrintCss_?: () => string
        getTeethChartPrintCss_?: () => string
      }
      if (
        typeof w.renderTeethChartHtml_ !== 'function' ||
        typeof w.getPatientPpsPrintCss_ !== 'function' ||
        typeof w.getTeethChartPrintCss_ !== 'function'
      ) return false
      const html = w.renderTeethChartHtml_({ upper_L8: 'Br', upper_L7: 'C2' }, { readOnly: true })
      const css = w.getPatientPpsPrintCss_() + w.getTeethChartPrintCss_()
      const cellBox = html.includes('box-sizing:border-box;width:44px')
      const bridgeWidth = html.includes('width="749"')
      const printBox = css.includes('box-sizing: border-box')
      return cellBox && bridgeWidth && printBox
    })
    expect(ok).toBe(true)
  })
})
