export function formatPersonalSheetMedList(arr) {
  if (!Array.isArray(arr)) return ''
  return arr
    .map((x) => {
      if (typeof x === 'string') return String(x).trim()
      if (x && x.name) {
        let line = String(x.name).trim()
        if (x.cat) line = `[${String(x.cat).trim()}] ${line}`
        if (x.brand) line += `（${String(x.brand).trim()}）`
        return line
      }
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

export function computeAgeFromBirthDate(birthYmd) {
  const s = String(birthYmd || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const parts = s.split('-')
  const y = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  const d = parseInt(parts[2], 10)
  if (!y) return ''
  const now = new Date()
  let age = now.getFullYear() - y
  const md = (now.getMonth() + 1) * 100 + now.getDate()
  const bd = m * 100 + d
  if (bd > md) age--
  return age >= 0 ? String(age) : ''
}

export function formatBirthDateKanji(birthYmd) {
  const s = String(birthYmd || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const p = s.split('-')
  return `${parseInt(p[0], 10)}年${parseInt(p[1], 10)}月${parseInt(p[2], 10)}日`
}

export function formatDateWareki(ymd) {
  const s = String(ymd || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return ''
  const p = s.split('-')
  const y = parseInt(p[0], 10)
  const m = parseInt(p[1], 10)
  const d = parseInt(p[2], 10)
  let era
  let ey
  if (y > 2019 || (y === 2019 && (m > 5 || (m === 5 && d >= 1)))) {
    era = '令和'
    ey = y - 2018
  } else if (y > 1989 || (y === 1989 && (m > 1 || (m === 1 && d >= 8)))) {
    era = '平成'
    ey = y - 1988
  } else if (y >= 1926) {
    if (y === 1926 && (m < 12 || (m === 12 && d < 25))) return ''
    era = '昭和'
    ey = y - 1925
  } else {
    return ''
  }
  return `${era}${ey}年${m}月${d}日`
}

export function formatPersonalSheetBulletBlock(text) {
  if (!text || !String(text).trim()) return ''
  return String(text)
    .split(/\n+/)
    .map((line) => {
      const t = String(line).trim()
      if (!t) return ''
      if (/^[・•\-]/.test(t) || /^\d+\.\s/.test(t)) return t
      return `・${t}`
    })
    .filter(Boolean)
    .join('\n')
}

export function buildPersonalSheetPlanCategoriesHint(records) {
  const sorted = (records || []).slice().sort((a, b) =>
    String(b.visit_date || '').localeCompare(String(a.visit_date || '')),
  )
  for (const r of sorted) {
    const tones = String(r.notes_tones || '').trim()
    if (tones) return tones
  }
  return ''
}

export function buildPersonalSheetTreatmentPlanHint(records) {
  const lines = []
  const sorted = (records || []).slice().sort((a, b) =>
    String(a.visit_date || '').localeCompare(String(b.visit_date || '')),
  )
  for (const r of sorted) {
    const tr = String(r.treatments || '').trim()
    const nx = String(r.next_content || '').trim()
    const nd = String(r.next_date || '').trim().slice(0, 10)
    if (tr) lines.push(`・${tr}`)
    if (nx) lines.push(`・次回予定${nd ? `（${nd}）` : ''}：${nx}`)
  }
  return lines.join('\n')
}
