/** GAS Main.gs の visitDateYMD_ / formatTimeValueForClient_ 互換 */

export function visitDateYMD(vd) {
  if (vd == null || vd === '') return ''
  if (vd instanceof Date && !Number.isNaN(vd.getTime())) {
    return formatJstYmd(vd)
  }
  const s = String(vd).trim()
  let m = s.match(/^(\d{4})[-/.／](\d{1,2})[-/.／](\d{1,2})/)
  if (m) {
    return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`
  }
  m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : ''
}

export function visitDateYM(vd) {
  const ymd = visitDateYMD(vd)
  return ymd.length >= 7 ? ymd.slice(0, 7) : ''
}

export function formatTimeValueForClient(v) {
  if (v == null || v === '') return ''
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return formatJstHm(v)
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2}):(\d{2})/)
  if (m) {
    const h = parseInt(m[1], 10)
    const mi = parseInt(m[2], 10)
    if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
      return `${pad2(h)}:${pad2(mi)}`
    }
  }
  return s.length >= 5 ? s.slice(0, 5) : s
}

export function normalizeTreatmentTimesForClient(t) {
  const o = { ...t }
  o.visit_time_start = formatTimeValueForClient(t.visit_time_start)
  o.visit_time_end = formatTimeValueForClient(t.visit_time_end)
  const vd = visitDateYMD(t.visit_date)
  if (vd) o.visit_date = vd
  if (t.next_date != null && String(t.next_date).trim() !== '') {
    const nd = visitDateYMD(t.next_date)
    if (nd) o.next_date = nd
  }
  return o
}

export function treatmentVisitSlotKey(visitDate, visitTimeStart) {
  const d = visitDateYMD(visitDate) || ''
  const t = formatTimeValueForClient(visitTimeStart) || ''
  return `${d}\t${t}`
}

export function newIdJst(prefix) {
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const p = (n) => String(n).padStart(2, '0')
  const stamp =
    jst.getFullYear() +
    p(jst.getMonth() + 1) +
    p(jst.getDate()) +
    p(jst.getHours()) +
    p(jst.getMinutes()) +
    p(jst.getSeconds()) +
    String(Math.floor(Math.random() * 100)).padStart(2, '0')
  return prefix + stamp
}

function pad2(n) {
  const x = parseInt(String(n), 10)
  return x < 10 ? `0${x}` : String(x)
}

function formatJstYmd(d) {
  const jst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const p = (n) => String(n).padStart(2, '0')
  return `${jst.getFullYear()}-${p(jst.getMonth() + 1)}-${p(jst.getDate())}`
}

function formatJstHm(d) {
  const jst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const p = (n) => String(n).padStart(2, '0')
  return `${p(jst.getHours())}:${p(jst.getMinutes())}`
}

export function nowJstTimestamp() {
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const p = (n) => String(n).padStart(2, '0')
  return `${jst.getFullYear()}-${p(jst.getMonth() + 1)}-${p(jst.getDate())} ${p(jst.getHours())}:${p(jst.getMinutes())}`
}
