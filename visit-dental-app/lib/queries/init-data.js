import { visitDateYMD } from '../date-utils.js'
import {
  assertDateYmd,
  clinicNameFromSettings,
  loadFacilities,
  loadMonthlyTreatments,
  loadPatients,
  loadSettingsObject,
  loadTreatmentsForDateYmd,
} from '../db-loaders.js'
import { sortRowsByRoom } from '../report-enrich.js'

async function getTreatmentsForDateFlat(dateYmd) {
  const ymd = assertDateYmd(dateYmd)
  const records = await loadTreatmentsForDateYmd(ymd)
  const patients = await loadPatients(null)
  const facilities = await loadFacilities()
  const facOrder = {}
  facilities.forEach((f, i) => {
    facOrder[String(f.id)] = i
  })
  const enriched = records.map((r) => {
    const p = patients.find((x) => x.id === r.patient_id) || {}
    const f = facilities.find((x) => String(x.id) === String(r.fac_id))
    const facLabel = f ? (f.short && String(f.short).trim() ? String(f.short).trim() : f.name) : ''
    const parts = []
    if (facLabel) parts.push(`【${facLabel}】`)
    if (r.treatments) parts.push(String(r.treatments))
    if (r.notes) parts.push(String(r.notes))
    return {
      patient_id: r.patient_id,
      fac_id: String(r.fac_id || ''),
      room: p.room != null ? String(p.room) : '',
      name: p.name || String(r.patient_id),
      draft_notes: parts.join('\n'),
    }
  })
  enriched.sort((a, b) => {
    const oa = facOrder[a.fac_id]
    const ob = facOrder[b.fac_id]
    if (oa != null && ob != null && oa !== ob) return oa - ob
    if (oa != null && ob == null) return -1
    if (oa == null && ob != null) return 1
    return sortRowsByRoom(a, b)
  })
  return enriched.map((x) => ({
    patient_id: x.patient_id,
    fac_id: x.fac_id,
    room: x.room,
    name: x.name,
    draft_notes: x.draft_notes,
  }))
}

export async function getTreatmentsForFacilityDate([dateYmd, facId]) {
  const fid = String(facId || '').trim()
  if (!fid) throw new Error('施設を選んでください')
  const all = await getTreatmentsForDateFlat(dateYmd)
  return JSON.stringify(all.filter((x) => String(x.fac_id || '') === fid))
}

export async function getInitData([ymOpt]) {
  const facilities = await loadFacilities()
  const patients = await loadPatients(null)
  const records = await loadMonthlyTreatments(ymOpt)
  const settings = await loadSettingsObject()
  return JSON.stringify({ facilities, patients, records, settings })
}

export async function getDashboardData() {
  const today = visitDateYMD(new Date())
  const records = await loadMonthlyTreatments(undefined)
  const patients = await loadPatients('active')
  const facilities = await loadFacilities()

  const todayCount = records.filter((r) => visitDateYMD(r.visit_date) === today).length
  const facStats = facilities.map((f) => {
    const visited = new Set(records.filter((r) => r.fac_id === f.id).map((r) => r.patient_id)).size
    return { id: f.id, name: f.name, visited, target: f.target || 10, color: f.color }
  })
  const countByPatient = {}
  records.forEach((r) => {
    countByPatient[r.patient_id] = (countByPatient[r.patient_id] || 0) + 1
  })
  const twice = Object.values(countByPatient).filter((c) => c >= 2).length
  return JSON.stringify({ todayCount, twice, facStats, totalActive: patients.length })
}

export { clinicNameFromSettings, loadSettingsObject }
