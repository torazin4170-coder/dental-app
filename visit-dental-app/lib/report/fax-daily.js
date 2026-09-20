import {
  assertDateYmd,
  clinicNameFromSettings,
  loadFacilities,
  loadPatients,
  loadSettingsObject,
  loadTreatmentsForDateYmd,
} from '../db-loaders.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import {
  buildFaxFacilityCommentFallback,
  enrichTreatmentRows,
  sortRowsByRoom,
  svListRecordExcludedFromCount,
} from '../report-enrich.js'

export async function getFacilityDailyReportData([facId, dateYmd]) {
  const ymd = assertDateYmd(dateYmd)
  const records = (await loadTreatmentsForDateYmd(ymd)).filter(
    (t) => String(t.fac_id) === String(facId),
  )
  const patients = await loadPatients(null)
  const facilities = await loadFacilities()
  const settings = await loadSettingsObject()
  const fac = facilities.find((f) => String(f.id) === String(facId))
  const enriched = enrichTreatmentRows(records, patients)
  return JSON.stringify({
    clinic_name: clinicNameFromSettings(settings),
    facility_name: fac ? fac.name : String(facId),
    visit_date: ymd,
    rows: enriched,
  })
}

export async function getFaxDailyBatchData([dateYmd, facIdsOpt]) {
  const ymd = assertDateYmd(dateYmd)
  const patients = await loadPatients(null)
  const facilities = await loadFacilities()
  const settings = await loadSettingsObject()
  const records = await loadTreatmentsForDateYmd(ymd)

  let facIdFilter = null
  if (facIdsOpt != null && String(facIdsOpt).trim()) {
    try {
      const parsed = JSON.parse(String(facIdsOpt))
      if (Array.isArray(parsed) && parsed.length) {
        facIdFilter = {}
        parsed.forEach((id) => {
          facIdFilter[String(id)] = true
        })
      }
    } catch {
      facIdFilter = null
    }
  }

  const byFac = {}
  for (const r of records) {
    const fid = String(r.fac_id)
    if (facIdFilter && !facIdFilter[fid]) continue
    if (!byFac[fid]) byFac[fid] = []
    byFac[fid].push(r)
  }

  const clinicName = clinicNameFromSettings(settings)
  const pages = {}
  for (const fid of Object.keys(byFac)) {
    const fac = facilities.find((f) => String(f.id) === fid)
    pages[fid] = {
      clinic_name: clinicName,
      facility_name: fac ? fac.name : fid,
      visit_date: ymd,
      rows: enrichTreatmentRows(byFac[fid], patients),
    }
  }

  return JSON.stringify({
    clinic_name: clinicName,
    visit_date: ymd,
    facility_ids: Object.keys(pages),
    pages,
  })
}

export async function getSupervisorDailyListData([dateYmd]) {
  const ymd = assertDateYmd(dateYmd)
  const records = await loadTreatmentsForDateYmd(ymd)
  const patients = await loadPatients(null)
  const facilities = await loadFacilities()
  const settings = await loadSettingsObject()

  const byFac = {}
  for (const r of records) {
    const fid = String(r.fac_id)
    if (!byFac[fid]) byFac[fid] = []
    const p = patients.find((x) => x.id === r.patient_id) || {}
    byFac[fid].push({
      room: p.room != null ? String(p.room) : '',
      name: p.name || String(r.patient_id),
      patient_id: r.patient_id != null ? String(r.patient_id) : '',
      treatment_id: r.id != null ? String(r.id) : '',
      treatments: r.treatments || '',
      notes: r.notes || '',
      coverage_type: p.coverage_type != null ? String(p.coverage_type).trim() : '',
    })
  }
  for (const fid of Object.keys(byFac)) {
    byFac[fid].sort(sortRowsByRoom)
  }

  const groups = []
  for (const f of facilities) {
    const fid = String(f.id)
    if (!byFac[fid]?.length) continue
    groups.push({
      facility_id: f.id,
      facility_name: f.name || fid,
      facility_short:
        f.short != null && String(f.short).trim() ? String(f.short).trim() : f.name || fid,
      rows: byFac[fid],
    })
  }
  for (const fid of Object.keys(byFac)) {
    if (groups.some((g) => String(g.facility_id) === fid)) continue
    groups.push({
      facility_id: fid,
      facility_name: '（施設マスタ未登録）',
      facility_short: fid,
      rows: byFac[fid],
    })
  }
  groups.sort((a, b) => String(a.facility_short).localeCompare(String(b.facility_short), 'ja'))

  const countableRecords = records.filter((r) => !svListRecordExcludedFromCount(r.treatments))
  return JSON.stringify({
    clinic_name: clinicNameFromSettings(settings),
    visit_date: ymd,
    groups,
    summary: { facility_count: groups.length, patient_count: countableRecords.length },
  })
}

export async function appendFaxStyleMemory([facId, dateYmd, comment]) {
  const fid = String(facId || '').trim()
  const text = String(comment || '').trim()
  if (!fid || text.length < 40) return 'ok'
  const settings = await loadSettingsObject()
  let all = {}
  try {
    const raw = settings.fax_style_memory
    if (raw) all = JSON.parse(raw) || {}
  } catch {
    all = {}
  }
  if (!all[fid]) all[fid] = []
  all[fid].push({ date: String(dateYmd || ''), comment: text.slice(0, 4000) })
  if (all[fid].length > 20) all[fid] = all[fid].slice(-20)
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'fax_style_memory', value: JSON.stringify(all) }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
  return 'ok'
}

export async function generateFaxDailyFacilityComment([facId, dateYmd]) {
  const data = JSON.parse(await getFacilityDailyReportData([facId, dateYmd]))
  const comment = buildFaxFacilityCommentFallback(data.rows || [])
  if (!comment) {
    return JSON.stringify({ ok: false, error: '下書きを生成できませんでした' })
  }
  return JSON.stringify({ ok: true, comment, source: 'local' })
}
