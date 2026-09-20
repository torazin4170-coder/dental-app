import { getSupabaseAdmin } from '../supabase-admin.js'

const RPT_DRAFT_CLOUD_CHUNK = 35000
const CHUNK_TTL_SEC = 600

function reportDraftUploadCacheKey(kind, id) {
  const safeKind = String(kind || '').replace(/[^\w\-]/g, '_')
  const safeId = String(id || '').replace(/[^\w\-_.]/g, '_')
  return `rpt_draft_up_rptDraft_v1_${safeKind}_${safeId}.json`
}

function parseReportDraftEnvelope(envelopeJson) {
  const o = JSON.parse(String(envelopeJson))
  return {
    savedAt: o.savedAt || 0,
    payload: o.payload != null ? o.payload : null,
  }
}

async function writeReportDraftEnvelope(kind, id, envelopeJson) {
  const supabase = getSupabaseAdmin()
  let savedAt = Date.now()
  try {
    const parsed = JSON.parse(String(envelopeJson))
    if (parsed && parsed.savedAt) savedAt = Number(parsed.savedAt) || savedAt
  } catch {
    /* keep now */
  }
  const { error } = await supabase.from('report_preview_drafts').upsert(
    {
      kind: String(kind),
      draft_id: String(id),
      envelope: String(envelopeJson),
      saved_at: savedAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'kind,draft_id' },
  )
  if (error) throw new Error(error.message)
}

async function readReportDraftEnvelope(kind, id) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('report_preview_drafts')
    .select('envelope')
    .eq('kind', String(kind))
    .eq('draft_id', String(id))
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.envelope != null ? String(data.envelope) : null
}

async function putChunk(cacheKey, chunkIndex, chunkData, chunkTotal) {
  const supabase = getSupabaseAdmin()
  const expiresAt = new Date(Date.now() + CHUNK_TTL_SEC * 1000).toISOString()
  const { error } = await supabase.from('upload_chunks').upsert(
    {
      cache_key: cacheKey,
      chunk_index: chunkIndex,
      chunk_data: String(chunkData || ''),
      chunk_total: chunkTotal != null ? Number(chunkTotal) : null,
      expires_at: expiresAt,
    },
    { onConflict: 'cache_key,chunk_index' },
  )
  if (error) throw new Error(error.message)
}

async function getChunkMeta(cacheKey) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('upload_chunks')
    .select('chunk_total, expires_at')
    .eq('cache_key', cacheKey)
    .eq('chunk_index', 0)
    .maybeSingle()
  if (error) throw new Error(error.message)
  // meta may be on any row; prefer row with chunk_total set
  if (data?.chunk_total) return Number(data.chunk_total)
  const { data: rows, error: e2 } = await supabase
    .from('upload_chunks')
    .select('chunk_total')
    .eq('cache_key', cacheKey)
    .not('chunk_total', 'is', null)
    .limit(1)
  if (e2) throw new Error(e2.message)
  return rows?.[0]?.chunk_total != null ? Number(rows[0].chunk_total) : 0
}

async function getChunkPart(cacheKey, chunkIndex) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('upload_chunks')
    .select('chunk_data, expires_at')
    .eq('cache_key', cacheKey)
    .eq('chunk_index', chunkIndex)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return null
  return data.chunk_data != null ? String(data.chunk_data) : null
}

async function clearChunks(cacheKey, chunkTotal) {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('upload_chunks').delete().eq('cache_key', cacheKey)
  if (error) throw new Error(error.message)
  void chunkTotal
}

