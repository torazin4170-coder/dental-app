import { visitDateYMD, visitDateYM } from './date-utils.js'
import {
  facilityRowToClient,
  patientRowToClient,
  treatmentRowToClient,
} from './row-mappers.js'
import { getSupabaseAdmin } from './supabase-admin.js'

export async function loadFacilities() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('facilities').select('*').order('id')
  if (error) throw new Error(error.message)
  return (data || []).map(facilityRowToClient)
}

export async function loadPatients(statusFilter) {
  const supabase = getSupabaseAdmin()
  let q = supabase.from('patients').select('*').order('id')
  if (statusFilter) q = q.eq('status', String(statusFilter))
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data || []).map(patientRowToClient)
}

export async function loadSettingsObject() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('settings').select('key, value')
  if (error) throw new Error(error.message)
  const obj = {}
  for (const r of data || []) {
    if (r.key) obj[r.key] = r.value ?? ''
  }
  return obj
}

export async function loadMonthlyTreatments(ymOpt) {
  const supabase = getSupabaseAdmin()
  const sOpt = ymOpt != null ? String(ymOpt).trim() : ''
  const wantAll = sOpt === '*' || sOpt === '__all__' || sOpt.toLowerCase() === 'all'
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const ymDefault = `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}`
  const ym = wantAll ? null : /^\d{4}-\d{2}$/.test(sOpt) ? sOpt : ymDefault

  let q = supabase.from('treatments').select('*')
  if (!wantAll && ym) {
    q = q.gte('visit_date', `${ym}-01`).lte('visit_date', `${ym}-31`)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  let rows = data || []
  if (!wantAll && ym) {
    rows = rows.filter((t) => visitDateYM(t.visit_date) === ym)
  }
  return rows.map(treatmentRowToClient)
}

export async function loadTreatmentsForDateYmd(dateYmd) {
  const ymd = String(dateYmd || '').trim()
  const ym = ymd.slice(0, 7)
  const records = await loadMonthlyTreatments(ym)
  return records.filter((t) => visitDateYMD(t.visit_date) === ymd)
}

export function clinicNameFromSettings(settings) {
  return settings.clinic_name || settings.clinicName || '医院名（設定で入力）'
}

export function assertDateYmd(dateYmd) {
  const ymd = String(dateYmd || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error('日付は yyyy-MM-dd で指定してください')
  }
  return ymd
}

export async function loadPatientById(patientId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', String(patientId))
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? patientRowToClient(data) : null
}

export async function loadMedicalInfoRaw(patientId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('patient_medical')
    .select('*')
    .eq('patient_id', String(patientId))
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    return {
      conditions: [],
      medications: [],
      allergies: [],
      care_level: '',
      independence: '',
      dementia_level: '',
    }
  }
  return {
    patient_id: data.patient_id,
    conditions: data.conditions ?? [],
    medications: data.medications ?? [],
    allergies: data.allergies ?? [],
    care_level: data.care_level ?? '',
    independence: data.independence ?? '',
    dementia_level: data.dementia_level ?? '',
    updated_at: data.updated_at ?? '',
  }
}

export async function loadLatestTeethJson(patientId) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('teeth_data')
    .select('json')
    .eq('patient_id', String(patientId))
    .order('id', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  if (!data?.length) return '{}'
  return data[0].json != null ? String(data[0].json) : '{}'
}
