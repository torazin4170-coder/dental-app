/**
 * RPC 実装数の静的確認（54 件の allowlist と照合）
 */
import { IMPLEMENTED_RPC } from '../lib/rpc-handlers.js'

const EXPECTED = [
  'getInitData',
  'getPatients',
  'addPatient',
  'updatePatient',
  'updatePatientStatus',
  'deletePatient',
  'getFacilities',
  'addFacility',
  'updateFacility',
  'deleteFacility',
  'getTreatmentsByPatient',
  'getMonthlyRecords',
  'saveTreatmentRecord',
  'saveTreatmentRecordBundle',
  'updateTreatmentRecord',
  'deleteTreatmentRecord',
  'getPatientMonthlyReportData',
  'getFacilityMonthlyCareReportData',
  'getFacilityClinicalMonthlyReportData',
  'getPatientPersonalSheetData',
  'getTeethData',
  'saveTeethData',
  'getTeethDataHistory',
  'getFacilityDailyReportData',
  'getFaxDailyBatchData',
  'getSupervisorDailyListData',
  'getTreatmentsForFacilityDate',
  'getOfpiFormData',
  'appendFaxStyleMemory',
  'generateFaxDailyFacilityComment',
  'getDashboardData',
  'getMedicalInfo',
  'saveMedicalInfo',
  'getCustomMasterItems',
  'addCustomMasterItem',
  'savePhoto',
  'getPhotos',
  'deletePhoto',
  'getSettings',
  'saveSettings',
  'saveReportPreviewDraftSimple',
  'saveReportPreviewDraftChunk',
  'saveReportPreviewDraftChunkFinish',
  'loadReportPreviewDraftInfo',
  'loadReportPreviewDraftChunk',
  'clearReportPreviewDraft',
  'saveGeneratedDocumentSimple',
  'saveGeneratedDocumentChunk',
  'saveGeneratedDocumentChunkFinish',
  'listGeneratedDocuments',
  'loadGeneratedDocument',
  'loadGeneratedDocumentChunk',
  'deleteGeneratedDocument',
  'getDiagnosisCertificateData',
]

const missing = EXPECTED.filter((n) => !IMPLEMENTED_RPC.has(n))
const extra = [...IMPLEMENTED_RPC].filter((n) => !EXPECTED.includes(n))

console.log(`IMPLEMENTED_RPC = ${IMPLEMENTED_RPC.size}`)
console.log(`EXPECTED = ${EXPECTED.length}`)
if (missing.length) {
  console.error('MISSING:', missing.join(', '))
  process.exit(1)
}
if (extra.length) {
  console.warn('EXTRA (ok):', extra.join(', '))
}
console.log('OK: GAS allowlist 54 RPC すべて実装済み')
