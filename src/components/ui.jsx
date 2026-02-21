import React from 'react'

export const Badge = ({ bg, color, children }) => (
  <span style={{
    display: 'inline-block', padding: '3px 10px', borderRadius: 20,
    fontSize: 11, fontWeight: 600, background: bg, color, lineHeight: '18px'
  }}>
    {children}
  </span>
)

export const Card = ({ children, style }) => (
  <div style={{
    background: 'var(--s1)', border: '1px solid var(--bdr)',
    borderRadius: 12, padding: 20, ...style
  }}>
    {children}
  </div>
)

export const Btn = ({ primary, small, children, ...p }) => (
  <button {...p} style={{
    padding: small ? '6px 14px' : '10px 20px', borderRadius: 8,
    border: primary ? 'none' : '1px solid var(--bdr)',
    background: primary ? 'var(--ac)' : 'var(--s2)',
    color: primary ? '#fff' : 'var(--t2)',
    fontSize: small ? 12 : 13, fontWeight: 600, ...(p.style || {}),
  }}>
    {children}
  </button>
)

export const Loading = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
    <div className="spinner" />
  </div>
)

export const Toast = ({ msg, type }) =>
  msg ? <div className={`toast toast-${type || 'ok'}`}>{msg}</div> : null

export const TabBar = ({ tabs, active, onChange }) => (
  <div style={{ display: 'flex', gap: 4, padding: '4px', background: 'var(--s2)', borderRadius: 10, marginBottom: 16 }}>
    {tabs.map(t => (
      <button key={t.k} onClick={() => onChange(t.k)} style={{
        padding: '8px 16px', borderRadius: 8, border: 'none',
        background: active === t.k ? 'var(--ac)' : 'transparent',
        color: active === t.k ? '#fff' : 'var(--t3)',
        fontSize: 12, fontWeight: 600, flex: 1,
      }}>
        {t.l}
      </button>
    ))}
  </div>
)

export class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p)
    this.state = { err: null }
  }
  static getDerivedStateFromError(e) {
    return { err: e }
  }
  componentDidCatch(e, i) {
    console.error('IITA Error:', e, i)
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 40, color: '#ff6b6b' }}>
          Error: {this.state.err.message}
          <button
            onClick={() => this.setState({ err: null })}
            style={{
              marginLeft: 12, padding: '6px 12px', background: '#262830',
              border: '1px solid #2a2d38', color: '#e8eaed', borderRadius: 8, cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
