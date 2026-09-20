import { visitDateYMD } from './date-utils.js'

export function sortRowsByRoom(a, b) {
  const ra = parseInt(String(a.room).replace(/\D/g, ''), 10)
  const rb = parseInt(String(b.room).replace(/\D/g, ''), 10)
  if (!Number.isNaN(ra) && !Number.isNaN(rb) && ra !== rb) return ra - rb
  return String(a.room).localeCompare(String(b.room), 'ja')
}

export function enrichTreatmentRows(records, patients) {
  const enriched = records.map((r) => {
    const p = patients.find((x) => x.id === r.patient_id) || {}
    return {
      patient_id: r.patient_id,
      room: p.room != null ? String(p.room) : '',
      name: p.name || String(r.patient_id),
      treatments: r.treatments || '',
      notes: r.notes || '',
      next_date: r.next_date ? visitDateYMD(r.next_date) : '',
      next_content: r.next_content || '',
      coverage_type: p.coverage_type != null ? String(p.coverage_type).trim() : '',
    }
  })
  enriched.sort(sortRowsByRoom)
  return enriched
}

export function svListRecordExcludedFromCount(treatments) {
  const codes = String(treatments || '')
    .split(/[、,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const exclude = ['ご逝去', '入院中', '退所', '退去']
  return codes.some((c) => exclude.includes(c))
}

export function buildFaxFacilityCommentFallback(rows) {
  if (!rows?.length) {
    return '本日の診療記録はありません。\n（必要に応じて、施設への伝達事項を記入してください。）'
  }
  const lines = [`本日は${rows.length}名の患者に歯科訪問を行いました。`]
  const withNotes = rows.filter((r) => String(r.notes || '').trim())
  if (!withNotes.length) {
    lines.push(
      '\n診療メモに追記がないため、特記の伝達事項はありません。内容をご確認のうえ、必要であれば追記してください。',
    )
    return lines.join('')
  }
  for (const r of withNotes) {
    const nm = String(r.name || '').trim() || '患者'
    const room = String(r.room != null ? r.room : '').trim()
    const head = room ? `${nm} 様（居室 ${room}）について。` : `${nm} 様について。`
    const body = String(r.notes || '')
      .trim()
      .replace(/Ext\b/gi, '抜歯予定')
      .replace(/\bCo\b/g, 'う蝕')
    lines.push(`\n${head}\n${body}`)
  }
  lines.push('\n※上記は診療メモをもとにした簡易下書きです。施設向けの表現に整えてからご利用ください。')
  return lines.join('')
}
