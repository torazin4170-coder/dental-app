/** Vercel Node.js API — 1ファイル完結 */

const POST_ONLY = new Set([
  'savePhoto',
  'saveReportPreviewDraftSimple',
  'saveReportPreviewDraftChunk',
  'saveGeneratedDocumentSimple',
  'saveGeneratedDocumentChunk',
])

function shouldPost(func, args) {
  if (POST_ONLY.has(func)) return true
  try {
    return JSON.stringify(args).length > 6000
  } catch {
    return true
  }
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
    if (text.includes('Page Not Found')) {
      hint = ' GAS URL が /exec か、Main.gs を新バージョンでデプロイ済みか確認してください。'
    } else if (text.includes('Authorization')) {
      hint = ' GAS のアクセスを「全員」にしてください。'
    } else if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      hint = ' GAS が HTML を返しました。doGet の rpc=1 が Main.gs に入っているか確認してください。'
    }
    return {
      ok: false,
      error: 'GAS が JSON 以外を返しました (' + res.status + '): ' + text.slice(0, 160) + hint,
    }
  }
}

async function callGasGet(gasUrl, func, args) {
  const url = new URL(gasUrl)
  url.searchParams.set('rpc', '1')
  url.searchParams.set('func', func)
  url.searchParams.set('args', JSON.stringify(args))
  const res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' })
  return parseGasText(res)
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
  if (shouldPost(func, args)) {
    return callGasPost(gasUrl, func, args)
  }
  return callGasGet(gasUrl, func, args)
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

    const gasUrl = String(process.env.GAS_WEBAPP_URL || '').trim()
    if (!gasUrl) {
      res.status(502).json({
        ok: false,
        error: 'GAS_WEBAPP_URL が未設定です。Vercel → Settings → Environment Variables を確認してください。',
      })
      return
    }

    try {
      new URL(gasUrl)
    } catch {
      res.status(502).json({
        ok: false,
        error: 'GAS_WEBAPP_URL の形式が正しくありません: ' + gasUrl.slice(0, 80),
      })
      return
    }

    const body = readJsonBody(req)
    const func = String(body.func || '').trim()
    if (!func) {
      res.status(400).json({ ok: false, error: 'Missing func' })
      return
    }
    const args = Array.isArray(body.args) ? body.args : []

    const out = await forwardGasRpc(gasUrl, func, args)
    res.status(out.ok ? 200 : 502).json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ ok: false, error: 'Vercel API 内部エラー: ' + msg })
  }
}
