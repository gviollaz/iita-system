// API client for IITA CRM Edge Function
const API = import.meta.env.VITE_API_URL
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL
const SUPA_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function normalizeApiError(rawError) {
  const msg = String(rawError || '').trim()
  if (!msg) return 'Error desconocido de API'
  if (msg.includes('Unknown endpoint or action')) {
    return 'Este módulo no está disponible en la versión actual de la API.'
  }
  if (msg.includes('Could not choose the best candidate function')) {
    return 'La API tiene una ambigüedad de funciones y no puede resolver esta consulta.'
  }
  return msg
}

export async function post(body) {
  if (!API) {
    throw new Error(
      'Falta VITE_API_URL. Configura .env.development o .env.production con la URL de la Edge Function crm-api.'
    )
  }

  console.log('[IITA] POST', body.endpoint || body.action || '?')
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await r.json()
  if (!r.ok) {
    throw new Error(normalizeApiError(j?.error || `Error HTTP ${r.status} al consultar la API`))
  }
  console.log(
    '[IITA] RESP',
    body.endpoint || body.action || '?',
    Array.isArray(j.data) ? 'array(' + j.data.length + ')' : typeof j.data
  )
  if (j.error) throw new Error(normalizeApiError(j.error))
  return j.data
}

export async function rpc(fnName, params = {}) {
  if (!SUPA_URL || !SUPA_KEY) {
    throw new Error('Falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.')
  }
  console.log('[IITA] RPC', fnName, params)
  const r = await fetch(`${SUPA_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
    },
    body: JSON.stringify(params),
  })
  const j = await r.json()
  if (!r.ok) {
    throw new Error(normalizeApiError(j?.message || j?.error || `Error HTTP ${r.status}`))
  }
  console.log('[IITA] RPC RESP', fnName, Array.isArray(j) ? 'rows=' + j.length : typeof j)
  return j
}

export function unwrap(d) {
  if (!d) return []
  if (Array.isArray(d)) {
    if (d.length === 1 && Array.isArray(d[0])) return d[0]
    if (d.length && typeof d[0] === 'object' && !Array.isArray(d[0])) {
      const k = Object.keys(d[0])
      if (k.length === 1 && Array.isArray(d[0][k[0]])) return d[0][k[0]]
    }
    return d
  }
  return [d]
}
