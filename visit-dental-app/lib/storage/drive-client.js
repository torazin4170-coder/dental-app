/**
 * Google Drive API client (service account) — 補助用。
 * 写真の新規アップロードは photos.js が GAS（ユーザー本人）経由で行う。
 * 個人 Google ではサービスアカウントに容量がなく create が失敗するため。
 * Env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON  … service account JSON (stringified)
 *   GOOGLE_DRIVE_PHOTO_FOLDER_ID … optional root folder id for 訪問歯科_写真
 */

import { google } from 'googleapis'

const PHOTO_ROOT_NAME = '訪問歯科_写真'
const DOC_ARCHIVE_FOLDER_NAME = '訪問歯科_書類アーカイブ'

let driveCached = null

export function getDriveClient() {
  if (driveCached) return driveCached
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim()
  if (!raw) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON が未設定です。写真・確定保存には Google サービスアカウントが必要です。',
    )
  }
  let creds
  try {
    creds = JSON.parse(raw)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON の JSON 形式が不正です。')
  }
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })
  driveCached = google.drive({ version: 'v3', auth })
  return driveCached
}

export function photoWebAppViewUrl(fileId) {
  const id = String(fileId || '').trim()
  if (!id) return ''
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`
}

async function findOrCreateFolderByName(drive, name, parentId) {
  const qParts = [
    `name = '${String(name).replace(/'/g, "\\'")}'`,
    `mimeType = 'application/vnd.google-apps.folder'`,
    'trashed = false',
  ]
  if (parentId) qParts.push(`'${parentId}' in parents`)
  const list = await drive.files.list({
    q: qParts.join(' and '),
    fields: 'files(id, name)',
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  if (list.data.files?.length) return list.data.files[0].id
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  return created.data.id
}

export async function getVisitDentalPhotoRootFolderId() {
  const envId = String(process.env.GOOGLE_DRIVE_PHOTO_FOLDER_ID || '').trim()
  if (envId) return envId
  const drive = getDriveClient()
  return findOrCreateFolderByName(drive, PHOTO_ROOT_NAME, null)
}

export async function getOrCreateChildFolder(parentId, folderName) {
  const n = String(folderName || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!n) return parentId
  const drive = getDriveClient()
  return findOrCreateFolderByName(drive, n.slice(0, 200), parentId)
}

export async function uploadJpegToFolder(folderId, fileName, base64Data) {
  const drive = getDriveClient()
  const buffer = Buffer.from(String(base64Data), 'base64')
  const { Readable } = await import('node:stream')
  const stream = Readable.from(buffer)
  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: 'image/jpeg',
      body: stream,
    },
    fields: 'id',
    supportsAllDrives: true,
  })
  const fileId = created.data.id
  try {
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    })
  } catch {
    /* sharing may fail on shared drives with different policy */
  }
  return fileId
}

export async function trashDriveFile(fileId) {
  const id = String(fileId || '').trim()
  if (!id) return
  const drive = getDriveClient()
  try {
    await drive.files.update({
      fileId: id,
      requestBody: { trashed: true },
      supportsAllDrives: true,
    })
  } catch {
    /* ignore */
  }
}

export async function downloadDriveFileBytes(fileId) {
  const drive = getDriveClient()
  const meta = await drive.files.get({
    fileId,
    fields: 'size, mimeType',
    supportsAllDrives: true,
  })
  const size = Number(meta.data.size || 0)
  const mime = meta.data.mimeType || 'image/jpeg'
  const res = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  )
  return { bytes: Buffer.from(res.data), mime, size }
}

export async function getDocArchiveFolderId() {
  const envId = String(process.env.GOOGLE_DRIVE_DOC_FOLDER_ID || '').trim()
  if (envId) return envId
  const drive = getDriveClient()
  return findOrCreateFolderByName(drive, DOC_ARCHIVE_FOLDER_NAME, null)
}

export async function writeJsonToDriveFolder(folderId, fileName, jsonText) {
  const drive = getDriveClient()
  const list = await drive.files.list({
    q: `name = '${String(fileName).replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    fields: 'files(id)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  for (const f of list.data.files || []) {
    await trashDriveFile(f.id)
  }
  const { Readable } = await import('node:stream')
  const stream = Readable.from(Buffer.from(String(jsonText), 'utf8'))
  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/json',
    },
    media: { mimeType: 'application/json', body: stream },
    fields: 'id',
    supportsAllDrives: true,
  })
  return created.data.id
}

export async function readJsonFromDriveByName(folderId, fileName) {
  const drive = getDriveClient()
  const list = await drive.files.list({
    q: `name = '${String(fileName).replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed = false`,
    fields: 'files(id)',
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  const id = list.data.files?.[0]?.id
  if (!id) return null
  const res = await drive.files.get(
    { fileId: id, alt: 'media', supportsAllDrives: true },
    { responseType: 'text' },
  )
  return String(res.data || '')
}

export function resetDriveClientForTests() {
  driveCached = null
}
