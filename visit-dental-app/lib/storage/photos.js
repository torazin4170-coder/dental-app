import { nowJstTimestamp } from '../date-utils.js'
import { loadFacilities, loadPatientById } from '../db-loaders.js'
import { getSupabaseAdmin } from '../supabase-admin.js'
import {
  getOrCreateChildFolder,
  getVisitDentalPhotoRootFolderId,
  photoWebAppViewUrl,
  trashDriveFile,
  uploadJpegToFolder,
  downloadDriveFileBytes,
} from './drive-client.js'

const INLINE_PHOTO_MAX_BYTES = 2.5 * 1024 * 1024

function buildUniquePhotoDriveFileName(patientId, filename) {
  const pid = String(patientId || '').trim().replace(/[\\/:*?"<>|]+/g, '_')
  if (!pid) throw new Error('patientId が空です')
  let fn = String(filename || 'photo.jpg').trim().replace(/[\\/:*?"<>|]+/g, '_')
  if (!/\.\w{2,4}$/i.test(fn)) fn += '.jpg'
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const p = (n) => String(n).padStart(2, '0')
  const stamp =
    jst.getFullYear() +
    p(jst.getMonth() + 1) +
    p(jst.getDate()) +
    p(jst.getHours()) +
    p(jst.getMinutes()) +
    p(jst.getSeconds())
  return `${pid}_${stamp}_${fn}`
}

async function getPhotoSaveFolderForPatientId(rootFolderId, patientId) {
  const p = await loadPatientById(patientId)
  if (!p?.fac) return rootFolderId
  const facilities = await loadFacilities()
  const fac = facilities.find((f) => String(f.id) === String(p.fac))
  if (!fac) return rootFolderId
  const label = String(fac.name || fac.short || '').trim()
  if (!label) return rootFolderId
  return getOrCreateChildFolder(rootFolderId, label)
}

export async function savePhoto([patientId, base64Data, filename, category, dateTaken]) {
  const root = await getVisitDentalPhotoRootFolderId()
  const folder = await getPhotoSaveFolderForPatientId(root, patientId)
  const driveName = buildUniquePhotoDriveFileName(patientId, filename)
  const fileId = await uploadJpegToFolder(folder, driveName, base64Data)
  const viewUrl = photoWebAppViewUrl(fileId)
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('photos').insert({
    patient_id: String(patientId),
    drive_file_id: fileId,
    file_url: viewUrl,
    filename: filename || 'photo.jpg',
    category: category || '',
    date_taken: dateTaken || '',
    uploaded_at: nowJstTimestamp(),
  })
  if (error) throw new Error(error.message)
  return JSON.stringify({ fileId, url: viewUrl })
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
        /* leave empty */
      }
    }
    list.push(item)
  }
  return JSON.stringify(list)
}

export async function deletePhoto([fileId]) {
  const fid = String(fileId || '').trim()
  await trashDriveFile(fid)
  const supabase = getSupabaseAdmin()
  await supabase.from('photos').delete().eq('drive_file_id', fid)
  return 'ok'
}
