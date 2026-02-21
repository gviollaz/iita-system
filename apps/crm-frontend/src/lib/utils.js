export function fmtDate(d) {
  if (!d) return ''
  const dt = new Date(d + (String(d).includes('T') || String(d).includes('+') ? '' : 'T00:00:00-03:00'))
  return (
    dt.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' +
    dt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  )
}

export function fmtShort(d) {
  if (!d) return ''
  const dt = new Date(d + (String(d).includes('T') || String(d).includes('+') ? '' : 'T00:00:00-03:00'))
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export function fmtNum(n) {
  if (n == null) return '0'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n)
}

export function fmtMin(m) {
  if (m == null || isNaN(m)) return '-'
  if (m < 60) return m + 'min'
  if (m < 1440) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'
  return Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h'
}

export function todayStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function mediaIcon(t) {
  const x = (t || '').toLowerCase()
  if (['jpeg', 'jpg', 'png', 'gif', 'webp'].includes(x)) return '🖼️'
  if (['mp4', 'mov', 'avi', 'webm'].includes(x)) return '🎬'
  if (['pdf'].includes(x)) return '📄'
  if (['mp3', 'ogg', 'wav', 'aac', 'opus'].includes(x)) return '🎵'
  return '📎'
}

export function isImage(t) {
  return ['jpeg', 'jpg', 'png', 'gif', 'webp'].includes((t || '').toLowerCase())
}

export function isVideo(t) {
  return ['mp4', 'mov', 'avi', 'webm'].includes((t || '').toLowerCase())
}

export function fmtAgo(d) {
  if (!d) return 'nunca'
  const ms = Date.now() - new Date(d).getTime()
  if (ms < 0) return 'ahora'
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `hace ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `hace ${days}d`
  const months = Math.floor(days / 30)
  return `hace ${months}m`
}
