import {
  newIdJst,
  normalizeTreatmentTimesForClient,
  nowJstTimestamp,
  treatmentVisitSlotKey,
  visitDateYMD,
  visitDateYM,
} from './date-utils.js'
import { getSupabaseAdmin } from './supabase-admin.js'

function parseJsonArg(raw, fallback = {}) {
  if (raw == null) return fallback
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(String(raw))
  } catch {
    return fallback
  }
}

function facilityRowToClient(r) {
  if (!r) return r
  return {
    id: r.id,
    name: r.name ?? '',
    short: r.short ?? '',
    color: r.color ?? '',
    visitDays: r.visit_days ?? '',
    fax: r.fax ?? '',
    cm: r.cm ?? '',
    target: r.target ?? 10,
  }
}

function patientRowToClient(r) {
  if (!r) return r
  let created = r.created_at
  if (created instanceof Date) created = created.toISOString()
  else if (created && typeof created === 'string') {
    /* keep ISO or date string */
  }
  return {
    id: r.id,
    name: r.name ?? '',
    furi: r.furi ?? '',
    age: r.age ?? '',
    gender: r.gender ?? '',
    room: r.room ?? '',
    fac: r.fac ?? '',
    cm: r.cm ?? '',
    status: r.status ?? 'active',
    created_at: created ?? '',
    notes: r.notes ?? '',
    birth_date: r.birth_date ?? '',
    coverage_type: r.coverage_type ?? '',
    intake_stage: r.intake_stage ?? '',
    assigned_doctor: r.assigned_doctor ?? '',
    in_hospital: r.in_hospital ?? '',
    monthly_visit_limit: r.monthly_visit_limit ?? '',
    address: r.address ?? '',
  }
}

function treatmentRowToClient(r) {
  return normalizeTreatmentTimesForClient({
    id: r.id,
    patient_id: r.patient_id,
    fac_id: r.fac_id,
    visit_date: r.visit_date,
    treatments: r.treatments ?? '',
    notes: r.notes ?? '',
    next_date: r.next_date ?? '',
    next_content: r.next_content ?? '',
    doctor: r.doctor ?? '',
    visit_time_start: r.visit_time_start ?? '',
    visit_time_end: r.visit_time_end ?? '',
    notes_tones: r.notes_tones ?? '',
    exam_data: r.exam_data ?? '',
  })
}

async function findDuplicateTreatmentSlot(supabase, patientId, visitDate, visitTimeStart, excludeId) {
  const pid = String(patientId || '').trim()
  if (!pid) return null
  const key = treatmentVisitSlotKey(visitDate, visitTimeStart)
  if (!key || key.startsWith('\t')) return null
  const { data, error } = await supabase.from('treatments').select('*').eq('patient_id', pid)
  if (error) throw new Error(error.message)
  for (const row of data || []) {
    if (excludeId != null && String(row.id) === String(excludeId)) continue
    const vk = treatmentVisitSlotKey(row.visit_date, row.visit_time_start)
    if (vk === key) return row.id
  }
  return null
}

export async function invokeSupabaseRpc(funcName, args) {
  const list = Array.isArray(args) ? args : []
  const fn = HANDLERS[funcName]
  if (!fn) {
    if (/^(get|load|list)/i.test(funcName)) {
      throw new Error(
        `試用版では「${funcName}」は未対応です（帳票・写真などは順次追加予定）。本番 GAS URL をご利用ください。`,
      )
    }
    throw new Error(
      `試用版では「${funcName}」は未対応です。本番 GAS URL をご利用ください。`,
    )
  }
  return fn(list)
}

