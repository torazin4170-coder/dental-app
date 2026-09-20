import { normalizeTreatmentTimesForClient } from './date-utils.js'

export function facilityRowToClient(r) {
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

export function patientRowToClient(r) {
  if (!r) return r
  let created = r.created_at
  if (created instanceof Date) created = created.toISOString()
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

export function treatmentRowToClient(r) {
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
