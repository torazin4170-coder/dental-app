import { callGasRpc, normalizeGasWebAppUrl } from '../lib/gas-http.js'

export default async function handler(_req, res) {
  const normalized = normalizeGasWebAppUrl(process.env.GAS_WEBAPP_URL)
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
  const out = await callGasRpc(normalized.url, 'getFacilities', [])

  if (out.ok) {
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
    error: out.error,
    gasHost: host,
    hint: String(out.error || '').includes('404')
      ? 'GAS_WEBAPP_URL を最新の /exec に更新し、Main.gs を新バージョンでデプロイしてください'
      : 'GAS のアクセスを「全員」にし、Main.gs に RPC_ALLOWLIST_ / doPost / doGet（rpc=1）があるか確認してください',
  })
}
