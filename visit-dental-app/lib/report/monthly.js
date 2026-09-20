import {
  formatTimeValueForClient,
  visitDateYMD,
  visitDateYM,
} from '../date-utils.js'
import {
  clinicNameFromSettings,
  loadFacilities,
  loadLatestTeethJson,
  loadMedicalInfoRaw,
  loadMonthlyTreatments,
  loadPatientById,
  loadPatients,
  loadSettingsObject,
} from '../db-loaders.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import { sortRowsByRoom } from '../report-enrich.js'
import { treatmentRowToClient } from '../row-mappers.js'
import {
  buildPersonalSheetPlanCategoriesHint,
  buildPersonalSheetTreatmentPlanHint,
  computeAgeFromBirthDate,
  formatBirthDateKanji,
  formatDateWareki,
  formatPersonalSheetBulletBlock,
  formatPersonalSheetMedList,
} from './personal-helpers.js'

function resolveYm(ymOpt) {
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const ymDefault = `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}`
  return ymOpt && /^\d{4}-\d{2}$/.test(String(ymOpt).trim()) ? String(ymOpt).trim() : ymDefault
}

function mapTreatmentToMonthlyVisit(t) {
  return {
    id: t.id,
    visit_date: visitDateYMD(t.visit_date),
    treatments: String(t.treatments || ''),
    notes: String(t.notes || ''),
    next_date: t.next_date ? visitDateYMD(t.next_date) : '',
    next_content: String(t.next_content || ''),
    visit_time_start: formatTimeValueForClient(t.visit_time_start),
    visit_time_end: formatTimeValueForClient(t.visit_time_end),
    notes_tones: String(t.notes_tones || ''),
  }
}

function omitVisitTimeForFacility(settings, facName) {
  const hideSubstr =
    settings.month_report_hide_time_facility_substr != null &&
    String(settings.month_report_hide_time_facility_substr).trim()
      ? String(settings.month_report_hide_time_facility_substr).trim()
      : 'サニーライフ稲毛'
  return {
    hideSubstr,
    omitVisitTime: hideSubstr.length > 0 && String(facName).indexOf(hideSubstr) !== -1,
  }
}

export async function getPatientMonthlyReportData([patientId, ymOpt]) {
  const pid = String(patientId || '').trim()
  if (!pid) throw new Error('患者IDを指定してください')
  const ym = resolveYm(ymOpt)
  const patients = await loadPatients(null)
  const facilities = await loadFacilities()
  const settings = await loadSettingsObject()
  const p = patients.find((x) => String(x.id) === pid) || {}
  const fac = facilities.find((f) => String(f.id) === String(p.fac)) || {}
  const facName = fac.name ? String(fac.name) : ''
  const { hideSubstr, omitVisitTime } = omitVisitTimeForFacility(settings, facName)
  const timeFb =
    settings.month_report_time_fallback != null && String(settings.month_report_time_fallback).trim()
      ? String(settings.month_report_time_fallback).trim()
      : 'おおむね20分以上診療いたしました'
  const reportTitle = omitVisitTime
    ? '歯科訪問診療報告書 （歯科医師）'
    : '居宅療養管理指導報告書 （歯科医師）'

  const records = await loadMonthlyTreatments(ym)
  const visits = records
    .filter((t) => String(t.patient_id) === pid)
    .sort((a, b) => {
      const da = visitDateYMD(a.visit_date)
      const db = visitDateYMD(b.visit_date)
      if (da !== db) return da.localeCompare(db)
      return String(formatTimeValueForClient(a.visit_time_start)).localeCompare(
        String(formatTimeValueForClient(b.visit_time_start)),
      )
    })
    .map(mapTreatmentToMonthlyVisit)

  return JSON.stringify({
    ym,
    patient_id: pid,
    patient_name: p.name || '',
    room: p.room != null ? String(p.room) : '',
    facility_id: String(p.fac || ''),
    facility_name: facName,
    facility_short:
      fac.short != null && String(fac.short).trim() ? String(fac.short).trim() : facName,
    care_manager: p.cm != null ? String(p.cm) : '',
    doctor_name: settings.doctor_name != null ? String(settings.doctor_name) : '',
    clinic_name: settings.clinic_name != null ? String(settings.clinic_name) : '',
    omit_visit_time: omitVisitTime,
    omit_visit_time_pattern: hideSubstr,
    report_title: reportTitle,
    time_fallback_phrase: timeFb,
    visits,
  })
}

