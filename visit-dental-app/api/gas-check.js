/** GAS 接続診断（URL 形式チェック + getFacilities を POST で試行） */

function normalizeGasWebAppUrl_(raw) {
  let url = String(raw || '').trim().replace(/^[?=]+/, '')
  if (!url) {
    return { url: '', error: 'GAS_WEBAPP_URL が未設定です' }
  }
  if (/docs\.google\.com|sheets\.google\.com|drive\.google\.com/i.test(url)) {
    return { url: '', error: 'スプレッドシート/Drive の URL になっています（/exec のウェブアプリ URL が必要）' }
  }
  if (!/script\.google\.com/i.test(url)) {
    return { url: '', error: 'script.google.com の URL ではありません' }
  }
  if (/\/dev\/?$/i.test(url)) {
    return { url: '', error: '/dev ではなく /exec URL を設定してください' }
  }
  url = url.replace(/\/+$/, '')
  if (!/\/exec$/i.test(url)) {
    url += '/exec'
  }
  return { url, error: null }
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
  const text = await res.text()
  return { status: res.status, text }
}

export default async function handler(_req, res) {
  const normalized = normalizeGasWebAppUrl_(process.env.GAS_WEBAPP_URL)
  if (normalized.error) {
    res.status(502).json({
      ok: false,
      step: 'env',
      error: normalized.error,
      hint: 'Vercel → dental-app → Settings → Environment Variables → GAS_WEBAPP_URL',
    })
    return
  }

  const host = normalized.url.replace(/^https?:\/\//, '').split('/')[0]
  const probe = await callGasPost(normalized.url, 'getFacilities', [])
  let parsed = null
  try {
    parsed = JSON.parse(probe.text)
  } catch {
    parsed = null
  }

  if (parsed && parsed.ok === true) {
    res.status(200).json({
      ok: true,
      step: 'gas',
      message: 'GAS 接続 OK（getFacilities 成功）',
      gasHost: host,
    })
    return
  }

  res.status(502).json({
    ok: false,
    step: 'gas',
    error: parsed && parsed.error
      ? parsed.error
      : 'GAS が JSON 以外を返しました (' + probe.status + '): ' + probe.text.slice(0, 120),
    gasHost: host,
    hint: probe.status === 404
      ? 'GAS_WEBAPP_URL を最新の /exec に更新し、Main.gs（doPost）を新バージョンでデプロイしてください'
      : 'GAS のアクセスを「全員」にし、Main.gs に RPC_ALLOWLIST_ / doPost があるか確認してください',
  })
}
