/** GAS Web App への HTTP 呼び出し */

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

export function describeGasDeployment_(url) {
  const m = String(url || '').match(/\/macros\/s\/([^/]+)\/exec/i)
  if (!m) return { ok: false, preview: null }
  const id = m[1]
  return { ok: true, preview: id.length > 10 ? id.slice(0, 10) + '…' : id + '…' }
}

function shouldUsePost(func, args) {
  if (POST_ONLY.has(func)) return true
  try {
    return JSON.stringify(args).length > 6000
  } catch {
    return true
  }
}

export function buildGasGetRpcUrl_(gasUrl, func, args) {
  const url = new URL(gasUrl)
  url.searchParams.set('rpc', '1')
  url.searchParams.set('func', func)
  url.searchParams.set('args', JSON.stringify(args))
  return url.toString()
}

function htmlGasHint_(text, status) {
  if (!text.includes('<!DOCTYPE') && !text.includes('<!doctype') && !text.includes('<html')) return ''
  if (text.includes('訪問歯科カルテ') || text.includes('boot-loading')) {
    return ' GAS は接続できていますが、画面HTMLが返りました。Main.gs を「AppsScript-Main-差し替え用.gs」で全文置換し、doGet の rpc=1 入りで「新バージョン」再デプロイしてください。'
  }
  if (status === 404 || text.includes('Page Not Found')) {
    return ' GAS_WEBAPP_URL が古いか誤りです。デプロイ管理の最新 /exec URL を Vercel に設定し Redeploy してください。'
  }
  if (text.includes('Authorization')) {
    return ' GAS のアクセスを「全員」にしてください。'
  }
  return ' Main.gs（doGet rpc=1 / doPost）を新バージョンでデプロイ済みか確認してください。'
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
    const hint = htmlGasHint_(text, res.status)
    return {
      ok: false,
      error: 'GAS が JSON 以外を返しました (' + res.status + '): ' + text.slice(0, 160) + hint,
    }
  }
}

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

/** 読み取り系: doGet ?rpc=1（リダイレクトは GET のまま追跡） */
async function callGasGetRpc(gasUrl, func, args) {
  const rpcUrl = buildGasGetRpcUrl_(gasUrl, func, args)
  let res = await fetch(rpcUrl, { method: 'GET', redirect: 'manual' })
  for (let i = 0; i < 6; i++) {
    if (![301, 302, 303, 307, 308].includes(res.status)) {
      return parseGasText(res)
    }
    const loc = res.headers.get('location')
    if (!loc) return parseGasText(res)
    const next = new URL(loc, rpcUrl)
    if (!next.searchParams.has('rpc')) {
      next.searchParams.set('rpc', '1')
      next.searchParams.set('func', func)
      next.searchParams.set('args', JSON.stringify(args))
    }
    res = await fetch(next.toString(), { method: 'GET', redirect: 'manual' })
  }
  return parseGasText(res)
}

/** 大きい payload: doPost（リダイレクト先にも POST。GET にすると画面 HTML になる） */
async function callGasPostRpc(gasUrl, func, args) {
  const payload = JSON.stringify({ func, args })
  const postOpts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    redirect: 'manual',
  }
  let res = await fetch(gasUrl, postOpts)
  for (let i = 0; i < 6; i++) {
    const tryParsed = await parseGasText(res.clone())
    if (tryParsed.ok) return tryParsed
    if (![301, 302, 303, 307, 308].includes(res.status)) {
      return tryParsed
    }
    const loc = res.headers.get('location')
    if (!loc) return tryParsed
    res = await fetch(loc, postOpts)
  }
  return parseGasText(res)
}

export async function callGasRpc(gasUrl, func, args) {
  if (shouldUsePost(func, args)) {
    return callGasPostRpc(gasUrl, func, args)
  }
  return callGasGetRpc(gasUrl, func, args)
}

export const GAS_CHECK_FIX_STEPS_ = [
  'GAS エディタで Main.gs を開き Ctrl+F →「rpc」→ doGet 内に rpc=1 があるか確認',
  'なければ「AppsScript-Main-差し替え用.gs」を Main.gs に全文コピーして保存',
  'デプロイ → デプロイを管理 → ウェブアプリ ✏️ → バージョン「新バージョン」→ デプロイ',
  '表示された /exec URL を Vercel の GAS_WEBAPP_URL（Value）に貼り替え → Save',
  'Vercel → Deployments → Redeploy → /api/gas-check を再確認',
]
