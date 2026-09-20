/**
 * photos / generated_documents だけ再投入（途中失敗後の続き用）
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
  return rows
    .slice(1)
    .filter((r) => r.some((x) => String(x || '').trim()))
    .map((r) => {
      const o = {}
      header.forEach((h, i) => {
        if (h) o[h] = r[i] != null ? String(r[i]) : ''
      })
      return o
    })
}

function readCsv(name) {
  const path = join(dataDir, name)
  if (!existsSync(path)) return []
  return parseCsv(readFileSync(path, 'utf8'))
}

async function main() {
  loadEnvLocal()
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const { data: patients, error: pErr } = await supabase.from('patients').select('id')
  if (pErr) throw new Error(pErr.message)
  const patientIds = new Set((patients || []).map((p) => String(p.id)))

  const photos = readCsv('photos.csv')
    .map((r) => ({
      patient_id: r.patient_id || r.patientId || '',
      drive_file_id: r.file_id || r.drive_file_id || r.fileId || '',
      file_url: r.file_url || r.fileUrl || '',
      filename: r.filename || '',
      category: r.category || '',
      date_taken: r.date_taken || r.dateTaken || '',
      uploaded_at: r.uploaded_at || r.uploadedAt || null,
    }))
    .filter((r) => r.patient_id && r.drive_file_id)

  const photosOk = photos.filter((r) => patientIds.has(String(r.patient_id)))
  console.log('photos csv=' + photos.length + ' ok=' + photosOk.length + ' skip=' + (photos.length - photosOk.length))

  if (photosOk.length) {
    // clear then insert to avoid duplicates on retry
    await supabase.from('photos').delete().neq('id', 0)
    const { error } = await supabase.from('photos').insert(photosOk)
    if (error) throw new Error('photos: ' + error.message)
    console.log('[ok] photos ' + photosOk.length)
  }

  const generatedDocs = readCsv('generated_documents.csv')
    .map((r) => {
      let savedAt = r.saved_at || null
      if (savedAt && /^\d+$/.test(String(savedAt).trim())) {
        const n = Number(savedAt)
        savedAt = new Date(n < 1e12 ? n * 1000 : n).toISOString()
      }
      return {
        doc_id: r.doc_id || r.docId || '',
        kind: r.kind || '',
        slot_key: r.slot_key || r.slotKey || '',
        patient_id: r.patient_id || '',
        fac_id: r.fac_id || '',
        period_key: r.period_key || '',
        title: r.title || '',
        saved_at: savedAt,
        save_mode: r.save_mode || '',
        version: r.version ? parseInt(r.version, 10) || 1 : 1,
        drive_file_id: r.drive_file_id || '',
        status: r.status || '',
        is_primary: r.is_primary === '1' || r.is_primary === 'true' || r.is_primary === true,
      }
    })
    .filter((r) => r.doc_id)

  if (generatedDocs.length) {
    const { error } = await supabase.from('generated_documents').upsert(generatedDocs, { onConflict: 'doc_id' })
    if (error) throw new Error('generated_documents: ' + error.message)
    console.log('[ok] generated_documents ' + generatedDocs.length)
  } else {
    console.log('[skip] generated_documents 0')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
