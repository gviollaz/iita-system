import { fmtNum } from '@/lib/utils'

export function MiniLineChart({ data, width = 600, height = 200 }) {
  if (!data || !data.length) return <div style={{ color: 'var(--t3)', textAlign: 'center', padding: 20 }}>Sin datos</div>
  const vals = data.map(d => d.value)
  const maxV = Math.max(...vals, 1)
  const minV = Math.min(...vals, 0)
  const range = maxV - minV || 1
  const pad = { t: 20, r: 20, b: 40, l: 50 }
  const w = width - pad.l - pad.r
  const h = height - pad.t - pad.b
  const pts = data.map((d, i) => ({
    x: pad.l + (i / (data.length - 1 || 1)) * w,
    y: pad.t + h - ((d.value - minV) / range) * h,
    ...d,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area = line + ` L${pts[pts.length - 1].x},${pad.t + h} L${pts[0].x},${pad.t + h} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      <defs>
        <linearGradient id="aG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--ac)" stopOpacity=".3" />
          <stop offset="100%" stopColor="var(--ac)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3, 4, 5].map(i => {
        const y = pad.t + (h / 5) * i
        const val = maxV - ((maxV - minV) / 5) * i
        return (
          <g key={i}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="var(--bdr)" strokeDasharray="3,3" />
            <text x={pad.l - 8} y={y + 4} textAnchor="end" fill="var(--t3)" fontSize="10">{fmtNum(Math.round(val))}</text>
          </g>
        )
      })}
      <path d={area} fill="url(#aG)" />
      <path d={line} fill="none" stroke="var(--ac)" strokeWidth="2" strokeLinejoin="round" />
      {pts.filter((_, i) => i % Math.ceil(data.length / 8) === 0 || i === data.length - 1).map((p, i) => (
        <text key={i} x={p.x} y={pad.t + h + 18} textAnchor="middle" fill="var(--t3)" fontSize="9">{p.label}</text>
      ))}
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--ac)" opacity=".7" />)}
    </svg>
  )
}

export function MiniBarChart({ data }) {
  if (!data || !data.length) return <div style={{ color: 'var(--t3)', textAlign: 'center', padding: 20 }}>Sin datos</div>
  const maxV = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ width: 120, fontSize: 11, color: 'var(--t2)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.label}>
            {d.label}
          </div>
          <div style={{ flex: 1, height: 26, background: 'var(--s2)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
            <div style={{ height: '100%', width: `${(d.value / maxV) * 100}%`, background: d.color || 'var(--ac)', borderRadius: 6 }} />
            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 600, color: 'var(--t1)' }}>
              {fmtNum(d.value)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export function MiniPieChart({ data, size = 170 }) {
  if (!data || !data.length) return null
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const cx = size / 2, cy = size / 2, r = size / 2 - 10
  let angle = -Math.PI / 2
  const colors = ['var(--grn)', 'var(--ylw)', 'var(--blu)', 'var(--ac)', 'var(--red)', '#a29bfe', '#fd79a8']

  const slices = data.map((d, i) => {
    const pct = d.value / total
    const sa = angle
    angle += pct * Math.PI * 2
    const ea = angle
    const lg = pct > 0.5 ? 1 : 0
    return {
      ...d, pct,
      color: d.color || colors[i % colors.length],
      path: `M${cx},${cy} L${cx + r * Math.cos(sa)},${cy + r * Math.sin(sa)} A${r},${r} 0 ${lg} 1 ${cx + r * Math.cos(ea)},${cy + r * Math.sin(ea)} Z`,
    }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={size} height={size}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity=".85" />)}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--t2)' }}>{s.label}</span>
            <span style={{ color: 'var(--t3)', marginLeft: 'auto' }}>{Math.round(s.pct * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
