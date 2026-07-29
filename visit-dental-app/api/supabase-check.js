import { IMPLEMENTED_RPC } from '../lib/rpc-handlers.js'
import { getSupabaseAdmin, getSupabaseConfig } from '../lib/supabase-admin.js'

export default async function handler(_req, res) {
  const cfg = getSupabaseConfig()
  if (cfg.error) {
    res.status(502).json({
      ok: false,
      step: 'env',
      error: cfg.error,
      fix: [
        'Supabase Dashboard → Project Settings → API から URL と service_role key をコピー',
        'Vercel → Settings → Environment Variables に SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY を設定',
        'VITE_RPC_BACKEND=supabase を Preview 環境に設定して Redeploy',
        'SQL Editor で supabase/migrations/001_initial_schema.sql を実行',
      ],
    })
    return
  }

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('settings').select('key').limit(1)
    if (error) {
      res.status(502).json({
        ok: false,
        step: 'db',
        error: 'Supabase 接続失敗: ' + error.message,
        hint: '001_initial_schema.sql を SQL Editor で実行済みか確認してください。',
      })
      return
    }

    const { count, error: facErr } = await supabase
      .from('facilities')
      .select('*', { count: 'exact', head: true })
    if (facErr) {
      res.status(502).json({ ok: false, step: 'db', error: facErr.message })
      return
    }

    res.status(200).json({
      ok: true,
      step: 'supabase',
      message: 'Supabase 接続 OK',
      backend: 'supabase',
      facilitiesCount: count ?? 0,
      implementedRpcCount: IMPLEMENTED_RPC.size,
      note: '試用版。帳票・写真など未実装 RPC はエラーメッセージで案内します。',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ ok: false, step: 'supabase', error: msg })
  }
}
