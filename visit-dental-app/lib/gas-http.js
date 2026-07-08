/** GAS Web App への HTTP 呼び出し（リダイレクト対応） */

const POST_ONLY = new Set([
  'savePhoto',
  'saveReportPreviewDraftSimple',
  'saveReportPreviewDraftChunk',
  'saveGeneratedDocumentSimple',
  'saveGeneratedDocumentChunk',
])

export function normalizeGasWebAppUrl(raw) {
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

function shouldUsePost(func, args) {
  if (POST_ONLY.has(func)) return true
  try {
    return JSON.stringify(args).length > 6000
  } catch {
    return true
  }
}

async function followGasRedirects(res, retryGet) {
  for (let i = 0; i < 5; i++) {
    if (![301, 302, 303, 307, 308].includes(res.status)) break
    const loc = res.headers.get('location')
    if (!loc) break
    res = await fetch(loc, { method: 'GET', redirect: 'manual' })
    if (res.status === 405 && retryGet) {
      res = await retryGet()
    }
  }
  return res
}

export async function parseGasText(res) {
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
    } else if (res.status === 405) {
      hint = ' GAS のリダイレクト応答の処理に失敗しました。デプロイをやり直すか、しばらく待って再試行してください。'
    } else if (text.includes('Authorization')) {
      hint = ' GAS のアクセスを「全員」にしてください。'
    } else if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      hint = ' Main.gs に doPost / doGet（rpc=1）が入っているか、新バージョンでデプロイ済みか確認してください。'
    }
    return {
      ok: false,
      error: 'GAS が JSON 以外を返しました (' + res.status + '): ' + text.slice(0, 160) + hint,
    }
  }
}

async function callGasGetRpc(gasUrl, func, args) {
  const base = new URL(gasUrl)
  const buildUrl = () => {
    const url = new URL(base.toString())
    url.searchParams.set('rpc', '1')
    url.searchParams.set('func', func)
    url.searchParams.set('args', JSON.stringify(args))
    return url
  }
  const retryGet = async () => fetch(buildUrl().toString(), { method: 'GET', redirect: 'manual' })

  let res = await retryGet()
  res = await followGasRedirects(res, retryGet)
  return parseGasText(res)
}

async function callGasPostRpc(gasUrl, func, args) {
  const payload = JSON.stringify({ func, args })
  let res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    redirect: 'manual',
  })
  res = await followGasRedirects(res, null)
  return parseGasText(res)
}

export async function callGasRpc(gasUrl, func, args) {
  if (shouldUsePost(func, args)) {
    return callGasPostRpc(gasUrl, func, args)
  }
  return callGasGetRpc(gasUrl, func, args)
}
