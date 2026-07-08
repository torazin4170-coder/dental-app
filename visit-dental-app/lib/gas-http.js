/** GAS Web App への HTTP 呼び出し（POST → リダイレクトは GET で追跡） */

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

/** 診断用: デプロイ ID の先頭だけ返す（秘密は伏せる） */
export function describeGasDeployment_(url) {
  const m = String(url || '').match(/\/macros\/s\/([^/]+)\/exec/i)
  if (!m) return { ok: false, preview: null }
  const id = m[1]
  return { ok: true, preview: id.length > 10 ? id.slice(0, 10) + '…' : id + '…' }
}

async function followGasRedirects(res) {
  for (let i = 0; i < 6; i++) {
    if (![301, 302, 303, 307, 308].includes(res.status)) break
    const loc = res.headers.get('location')
    if (!loc) break
    res = await fetch(loc, { method: 'GET', redirect: 'manual' })
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
      hint = ' GAS の「デプロイを管理」から最新の /exec URL をコピーし、Vercel の GAS_WEBAPP_URL を更新 → Redeploy してください（エディタに doPost があっても、古い URL では動きません）。'
    } else if (res.status === 405) {
      hint = ' GAS のリダイレクト応答の処理に失敗しました。'
    } else if (text.includes('Authorization')) {
      hint = ' GAS のアクセスを「全員」にしてください。'
    } else if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      hint = ' ウェブアプリを「新バージョン」で再デプロイし、新しい /exec URL を Vercel に設定してください。'
    }
    return {
      ok: false,
      error: 'GAS が JSON 以外を返しました (' + res.status + '): ' + text.slice(0, 160) + hint,
    }
  }
}

/** ウェブアプリ URL 自体が生きているか（404 なら URL が完全に誤り） */
export async function probeGasWebAppReachable_(gasUrl) {
  try {
    const res = await fetch(gasUrl, { method: 'GET', redirect: 'manual' })
    if (res.status === 404) {
      return { reachable: false, status: 404, detail: 'URL が存在しません（デプロイ ID が古いか URL のコピーミス）' }
    }
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      return { reachable: true, status: res.status, detail: 'リダイレクト応答（URL は有効）' }
    }
    if (res.status >= 200 && res.status < 400) {
      return { reachable: true, status: res.status, detail: '応答あり（URL は有効）' }
    }
    return { reachable: false, status: res.status, detail: 'HTTP ' + res.status }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { reachable: false, status: 0, detail: msg }
  }
}

async function callGasPostRpc(gasUrl, func, args) {
  const payload = JSON.stringify({ func, args })
  let res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: payload,
    redirect: 'manual',
  })
  res = await followGasRedirects(res)
  return parseGasText(res)
}

/** すべて doPost 経由（デプロイ済み doPost があれば動く） */
export async function callGasRpc(gasUrl, func, args) {
  return callGasPostRpc(gasUrl, func, args)
}

export const GAS_CHECK_FIX_STEPS_ = [
  'GAS エディタ → 右上「デプロイ」→「デプロイを管理」',
  '種類「ウェブアプリ」の ✏️ → バージョン「新バージョン」→「デプロイ」',
  '表示された URL（…/exec）を **全文コピー**',
  'Vercel → dental-app → Settings → Environment Variables → GAS_WEBAPP_URL に貼り替え',
  'Vercel → Deployments → Redeploy → /api/gas-check を再確認',
]
