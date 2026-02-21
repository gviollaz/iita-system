import { useState, useEffect, useRef } from 'react'
import { post, unwrap } from '@/lib/api'
import { fmtAgo, fmtShort, fmtNum } from '@/lib/utils'
import { Card, Badge, Loading } from '@/components/ui'
import { MiniLineChart } from '@/components/Charts'
import { useIsMobile } from '@/lib/useIsMobile'

const PROVIDER_ICONS = {
  'WhatsApp': '📱', 'WhatsApp Cloud API': '🤖',
  'Instagram': '📸', 'Messenger': '💬', 'Email': '📧',
}
const HEALTH = {
  green:  { color: 'var(--grn)', bg: 'var(--grnBg)', label: 'Activo',        icon: '🟢' },
  yellow: { color: 'var(--ylw)', bg: 'var(--ylwBg)', label: 'Inactivo >24h', icon: '🟡' },
  red:    { color: 'var(--red)', bg: 'var(--redBg)', label: 'Offline >7d',   icon: '🔴' },
}

function HealthDot({ health, size = 8 }) {
  const h = HEALTH[health] || HEALTH.red
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      background: h.color, boxShadow: `0 0 8px ${h.color}`, flexShrink: 0,
    }} />
  )
}

function StatBox({ label, valueIn, valueOut, compact }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: compact ? '2px 6px' : '4px 8px',
      background: 'var(--s2)', borderRadius: 6, minWidth: compact ? 50 : 60,
    }}>
      <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>
        <span style={{ color: 'var(--grn)' }}>{fmtNum(valueIn)}</span>
        <span style={{ color: 'var(--t3)', margin: '0 2px' }}>/</span>
        <span style={{ color: 'var(--blu)' }}>{fmtNum(valueOut)}</span>
      </div>
    </div>
  )
}

function TimestampRow({ label, arrow, ts, health }) {
  const isOld = ts && (Date.now() - new Date(ts).getTime()) > 7 * 24 * 3600000
  const isStale = ts && (Date.now() - new Date(ts).getTime()) > 24 * 3600000
  const color = !ts ? 'var(--red)' : isOld ? 'var(--red)' : isStale ? 'var(--ylw)' : 'var(--t2)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
      <span style={{ color: 'var(--t3)', width: 10 }}>{arrow}</span>
      <span style={{ color: 'var(--t3)', minWidth: 28 }}>{label}:</span>
      <span style={{ color, fontWeight: 600 }}>{fmtAgo(ts)}</span>
    </div>
  )
}

