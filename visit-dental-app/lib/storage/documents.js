import { getSupabaseAdmin } from '../supabase-admin.js'
import {
  clearChunks,
  getChunkMeta,
  getChunkPart,
  putChunk,
} from './chunk-cache.js'
import {
  getDocArchiveFolderId,
  readJsonFromDriveByName,
  trashDriveFile,
  writeJsonToDriveFolder,
} from './drive-client.js'

const DOC_ARCHIVE_VER = 1
const DOC_ARCHIVE_CHUNK = 35000

function docArchiveFileName(docId) {
  return `docArchive_v${DOC_ARCHIVE_VER}_${String(docId || '').replace(/[^\w\-_.]/g, '_')}.json`
}

function docArchiveUploadCacheKey(docId) {
  return `doc_arc_up_${docArchiveFileName(docId)}`
}

function newDocArchiveId() {
  return `DOC_${Date.now()}_${Math.floor(Math.random() * 10000)}`
}

function parseDocArchiveMeta(metaJson) {
  const o = typeof metaJson === 'object' ? metaJson : JSON.parse(String(metaJson || '{}'))
  return {
    kind: String(o.kind || '').trim(),
    slot_key: String(o.slot_key || '').trim(),
    patient_id: String(o.patient_id || '').trim(),
    fac_id: String(o.fac_id || '').trim(),
    period_key: String(o.period_key || '').trim(),
    title: String(o.title || '').trim(),
    save_mode: String(o.save_mode || 'overwrite').trim(),
    status: String(o.status || 'final').trim(),
  }
}

async function maxDocVersionForSlot(kind, slotKey) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('generated_documents')
    .select('version')
    .eq('kind', kind)
    .eq('slot_key', slotKey)
  if (error) throw new Error(error.message)
  let maxV = 0
  for (const r of data || []) {
    const v = Number(r.version) || 0
    if (v > maxV) maxV = v
  }
  return maxV
}