const HANDLERS = {
  async getFacilities() {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('facilities').select('*').order('id')
    if (error) throw new Error(error.message)
    return JSON.stringify((data || []).map(facilityRowToClient))
  },

  async addFacility([json]) {
    const f = parseJsonArg(json)
    const supabase = getSupabaseAdmin()
    const id = newIdJst('F')
    const { error } = await supabase.from('facilities').insert({
      id,
      name: f.name ?? '',
      short: f.short ?? '',
      color: f.color ?? '#94a3b8',
      visit_days: f.visitDays ?? '',
      fax: f.fax ?? '',
      cm: f.cm ?? '',
      target: f.target != null && f.target !== '' ? Number(f.target) || 10 : 10,
    })
    if (error) throw new Error(error.message)
    return id
  },

  async updateFacility([json]) {
    const f = parseJsonArg(json)
    const supabase = getSupabaseAdmin()
    const patch = {
      name: f.name,
      visit_days: f.visitDays,
      fax: f.fax,
      cm: f.cm,
    }
    if (f.short != null) patch.short = String(f.short)
    if (f.target != null && f.target !== '') patch.target = Number(f.target) || f.target
    const { data, error } = await supabase
      .from('facilities')
      .update(patch)
      .eq('id', f.id)
      .select('id')
    if (error) throw new Error(error.message)
    return data?.length ? 'ok' : 'not_found'
  },

  async deleteFacility([facilityId]) {
    const fid = String(facilityId)
    const supabase = getSupabaseAdmin()
    const { data: patients } = await supabase.from('patients').select('id, fac, status')
    const hasActive = (patients || []).some(
      (p) => String(p.fac) === fid && (p.status || 'active') === 'active',
    )
    if (hasActive) return 'has_patients'
    const { data, error } = await supabase.from('facilities').delete().eq('id', fid).select('id')
    if (error) throw new Error(error.message)
    return data?.length ? 'ok' : 'not_found'
  },

  async getPatients([statusFilter]) {
    const supabase = getSupabaseAdmin()
    let q = supabase.from('patients').select('*').order('id')
    if (statusFilter) q = q.eq('status', String(statusFilter))
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return JSON.stringify((data || []).map(patientRowToClient))
  },

  async addPatient([json]) {
    const p = parseJsonArg(json)
    const supabase = getSupabaseAdmin()
    const id = newIdJst('P')
    const { error } = await supabase.from('patients').insert({
      id,
      name: p.name ?? '',
      furi: p.furi ?? '',
      age: p.age != null && p.age !== '' ? String(p.age) : '',
      gender: p.gender != null ? String(p.gender).trim() : '',
      room: p.room ?? '',
      fac: p.fac ?? '',
      cm: p.cm ?? '',
      status: 'active',
      notes: p.notes ?? '',
      birth_date: p.birth_date ?? '',
      coverage_type: p.coverage_type != null ? String(p.coverage_type) : '',
      intake_stage: p.intake_stage != null ? String(p.intake_stage).trim() : '',
      assigned_doctor: p.assigned_doctor != null ? String(p.assigned_doctor).trim() : '',
      in_hospital: p.in_hospital != null && String(p.in_hospital).trim() !== '' ? '1' : '',
      monthly_visit_limit:
        p.monthly_visit_limit != null && String(p.monthly_visit_limit).trim() !== ''
          ? String(p.monthly_visit_limit).trim()
          : '',
      address: p.address != null ? String(p.address).trim() : '',
    })
    if (error) throw new Error(error.message)
    return id
  },

  async updatePatient([json]) {
    const p = parseJsonArg(json)
    const supabase = getSupabaseAdmin()
    const patch = {}
    for (const k of [
      'name',
      'furi',
      'room',
      'fac',
      'cm',
      'status',
      'notes',
      'birth_date',
      'coverage_type',
      'intake_stage',
      'assigned_doctor',
      'address',
    ]) {
      if (p[k] !== undefined) patch[k] = p[k]
    }
    if (p.age !== undefined) patch.age = p.age != null && p.age !== '' ? String(p.age) : ''
    if (p.gender !== undefined) patch.gender = p.gender != null ? String(p.gender).trim() : ''
    if (p.in_hospital !== undefined) {
      patch.in_hospital = String(p.in_hospital).trim() !== '' ? '1' : ''
    }
    if (p.monthly_visit_limit !== undefined) {
      patch.monthly_visit_limit =
        p.monthly_visit_limit != null && String(p.monthly_visit_limit).trim() !== ''
          ? String(p.monthly_visit_limit).trim()
          : ''
    }
    const { data, error } = await supabase.from('patients').update(patch).eq('id', p.id).select('id')
    if (error) throw new Error(error.message)
    return data?.length ? 'ok' : 'not_found'
  },

  async updatePatientStatus([id, status]) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('patients')
      .update({ status: String(status) })
      .eq('id', String(id))
      .select('id')
    if (error) throw new Error(error.message)
    return data?.length ? 'ok' : 'not_found'
  },

  async deletePatient([patientId]) {
    const pid = String(patientId)
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('patients').delete().eq('id', pid).select('id')
    if (error) throw new Error(error.message)
    return data?.length ? 'ok' : 'not_found'
  },

  async getTreatmentsByPatient([patientId]) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('treatments')
      .select('*')
      .eq('patient_id', String(patientId))
      .order('visit_date', { ascending: true })
      .order('id', { ascending: true })
    if (error) throw new Error(error.message)
    const rows = (data || []).map(treatmentRowToClient).reverse()
    return JSON.stringify(rows)
  },

  async getMonthlyRecords([ymOpt]) {
    const supabase = getSupabaseAdmin()
    const sOpt = ymOpt != null ? String(ymOpt).trim() : ''
    const wantAll = sOpt === '*' || sOpt === '__all__' || sOpt.toLowerCase() === 'all'
    const now = new Date()
    const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
    const ymDefault = `${jst.getFullYear()}-${String(jst.getMonth() + 1).padStart(2, '0')}`
    const ym = wantAll ? null : /^\d{4}-\d{2}$/.test(sOpt) ? sOpt : ymDefault

    const { data, error } = await supabase.from('treatments').select('*')
    if (error) throw new Error(error.message)
    let rows = data || []
    if (!wantAll && ym) {
      rows = rows.filter((t) => visitDateYM(t.visit_date) === ym)
    }
    return JSON.stringify(rows.map(treatmentRowToClient))
  },

  async saveTreatmentRecord([json]) {
    const t = parseJsonArg(json)
    const supabase = getSupabaseAdmin()
    const id = newIdJst('T')
    const visitDate =
      visitDateYMD(t.visit_date) ||
      visitDateYMD(new Date()) ||
      new Date().toISOString().slice(0, 10)
    const dupId = await findDuplicateTreatmentSlot(
      supabase,
      t.patient_id,
      visitDate,
      t.visit_time_start,
      null,
    )
    if (dupId) {
      throw new Error(
        '同じ診療日・開始時刻の記録が既にあります。治療履歴で確認するか、日付・時間を変えてから保存してください。',
      )
    }
    const { error } = await supabase.from('treatments').insert({
      id,
      patient_id: t.patient_id,
      fac_id: t.fac_id ?? '',
      visit_date: visitDate,
      treatments: t.treatments ?? '',
      notes: t.notes ?? '',
      next_date: t.next_date ?? '',
      next_content: t.next_content ?? '',
      doctor: t.doctor ?? '',
      visit_time_start: t.visit_time_start != null ? String(t.visit_time_start) : '',
      visit_time_end: t.visit_time_end != null ? String(t.visit_time_end) : '',
      notes_tones: t.notes_tones != null ? String(t.notes_tones) : '',
      exam_data: t.exam_data != null ? String(t.exam_data) : '',
    })
    if (error) throw new Error(error.message)
    return id
  },

  async updateTreatmentRecord([json]) {
    const t = parseJsonArg(json)
    const supabase = getSupabaseAdmin()
    const { data: existing, error: fetchErr } = await supabase
      .from('treatments')
      .select('*')
      .eq('id', t.id)
      .maybeSingle()
    if (fetchErr) throw new Error(fetchErr.message)
    if (!existing) return 'not_found'

    const newDate =
      t.visit_date !== undefined
        ? visitDateYMD(t.visit_date) || visitDateYMD(existing.visit_date)
        : visitDateYMD(existing.visit_date)
    const newStart =
      t.visit_time_start !== undefined
        ? String(t.visit_time_start)
        : String(existing.visit_time_start ?? '')
    const dupId = await findDuplicateTreatmentSlot(
      supabase,
      existing.patient_id,
      newDate,
      newStart,
      t.id,
    )
    if (dupId) {
      throw new Error(
        '同じ診療日・開始時刻の記録が既にあります。治療履歴で確認するか、日付・時間を変えてから保存してください。',
      )
    }

    const patch = {}
    if (t.treatments !== undefined) patch.treatments = t.treatments ?? ''
    if (t.notes !== undefined) patch.notes = t.notes ?? ''
    if (t.next_date !== undefined) patch.next_date = t.next_date ?? ''
    if (t.next_content !== undefined) patch.next_content = t.next_content ?? ''
    if (t.doctor !== undefined) patch.doctor = t.doctor ?? ''
    if (t.visit_time_start !== undefined) {
      patch.visit_time_start = t.visit_time_start != null ? String(t.visit_time_start) : ''
    }
    if (t.visit_time_end !== undefined) {
      patch.visit_time_end = t.visit_time_end != null ? String(t.visit_time_end) : ''
    }
    if (t.visit_date !== undefined && newDate) patch.visit_date = newDate
    if (t.notes_tones !== undefined) patch.notes_tones = t.notes_tones != null ? String(t.notes_tones) : ''
    if (t.exam_data !== undefined) patch.exam_data = t.exam_data != null ? String(t.exam_data) : ''

    const { error } = await supabase.from('treatments').update(patch).eq('id', t.id)
    if (error) throw new Error(error.message)
    return 'ok'
  },

  async deleteTreatmentRecord([treatmentId]) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('treatments')
      .delete()
      .eq('id', String(treatmentId))
      .select('id')
    if (error) throw new Error(error.message)
    return data?.length ? 'ok' : 'not_found'
  },

  async getTeethData([patientId]) {
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
  },

  async saveTeethData([patientId, teethJson]) {
    const supabase = getSupabaseAdmin()
    const today = visitDateYMD(new Date())
    const { error } = await supabase.from('teeth_data').insert({
      patient_id: String(patientId),
      date: today,
      json: teethJson != null ? String(teethJson) : '{}',
    })
    if (error) throw new Error(error.message)
    return 'ok'
  },

  async getTeethDataHistory([patientId]) {
    const pid = String(patientId || '').trim()
    if (!pid) return '[]'
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('teeth_data')
      .select('date, json')
      .eq('patient_id', pid)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
    if (error) throw new Error(error.message)
    const out = (data || []).map((r) => ({
      date: visitDateYMD(r.date) || String(r.date || '').slice(0, 10),
      json: r.json != null ? String(r.json) : '{}',
    }))
    return JSON.stringify(out)
  },

  async getMedicalInfo([patientId]) {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('patient_medical')
      .select('*')
      .eq('patient_id', String(patientId))
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) {
      return JSON.stringify({
        conditions: [],
        medications: [],
        allergies: [],
        care_level: '',
        independence: '',
        dementia_level: '',
      })
    }
    return JSON.stringify({
      patient_id: data.patient_id,
      conditions: data.conditions ?? [],
      medications: data.medications ?? [],
      allergies: data.allergies ?? [],
      care_level: data.care_level ?? '',
      independence: data.independence ?? '',
      dementia_level: data.dementia_level ?? '',
      updated_at: data.updated_at ?? '',
    })
  },

  async saveMedicalInfo([patientId, json]) {
    const data = parseJsonArg(json)
    const supabase = getSupabaseAdmin()
    const row = {
      patient_id: String(patientId),
      conditions: data.conditions ?? [],
      medications: data.medications ?? [],
      allergies: data.allergies ?? [],
      care_level: data.care_level ?? '',
      independence: data.independence ?? '',
      dementia_level: data.dementia_level ?? '',
      updated_at: nowJstTimestamp(),
    }
    const { error } = await supabase.from('patient_medical').upsert(row, { onConflict: 'patient_id' })
    if (error) throw new Error(error.message)
    return 'ok'
  },

  async getSettings() {
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('settings').select('key, value')
    if (error) throw new Error(error.message)
    const obj = {}
    for (const r of data || []) {
      if (r.key) obj[r.key] = r.value ?? ''
    }
    return JSON.stringify(obj)
  },

  async saveSettings([json]) {
    const data = parseJsonArg(json)
    const supabase = getSupabaseAdmin()
    for (const [k, v] of Object.entries(data)) {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: k, value: v != null ? String(v) : '' }, { onConflict: 'key' })
      if (error) throw new Error(error.message)
    }
    return 'ok'
  },

  async getCustomMasterItems() {
    const raw = await HANDLERS.getSettings([])
    const settings = parseJsonArg(raw, {})
    const parseArr = (k) => {
      try {
        return JSON.parse(settings[k] || '[]')
      } catch {
        return []
      }
    }
    const parseObj = (k) => {
      try {
        const o = JSON.parse(settings[k] || '{}')
        return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
      } catch {
        return {}
      }
    }
    return JSON.stringify({
      diseases: parseArr('custom_diseases'),
      medications: parseArr('custom_medications'),
      diseaseCategories: parseArr('custom_disease_categories'),
      medicationCategories: parseArr('custom_med_categories'),
      hiddenDiseases: parseArr('hidden_disease_master_items'),
      hiddenMedications: parseArr('hidden_med_master_items'),
      diseaseCategoryRenames: parseObj('disease_category_renames'),
      medCategoryRenames: parseObj('med_category_renames'),
      medMasterRowEdits: parseArr('med_master_row_edits'),
      diseaseMasterRowEdits: parseArr('disease_master_row_edits'),
      diseaseCategoryOrder: parseArr('disease_category_order'),
      medCategoryOrder: parseArr('med_category_order'),
    })
  },

  async addCustomMasterItem([type, item, category, brand]) {
    const cat = category ? String(category).trim() : ''
    if (!cat) return 'no_category'
    const name = String(item || '').trim()
    if (!name) return 'empty'
    const key = type === 'diseases' ? 'custom_diseases' : 'custom_medications'
    const settingsRaw = await HANDLERS.getSettings([])
    const settings = parseJsonArg(settingsRaw, {})
    let arr = []
    try {
      arr = JSON.parse(settings[key] || '[]')
    } catch {
      arr = []
    }
    if (!Array.isArray(arr)) arr = []
    const entry =
      type === 'diseases'
        ? { cat, name }
        : { cat, name, brand: brand ? String(brand).trim() : '' }
    const dup = arr.some((e) => e && e.name === entry.name && e.cat === entry.cat)
    if (!dup) arr.push(entry)
    await HANDLERS.saveSettings([JSON.stringify({ [key]: JSON.stringify(arr) })])
    return 'ok'
  },
}

/** 試用 MVP で実装済みの RPC */
export const IMPLEMENTED_RPC = new Set(Object.keys(HANDLERS))