export async function saveReportPreviewDraftSimple([kind, id, envelopeJson]) {
  kind = String(kind || '').trim()
  id = String(id || '').trim()
  if (!kind || !id) return JSON.stringify({ ok: false, error: 'kind/id required' })
  try {
    await writeReportDraftEnvelope(kind, id, envelopeJson)
    return JSON.stringify({ ok: true })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function saveReportPreviewDraftChunk([kind, id, chunkIndex, chunkTotal, chunkData]) {
  kind = String(kind || '').trim()
  id = String(id || '').trim()
  chunkIndex = Number(chunkIndex)
  chunkTotal = Number(chunkTotal)
  if (!kind || !id || chunkTotal < 1 || chunkIndex < 0 || chunkIndex >= chunkTotal) {
    return JSON.stringify({ ok: false, error: 'invalid chunk' })
  }
  try {
    const baseKey = reportDraftUploadCacheKey(kind, id)
    await putChunk(baseKey, chunkIndex, chunkData, chunkTotal)
    // also store meta on a sentinel-friendly way: update chunk 0's chunk_total
    if (chunkIndex === 0) {
      await putChunk(baseKey, 0, chunkData, chunkTotal)
    } else {
      // ensure meta total is visible: upsert a meta-only row via chunk_index -1 is not allowed;
      // store total on every chunk
      await putChunk(baseKey, chunkIndex, chunkData, chunkTotal)
    }
    return JSON.stringify({ ok: true })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function saveReportPreviewDraftChunkFinish([kind, id]) {
  kind = String(kind || '').trim()
  id = String(id || '').trim()
  if (!kind || !id) return JSON.stringify({ ok: false, error: 'kind/id required' })
  try {
    const baseKey = reportDraftUploadCacheKey(kind, id)
    const chunkTotal = await getChunkMeta(baseKey)
    if (!chunkTotal || chunkTotal < 1) return JSON.stringify({ ok: false, error: 'upload not found' })
    let envelopeJson = ''
    for (let i = 0; i < chunkTotal; i++) {
      const part = await getChunkPart(baseKey, i)
      if (part == null) return JSON.stringify({ ok: false, error: `missing chunk ${i}` })
      envelopeJson += part
    }
    await writeReportDraftEnvelope(kind, id, envelopeJson)
    await clearChunks(baseKey, chunkTotal)
    return JSON.stringify({ ok: true })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function loadReportPreviewDraftInfo([kind, id]) {
  kind = String(kind || '').trim()
  id = String(id || '').trim()
  if (!kind || !id) return JSON.stringify({ ok: true, exists: false })
  try {
    const envelopeJson = await readReportDraftEnvelope(kind, id)
    if (!envelopeJson) return JSON.stringify({ ok: true, exists: false })
    if (envelopeJson.length <= RPT_DRAFT_CLOUD_CHUNK) {
      const parsed = parseReportDraftEnvelope(envelopeJson)
      return JSON.stringify({
        ok: true,
        exists: true,
        savedAt: parsed.savedAt,
        payload: parsed.payload,
      })
    }
    const chunkTotal = Math.ceil(envelopeJson.length / RPT_DRAFT_CLOUD_CHUNK)
    const parsedLarge = parseReportDraftEnvelope(envelopeJson)
    return JSON.stringify({
      ok: true,
      exists: true,
      savedAt: parsedLarge.savedAt,
      chunkTotal,
    })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e), exists: false })
  }
}

export async function loadReportPreviewDraftChunk([kind, id, chunkIndex]) {
  kind = String(kind || '').trim()
  id = String(id || '').trim()
  chunkIndex = Number(chunkIndex)
  try {
    const envelopeJson = await readReportDraftEnvelope(kind, id)
    if (!envelopeJson) return JSON.stringify({ ok: false, error: 'not found' })
    const start = chunkIndex * RPT_DRAFT_CLOUD_CHUNK
    if (start >= envelopeJson.length) return JSON.stringify({ ok: false, error: 'chunk out of range' })
    const data = envelopeJson.substring(start, start + RPT_DRAFT_CLOUD_CHUNK)
    return JSON.stringify({ ok: true, data })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function clearReportPreviewDraft([kind, id]) {
  kind = String(kind || '').trim()
  id = String(id || '').trim()
  if (!kind || !id) return JSON.stringify({ ok: false, error: 'kind/id required' })
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from('report_preview_drafts').delete().eq('kind', kind).eq('draft_id', id)
    const baseKey = reportDraftUploadCacheKey(kind, id)
    await clearChunks(baseKey, 0)
    return JSON.stringify({ ok: true })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export { RPT_DRAFT_CLOUD_CHUNK, putChunk, getChunkMeta, getChunkPart, clearChunks }
