import { useState, useEffect } from 'react'
import { post, unwrap } from '@/lib/api'
import { fmtNum, fmtShort, fmtMin, todayStr } from '@/lib/utils'
import { Card, Btn, Loading, Toast, TabBar, Badge } from '@/components/ui'
import { MiniLineChart, MiniBarChart, MiniPieChart } from '@/components/Charts'
import { useIsMobile } from '@/lib/useIsMobile'

export default function Dashboard() {
  const [dashTab, setDashTab] = useState('overview')
  const isMobile = useIsMobile()
  return (
    <div style={{ padding: isMobile ? 10 : 24, animation: 'fadeIn .3s' }}>
      <TabBar
        tabs={[
          { k: 'overview', l: isMobile ? '📊 Resumen' : '📊 Resumen general' },
          { k: 'analysis', l: isMobile ? '📋 Análisis' : '📋 Análisis por canal' },
        ]}
        active={dashTab}
        onChange={setDashTab}
      />
      {dashTab === 'overview' && <DashOverview isMobile={isMobile} />}
      {dashTab === 'analysis' && <DashAnalysis isMobile={isMobile} />}
    </div>
  )
}

function DashOverview({ isMobile }) {
  const [stats, setStats] = useState(null)
  const [msgs, setMsgs] = useState([])
  const [volCh, setVolCh] = useState([])
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      setLoading(true); setError('')
      try {
        const [s, m, vc, tl] = await Promise.all([
          post({ endpoint: 'stats' }),
          post({ endpoint: 'msgs_per_day', params: { days: 30 } }),
          post({ endpoint: 'volume_by_channel' }),
          post({ endpoint: 'top_leads', params: { limit: 10 } }),
        ])
        const st = Array.isArray(s) ? s[0] : s
        setStats(st?.get_crm_stats || st)
        setMsgs(unwrap(m))
        setVolCh(unwrap(vc))
        setLeads(unwrap(tl))
      } catch (e) { setError(e.message) }
      setLoading(false)
    })()
  }, [])

  if (loading) return <Loading />
  if (error) return <div style={{ padding: 40, color: 'var(--red)' }}>{error}</div>

  const provMap = {}
  ;(volCh || []).forEach(c => {
    const p = (c.provider || 'otro').toLowerCase()
    provMap[p] = (provMap[p] || 0) + (c.total || 0)
  })
  const provData = Object.entries(provMap).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value)
  const provColors = { whatsapp: 'var(--grn)', instagram: 'var(--ylw)', messenger: 'var(--blu)', 'whatsapp cloud api': '#55efc4' }
  provData.forEach(d => { d.color = provColors[d.label] || 'var(--ac)' })
  const chColors = ['var(--ac)', 'var(--grn)', 'var(--ylw)', 'var(--blu)', 'var(--red)', '#a29bfe', '#fd79a8', '#55efc4']

  const kpis = [
    { label: 'Conversaciones', value: fmtNum(stats?.total_conversations), color: 'var(--ac)', bg: 'var(--acBg)' },
    { label: 'Personas', value: fmtNum(stats?.total_persons), color: 'var(--grn)', bg: 'var(--grnBg)' },
    { label: 'Msgs 24h', value: fmtNum(stats?.msgs_24h), color: 'var(--blu)', bg: 'var(--bluBg)' },
    { label: 'Msgs 7d', value: fmtNum(stats?.msgs_7d), color: 'var(--ylw)', bg: 'var(--ylwBg)' },
    { label: 'Sin responder', value: fmtNum(stats?.unanswered), color: 'var(--red)', bg: 'var(--redBg)' },
    { label: 'IA pendiente', value: fmtNum(stats?.ai_pending), color: '#a29bfe', bg: 'rgba(162,155,254,.12)' },
  ]

  return (
    <>
      {/* KPI cards — mobile: 2 columns stacked vertically, desktop: auto-fit row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(155px, 1fr))',
        gap: isMobile ? 10 : 12,
        marginBottom: isMobile ? 16 : 24,
      }}>
        {kpis.map((k, i) => (
          <Card key={i} style={{
            padding: isMobile ? '14px 12px' : 16,
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            gap: isMobile ? 6 : 14,
          }}>
            <div style={{
              fontSize: isMobile ? 28 : 18,
              fontWeight: 800,
              color: k.color,
              lineHeight: 1,
            }}>
              {k.value}
            </div>
            <div style={{
              fontSize: isMobile ? 13 : 12,
              color: 'var(--t2)',
              fontWeight: 500,
            }}>{k.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: isMobile ? 12 : 16, marginBottom: isMobile ? 12 : 20 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Mensajes por día (30d)</div>
          <MiniLineChart data={msgs.map(m => ({ label: fmtShort(m.day), value: (m.msgs_in || 0) + (m.msgs_out || 0) }))} height={isMobile ? 160 : 220} />
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Por proveedor</div>
          <MiniPieChart data={provData} />
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? 12 : 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Volumen por canal</div>
          <MiniBarChart data={(volCh || []).slice(0, 8).map((v, i) => ({ label: v.channel || '?', value: v.total || 0, color: chColors[i % chColors.length] }))} />
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Top leads</div>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Nombre</th><th>Msgs</th><th>Convs</th></tr></thead>
              <tbody>
                {(leads || []).map((l, i) => (
                  <tr key={i}>
                    <td style={{ color: 'var(--t1)', fontWeight: 500 }}>
                      {[l.first_name, l.last_name].filter(Boolean).join(' ') || `Lead #${l.id}`}
                    </td>
                    <td>{l.total_messages || 0}</td>
                    <td>{l.total_conversations || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  )
}

function DashAnalysis({ isMobile }) {
  const [dateFrom, setDateFrom] = useState(todayStr())
  const [dateTo, setDateTo] = useState(todayStr())
  const [branchF, setBranchF] = useState('')
  const [providerF, setProviderF] = useState('')
  const [channelF, setChannelF] = useState('')
  const [branches, setBranches] = useState([])
  const [channels, setChannels] = useState([])
  const [providers, setProviders] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)

  const extractProviders = (channelsData) => {
    const map = new Map()
    ;(channelsData || []).forEach(c => {
      const name = c?.channel_providers?.name || c?.provider || null
      if (!name) return
      const key = String(name).trim().toLowerCase()
      if (!map.has(key)) {
        map.set(key, { id: c?.channel_providers?.id || key, name: String(name).trim() })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  useEffect(() => {
    ;(async () => {
      try {
        const [b, ch] = await Promise.all([
          post({ endpoint: 'branches' }),
          post({ endpoint: 'channels' }),
        ])
        setBranches(b || [])
        setChannels(ch || [])
        setProviders(extractProviders(ch))
      } catch (e) { setError(e.message) }
    })()
  }, [])

  const doAnalysis = async () => {
    setLoading(true); setError('')
    try {
      const dtTo = new Date(dateTo)
      dtTo.setDate(dtTo.getDate() + 1)
      const dateToExcl = dtTo.toISOString().split('T')[0]

      const d = await post({
        endpoint: 'channel_analysis',
        params: {
          date_from: dateFrom,
          date_to: dateToExcl,
          branch_id: branchF || null,
          provider: providerF || null,
          channel_id: channelF || null,
        }
      })
      const data = unwrap(d)
      setRows(data); setLoaded(true)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const filteredCh = providerF ? channels.filter(c => (c.channel_providers?.name || '') === providerF) : channels

  const totals = rows.reduce((a, r) => ({
    msgs_in: a.msgs_in + (r.msgs_in || 0),
    msgs_out: a.msgs_out + (r.msgs_out || 0),
    pending_prev: a.pending_prev + (r.pending_prev || 0),
    ai_responses: a.ai_responses + (r.ai_responses || 0),
    pending_now: a.pending_now + (r.pending_now || 0),
  }), { msgs_in: 0, msgs_out: 0, pending_prev: 0, ai_responses: 0, pending_now: 0 })

  return (
    <>
      <Card style={{ marginBottom: 20, padding: isMobile ? 12 : 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🔍 Filtros de análisis</div>

        {isMobile ? (
          /* Mobile: stacked vertical layout for filters */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Desde</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600, display: 'block', marginBottom: 4 }}>Hasta</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>
            <select value={branchF} onChange={e => setBranchF(e.target.value)} style={{ width: '100%' }}>
              <option value="">Todas las sedes</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={providerF} onChange={e => { setProviderF(e.target.value); setChannelF('') }} style={{ width: '100%' }}>
              <option value="">Todos proveedores</option>
              {providers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
            <select value={channelF} onChange={e => setChannelF(e.target.value)} style={{ width: '100%' }}>
              <option value="">Todos los canales</option>
              {filteredCh.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Btn primary onClick={doAnalysis} style={{ width: '100%', padding: '12px 0', fontSize: 15 }}>Analizar</Btn>
          </div>
        ) : (
          /* Desktop: horizontal row */
          <div className="fr" style={{ marginBottom: 10, gap: 8 }}>
            <div><label style={{ fontSize: 10, color: 'var(--t2)', display: 'block' }}>Desde</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%' }} /></div>
            <div><label style={{ fontSize: 10, color: 'var(--t2)', display: 'block' }}>Hasta</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%' }} /></div>
            <select value={branchF} onChange={e => setBranchF(e.target.value)}><option value="">Todas las sedes</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <select value={providerF} onChange={e => { setProviderF(e.target.value); setChannelF('') }}><option value="">Todos proveedores</option>{providers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select>
            <select value={channelF} onChange={e => setChannelF(e.target.value)}><option value="">Todos los canales</option>{filteredCh.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <Btn primary onClick={doAnalysis}>Analizar</Btn>
          </div>
        )}

        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{error}</div>}
      </Card>

      {loading && <Loading />}
      {loaded && !loading && (
        <>
          {/* Summary KPIs — mobile: 2 cols stacked, desktop: 5 cols */}
          {isMobile ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              marginBottom: 20,
            }}>
              {[
                { label: 'Entrantes', value: totals.msgs_in, color: 'var(--blu)' },
                { label: 'Enviados', value: totals.msgs_out, color: 'var(--grn)' },
                { label: 'Pendientes anteriores', value: totals.pending_prev, color: 'var(--ylw)' },
                { label: 'Respuestas IA', value: totals.ai_responses, color: 'var(--ac)' },
                { label: 'Pendientes ahora', value: totals.pending_now, color: 'var(--red)' },
              ].map((k, i) => (
                <Card key={i} style={{ padding: '14px 12px' }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500 }}>{k.label}</div>
                </Card>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
              <Card style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--blu)' }}>{totals.msgs_in}</div><div style={{ fontSize: 11, color: 'var(--t2)' }}>Entrantes</div></Card>
              <Card style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--grn)' }}>{totals.msgs_out}</div><div style={{ fontSize: 11, color: 'var(--t2)' }}>Enviados</div></Card>
              <Card style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ylw)' }}>{totals.pending_prev}</div><div style={{ fontSize: 11, color: 'var(--t2)' }}>Pend.ant.</div></Card>
              <Card style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ac)' }}>{totals.ai_responses}</div><div style={{ fontSize: 11, color: 'var(--t2)' }}>Resp.IA</div></Card>
              <Card style={{ padding: 14, textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)' }}>{totals.pending_now}</div><div style={{ fontSize: 11, color: 'var(--t2)' }}>Pendientes</div></Card>
            </div>
          )}

          <Card style={{ overflow: 'hidden', padding: isMobile ? 10 : 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Detalle por canal — {dateFrom}{dateFrom !== dateTo ? ` a ${dateTo}` : ''}</div>

            {/* Mobile: card-based layout */}
            {isMobile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {rows.filter(r => r.msgs_in || r.msgs_out || r.pending_prev || r.pending_now).map(r => (
                  <div key={r.channel_id} style={{ background: 'var(--s2)', borderRadius: 10, padding: '14px 12px' }}>
                    {/* Channel header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>{r.channel_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{r.branch_name}</div>
                      </div>
                      <Badge bg={r.provider === 'whatsapp' ? 'var(--grnBg)' : r.provider === 'instagram' ? 'var(--ylwBg)' : 'var(--bluBg)'} color={r.provider === 'whatsapp' ? 'var(--grn)' : r.provider === 'instagram' ? 'var(--ylw)' : 'var(--blu)'}>{r.provider}</Badge>
                    </div>

                    {/* Stats in 2x2 grid with clear labels */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div style={{ background: 'var(--s3)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 2 }}>Entrantes</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--blu)', lineHeight: 1 }}>{r.msgs_in || 0}</div>
                      </div>
                      <div style={{ background: 'var(--s3)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 2 }}>Salientes</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--grn)', lineHeight: 1 }}>{r.msgs_out || 0}</div>
                      </div>
                      <div style={{ background: 'var(--s3)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 2 }}>Resp. IA</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ac)', lineHeight: 1 }}>{r.ai_responses || 0}</div>
                      </div>
                      <div style={{ background: 'var(--s3)', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 600, marginBottom: 2 }}>Pendientes</div>
                        <div style={{ fontSize: 20, fontWeight: 800, color: r.pending_now ? 'var(--red)' : 'var(--grn)', lineHeight: 1 }}>{r.pending_now || 0}</div>
                      </div>
                    </div>

                    {/* Timing info */}
                    {(r.avg_reply_min != null || r.pending_avg_wait_min != null) && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--t2)' }}>
                        {r.avg_reply_min != null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Tiempo de respuesta</span>
                            <span style={{ fontWeight: 600, color: 'var(--t1)' }}>{fmtMin(r.avg_reply_min)}</span>
                          </div>
                        )}
                        {r.pending_avg_wait_min != null && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Espera promedio</span>
                            <span style={{ fontWeight: 600, color: r.pending_avg_wait_min > 1440 ? 'var(--red)' : 'var(--t1)' }}>{fmtMin(r.pending_avg_wait_min)}</span>
                          </div>
                        )}
                        {r.pending_prev > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Pendientes anteriores</span>
                            <span style={{ fontWeight: 600, color: 'var(--ylw)' }}>{r.pending_prev}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {rows.filter(r => r.msgs_in || r.msgs_out || r.pending_prev || r.pending_now).length === 0 && (
                  <div style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>Sin actividad en el período</div>
                )}
              </div>
            ) : (
              /* Desktop: table layout */
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table>
                  <thead><tr>
                    <th>Sede</th><th>Canal</th><th>Proveedor</th>
                    <th style={{ textAlign: 'right' }}>Entr.</th><th style={{ textAlign: 'right' }}>Sal.</th>
                    <th style={{ textAlign: 'right' }}>Pend.ant.</th><th style={{ textAlign: 'right' }}>Resp.IA</th><th style={{ textAlign: 'right' }}>Pend.</th>
                    <th style={{ textAlign: 'right' }}>Resp.prom</th><th style={{ textAlign: 'right' }}>Resp.min</th><th style={{ textAlign: 'right' }}>Resp.max</th>
                    <th style={{ textAlign: 'right' }}>Esp.prom</th><th style={{ textAlign: 'right' }}>Esp.min</th><th style={{ textAlign: 'right' }}>Esp.max</th>
                  </tr></thead>
                  <tbody>
                    {rows.filter(r => r.msgs_in || r.msgs_out || r.pending_prev || r.pending_now).map(r => (
                      <tr key={r.channel_id}>
                        <td style={{ fontWeight: 500, color: 'var(--t1)' }}>{r.branch_name}</td>
                        <td>{r.channel_name}</td>
                        <td><Badge bg={r.provider === 'whatsapp' ? 'var(--grnBg)' : r.provider === 'instagram' ? 'var(--ylwBg)' : 'var(--bluBg)'} color={r.provider === 'whatsapp' ? 'var(--grn)' : r.provider === 'instagram' ? 'var(--ylw)' : 'var(--blu)'}>{r.provider}</Badge></td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--blu)' }}>{r.msgs_in || 0}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--grn)' }}>{r.msgs_out || 0}</td>
                        <td style={{ textAlign: 'right', color: r.pending_prev ? 'var(--ylw)' : 'var(--t3)' }}>{r.pending_prev || 0}</td>
                        <td style={{ textAlign: 'right', color: r.ai_responses ? 'var(--ac)' : 'var(--t3)' }}>{r.ai_responses || 0}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: r.pending_now ? 'var(--red)' : 'var(--grn)' }}>{r.pending_now || 0}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMin(r.avg_reply_min)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--grn)' }}>{fmtMin(r.min_reply_min)}</td>
                        <td style={{ textAlign: 'right', color: r.max_reply_min > 120 ? 'var(--red)' : 'var(--t2)' }}>{fmtMin(r.max_reply_min)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMin(r.pending_avg_wait_min)}</td>
                        <td style={{ textAlign: 'right' }}>{fmtMin(r.pending_min_wait_min)}</td>
                        <td style={{ textAlign: 'right', color: r.pending_max_wait_min > 1440 ? 'var(--red)' : 'var(--t2)' }}>{fmtMin(r.pending_max_wait_min)}</td>
                      </tr>
                    ))}
                    {rows.filter(r => r.msgs_in || r.msgs_out || r.pending_prev || r.pending_now).length === 0 && (
                      <tr><td colSpan={14} style={{ textAlign: 'center', color: 'var(--t3)', padding: 20 }}>Sin actividad en el período</td></tr>
                    )}
                  </tbody>
                  {rows.filter(r => r.msgs_in || r.msgs_out || r.pending_prev || r.pending_now).length > 1 && (
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--ac)' }}>
                        <td colSpan={3} style={{ fontWeight: 700, color: 'var(--t1)' }}>TOTAL</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--blu)' }}>{totals.msgs_in}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--grn)' }}>{totals.msgs_out}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ylw)' }}>{totals.pending_prev}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--ac)' }}>{totals.ai_responses}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>{totals.pending_now}</td>
                        <td colSpan={6}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  )
}