export async function getFacilityMonthlyCareReportData([facId, ymOpt]) {
  const facIdStr = String(facId || '').trim()
  if (!facIdStr) throw new Error('施設を指定してください')
  const ym = resolveYm(ymOpt)
  const patients = await loadPatients(null)
  const facilities = await loadFacilities()
  const settings = await loadSettingsObject()
  const fac = facilities.find((f) => String(f.id) === facIdStr) || {}
  const facName = fac.name ? String(fac.name) : facIdStr
  const { hideSubstr, omitVisitTime } = omitVisitTimeForFacility(settings, facName)
  const timeFb =
    settings.month_report_time_fallback != null && String(settings.month_report_time_fallback).trim()
      ? String(settings.month_report_time_fallback).trim()
      : 'おおむね20分以上診療いたしました'
  const reportTitle = omitVisitTime
    ? '歯科訪問診療報告書 （歯科医師）'
    : '居宅療養管理指導報告書 （歯科医師）'
  const clinicName = settings.clinic_name != null ? String(settings.clinic_name) : ''
  const doctorName = settings.doctor_name != null ? String(settings.doctor_name) : ''

  const records = (await loadMonthlyTreatments(ym)).filter((t) => String(t.fac_id) === facIdStr)
  const byPid = {}
  for (const t of records) {
    const pid = String(t.patient_id)
    if (!byPid[pid]) byPid[pid] = []
    byPid[pid].push(t)
  }
  const pids = Object.keys(byPid)
  const patientList = pids
    .map((pid) => {
      const p = patients.find((x) => String(x.id) === pid) || { id: pid }
      return p
    })
    .sort((a, b) =>
      sortRowsByRoom(
        { room: a.room != null ? String(a.room) : '' },
        { room: b.room != null ? String(b.room) : '' },
      ),
    )

  const outPatients = []
  for (const p of patientList) {
    const pid = String(p.id)
    const visits = (byPid[pid] || [])
      .sort((a, b) => visitDateYMD(a.visit_date).localeCompare(visitDateYMD(b.visit_date)))
      .map(mapTreatmentToMonthlyVisit)
    let teethData = {}
    try {
      teethData = JSON.parse(await loadLatestTeethJson(pid))
    } catch {
      teethData = {}
    }
    outPatients.push({
      ym,
      patient_id: pid,
      patient_name: p.name || '',
      room: p.room != null ? String(p.room) : '',
      facility_id: facIdStr,
      facility_name: facName,
      facility_short:
        fac.short != null && String(fac.short).trim() ? String(fac.short).trim() : facName,
      care_manager: p.cm != null ? String(p.cm) : '',
      doctor_name: doctorName,
      clinic_name: clinicName,
      omit_visit_time: omitVisitTime,
      omit_visit_time_pattern: hideSubstr,
      report_title: reportTitle,
      time_fallback_phrase: timeFb,
      visits,
      teeth_data: teethData,
    })
  }

  return JSON.stringify({
    ym,
    facility_id: facIdStr,
    facility_name: facName,
    clinic_name: clinicName,
    doctor_name: doctorName,
    omit_visit_time: omitVisitTime,
    report_title: reportTitle,
    time_fallback_phrase: timeFb,
    patients: outPatients,
  })
}

export async function getFacilityClinicalMonthlyReportData([facId, ymOpt]) {
  const facIdStr = String(facId || '').trim()
  if (!facIdStr) throw new Error('施設を指定してください')
  const ym = resolveYm(ymOpt)
  const facilities = await loadFacilities()
  const fac = facilities.find((f) => String(f.id) === facIdStr)
  if (!fac) throw new Error('施設が見つかりません')
  const patients = await loadPatients(null)
  const settings = await loadSettingsObject()
  const allRecords = await loadMonthlyTreatments('*')
  const firstVisit = {}
  for (const r of allRecords) {
    const pid = String(r.patient_id)
    const d = visitDateYMD(r.visit_date)
    if (!d) continue
    if (!firstVisit[pid] || d < firstVisit[pid]) firstVisit[pid] = d
  }
  const monthRecs = allRecords.filter(
    (t) => String(t.fac_id) === facIdStr && visitDateYM(t.visit_date) === ym,
  )
  const byPid = {}
  for (const t of monthRecs) {
    const pid = String(t.patient_id)
    if (!byPid[pid]) byPid[pid] = []
    byPid[pid].push(t)
  }
  const patientRows = Object.keys(byPid)
    .map((pid) => {
      const p = patients.find((x) => String(x.id) === pid) || { id: pid }
      const visits = (byPid[pid] || [])
        .sort((a, b) => visitDateYMD(a.visit_date).localeCompare(visitDateYMD(b.visit_date)))
        .map((t) => ({
          id: t.id,
          visit_date: visitDateYMD(t.visit_date),
          treatments: String(t.treatments || ''),
          notes: String(t.notes || ''),
          next_date: t.next_date ? visitDateYMD(t.next_date) : '',
          next_content: String(t.next_content || ''),
          visit_time_start: formatTimeValueForClient(t.visit_time_start),
          visit_time_end: formatTimeValueForClient(t.visit_time_end),
        }))
      return {
        patient_id: pid,
        room: p.room != null ? String(p.room) : '',
        name: p.name || pid,
        coverage_type: p.coverage_type != null ? String(p.coverage_type).trim() : '',
        first_visit_date_ever: firstVisit[pid] || '',
        visits,
      }
    })
    .sort(sortRowsByRoom)

  return JSON.stringify({
    facility_id: facIdStr,
    facility_name: fac.name || facIdStr,
    ym,
    clinic_name: clinicNameFromSettings(settings),
    doctor_name: settings.doctor_name != null ? String(settings.doctor_name) : '',
    patient_count: patientRows.length,
    patients: patientRows,
  })
}

