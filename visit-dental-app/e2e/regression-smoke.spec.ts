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

  test('calendar count splits free screening as regular+musho', async ({ page }) => {
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
        calFacCountLabel_?: (regular: number, musho: number) => string
        calDayPatientIsMusho_?: (recs: { treatments?: string }[]) => boolean
      }
      if (typeof w.calFacCountLabel_ !== 'function' || typeof w.calDayPatientIsMusho_ !== 'function') return false
      const label = w.calFacCountLabel_(19, 1) === '19+1'
        && w.calFacCountLabel_(20, 0) === '20'
        && w.calFacCountLabel_(0, 2) === '0+2'
      const musho = w.calDayPatientIsMusho_([{ treatments: '無料検診' }])
      const withStatus = w.calDayPatientIsMusho_([{ treatments: '無料検診、入院中' }])
      const withCare = !w.calDayPatientIsMusho_([{ treatments: '無料検診、口腔ケア' }])
      const withShoshin = !w.calDayPatientIsMusho_([{ treatments: '初診、無料検診' }])
      const regular = !w.calDayPatientIsMusho_([{ treatments: '口腔ケア' }])
      return label && musho && withStatus && withCare && withShoshin && regular
    })
    expect(ok).toBe(true)
  })

  test('month care checks denture cleaning when the tooth chart shows a denture in use', async ({ page }) => {
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
        mapVisitToGokanSlot_?: (visit: unknown, data: unknown, used: Set<string>) => {
          today?: { oral_care?: { checked?: boolean, subs?: Record<string, boolean> } }
        }
      }
      if (typeof w.mapVisitToGokanSlot_ !== 'function') return false
      const slot = (treatments: string, teeth: Record<string, boolean>) =>
        w.mapVisitToGokanSlot_!(
          { visit_date: '2026-10-01', treatments, notes: '' },
          { teeth_data: teeth },
          new Set(),
        )
      const on = (s: ReturnType<typeof slot>) => !!(s.today && s.today.oral_care && s.today.oral_care.subs && s.today.oral_care.subs['入れ歯の清掃'])
      const fd = on(slot('口腔ケア', { fd_upper: true }))
      const pd = on(slot('虫歯治療', { pd_lower: true }))
      const legacy = on(slot('口腔ケア', { fd: true }))
      const empty = !on(slot('口腔ケア', {}))
      const none = !on(slot('口腔ケア', { no_denture_upper: true, no_denture_lower: true }))
      const lost = !on(slot('口腔ケア', { fd_upper: true, denture_lost_upper: true }))
      const oneJaw = on(slot('口腔ケア', { fd_upper: true, denture_lost_upper: true, pd_lower: true }))
      const careVisit = slot('口腔ケア', { fd_upper: true })
      const careKept = !!(careVisit.today && careVisit.today.oral_care && careVisit.today.oral_care.subs
        && careVisit.today.oral_care.subs['口腔清掃'] && careVisit.today.oral_care.subs['歯茎の清掃'])
      const parentOff = slot('虫歯治療', { pd_upper: true })
      const parentOk = !(parentOff.today && parentOff.today.oral_care && parentOff.today.oral_care.checked)
      return fd && pd && legacy && empty && none && lost && oneJaw && careKept && parentOk
    })
    expect(ok).toBe(true)
  })

  test('swallow screening chip and form map into the printable sheet', async ({ page }) => {
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
        emptySwsData_?: () => Record<string, unknown>
        buildSwsDocumentHtml_?: (data: Record<string, unknown>, forPrint: boolean, opts?: { includeQuestionnaires?: boolean, showLinkMarks?: boolean }) => string
        applySwsTeethDefaults_?: (data: Record<string, unknown>, teeth: Record<string, unknown>, force: boolean) => Record<string, unknown>
        swsPill5GuideText_?: (total: number | null) => string
        swsSyncLinkedQuestionnaireAnswers_?: (q: Record<string, string[]>, kind: string, idx: number) => boolean
        openSwallowScreenModal?: () => void
        toggleChip?: (code: string) => void
      }
      const modal = document.getElementById('swsModal')
      const printOpt = document.getElementById('swsPrintQuestionnaires') as HTMLInputElement | null
      const linkOpt = document.getElementById('swsShowLinkMarks') as HTMLInputElement | null
      const btn = [...document.querySelectorAll('.report-out-btn')].some(el => (el.textContent || '').includes('嚥下スクリーニング'))
      if (typeof w.emptySwsData_ !== 'function' || typeof w.buildSwsDocumentHtml_ !== 'function' || typeof w.applySwsTeethDefaults_ !== 'function') {
        return { ok: false, reason: 'missing-fns' }
      }
      const data = w.emptySwsData_() as {
        patientName?: string
        rsst?: { count?: string, judge?: string }
        oral?: { remainingTeeth?: string, dentureUse?: string[], dentureJaw?: string[] }
      }
      data.patientName = '山田花子'
      if (data.rsst) {
        data.rsst.count = '4'
        data.rsst.judge = 'normal'
      }
      const htmlMain = w.buildSwsDocumentHtml_(data as Record<string, unknown>, true, { includeQuestionnaires: false })
      const htmlQ = w.buildSwsDocumentHtml_(data as Record<string, unknown>, true, { includeQuestionnaires: true })
      const htmlQNoMark = w.buildSwsDocumentHtml_(data as Record<string, unknown>, true, { includeQuestionnaires: true, showLinkMarks: false })
      const teeth = w.applySwsTeethDefaults_(
        w.emptySwsData_() as Record<string, unknown>,
        { fd_upper: true, upper_L1: 'C2' },
        true,
      ) as { oral?: { remainingTeeth?: string, dentureUse?: string[], dentureJaw?: string[] } }
      const emptyTeeth = w.applySwsTeethDefaults_(
        w.emptySwsData_() as Record<string, unknown>,
        {},
        true,
      ) as { oral?: { remainingTeeth?: string } }
      const pillGuide = typeof w.swsPill5GuideText_ === 'function' ? w.swsPill5GuideText_(8) : ''
      const q = { seirei: Array(15).fill(''), fssg: Array(12).fill(''), eat10: Array(10).fill(''), pill5: Array(5).fill('') }
      q.seirei[6] = 'A'
      q.eat10[4] = '3'
      const syncResidue = typeof w.swsSyncLinkedQuestionnaireAnswers_ === 'function'
        ? (w.swsSyncLinkedQuestionnaireAnswers_(q, 'seirei', 6) && q.eat10[7] === '4')
        : false
      const syncPill = typeof w.swsSyncLinkedQuestionnaireAnswers_ === 'function'
        ? (w.swsSyncLinkedQuestionnaireAnswers_(q, 'eat10', 4) && q.pill5[0] === '3')
        : false
      const ok = !!modal && !!printOpt && !!linkOpt && btn && typeof w.openSwallowScreenModal === 'function' && typeof w.toggleChip === 'function'
        && htmlMain.includes('山田花子') && htmlMain.includes('反復唾液嚥下テスト') && htmlMain.includes('［4］') && htmlMain.includes('正常')
        && htmlMain.includes('sws-opt')
        && !htmlMain.includes('聖隷式嚥下質問紙') && !htmlMain.includes('次回VE嚥下内視鏡検査に向けて')
        && htmlMain.includes('総合判定 ＆ 今後の計画') && !htmlMain.includes('sws-page-break')
        && htmlQ.includes('聖隷式嚥下質問紙') && htmlQ.includes('sws-page-break') && htmlQ.includes('sws-q-page')
        && htmlQ.includes('酸逆流関連症状') && htmlQ.includes('運動不全（もたれ）症状')
        && htmlQ.includes('PILL-5（錠剤嚥下障害のアセスメント）') && htmlQ.includes('6未満＝正常')
        && htmlQ.includes('0：なし') && htmlQ.includes('1：ほとんどなし') && htmlQ.includes('4：毎回あった')
        && htmlQ.includes('0：ない') && htmlQ.includes('1：まれに') && htmlQ.includes('0：問題なし')
        && htmlQ.includes('A.明らかに') && htmlQ.includes('C.なし')
        && !htmlQ.includes('空欄のまま印刷し、現場で手書きしても構いません')
        && !htmlQ.includes('手書きでも同じ印どうしを揃えてください')
        && htmlQ.includes('連1') && htmlQ.includes('連7') && htmlQ.includes('sws-q-link-mark')
        && !htmlQNoMark.includes('sws-q-link-mark')
        && htmlMain.includes('1点：嚥下なし') && htmlMain.includes('泡立ち音')
        && pillGuide.includes('軽度から中等度')
        && syncResidue && syncPill
        && !!teeth?.oral?.dentureUse?.includes('use') && !!teeth?.oral?.dentureJaw?.includes('upper')
        && (emptyTeeth?.oral?.remainingTeeth === '' || emptyTeeth?.oral?.remainingTeeth == null)
      return { ok }
    })
    expect(ok).toEqual(expect.objectContaining({ ok: true }))
  })

  test('quarterly overview shows the previous value under each exam', async ({ page }) => {
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
        formatQuarterlyChipPrevDetail_?: (code: string, rec: unknown) => string
        quarterlyOverviewPrevLineText_?: (detail: string, valueYmd: string, statusLastYmd: string, hideStatusDate: boolean) => string
        quarterlyOverviewExamCellHtml_?: (info: unknown, prevLine: string, block: { title: string } | null) => string
        latestQuarterlyExamRecordFromList_?: (list: unknown[], patientId: string, code: string) => { id?: string } | null
      }
      if (
        typeof w.formatQuarterlyChipPrevDetail_ !== 'function' ||
        typeof w.quarterlyOverviewPrevLineText_ !== 'function' ||
        typeof w.quarterlyOverviewExamCellHtml_ !== 'function' ||
        typeof w.latestQuarterlyExamRecordFromList_ !== 'function'
      ) return false
      const tongue = w.formatQuarterlyChipPrevDetail_('舌圧検査', {
        exam_data: JSON.stringify({ 舌圧検査: { value: '28.5', unit: 'kPa' } }),
        notes: '',
      })
      const moisture = w.formatQuarterlyChipPrevDetail_('口腔粘膜湿潤度検査', {
        exam_data: '',
        notes: '口腔粘膜湿潤度 27.4点',
      })
      const site = w.formatQuarterlyChipPrevDetail_('フッ素塗布', {
        exam_data: JSON.stringify({ フッ素塗布: { labels: ['上右6', '上右7'] } }),
        notes: '',
      })
      const sameDay = w.quarterlyOverviewPrevLineText_('28.5kPa', '2026-08-02', '2026-08-02', false) === '28.5kPa'
      const older = w.quarterlyOverviewPrevLineText_('28.5kPa', '2024-06-01', '', false) === '28.5kPa（24/6/1）'
      const blockedDate = w.quarterlyOverviewPrevLineText_('上右6·上右7', '2026-08-02', '2026-08-02', true) === '上右6·上右7（26/8/2）'
      const okCell = w.quarterlyOverviewExamCellHtml_({ lastYmd: '2026-08-02', restricted: false }, '28.5kPa', null)
      const neverCell = w.quarterlyOverviewExamCellHtml_({ lastYmd: '', restricted: false }, '', null)
      const missingCell = w.quarterlyOverviewExamCellHtml_({ lastYmd: '2026-08-02', restricted: false }, '', null)
      const blockCell = w.quarterlyOverviewExamCellHtml_(
        { lastYmd: '2026-08-02', restricted: false },
        '上右6·上右7（26/8/2）',
        { title: '無歯顎（残っている歯がない）ため、F局は算定できません' },
      )
      const newer = w.latestQuarterlyExamRecordFromList_([
        { id: 'old', patient_id: 'p1', visit_date: '2026-01-01', treatments: '舌圧検査' },
        { id: 'new', patient_id: 'p1', visit_date: '2026-08-02', treatments: '舌圧検査' },
        { id: 'other', patient_id: 'p2', visit_date: '2026-09-01', treatments: '舌圧検査' },
      ], 'p1', '舌圧検査')
      const cellsOk = okCell.includes('qo-ok') && okCell.includes('可') && okCell.includes('28.5kPa') && okCell.includes('qo-prev')
        && !neverCell.includes('qo-prev') && neverCell.includes('未')
        && missingCell.includes('qo-prev-empty') && missingCell.includes('—')
        && blockCell.includes('不可') && blockCell.includes('qo-block') && blockCell.includes('上右6·上右7')
        && !blockCell.includes('qo-ok')
      return tongue === '28.5kPa' && moisture === '27.4点' && site === '上右6·上右7'
        && sameDay && older && blockedDate && cellsOk && newer?.id === 'new'
    })
    expect(ok).toBe(true)
  })

  test('patient status filters include the ended tag', async ({ page }) => {
    await page.goto('/')
    await page.waitForFunction(
      () => {
        const boot = document.getElementById('boot-loading')
        return !boot || boot.style.display === 'none'
      },
      { timeout: 45_000 },
    )
    const ok = await page.evaluate(() => {
      const listBtn = document.getElementById('plist-st-ended')
      const mgmtBtn = document.getElementById('st-ended')
      const buttons = !!listBtn && !!mgmtBtn
        && (listBtn.textContent || '').includes('終了')
        && (mgmtBtn.textContent || '').includes('終了')
      const sel = document.getElementById('pm-status') as HTMLSelectElement | null
      const opt = !!(sel && [...sel.options].some(o => o.value === 'ended' && (o.textContent || '').includes('終了')))
      const modal = document.getElementById('statusModal')
      const modalBtn = !!(modal && modal.innerHTML.includes("applyStatus('ended')") && modal.innerHTML.includes('依頼時のみ'))
      const activeOnly = (status: string) => (status || 'active') === 'active'
      const hidden = !activeOnly('ended') && !activeOnly('left') && activeOnly('active')
      return buttons && !!opt && modalBtn && hidden
    })
    expect(ok).toBe(true)
  })
})
