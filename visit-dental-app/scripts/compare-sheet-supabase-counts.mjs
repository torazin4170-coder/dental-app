/**
 * Sheets CSV（import-data/）と Supabase の件数を突合する
 *
 * 使い方:
 *   1. Spreadsheet を CSV で export → import-data/
 *   2. npm run compare:counts
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

function countCsvRows(name) {
  const path = join(dataDir, name)
  if (!existsSync(path)) return null
  const text = readFileSync(path, 'utf8')
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  return Math.max(0, lines.length - 1)
}

async function countTable(supabase, table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(table + ': ' + error.message)
  return count ?? 0
}

async function main() {
  loadEnvLocal()
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要です')
    process.exit(1)
  }
  const supabase = createClient(url, key)

  const pairs = [
    ['facilities.csv', 'facilities'],
    ['patients.csv', 'patients'],
    ['treatments.csv', 'treatments'],
    ['teeth_data.csv', 'teeth_data'],
    ['patient_medical.csv', 'patient_medical'],
    ['settings.csv', 'settings'],
    ['photos.csv', 'photos'],
    ['generated_documents.csv', 'generated_documents'],
  ]

  let ok = true
  console.log('CSV vs Supabase 件数突合\n')
  for (const [csv, table] of pairs) {
    const csvN = countCsvRows(csv)
    const dbN = await countTable(supabase, table)
    const csvLabel = csvN == null ? '(CSVなし)' : String(csvN)
    const mark = csvN == null ? '~' : csvN === dbN ? 'OK' : 'DIFF'
    if (mark === 'DIFF') ok = false
    console.log(`${mark.padEnd(4)} ${table.padEnd(22)} csv=${csvLabel.padStart(6)}  db=${String(dbN).padStart(6)}`)
  }
  console.log(ok ? '\n差分なし（または CSV 未配置）' : '\n差分あり — import:supabase を再実行してください')
  process.exit(ok ? 0 : 2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
