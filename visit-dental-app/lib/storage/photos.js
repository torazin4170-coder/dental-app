import { nowJstTimestamp } from '../date-utils.js'
import { callGasRpc, normalizeGasWebAppUrl } from '../gas-http.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import {
  photoWebAppViewUrl,
  trashDriveFile,
  downloadDriveFileBytes,
} from './drive-client.js'

const INLINE_PHOTO_MAX_BYTES = 2.5 * 1024 * 1024

/**
 * 写真ファイルの実体は「あなた本人の Google」（GAS / DriveApp）経由で保存する。
 * サービスアカウントは個人 Drive に容量がなく新規作成できないため使わない。
 * メタデータのみ Supabase photos に残す。
 */
async function savePhotoFileAsUser(patientId, base64Data, filename, category, dateTaken) {
  const normalized = normalizeGasWebAppUrl(process.env.GAS_WEBAPP_URL || '')
  if (normalized.error) {
    throw new Error(
      '写真の保存には GAS_WEBAPP_URL（従来どおりあなたの Google 経由）が必要です。' +
        normalized.error,
    )
  }
  const out = await callGasRpc(normalized.url, 'savePhoto', [
    String(patientId),
    String(base64Data),
    filename || 'photo.jpg',
    category || '',
    dateTaken || '',
  ])
  if (!out.ok) {
    throw new Error(out.error || '写真の Drive 保存に失敗しました')
  }
  let parsed = out.result
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      throw new Error('写真の Drive 保存応答が不正です')
    }
  }
  const fileId = String(parsed?.fileId || parsed?.file_id || '').trim()
  if (!fileId) throw new Error('写真の Drive 保存応答に fileId がありません')
  const url = String(parsed?.url || '').trim() || photoWebAppViewUrl(fileId)
  return { fileId, url }
}

async function trashPhotoFileAsUser(fileId) {
  const fid = String(fileId || '').trim()
  if (!fid) return
  const normalized = normalizeGasWebAppUrl(process.env.GAS_WEBAPP_URL || '')
  if (!normalized.error) {
    const out = await callGasRpc(normalized.url, 'deletePhoto', [fid])
    if (out.ok) return
    /* GAS 失敗時は SA 削除を試す（既存共有ファイル向け） */
  }
  await trashDriveFile(fid)
}

export async function savePhoto([patientId, base64Data, filename, category, dateTaken]) {
  const { fileId, url } = await savePhotoFileAsUser(
    patientId,
    base64Data,
    filename,
    category,
    dateTaken,
  )
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('photos').insert({
    patient_id: String(patientId),
    drive_file_id: fileId,
    file_url: url,
    filename: filename || 'photo.jpg',
    category: category || '',
    date_taken: dateTaken || '',
    uploaded_at: nowJstTimestamp(),
  })
  if (error) throw new Error(error.message)
  return JSON.stringify({ fileId, url })
}

export async function getPhotos([patientId, includeInline]) {
  const pid = String(patientId || '').trim()
  const wantInline = includeInline === true || String(includeInline) === 'true'
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('patient_id', pid)
    .order('id', { ascending: false })
  if (error) throw new Error(error.message)
  const list = []
  for (const r of data || []) {
    const fid = String(r.drive_file_id || '').trim()
    const item = {
      patient_id: r.patient_id,
      file_id: fid,
      fileId: fid,
      file_url: fid ? photoWebAppViewUrl(fid) : r.file_url || '',
      filename: r.filename || '',
      category: r.category || '',
      dateTaken: r.date_taken || '',
      date_taken: r.date_taken || '',
      uploadedAt: r.uploaded_at || '',
      uploaded_at: r.uploaded_at || '',
      inline_data_url: '',
    }
    if (wantInline && fid) {
      try {
        const { bytes, mime, size } = await downloadDriveFileBytes(fid)
        if (size > 0 && size <= INLINE_PHOTO_MAX_BYTES && String(mime).startsWith('image/')) {
          item.inline_data_url = `data:${mime};base64,${bytes.toString('base64')}`
        }
      } catch {
        /* leave empty — 画面は file_url（リンク共有）で表示 */
      }
    }
    list.push(item)
  }
  return JSON.stringify(list)
}

export async function deletePhoto([fileId]) {
  const fid = String(fileId || '').trim()
  await trashPhotoFileAsUser(fid)
  const supabase = getSupabaseAdmin()
  await supabase.from('photos').delete().eq('drive_file_id', fid)
  return 'ok'
}
