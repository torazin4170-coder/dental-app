/** Vercel Node.js API — 1ファイル完結（GAS へは POST のみ） */

function normalizeGasWebAppUrl_(raw) {
  let url = String(raw || '').trim().replace(/^[?=]+/, '')
  if (!url) {
    return { url: '', error: 'GAS_WEBAPP_URL が未設定です。Vercel → Settings → Environment Variables を確認してください。' }
  }
  if (/docs\.google\.com|sheets\.google\.com|drive\.google\.com/i.test(url)) {
    return {
      url: '',
      error: 'GAS_WEBAPP_URL がスプレッドシート/Drive の URL になっています。GAS エディタ → デプロイ → ウェブアプリの /exec URL を設定してください。',
    }
  }
  if (!/script\.google\.com/i.test(url)) {
    return {
      url: '',
      error: 'GAS_WEBAPP_URL は script.google.com のウェブアプリ URL（/exec で終わる）である必要があります。',
    }
  }
  if (/\/dev\/?$/i.test(url)) {
    return {
      url: '',
      error: 'GAS_WEBAPP_URL が /dev です。デプロイ管理から /exec URL をコピーして設定してください。',
    }
  }
  url = url.replace(/\/+$/, '')
  if (!/\/exec$/i.test(url)) {
    url += '/exec'
  }
  return { url, error: null }
}

async function parseGasText(res) {
  const text = await res.text()
  try {
    const parsed = JSON.parse(text)
    if (typeof parsed.ok !== 'boolean') {
      return { ok: false, error: 'GAS 応答が不正です (' + res.status + ')' }
    }
    return parsed
  } catch {
    let hint = ''
    if (res.status === 404 || text.includes('Page Not Found')) {
      hint = ' GAS_WEBAPP_URL が古いか誤りです。GAS → デプロイを管理 → ウェブアプリの /exec URL を Vercel に再設定し Redeploy してください。'
    } else if (text.includes('Authorization')) {
      hint = ' GAS のアクセスを「全員」にしてください。'
    } else if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      hint = ' Main.gs に doPost（RPC_ALLOWLIST_）が入っているか、新バージョンでデプロイ済みか確認してください。'
    }
    return {
      ok: false,
      error: 'GAS が JSON 以外を返しました (' + res.status + '): ' + text.slice(0, 160) + hint,
    }
  }
}

async function callGasPost(gasUrl, func, args) {
  const payload = JSON.stringify({ func, args })
  const opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    redirect: 'manual',
  }
  let res = await fetch(gasUrl, opts)
  for (let i = 0; i < 5; i++) {
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location')
      if (!loc) break
      res = await fetch(loc, opts)
      continue
    }
    break
  }
  return parseGasText(res)
}

async function forwardGasRpc(gasUrl, func, args) {
  return callGasPost(gasUrl, func, args)
}

function readJsonBody(req) {
  const body = req.body
  if (body == null) return {}
  if (typeof body === 'string') {
    try {
      return JSON.parse(body)
    } catch {
      return {}
    }
  }
  if (typeof body === 'object') return body
  return {}
}

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' })
      return
    }

    const normalized = normalizeGasWebAppUrl_(process.env.GAS_WEBAPP_URL)
    if (normalized.error) {
      res.status(502).json({ ok: false, error: normalized.error })
      return
    }

    const body = readJsonBody(req)
    const func = String(body.func || '').trim()
    if (!func) {
      res.status(400).json({ ok: false, error: 'Missing func' })
      return
    }
    const args = Array.isArray(body.args) ? body.args : []

    const out = await forwardGasRpc(normalized.url, func, args)
    res.status(out.ok ? 200 : 502).json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ ok: false, error: 'Vercel API 内部エラー: ' + msg })
  }
}
