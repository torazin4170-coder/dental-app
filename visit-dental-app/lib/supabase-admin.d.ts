import type { SupabaseClient } from '@supabase/supabase-js'

export function getSupabaseConfig(): { url: string; key: string; error: string | null }
export function getSupabaseAdmin(): SupabaseClient
export function resetSupabaseAdminForTests(): void
