/**
 * Supabase の主要テーブルを CSV に書き出す（週次バックアップ用）
 *
 * 使い方:
 *   cd visit-dental-app
 *   npm run export:supabase
 *
 * 出力先: export-data/YYYY-MM-DD/
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

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

function toCsv(rows) {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const esc = (v) => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  return [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n')
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
  const today = new Date().toISOString().slice(0, 10)
  const outDir = join(root, 'export-data', today)
  mkdirSync(outDir, { recursive: true })

  const tables = [
    'facilities',
    'patients',
    'treatments',
    'teeth_data',
    'patient_medical',
    'settings',
    'photos',
    'generated_documents',
    'report_preview_drafts',
  ]

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) {
      console.warn('[skip] ' + table + ': ' + error.message)
      continue
    }
    const rows = data || []
    writeFileSync(join(outDir, table + '.csv'), toCsv(rows), 'utf8')
    console.log('[ok] ' + table + ' ' + rows.length + '件 → ' + outDir)
  }
  console.log('\nバックアップ完了: ' + outDir)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
