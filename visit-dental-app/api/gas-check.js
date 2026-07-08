import {
  callGasRpc,
  describeGasDeployment_,
  GAS_CHECK_FIX_STEPS_,
  normalizeGasWebAppUrl,
  probeGasWebAppReachable_,
} from '../lib/gas-http.js'

export default async function handler(_req, res) {
  const normalized = normalizeGasWebAppUrl(process.env.GAS_WEBAPP_URL)
  if (normalized.error) {
    res.status(502).json({
      ok: false,
      step: 'env',
      error: normalized.error,
      fix: GAS_CHECK_FIX_STEPS_,
    })
    return
  }

  const deployment = describeGasDeployment_(normalized.url)
  const reach = await probeGasWebAppReachable_(normalized.url)

  if (!reach.reachable) {
    res.status(502).json({
      ok: false,
      step: 'url',
      error: 'GAS ウェブアプリ URL に到達できません: ' + reach.detail,
      httpStatus: reach.status,
      deploymentIdPreview: deployment.preview,
      gasHost: 'script.google.com',
      fix: GAS_CHECK_FIX_STEPS_,
      note: 'Main.gs に doPost があっても、Vercel の URL が古いデプロイを指していると 404 になります。',
    })
    return
  }

  const out = await callGasRpc(normalized.url, 'getFacilities', [])

  if (out.ok) {
    res.status(200).json({
      ok: true,
      step: 'gas',
      message: 'GAS 接続 OK（getFacilities 成功）',
      deploymentIdPreview: deployment.preview,
      gasHost: 'script.google.com',
    })
    return
  }

  res.status(502).json({
    ok: false,
    step: 'gas',
    error: out.error,
    deploymentIdPreview: deployment.preview,
    gasHost: 'script.google.com',
    urlReachable: reach.detail,
    fix: GAS_CHECK_FIX_STEPS_,
    note: 'エディタの Main.gs と「デプロイ済みバージョン」は別です。必ず「新バージョン」で再デプロイしてください。',
  })
}
