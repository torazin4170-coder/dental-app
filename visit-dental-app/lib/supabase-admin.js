import { createClient } from '@supabase/supabase-js'

let cached = null

export function getSupabaseConfig() {
  let url = String(process.env.SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!url || !key) {
    return {
      url: '',
      key: '',
      error:
        'SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を Vercel 環境変数（または .env.local）に設定してください。',
    }
  }
  if (!/^https:\/\/.+\.supabase\.co/i.test(url)) {
    return { url: '', key: '', error: 'SUPABASE_URL は https://xxxx.supabase.co 形式である必要があります。' }
  }
  return { url, key, error: null }
}

export function getSupabaseAdmin() {
  const cfg = getSupabaseConfig()
  if (cfg.error) {
    throw new Error(cfg.error)
  }
  if (!cached) {
    cached = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}

export function resetSupabaseAdminForTests() {
  cached = null
}
