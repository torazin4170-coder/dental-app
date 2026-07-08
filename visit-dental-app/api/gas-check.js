import {
  buildGasGetRpcUrl_,
  callGasRpc,
  describeGasDeployment_,
  GAS_CHECK_FIX_STEPS_,
  normalizeGasWebAppUrl,
  parseGasText,
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
      fix: GAS_CHECK_FIX_STEPS_,
    })
    return
  }

  const getUrl = buildGasGetRpcUrl_(normalized.url, 'getFacilities', [])
  const getRes = await fetch(getUrl, { method: 'GET', redirect: 'follow' })
  const getOut = await parseGasText(getRes)

  if (getOut.ok) {
    res.status(200).json({
      ok: true,
      step: 'gas',
      method: 'GET rpc=1',
      message: 'GAS 接続 OK（getFacilities 成功）',
      deploymentIdPreview: deployment.preview,
    })
    return
  }

  const out = await callGasRpc(normalized.url, 'getFacilities', [])

  if (out.ok) {
    res.status(200).json({
      ok: true,
      step: 'gas',
      method: 'fallback',
      message: 'GAS 接続 OK（getFacilities 成功）',
      deploymentIdPreview: deployment.preview,
    })
    return
  }

  res.status(502).json({
    ok: false,
    step: 'gas',
    error: out.error || getOut.error,
    deploymentIdPreview: deployment.preview,
    urlReachable: reach.detail,
    fix: GAS_CHECK_FIX_STEPS_,
    note: '画面HTML（訪問歯科カルテ）が返る場合、デプロイ版 Main.gs に doGet の rpc=1 がありません。全文コピー＋新バージョンデプロイが必要です。',
  })
}