export async function getPatientPersonalSheetData([patientId, ymOpt]) {
  const pid = String(patientId || '').trim()
  if (!pid) return JSON.stringify({ ok: false, error: '患者IDを指定してください' })
  try {
    const ym = resolveYm(ymOpt)
    const p = await loadPatientById(pid)
    if (!p) return JSON.stringify({ ok: false, error: '患者が見つかりません' })
    const facilities = await loadFacilities()
    const settings = await loadSettingsObject()
    const fac = facilities.find((f) => String(f.id) === String(p.fac)) || {}
    const medical = await loadMedicalInfoRaw(pid)
    const teethJson = await loadLatestTeethJson(pid)
    const records = (await loadMonthlyTreatments(ym)).filter((t) => String(t.patient_id) === pid)
    const today = visitDateYMD(new Date())
    const birth = p.birth_date ? visitDateYMD(p.birth_date) : ''
    const age = computeAgeFromBirthDate(birth) || String(p.age || '')
    const medicalHistory = formatPersonalSheetMedList(medical.conditions)
    const medications = [
      formatPersonalSheetMedList(medical.medications),
      formatPersonalSheetMedList(medical.allergies)
        ? '【アレルギー】\n' + formatPersonalSheetMedList(medical.allergies)
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')
    const specialNotes = formatPersonalSheetBulletBlock(p.notes || '')
    const generalCondition = formatPersonalSheetBulletBlock(
      [medical.care_level, medical.independence, medical.dementia_level]
        .filter((x) => x && String(x).trim())
        .join('\n'),
    )
    return JSON.stringify({
      ok: true,
      patient_id: pid,
      facility_id: String(p.fac || ''),
      facility_name: fac.name || '',
      clinic_name: clinicNameFromSettings(settings),
      doctor_name: settings.doctor_name != null ? String(settings.doctor_name) : '',
      room: p.room != null ? String(p.room) : '',
      name: p.name || '',
      birth_date: birth,
      birth_date_kanji: formatBirthDateKanji(birth),
      age,
      entry_year: today.slice(0, 4),
      entry_month: String(parseInt(today.slice(5, 7), 10)),
      entry_day: String(parseInt(today.slice(8, 10), 10)),
      entry_date_ymd: today,
      special_notes: specialNotes,
      general_condition: generalCondition,
      medical_history: medicalHistory,
      medications,
      plan_categories_hint: buildPersonalSheetPlanCategoriesHint(records),
      plan_comment_hint: '',
      treatment_plan_auto: buildPersonalSheetTreatmentPlanHint(records),
      teeth_json: teethJson,
      ym,
    })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function getDiagnosisCertificateData([patientId, issueDateYmdOpt]) {
  const pid = String(patientId || '').trim()
  if (!pid) return JSON.stringify({ ok: false, error: '患者IDを指定してください' })
  try {
    let issue = String(issueDateYmdOpt || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issue)) issue = visitDateYMD(new Date())
    const p = await loadPatientById(pid)
    if (!p) return JSON.stringify({ ok: false, error: '患者が見つかりません' })
    const settings = await loadSettingsObject()
    const medical = await loadMedicalInfoRaw(pid)
    const birth = p.birth_date ? visitDateYMD(p.birth_date) : ''
    const age = computeAgeFromBirthDate(birth)
    return JSON.stringify({
      ok: true,
      patient_id: pid,
      facility_id: String(p.fac || ''),
      issue_date_ymd: issue,
      issue_date_wareki: formatDateWareki(issue),
      title: '診　断　書',
      address: p.address != null ? String(p.address) : '',
      name: p.name || '',
      birth_date_wareki: formatDateWareki(birth),
      age_paren: age ? `(${age}歳)` : '',
      disease_names: '',
      diagnosis_body: '',
      clinic_name: clinicNameFromSettings(settings),
      clinic_address: settings.clinic_address != null ? String(settings.clinic_address) : '',
      clinic_location_detail:
        settings.clinic_location_detail != null ? String(settings.clinic_location_detail) : '',
      clinic_tel: settings.clinic_tel != null ? String(settings.clinic_tel) : '',
      doctor_name: settings.doctor_name != null ? String(settings.doctor_name) : '',
      medical_history_hint: formatPersonalSheetMedList(medical.conditions),
    })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function getOfpiFormData([patientId, examDateYmdOpt]) {
  const pid = String(patientId || '').trim()
  if (!pid) return JSON.stringify({ ok: false, error: '患者IDを指定してください' })
  try {
    let exam = String(examDateYmdOpt || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exam)) exam = visitDateYMD(new Date())
    const teethJson = await loadLatestTeethJson(pid)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('treatments')
      .select('*')
      .eq('patient_id', pid)
      .order('visit_date', { ascending: true })
      .order('id', { ascending: true })
    if (error) throw new Error(error.message)
    const records = (data || []).map(treatmentRowToClient).reverse()
    return JSON.stringify({
      ok: true,
      patient_id: pid,
      exam_date: exam,
      teeth_json: teethJson,
      records,
    })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}
