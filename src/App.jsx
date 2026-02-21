import { useEffect, useState } from 'react'
import { ErrorBoundary } from '@/components/ui'
import { useIsMobile } from '@/lib/useIsMobile'
import Dashboard from '@/pages/Dashboard'
import Conversations from '@/pages/Conversations'
import People from '@/pages/People'
import Courses from '@/pages/Courses'
import Health from '@/pages/Health'

const APP_ENV = import.meta.env.VITE_APP_ENV || 'development'
const API_URL = import.meta.env.VITE_API_URL

const sections = [
  { k: 'dashboard', l: '📊 Dashboard', short: '📊' },
  { k: 'conversations', l: '💬 Conversaciones', short: '💬' },
  { k: 'people', l: '👥 Personas', short: '👥' },
  { k: 'courses', l: '📚 Cursos', short: '📚' },
  { k: 'health', l: '🚦 Canales', short: '🚦' },
]

export default function App() {
  const [section, setSection] = useState('dashboard')
  const [connState, setConnState] = useState('checking')
  const [connMsg, setConnMsg] = useState('Verificando...')
  const isMobile = useIsMobile()

  useEffect(() => {
    let mounted = true

    const checkConnection = async () => {
      if (!API_URL) {
        if (!mounted) return
        setConnState('offline')
        setConnMsg('Sin VITE_API_URL')
        return
      }

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)
        const r = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: 'branches' }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        const j = await r.json()

        if (!mounted) return
        if (r.ok && !j?.error) {
          setConnState('online')
          setConnMsg('Conectado')
        } else {
          setConnState('offline')
          setConnMsg(j?.error || `Error HTTP ${r.status}`)
        }
      } catch (e) {
        if (!mounted) return
        setConnState('offline')
        setConnMsg(e?.name === 'AbortError' ? 'Timeout de conexión' : 'Sin conexión API')
      }
    }

    checkConnection()
    const id = setInterval(checkConnection, 60000)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [])

  const connColor = connState === 'online' ? 'var(--grn)' : connState === 'checking' ? 'var(--ylw)' : 'var(--red)'
  const connBg = connState === 'online' ? 'var(--grnBg)' : connState === 'checking' ? 'var(--ylwBg)' : 'var(--redBg)'
  const connLabel = connState === 'online' ? 'API OK' : connState === 'checking' ? '...' : 'API OFF'

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <nav style={{
        height: isMobile ? 48 : 56,
        background: 'var(--s1)',
        borderBottom: '1px solid var(--bdr)',
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 10px' : '0 20px',
        gap: isMobile ? 4 : 8,
        flexShrink: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          fontWeight: 800,
          fontSize: isMobile ? 15 : 18,
          color: 'var(--ac)',
          marginRight: isMobile ? 8 : 28,
          letterSpacing: -.5,
          flexShrink: 0,
        }}>
          IITA
        </div>

        {/* Nav buttons - scrollable on mobile */}
        <div style={{
          display: 'flex',
          gap: isMobile ? 3 : 8,
          flex: 1,
          overflow: 'auto',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}>
          {sections.map(n => (
            <button key={n.k} onClick={() => setSection(n.k)} style={{
              padding: isMobile ? '6px 10px' : '8px 18px',
              borderRadius: 8,
              border: 'none',
              fontSize: isMobile ? 11 : 13,
              fontWeight: 600,
              background: section === n.k ? 'var(--ac)' : 'transparent',
              color: section === n.k ? '#fff' : 'var(--t3)',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {isMobile ? n.short : n.l}
            </button>
          ))}
        </div>

        {/* Status pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 10, flexShrink: 0 }}>
          <div
            title={connMsg}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: isMobile ? '3px 6px' : '4px 10px',
              borderRadius: 999,
              background: connBg,
              color: connColor,
              border: `1px solid ${connColor}`,
              fontSize: isMobile ? 9 : 11,
              fontWeight: 700,
              letterSpacing: .2,
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: connColor, boxShadow: `0 0 8px ${connColor}`,
            }} />
            {connLabel}
          </div>
          {!isMobile && (
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>
              v4 · {APP_ENV}
            </div>
          )}
        </div>
      </nav>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {section === 'dashboard' && <ErrorBoundary><Dashboard /></ErrorBoundary>}
        {section === 'conversations' && <ErrorBoundary><Conversations /></ErrorBoundary>}
        {section === 'people' && <ErrorBoundary><People /></ErrorBoundary>}
        {section === 'courses' && <ErrorBoundary><Courses /></ErrorBoundary>}
        {section === 'health' && <ErrorBoundary><Health /></ErrorBoundary>}
      </div>
    </div>
  )
}
