#!/usr/bin/env node
/**
 * GAS 接続をローカルまたは Vercel URL で検証。
 * 用法:
 *   GAS_WEBAPP_URL=https://script.google.com/.../exec node scripts/verify-gas-connection.mjs
 *   VERCEL_URL=https://xxx.vercel.app node scripts/verify-gas-connection.mjs
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { callGasRpc, normalizeGasWebAppUrl } from '../lib/gas-http.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const p = path.join(root, '.env.local')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    const k = t.slice(0, i).trim()
    const v = t.slice(i + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnvLocal()

const vercelUrl = String(process.env.VERCEL_URL || process.env.VERCEL_PRODUCTION_URL || '').trim().replace(/\/$/, '')

async function checkVercel() {
  if (!vercelUrl) return null
  const url = vercelUrl + '/api/gas-check'
  console.log('Vercel 経由:', url)
  const res = await fetch(url)
  const j = await res.json()
  return j
}

async function checkDirect() {
  const normalized = normalizeGasWebAppUrl(process.env.GAS_WEBAPP_URL || '')
  if (normalized.error) {
    return { ok: false, error: normalized.error }
  }
  console.log('GAS 直接:', normalized.url.replace(/\/macros\/s\/[^/]+/, '/macros/s/…'))
  return callGasRpc(normalized.url, 'getFacilities', [])
}

async function main() {
  let ok = false
  const vercel = await checkVercel()
  if (vercel) {
    console.log(JSON.stringify(vercel, null, 2))
    ok = vercel.ok === true
  } else {
    const direct = await checkDirect()
    console.log(JSON.stringify(direct, null, 2))
    ok = direct.ok === true
  }
  process.exit(ok ? 0 : 1)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