function ChannelCard({ ch, isMobile }) {
  const h = HEALTH[ch.health] || HEALTH.red
  const trend = ch.daily_trend || []
  const sparkData = trend.map(d => ({
    label: fmtShort(d.day),
    value: (d.msgs_in || 0) + (d.msgs_out || 0),
  }))

  return (
    <Card style={{
      padding: isMobile ? 12 : 16,
      border: `1px solid ${h.color}33`,
      borderLeft: `4px solid ${h.color}`,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HealthDot health={ch.health} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ch.channel_name}
          </div>
        </div>
        <Badge bg={`${h.color}22`} color={h.color}>{h.label}</Badge>
      </div>

      {/* Provider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--t3)' }}>
        <span>{PROVIDER_ICONS[ch.provider] || '📡'}</span>
        <span>{ch.provider}</span>
      </div>

      {/* Timestamps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TimestampRow label="Ent" arrow="↓" ts={ch.last_incoming} />
        <TimestampRow label="Sal" arrow="↑" ts={ch.last_outgoing} />
      </div>

      {/* Sparkline */}
      {sparkData.length > 0 && (
        <div style={{ margin: '4px 0' }}>
          <MiniLineChart data={sparkData} height={isMobile ? 80 : 100} width={300} />
        </div>
      )}

      {/* Volume stats */}
      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
        <StatBox label="24h" valueIn={ch.msgs_in_24h} valueOut={ch.msgs_out_24h} compact={isMobile} />
        <StatBox label="7d" valueIn={ch.msgs_in_7d} valueOut={ch.msgs_out_7d} compact={isMobile} />
        <StatBox label="30d" valueIn={ch.msgs_in_30d} valueOut={ch.msgs_out_30d} compact={isMobile} />
      </div>
    </Card>
  )
}

export default function Health() {
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState(null)
  const isMobile = useIsMobile()
  const intervalRef = useRef(null)

  const loadHealth = async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const d = await post({ endpoint: 'channel_health' })
      const arr = Array.isArray(d) ? d : unwrap(d)
      setChannels(Array.isArray(arr) ? arr : [])
      setLastRefresh(new Date())
    } catch (e) { setError(e.message) }
    if (!silent) setLoading(false)
  }

  useEffect(() => {
    loadHealth()
    intervalRef.current = setInterval(() => loadHealth(true), 5 * 60 * 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  // Group by branch
  const branches = {}
  channels.forEach(ch => {
    const bk = ch.branch_name || 'Sin sede'
    if (!branches[bk]) branches[bk] = []
    branches[bk].push(ch)
  })

  // Aggregate counts
  const counts = { green: 0, yellow: 0, red: 0 }
  channels.forEach(ch => { counts[ch.health] = (counts[ch.health] || 0) + 1 })

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Loading /></div>
  if (error) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--red)' }}>
      Error: {error}
      <br />
      <button onClick={() => loadHealth()} style={{ marginTop: 12, padding: '6px 16px', borderRadius: 8, border: '1px solid var(--bdr)', background: 'var(--s2)', color: 'var(--t1)', cursor: 'pointer' }}>
        Reintentar
      </button>
    </div>
  )

  return (
    <div style={{ padding: isMobile ? 12 : 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Summary KPIs */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: isMobile ? 8 : 16, flexWrap: 'wrap',
        marginBottom: isMobile ? 16 : 24,
        padding: isMobile ? 10 : 16,
        background: 'var(--s1)', borderRadius: 12,
        border: '1px solid var(--bdr)',
      }}>
        <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 15, color: 'var(--t1)' }}>
          {channels.length} Canales
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 8 : 12 }}>
          {[
            { k: 'green', label: 'Activos' },
            { k: 'yellow', label: 'Inactivos' },
            { k: 'red', label: 'Offline' },
          ].map(s => (
            <div key={s.k} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 999,
              background: HEALTH[s.k].bg,
              border: `1px solid ${HEALTH[s.k].color}`,
              fontSize: isMobile ? 11 : 12, fontWeight: 700,
              color: HEALTH[s.k].color,
            }}>
              <HealthDot health={s.k} size={6} />
              {counts[s.k]} {s.label}
            </div>
          ))}
        </div>
        {lastRefresh && (
          <div style={{ fontSize: 10, color: 'var(--t3)' }}>
            Auto-refresh 5min · {fmtAgo(lastRefresh.toISOString())}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, fontSize: 10, color: 'var(--t3)', justifyContent: 'center' }}>
        <span><span style={{ color: 'var(--grn)', fontWeight: 700 }}>Ent</span> = entrantes</span>
        <span><span style={{ color: 'var(--blu)', fontWeight: 700 }}>Sal</span> = salientes</span>
        <span>Formato: ent/sal</span>
      </div>

      {/* Branches */}
      {Object.entries(branches).map(([branchName, branchChannels]) => (
        <div key={branchName} style={{ marginBottom: isMobile ? 20 : 32 }}>
          {/* Branch header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: isMobile ? 8 : 12,
            paddingBottom: 8,
            borderBottom: '1px solid var(--bdr)',
          }}>
            <span style={{ fontSize: 16 }}>🏢</span>
            <span style={{ fontWeight: 700, fontSize: isMobile ? 14 : 16, color: 'var(--t1)' }}>
              {branchName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>
              ({branchChannels.length} canales)
            </span>
          </div>

          {/* Channel cards grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: isMobile ? 10 : 16,
          }}>
            {branchChannels.map(ch => (
              <ChannelCard key={ch.channel_id} ch={ch} isMobile={isMobile} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
