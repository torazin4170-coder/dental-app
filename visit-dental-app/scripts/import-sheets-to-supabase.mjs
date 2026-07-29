/**
 * Google Sheets からエクスポートした CSV を Supabase に投入
 *
 * 使い方:
 *   1. Spreadsheet 各シートを CSV でダウンロード → import-data/ に配置
 *      facilities.csv, patients.csv, treatments.csv, teeth_data.csv,
 *      patient_medical.csv, settings.csv
 *   2. .env.local に SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   3. node scripts/import-sheets-to-supabase.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const dataDir = join(root, 'import-data')

function loadEnvLocal() {
  const path = join(root, '.env.local')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) continue
    let val = m[2].trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[m[1]]) process.env[m[1]] = val
  }
}

function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else inQuotes = false
      } else cell += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  if (!rows.length) return []
  const header = rows[0].map((h) => String(h || '').trim())
  return rows.slice(1).filter((r) => r.some((x) => String(x || '').trim())).map((r) => {
    const o = {}
    header.forEach((h, i) => {
      if (h) o[h] = r[i] != null ? String(r[i]) : ''
    })
    return o
  })
}

function readCsv(name) {
  const path = join(dataDir, name)
  if (!existsSync(path)) {
    console.warn('[skip] ' + name + ' がありません')
    return []
  }
  return parseCsv(readFileSync(path, 'utf8'))
}

async function main() {
  loadEnvLocal()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください')
    process.exit(1)
  }
  const supabase = createClient(url, key)

  const facilities = readCsv('facilities.csv').map((r) => ({
    id: r.id,
    name: r.name ?? '',
    short: r.short ?? '',
    color: r.color ?? '#94a3b8',
    visit_days: r.visitDays ?? r.visit_days ?? '',
    fax: r.fax ?? '',
    cm: r.cm ?? '',
    target: r.target ? parseInt(r.target, 10) || 10 : 10,
  }))

  const patients = readCsv('patients.csv').map((r) => ({
    id: r.id,
    name: r.name ?? '',
    furi: r.furi ?? '',
    age: r.age ?? '',
    gender: r.gender ?? '',
    room: r.room ?? '',
    fac: r.fac ?? '',
    cm: r.cm ?? '',
    status: r.status ?? 'active',
    created_at: r.created_at || null,
    notes: r.notes ?? '',
    birth_date: r.birth_date ?? '',
    coverage_type: r.coverage_type ?? '',
    intake_stage: r.intake_stage ?? '',
    assigned_doctor: r.assigned_doctor ?? '',
    in_hospital: r.in_hospital ?? '',
    monthly_visit_limit: r.monthly_visit_limit ?? '',
    address: r.address ?? '',
  }))

  const treatments = readCsv('treatments.csv').map((r) => ({
    id: r.id,
    patient_id: r.patient_id,
    fac_id: r.fac_id ?? '',
    visit_date: r.visit_date ?? '',
    treatments: r.treatments ?? '',
    notes: r.notes ?? '',
    next_date: r.next_date ?? '',
    next_content: r.next_content ?? '',
    doctor: r.doctor ?? '',
    visit_time_start: r.visit_time_start ?? '',
    visit_time_end: r.visit_time_end ?? '',
    notes_tones: r.notes_tones ?? '',
    exam_data: r.exam_data ?? '',
  }))

  const teeth = readCsv('teeth_data.csv').map((r) => ({
    patient_id: r.patient_id,
    date: r.date ?? '',
    json: r.json ?? '{}',
  }))

  const medical = readCsv('patient_medical.csv').map((r) => {
    const parseJson = (s) => {
      try {
        return JSON.parse(s || '[]')
      } catch {
        return []
      }
    }
    return {
      patient_id: r.patient_id,
      conditions: parseJson(r.conditions),
      medications: parseJson(r.medications),
      allergies: parseJson(r.allergies),
      care_level: r.care_level ?? '',
      independence: r.independence ?? '',
      dementia_level: r.dementia_level ?? '',
      updated_at: r.updated_at || null,
    }
  })

  const settings = readCsv('settings.csv').map((r) => ({
    key: r.key,
    value: r.value ?? '',
    description: r.description ?? '',
  }))

  const upsert = async (table, rows, label, conflictKey = 'id') => {
    if (!rows.length) {
      console.log('[skip] ' + label + ' 0件')
      return
    }
    const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictKey })
    if (error) throw new Error(label + ': ' + error.message)
    console.log('[ok] ' + label + ' ' + rows.length + '件')
  }

  await upsert('facilities', facilities, 'facilities')
  await upsert('patients', patients, 'patients')
  await upsert('treatments', treatments, 'treatments')
  if (teeth.length) {
    const { error } = await supabase.from('teeth_data').insert(teeth)
    if (error) throw new Error('teeth_data: ' + error.message)
    console.log('[ok] teeth_data ' + teeth.length + '件')
  }
  await upsert('patient_medical', medical, 'patient_medical', 'patient_id')
  await upsert('settings', settings, 'settings', 'key')

  console.log('\n完了。/api/supabase-check で接続を確認してください。')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