async function findPrimaryDoc(kind, slotKey) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('generated_documents')
    .select('*')
    .eq('kind', kind)
    .eq('slot_key', slotKey)
    .eq('is_primary', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

async function clearPrimaryFlagForSlot(kind, slotKey, exceptDocId) {
  const supabase = getSupabaseAdmin()
  let q = supabase
    .from('generated_documents')
    .update({ is_primary: false })
    .eq('kind', kind)
    .eq('slot_key', slotKey)
    .eq('is_primary', true)
  if (exceptDocId) q = q.neq('doc_id', exceptDocId)
  const { error } = await q
  if (error) throw new Error(error.message)
}

async function writeEnvelope(docId, envelopeJson) {
  // Prefer DB envelope (works without Drive). Also try Drive when configured.
  let driveFileId = ''
  try {
    const folderId = await getDocArchiveFolderId()
    driveFileId = await writeJsonToDriveFolder(folderId, docArchiveFileName(docId), envelopeJson)
  } catch {
    driveFileId = ''
  }
  return driveFileId
}

async function readEnvelope(docId, row) {
  if (row?.envelope) return String(row.envelope)
  try {
    const folderId = await getDocArchiveFolderId()
    return await readJsonFromDriveByName(folderId, docArchiveFileName(docId))
  } catch {
    return null
  }
}

async function finalizeGeneratedDocumentSave(metaJson, envelopeJson) {
  const meta = parseDocArchiveMeta(metaJson)
  if (!meta.kind || !meta.slot_key) throw new Error('kind/slot_key required')
  const parsed = JSON.parse(String(envelopeJson))
  const savedAt = Number(parsed.savedAt) || Date.now()
  const saveMode = meta.save_mode === 'new' ? 'new' : 'overwrite'
  meta.save_mode = saveMode
  const version = (await maxDocVersionForSlot(meta.kind, meta.slot_key)) + 1
  let docId
  if (saveMode === 'overwrite') {
    const primary = await findPrimaryDoc(meta.kind, meta.slot_key)
    docId = primary?.doc_id ? String(primary.doc_id) : newDocArchiveId()
  } else {
    docId = newDocArchiveId()
  }
  const isPrimary = saveMode === 'overwrite'
  if (isPrimary) await clearPrimaryFlagForSlot(meta.kind, meta.slot_key, docId)
  const driveFileId = await writeEnvelope(docId, envelopeJson)
  const supabase = getSupabaseAdmin()
  const row = {
    doc_id: docId,
    kind: meta.kind,
    slot_key: meta.slot_key,
    patient_id: meta.patient_id,
    fac_id: meta.fac_id,
    period_key: meta.period_key,
    title: meta.title,
    saved_at: new Date(savedAt).toISOString(),
    save_mode: saveMode,
    version,
    drive_file_id: driveFileId,
    storage_path: '',
    status: meta.status,
    is_primary: isPrimary,
    envelope: String(envelopeJson),
  }
  if (saveMode === 'overwrite') {
    const primary = await findPrimaryDoc(meta.kind, meta.slot_key)
    if (primary && String(primary.doc_id) !== docId) {
      if (primary.drive_file_id) await trashDriveFile(primary.drive_file_id)
      await supabase.from('generated_documents').delete().eq('doc_id', primary.doc_id)
    }
  }
  const { error } = await supabase.from('generated_documents').upsert(row, { onConflict: 'doc_id' })
  if (error) throw new Error(error.message)
  return { docId, version, savedAt }
}

export async function saveGeneratedDocumentSimple([metaJson, envelopeJson]) {
  try {
    const result = await finalizeGeneratedDocumentSave(metaJson, envelopeJson)
    return JSON.stringify({
      ok: true,
      docId: result.docId,
      version: result.version,
      savedAt: result.savedAt,
    })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function saveGeneratedDocumentChunk([docId, chunkIndex, chunkTotal, chunkData]) {
  docId = String(docId || '').trim()
  chunkIndex = Number(chunkIndex)
  chunkTotal = Number(chunkTotal)
  if (!docId || chunkTotal < 1 || chunkIndex < 0 || chunkIndex >= chunkTotal) {
    return JSON.stringify({ ok: false, error: 'invalid chunk' })
  }
  try {
    const baseKey = docArchiveUploadCacheKey(docId)
    await putChunk(baseKey, chunkIndex, chunkData, chunkTotal)
    return JSON.stringify({ ok: true })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function saveGeneratedDocumentChunkFinish([metaJson, docId]) {
  docId = String(docId || '').trim()
  if (!docId) return JSON.stringify({ ok: false, error: 'docId required' })
  try {
    const baseKey = docArchiveUploadCacheKey(docId)
    const chunkTotal = await getChunkMeta(baseKey)
    if (!chunkTotal || chunkTotal < 1) {
      return JSON.stringify({ ok: false, error: 'upload not found' })
    }
    let envelopeJson = ''
    for (let i = 0; i < chunkTotal; i++) {
      const part = await getChunkPart(baseKey, i)
      if (part == null) return JSON.stringify({ ok: false, error: `missing chunk ${i}` })
      envelopeJson += part
    }
    const result = await finalizeGeneratedDocumentSave(metaJson, envelopeJson)
    await clearChunks(baseKey, chunkTotal)
    return JSON.stringify({
      ok: true,
      docId: result.docId,
      version: result.version,
      savedAt: result.savedAt,
    })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function listGeneratedDocuments([filterJson]) {
  try {
    let filter = {}
    try {
      filter = typeof filterJson === 'object' ? filterJson || {} : JSON.parse(String(filterJson || '{}'))
    } catch {
      filter = {}
    }
    let limit = Number(filter.limit)
    if (!limit || limit < 1) limit = 80
    if (limit > 200) limit = 200
    const supabase = getSupabaseAdmin()
    let q = supabase.from('generated_documents').select('*').order('saved_at', { ascending: false })
    if (filter.kind) q = q.ilike('kind', `${String(filter.kind)}%`)
    if (filter.patient_id) q = q.ilike('patient_id', `${String(filter.patient_id)}%`)
    if (filter.fac_id) q = q.ilike('fac_id', `${String(filter.fac_id)}%`)
    if (filter.period_key) q = q.ilike('period_key', `${String(filter.period_key)}%`)
    q = q.limit(limit)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const items = (data || []).map((r) => ({
      doc_id: r.doc_id,
      kind: r.kind,
      slot_key: r.slot_key,
      patient_id: r.patient_id,
      fac_id: r.fac_id,
      period_key: r.period_key,
      title: r.title,
      saved_at: r.saved_at ? new Date(r.saved_at).getTime() : 0,
      save_mode: r.save_mode,
      version: r.version,
      status: r.status,
      is_primary: !!r.is_primary,
    }))
    return JSON.stringify({ ok: true, items })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e), items: [] })
  }
}

export async function loadGeneratedDocument([docId]) {
  docId = String(docId || '').trim()
  try {
    const supabase = getSupabaseAdmin()
    const { data: row, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('doc_id', docId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const envelopeJson = await readEnvelope(docId, row)
    if (!envelopeJson) return JSON.stringify({ ok: false, error: 'not found' })
    const parsed = JSON.parse(envelopeJson)
    const savedAt = Number(parsed.savedAt) || 0
    const meta = parsed.meta || {}
    if (envelopeJson.length <= DOC_ARCHIVE_CHUNK) {
      return JSON.stringify({
        ok: true,
        docId,
        savedAt,
        meta,
        payload: parsed.payload != null ? parsed.payload : null,
      })
    }
    return JSON.stringify({
      ok: true,
      docId,
      savedAt,
      meta,
      chunkTotal: Math.ceil(envelopeJson.length / DOC_ARCHIVE_CHUNK),
    })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function loadGeneratedDocumentChunk([docId, chunkIndex]) {
  docId = String(docId || '').trim()
  chunkIndex = Number(chunkIndex)
  try {
    const supabase = getSupabaseAdmin()
    const { data: row, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('doc_id', docId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    const envelopeJson = await readEnvelope(docId, row)
    if (!envelopeJson) return JSON.stringify({ ok: false, error: 'not found' })
    const start = chunkIndex * DOC_ARCHIVE_CHUNK
    if (start >= envelopeJson.length) {
      return JSON.stringify({ ok: false, error: 'chunk out of range' })
    }
    return JSON.stringify({
      ok: true,
      data: envelopeJson.substring(start, start + DOC_ARCHIVE_CHUNK),
    })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}

export async function deleteGeneratedDocument([docId]) {
  docId = String(docId || '').trim()
  try {
    const supabase = getSupabaseAdmin()
    const { data: row } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('doc_id', docId)
      .maybeSingle()
    if (row?.drive_file_id) await trashDriveFile(row.drive_file_id)
    await supabase.from('generated_documents').delete().eq('doc_id', docId)
    return JSON.stringify({ ok: true })
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e?.message || e) })
  }
}
