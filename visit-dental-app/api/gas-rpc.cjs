/** Vercel Node.js API — lib フォルダを import せず1ファイル完結（Edge 落ち対策） */

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
    var hint = ''
    if (text.indexOf('Page Not Found') >= 0) {
      hint = ' GAS URL が /exec か、Main.gs を新バージョンでデプロイ済みか確認してください。'
    } else if (text.indexOf('Authorization') >= 0) {
      hint = ' GAS のアクセスを「全員」にしてください。'
    } else if (text.indexOf('<!DOCTYPE') >= 0 || text.indexOf('<html') >= 0) {
      hint = ' GAS が HTML を返しました。doGet の rpc=1 が Main.gs に入っているか確認してください。'
    }
    return {
      ok: false,
      error: 'GAS が JSON 以外を返しました (' + res.status + '): ' + text.slice(0, 160) + hint,
    }
  }
}

async function callGasGet(gasUrl, func, args) {
  var url = new URL(gasUrl)
  url.searchParams.set('rpc', '1')
  url.searchParams.set('func', func)
  url.searchParams.set('args', JSON.stringify(args))
  var res = await fetch(url.toString(), { method: 'GET', redirect: 'follow' })
  return parseGasText(res)
}

async function callGasPost(gasUrl, func, args) {
  var payload = JSON.stringify({ func: func, args: args })
  var opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    redirect: 'manual',
  }
  var res = await fetch(gasUrl, opts)
  for (var i = 0; i < 5; i++) {
    if ([301, 302, 303, 307, 308].indexOf(res.status) >= 0) {
      var loc = res.headers.get('location')
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
  var body = req.body
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

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' })
      return
    }

    var gasUrl = String(process.env.GAS_WEBAPP_URL || '').trim()
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
      res.status(502).json({ ok: false, error: 'GAS_WEBAPP_URL の形式が正しくありません: ' + gasUrl.slice(0, 80) })
      return
    }

    var body = readJsonBody(req)
    var func = String(body.func || '').trim()
    if (!func) {
      res.status(400).json({ ok: false, error: 'Missing func' })
      return
    }
    var args = Array.isArray(body.args) ? body.args : []

    var out = await forwardGasRpc(gasUrl, func, args)
    res.status(out.ok ? 200 : 502).json(out)
  } catch (e) {
    var msg = e && e.message ? e.message : String(e)
    res.status(500).json({ ok: false, error: 'Vercel API 内部エラー: ' + msg })
  }
}
