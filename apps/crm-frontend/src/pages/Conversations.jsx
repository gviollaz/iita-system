import { useState, useEffect, useCallback, useRef } from 'react'
import { post, rpc, unwrap } from '@/lib/api'
import { fmtDate, fmtShort, isImage, isVideo, mediaIcon } from '@/lib/utils'
import { Badge, Btn, Loading } from '@/components/ui'
import { Lightbox } from '@/components/Lightbox'
import { useIsMobile } from '@/lib/useIsMobile'

const PAGE_SIZE = 100

export default function Conversations() {
  const isMobile = useIsMobile()
  const [convos, setConvos] = useState([])
  const [branches, setBranches] = useState([])
  const [channels, setChannels] = useState([])
  const [providers, setProviders] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [branchF, setBranchF] = useState('')
  const [providerF, setProviderF] = useState('')
  const [channelF, setChannelF] = useState('')
  const [statusF, setStatusF] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState(null)
  const [chatData, setChatData] = useState(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [editingAi, setEditingAi] = useState(null)
  const [editAiText, setEditAiText] = useState('')
  const [aiSaving, setAiSaving] = useState(false)
  const aiSavingRef = useRef(false) // Sync guard — prevents double-click race condition
  const chatEndRef = useRef(null)
  const listRef = useRef(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [inited, setInited] = useState(false)
  const [personPanel, setPersonPanel] = useState(false)
  const [personEdit, setPersonEdit] = useState(null)
  const [personSaving, setPersonSaving] = useState(false)
  const [personToast, setPersonToast] = useState('')

  const [msgText, setMsgText] = useState('')
  const [msgAttachUrl, setMsgAttachUrl] = useState('')
  const [msgAttachName, setMsgAttachName] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [showAttach, setShowAttach] = useState(false)

  const [autoLoad, setAutoLoad] = useState(0)
  const [activeQuick, setActiveQuick] = useState(null) // 'pending' | 'approved' | null

  const pageRef = useRef(0)
  const hasMoreRef = useRef(true)
  const loadingMoreRef = useRef(false)
  const refreshIntervalRef = useRef(null)

  // Silent refresh: reloads conversation list without showing loading spinner
  const silentRefresh = useCallback(async () => {
    try {
      const d = await rpc('get_conversations', buildConversationsRpcParams(0))
      const arr = Array.isArray(d) ? d : unwrap(d)
      setConvos(arr)
      if (arr.length < PAGE_SIZE) {
        hasMoreRef.current = false
        setHasMore(false)
      }
    } catch (e) { /* silent fail */ }
  }, [search, branchF, providerF, channelF, statusF, dateFrom, dateTo])

  const personFields = [
    { k: 'first_name', l: 'Nombre', type: 'text' },
    { k: 'last_name', l: 'Apellido', type: 'text' },
    { k: 'email', l: 'Email', type: 'email' },
    { k: 'national_id', l: 'DNI / ID', type: 'text' },
    { k: 'birth_date', l: 'Fecha de nacimiento', type: 'date' },
    { k: 'country', l: 'País', type: 'text' },
    { k: 'state_province', l: 'Provincia / Estado', type: 'text' },
    { k: 'location_address', l: 'Dirección', type: 'text' },
    { k: 'legal_guardian_id', l: 'ID Tutor legal', type: 'number' },
  ]

  // Quick filter helpers
  const applyQuickFilter = (quickName, status, from, to) => {
    setStatusF(status); setDateFrom(from); setDateTo(to)
    setProviderF(''); setChannelF(''); setBranchF(''); setSearch('')
    setActiveQuick(quickName)
    setAutoLoad(c => c + 1)
  }

  const quickPending = () => {
    if (activeQuick === 'pending') { clearFilters(); setAutoLoad(c => c + 1); return }
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    applyQuickFilter('pending', 'ai_pending', yesterday, today)
  }

  const quickApprovedToday = () => {
    if (activeQuick === 'approved') { clearFilters(); setAutoLoad(c => c + 1); return }
    const today = new Date().toISOString().slice(0, 10)
    applyQuickFilter('approved', 'ai_approved', today, today)
  }

  const openPersonPanel = () => {
    if (!chatData?.person) return
    setPersonEdit({ ...chatData.person })
    setPersonPanel(true)
  }

  const savePersonData = async () => {
    if (!personEdit?.id) return
    setPersonSaving(true)
    try {
      const data = {}
      personFields.forEach(f => {
        const val = personEdit[f.k]
        data[f.k] = val === '' ? null : val
      })
      await post({ action: 'update', table: 'persons', data, id: personEdit.id })
      setChatData(prev => prev ? { ...prev, person: { ...prev.person, ...data } } : prev)
      setPersonToast('Datos guardados')
      setTimeout(() => setPersonToast(''), 2500)
    } catch (e) { alert('Error al guardar: ' + e.message) }
    setPersonSaving(false)
  }

  // BUG-002 FIX: Use system_conversation_id from chatData instead of conversation_id (selected)
  const sendMessage = async () => {
    if (!selected || (!msgText.trim() && !msgAttachUrl.trim())) return
    if (!chatData?.system_conversation_id) {
      alert('Error: no se encontró system_conversation para esta conversación. No se puede enviar.')
      return
    }
    setMsgSending(true)
    try {
      const ts = new Date().toISOString()
      const messageText = msgText.trim() || null
      const interactionData = {
        id_system_conversation: chatData.system_conversation_id, // FIX: was `selected` (conversation_id), now correct system_conversation.id
        text: messageText,
        time_stamp: ts,
        status: 'pending_delivery',
        external_ref: null,
      }
      const inserted = await post({ action: 'insert', table: 'interactions', data: interactionData })
      const newId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id

      if (msgAttachUrl.trim() && newId) {
        const ext = (msgAttachUrl.split('.').pop() || 'file').split('?')[0].toLowerCase()
        const mediaInserted = await post({
          action: 'insert', table: 'medias',
          data: { name: msgAttachName.trim() || 'adjunto', type: ext, content_dir: msgAttachUrl.trim() },
        })
        const mediaId = Array.isArray(mediaInserted) ? mediaInserted[0]?.id : mediaInserted?.id
        if (mediaId) {
          await post({
            action: 'insert', table: 'interaction_medias',
            data: { interaction_id: newId, media_id: mediaId },
          })
        }
      }

      // Delivery is handled by database triggers — no manual webhook call needed

      setMsgText('')
      setMsgAttachUrl('')
      setMsgAttachName('')
      setShowAttach(false)
      await loadChat(selected)
    } catch (e) { alert('Error al enviar: ' + e.message) }
    setMsgSending(false)
  }

  const handleMsgKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const buildConversationsRpcParams = (offset = 0) => ({
    p_search: search || null,
    p_provider: providerF || null,
    p_channel_id: channelF ? Number(channelF) : null,
    p_branch_id: branchF ? Number(branchF) : null,
    p_status: statusF || null,
    p_limit: PAGE_SIZE,
    p_offset: offset,
    p_date_from: dateFrom ? dateFrom + 'T00:00:00' : null,
    p_date_to: dateTo ? dateTo + 'T23:59:59' : null,
  })

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

  // Approve/Reject AI responses via atomic RPCs (no webhooks)
  // approve_ai_response: validates → creates outgoing interaction → marks approved (single transaction)
  // reject_ai_response: validates → marks confictive (no interaction created, no message sent)
  // Dispatch is handled by existing DB trigger New_pending_delivery_and_send → Make dispatcher
  const updateAi = async (aiId, evaluation, response) => {
    if (aiSavingRef.current) return // Sync guard — prevents double-click
    aiSavingRef.current = true
    setAiSaving(true)
    try {
      if (evaluation === 'approved') {
        // If edited, save the new response text first
        if (response !== undefined) {
          await post({ action: 'update', table: 'ai_interaction', data: { response }, id: aiId })
        }
        // Atomic RPC: validate + create interaction + mark approved
        const result = await rpc('approve_ai_response', { p_ai_id: aiId })
        if (!result?.ok) throw new Error(result?.error || 'Error al aprobar')
        if (result.deadline_ok === false) {
          alert('⚠️ Pasaron más de 24h desde el mensaje original. La respuesta fue guardada pero no se enviará automáticamente.')
        }
      } else {
        // Atomic RPC: validate + mark confictive (no interaction, no send)
        const result = await rpc('reject_ai_response', { p_ai_id: aiId })
        if (!result?.ok) throw new Error(result?.error || 'Error al rechazar')
      }

      // Update local UI state
      if (chatData?.ai_interactions) {
        const upd = { ...chatData.ai_interactions }
        for (const k of Object.keys(upd)) {
          if (upd[k].id === aiId) {
            upd[k] = { ...upd[k], evaluation, response: response !== undefined ? response : upd[k].response }
            break
          }
        }
        setChatData({ ...chatData, ai_interactions: upd })
      }
      setEditingAi(null)
      setTimeout(() => silentRefresh(), 600)
    } catch (e) { alert('Error: ' + e.message) }
    aiSavingRef.current = false
    setAiSaving(false)
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
        setInited(true)
      } catch (e) { setError(e.message) }
    })()
  }, [])

  const loadConvos = useCallback(async () => {
    setLoading(true); setError('')
    setSelected(null); setChatData(null); setPersonPanel(false)
    pageRef.current = 0
    hasMoreRef.current = true
    setHasMore(true)
    try {
      const d = await rpc('get_conversations', buildConversationsRpcParams(0))
      const arr = Array.isArray(d) ? d : unwrap(d)
      setConvos(arr)
      if (arr.length < PAGE_SIZE) {
        hasMoreRef.current = false
        setHasMore(false)
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [search, branchF, providerF, channelF, statusF, dateFrom, dateTo])

  const loadMoreConvos = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    const nextPage = pageRef.current + 1
    try {
      const d = await rpc('get_conversations', buildConversationsRpcParams(nextPage * PAGE_SIZE))
      const arr = Array.isArray(d) ? d : unwrap(d)
      if (arr.length > 0) {
        setConvos(prev => [...prev, ...arr])
        pageRef.current = nextPage
      }
      if (arr.length < PAGE_SIZE) {
        hasMoreRef.current = false
        setHasMore(false)
      }
    } catch (e) { setError(e.message) }
    loadingMoreRef.current = false
    setLoadingMore(false)
  }, [search, branchF, providerF, channelF, statusF, dateFrom, dateTo])

  const handleListScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      loadMoreConvos()
    }
  }, [loadMoreConvos])

  useEffect(() => { if (inited) loadConvos() }, [inited])

  // Auto-load when quick filters are applied (fires after state batch update)
  useEffect(() => { if (autoLoad > 0 && inited) loadConvos() }, [autoLoad, loadConvos])

  // Auto-refresh every 15s when quick filter is active (Pendientes/Aprobadas)
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
      refreshIntervalRef.current = null
    }
    if (activeQuick && inited) {
      refreshIntervalRef.current = setInterval(() => silentRefresh(), 15000)
    }
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [activeQuick, inited, silentRefresh])

  const loadChat = useCallback(async (convId) => {
    setSelected(convId); setChatLoading(true); setChatData(null)
    try {
      const d = await post({ endpoint: 'chat', params: { conversation_id: convId } })
      setChatData(d)
    } catch (e) { setError(e.message) }
    setChatLoading(false)
  }, [])

  useEffect(() => {
    if (chatData && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [chatData])

  const filteredChannels = providerF ? channels.filter(c => (c.channel_providers?.name || '') === providerF) : channels
  const clearFilters = () => { setSearch(''); setBranchF(''); setProviderF(''); setChannelF(''); setStatusF(''); setDateFrom(''); setDateTo(''); setActiveQuick(null) }
  const hasFilters = search || branchF || providerF || channelF || statusF || dateFrom || dateTo

  // On mobile: show list OR chat, not both
  const showSidebar = !isMobile || !selected
  const showChat = !isMobile || selected

  return (
    <div style={{ display: 'flex', height: `calc(100vh - ${isMobile ? 48 : 56}px)`, animation: 'fadeIn .3s' }}>
      {lightbox && <Lightbox src={lightbox.url} type={lightbox.type} onClose={() => setLightbox(null)} />}

      {/* Sidebar: conversation list */}
      {showSidebar && (
        <div style={{
          width: isMobile ? '100%' : 400,
          borderRight: isMobile ? 'none' : '1px solid var(--bdr)',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          {/* Search & filters */}
          <div style={{ padding: isMobile ? 8 : 10, borderBottom: '1px solid var(--bdr)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input placeholder="Buscar persona, email, tel..." value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadConvos()} style={{ flex: 1 }} />
              <Btn small primary onClick={loadConvos}>🔍</Btn>
              <Btn small onClick={() => setFiltersOpen(!filtersOpen)} style={{ background: filtersOpen || hasFilters ? 'var(--acBg)' : 'var(--s2)', color: filtersOpen || hasFilters ? 'var(--ac)' : 'var(--t3)' }}>⚙️</Btn>
            </div>

            {/* Quick filter buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={quickPending} style={{
                flex: 1, padding: '6px 8px', fontSize: isMobile ? 13 : 11, fontWeight: 600, cursor: 'pointer',
                borderRadius: 6, border: '1px solid var(--ylw)', transition: 'all .15s',
                background: activeQuick === 'pending' ? 'var(--ylw)' : 'var(--ylwBg)',
                color: activeQuick === 'pending' ? '#000' : 'var(--ylw)',
              }}>🤖 Pendientes</button>
              <button onClick={quickApprovedToday} style={{
                flex: 1, padding: '6px 8px', fontSize: isMobile ? 13 : 11, fontWeight: 600, cursor: 'pointer',
                borderRadius: 6, border: '1px solid var(--grn)', transition: 'all .15s',
                background: activeQuick === 'approved' ? 'var(--grn)' : 'var(--grnBg)',
                color: activeQuick === 'approved' ? '#000' : 'var(--grn)',
              }}>✅ Aprobadas hoy</button>
            </div>

            {filtersOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, background: 'var(--s2)', borderRadius: 8 }}>
                <div className="fr">
                  <select value={providerF} onChange={e => { setProviderF(e.target.value); setChannelF('') }} style={{ flex: 1 }}><option value="">Todos los proveedores</option>{providers.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select>
                  <select value={channelF} onChange={e => setChannelF(e.target.value)} style={{ flex: 1 }}><option value="">Todos los canales</option>{filteredChannels.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </div>
                <div className="fr">
                  <select value={branchF} onChange={e => setBranchF(e.target.value)} style={{ flex: 1 }}><option value="">Todas las sedes</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
                  <select value={statusF} onChange={e => { setStatusF(e.target.value); setActiveQuick(null) }} style={{ flex: 1 }}><option value="">Todos los estados</option><option value="unanswered">⚠️ Sin responder</option><option value="answered">✅ Respondidas</option><option value="ai_pending">🤖 IA pendiente</option><option value="ai_approved">✅ IA aprobadas</option></select>
                </div>
                <div className="fr">
                  <div style={{ flex: 1 }}><label style={{ fontSize: isMobile ? 12 : 10, color: 'var(--t2)', fontWeight: 600 }}>Desde</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: '100%' }} /></div>
                  <div style={{ flex: 1 }}><label style={{ fontSize: isMobile ? 12 : 10, color: 'var(--t2)', fontWeight: 600 }}>Hasta</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: '100%' }} /></div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn small primary onClick={loadConvos} style={{ flex: 1 }}>Aplicar</Btn>
                  {hasFilters && <Btn small onClick={() => { clearFilters(); setTimeout(loadConvos, 100) }}>Limpiar</Btn>}
                </div>
              </div>
            )}

            {hasFilters && !filtersOpen && (
              <div style={{ fontSize: isMobile ? 13 : 11, color: 'var(--ac)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                🔽 Filtros activos
                {providerF && <Badge bg="var(--grnBg)" color="var(--grn)">{providerF}</Badge>}
                {statusF && <Badge bg="var(--ylwBg)" color="var(--ylw)">{statusF}</Badge>}
                {(dateFrom || dateTo) && <Badge bg="var(--bluBg)" color="var(--blu)">{dateFrom || '...'} → {dateTo || '...'}</Badge>}
              </div>
            )}
          </div>

          <div style={{ padding: '6px 12px', fontSize: isMobile ? 13 : 11, color: 'var(--t2)', borderBottom: '1px solid var(--bdr)', background: 'var(--s1)', fontWeight: 500, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{loading ? 'Cargando...' : `${convos.length} conversaciones${hasMore ? '+' : ''}`}</span>
            {activeQuick && !loading && (
              <span style={{ fontSize: isMobile ? 11 : 9, color: 'var(--grn)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grn)', display: 'inline-block' }} />
                auto-refresh
              </span>
            )}
          </div>

          {/* Conversation list */}
          <div ref={listRef} onScroll={handleListScroll} style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? <Loading /> : error && !convos.length ? (
              <div style={{ padding: 20, color: 'var(--red)', fontSize: 13 }}>{error}</div>
            ) : !convos.length ? (
              <div style={{ padding: 20, color: 'var(--t3)', textAlign: 'center', fontSize: 13 }}>Sin resultados</div>
            ) : (
              <>
                {convos.map(c => {
                  const lm = typeof c.last_message === 'object' && c.last_message !== null ? c.last_message : null
                  const lmText = lm ? lm.text || '' : typeof c.last_message === 'string' ? c.last_message : ''
                  const lmDate = lm ? lm.time_stamp || c.last_activity : c.last_activity
                  const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.person_address || 'Sin nombre'

                  return (
                    <div key={c.conversation_id} onClick={() => loadChat(c.conversation_id)} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bdr)', cursor: 'pointer', background: selected === c.conversation_id ? 'var(--acBg)' : 'transparent' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, fontSize: isMobile ? 15 : 13, color: 'var(--t1)' }}>{name}</span>
                        <span style={{ fontSize: isMobile ? 12 : 10, color: 'var(--t2)', flexShrink: 0, fontWeight: 500 }}>{fmtShort(lmDate)}</span>
                      </div>
                      <div style={{ fontSize: isMobile ? 14 : 12, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{lmText}</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {c.provider && <Badge bg="var(--ylwBg)" color="var(--ylw)">{c.provider}</Badge>}
                        {c.channel_name && <Badge bg="var(--acBg)" color="var(--ac)">{c.channel_name}</Badge>}
                        {c.has_reply === false && <Badge bg="var(--redBg)" color="var(--red)">sin resp</Badge>}
                        <span style={{ fontSize: isMobile ? 12 : 10, color: 'var(--t2)', marginLeft: 'auto', fontWeight: 500 }}>{c.msgs_in || 0}↓ {c.msgs_out || 0}↑</span>
                      </div>
                    </div>
                  )
                })}

                {loadingMore && <div style={{ padding: 16, textAlign: 'center' }}><Loading /></div>}

                {!hasMore && convos.length > 0 && (
                  <div style={{ padding: 12, textAlign: 'center', fontSize: 11, color: 'var(--t3)', borderTop: '1px solid var(--bdr)' }}>
                    — Fin ({convos.length}) —
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Chat panel */}
      {showChat && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', width: isMobile ? '100%' : undefined }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 14, flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 40, opacity: .3 }}>💬</div>Seleccioná una conversación
            </div>
          ) : chatLoading ? <Loading /> : chatData ? (
            <>
              {/* Chat header */}
              <div style={{ padding: isMobile ? '8px 10px' : '12px 16px', borderBottom: '1px solid var(--bdr)', background: 'var(--s1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, minWidth: 0 }}>
                  <button onClick={() => { setSelected(null); setChatData(null); setPersonPanel(false) }} style={{ background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '6px 10px', color: 'var(--t1)', cursor: 'pointer', flexShrink: 0 }}>◀</button>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: isMobile ? 15 : 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t1)' }}>{chatData.person ? [chatData.person.first_name, chatData.person.last_name].filter(Boolean).join(' ') || 'Sin nombre' : 'Desconocido'}</div>
                    <div style={{ color: 'var(--t2)', fontSize: isMobile ? 12 : 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatData.person_address || ''}{chatData.channel ? ` · ${chatData.channel.name}` : ''}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {!isMobile && chatData.person?.email && <div style={{ color: 'var(--t2)', fontSize: 11 }}>{chatData.person.email}</div>}
                  {chatData.person && (
                    <button onClick={openPersonPanel} title="Ver / editar datos" style={{
                      background: personPanel ? 'var(--ac)' : 'var(--s2)',
                      color: personPanel ? '#fff' : 'var(--t1)',
                      border: '1px solid ' + (personPanel ? 'var(--ac)' : 'var(--bdr)'),
                      borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>👤</button>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px 8px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(chatData.messages || []).map((m, i) => {
                  const isIn = m.direction === 'in'
                  const ai = chatData.ai_interactions?.[m.id]
                  const ad = m.ad_id ? chatData.ads?.[m.ad_id] : null
                  const medias = chatData.media?.[m.id] || []

                  return (
                    <div key={m.id || i}>
                      {ad && (
                        <div style={{ fontSize: isMobile ? 12 : 10, marginBottom: 4, padding: '3px 10px', borderRadius: 20, background: 'var(--ylwBg)', color: 'var(--ylw)', display: 'inline-block', fontWeight: 500 }}>
                          📢 {ad.title || 'Ad'}{ad.courses?.name ? ` → ${ad.courses.name}` : ''}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: isIn ? 'flex-start' : 'flex-end' }}>
                        <div style={{ maxWidth: isMobile ? '88%' : '75%', padding: isMobile ? '8px 10px' : '10px 14px', borderRadius: isIn ? '4px 16px 16px 16px' : '16px 4px 16px 16px', background: isIn ? 'var(--s2)' : 'var(--acBg)', color: 'var(--t1)', fontSize: isMobile ? 15 : 13, lineHeight: 1.5, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {m.text || (!medias.length && <span style={{ color: 'var(--t3)', fontStyle: 'italic' }}>[sin texto]</span>)}

                          {medias.length > 0 && (
                            <div style={{ marginTop: m.text ? 8 : 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {medias.map(med => {
                                if (isImage(med.type) && med.url) return <img key={med.id} src={med.url} className="media-thumb" style={{ maxWidth: isMobile ? 180 : 240 }} onClick={e => { e.stopPropagation(); setLightbox(med) }} alt={med.name || 'imagen'} />
                                if (isVideo(med.type) && med.url) return (
                                  <div key={med.id} style={{ position: 'relative', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setLightbox(med) }}>
                                    <video src={med.url} style={{ maxWidth: isMobile ? 180 : 240, maxHeight: 180, borderRadius: 8, border: '1px solid var(--bdr)' }} />
                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.3)', borderRadius: 8, fontSize: 32 }}>▶</div>
                                  </div>
                                )
                                return <a key={med.id} href={med.url} target="_blank" rel="noopener" className="media-file" onClick={e => e.stopPropagation()}>{mediaIcon(med.type)} {med.name || 'archivo'}.{med.type}</a>
                              })}
                            </div>
                          )}

                          <div style={{ fontSize: isMobile ? 11 : 10, color: 'var(--t2)', marginTop: 4, textAlign: 'right' }}>{fmtDate(m.time_stamp)}</div>
                        </div>
                      </div>

                      {/* AI interaction */}
                      {ai && (
                        <div style={{ marginLeft: isMobile ? 4 : 8, marginTop: 2, padding: isMobile ? '10px 12px' : '8px 10px', background: 'var(--s3)', borderRadius: 8, maxWidth: isMobile ? '92%' : '70%', borderLeft: `3px solid ${ai.evaluation === 'approved' ? 'var(--grn)' : ai.evaluation === 'confictive' ? 'var(--red)' : 'var(--ylw)'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 4 }}>
                            <div style={{ fontSize: isMobile ? 13 : 11, color: 'var(--t2)', fontWeight: 600 }}>
                              🤖 IA <Badge bg={ai.evaluation === 'approved' ? 'var(--grnBg)' : ai.evaluation === 'confictive' ? 'var(--redBg)' : 'var(--ylwBg)'} color={ai.evaluation === 'approved' ? 'var(--grn)' : ai.evaluation === 'confictive' ? 'var(--red)' : 'var(--ylw)'}>{ai.evaluation}</Badge>
                            </div>
                            {ai.evaluation === 'pending' && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button disabled={aiSaving} onClick={() => updateAi(ai.id, 'approved')} style={{ background: 'var(--grnBg)', color: 'var(--grn)', border: '1px solid var(--grn)', borderRadius: 6, padding: isMobile ? '6px 14px' : '3px 8px', fontSize: isMobile ? 14 : 11, fontWeight: 700, cursor: 'pointer', opacity: aiSaving ? .5 : 1 }}>✓ Aprobar</button>
                                <button disabled={aiSaving} onClick={() => { setEditingAi(ai.id); setEditAiText(ai.response || '') }} style={{ background: 'var(--acBg)', color: 'var(--ac)', border: '1px solid var(--ac)', borderRadius: 6, padding: isMobile ? '6px 14px' : '3px 8px', fontSize: isMobile ? 14 : 11, fontWeight: 700, cursor: 'pointer', opacity: aiSaving ? .5 : 1 }}>✎ Editar</button>
                                <button disabled={aiSaving} onClick={() => updateAi(ai.id, 'confictive')} style={{ background: 'var(--redBg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 6, padding: isMobile ? '6px 14px' : '3px 8px', fontSize: isMobile ? 14 : 11, fontWeight: 700, cursor: 'pointer', opacity: aiSaving ? .5 : 1 }}>✗ Rechazar</button>
                              </div>
                            )}
                          </div>

                          {editingAi === ai.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <textarea value={editAiText} onChange={e => setEditAiText(e.target.value)} style={{ width: '100%', minHeight: 80, padding: 8, borderRadius: 6, border: '1px solid var(--ac)', background: 'var(--s2)', color: 'var(--t1)', fontSize: isMobile ? 15 : 13, fontFamily: 'inherit', resize: 'vertical' }} />
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button onClick={() => setEditingAi(null)} style={{ background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bdr)', borderRadius: 6, padding: isMobile ? '8px 16px' : '4px 12px', fontSize: isMobile ? 14 : 12, cursor: 'pointer', fontWeight: 500 }}>Cancelar</button>
                                <button disabled={aiSaving} onClick={() => updateAi(ai.id, 'approved', editAiText)} style={{ background: 'var(--ac)', color: '#fff', border: 'none', borderRadius: 6, padding: isMobile ? '8px 16px' : '4px 12px', fontSize: isMobile ? 14 : 12, fontWeight: 700, cursor: 'pointer', opacity: aiSaving ? .5 : 1 }}>{aiSaving ? '...' : 'Guardar y aprobar'}</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: isMobile ? 15 : 13, color: 'var(--t1)', lineHeight: 1.55, fontWeight: 400, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {ai.response || ''}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Compose bar */}
              <div style={{
                borderTop: '1px solid var(--bdr)', background: 'var(--s1)',
                padding: isMobile ? '8px 10px' : '10px 16px', display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                {showAttach && (
                  <div style={{
                    display: 'flex', gap: 6, alignItems: 'center', padding: '6px 8px',
                    background: 'var(--s2)', borderRadius: 8, fontSize: 12, flexWrap: 'wrap',
                  }}>
                    <input placeholder="URL archivo" value={msgAttachUrl} onChange={e => setMsgAttachUrl(e.target.value)} style={{ flex: 1, padding: '4px 8px', fontSize: 12, minWidth: 120 }} />
                    <input placeholder="Nombre" value={msgAttachName} onChange={e => setMsgAttachName(e.target.value)} style={{ width: isMobile ? '100%' : 100, padding: '4px 8px', fontSize: 12 }} />
                    <button onClick={() => { setShowAttach(false); setMsgAttachUrl(''); setMsgAttachName('') }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>✕</button>
                  </div>
                )}
                {msgAttachUrl && !showAttach && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'var(--acBg)', borderRadius: 6, fontSize: 11, color: 'var(--ac)' }}>
                    📎 {msgAttachName || msgAttachUrl.split('/').pop()?.slice(0, 30)}
                    <button onClick={() => { setMsgAttachUrl(''); setMsgAttachName('') }} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, marginLeft: 'auto' }}>✕</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                  <button onClick={() => setShowAttach(!showAttach)} title="Adjuntar" style={{
                    background: showAttach || msgAttachUrl ? 'var(--acBg)' : 'var(--s2)',
                    color: showAttach || msgAttachUrl ? 'var(--ac)' : 'var(--t2)',
                    border: '1px solid ' + (showAttach || msgAttachUrl ? 'var(--ac)' : 'var(--bdr)'),
                    borderRadius: 8, padding: '8px 10px', fontSize: 16, cursor: 'pointer', flexShrink: 0, lineHeight: 1,
                  }}>📎</button>
                  <textarea
                    placeholder="Escribir mensaje..."
                    value={msgText} onChange={e => setMsgText(e.target.value)}
                    onKeyDown={handleMsgKeyDown} disabled={msgSending} rows={1}
                    style={{
                      flex: 1, padding: '8px 12px', fontSize: isMobile ? 16 : 13, fontFamily: 'inherit',
                      background: 'var(--s2)', border: '1px solid var(--bdr)', color: 'var(--t1)',
                      borderRadius: 10, resize: 'none', outline: 'none',
                      minHeight: 38, maxHeight: 120, lineHeight: 1.4,
                    }}
                    onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                  />
                  <button onClick={sendMessage} disabled={msgSending || (!msgText.trim() && !msgAttachUrl.trim())} title="Enviar" style={{
                    background: (msgText.trim() || msgAttachUrl.trim()) && !msgSending ? 'var(--ac)' : 'var(--s3)',
                    color: (msgText.trim() || msgAttachUrl.trim()) && !msgSending ? '#fff' : 'var(--t3)',
                    border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 16, cursor: msgSending ? 'wait' : 'pointer',
                    flexShrink: 0, lineHeight: 1, fontWeight: 700, opacity: msgSending ? .6 : 1,
                  }}>{msgSending ? '...' : '➤'}</button>
                </div>
                {!isMobile && (
                  <div style={{ fontSize: 10, color: 'var(--t3)', paddingLeft: 2 }}>
                    Enter para enviar · Shift+Enter nueva linea
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* Person detail panel - overlay on mobile */}
      {personPanel && personEdit && (
        <div style={{
          width: isMobile ? '100%' : 360,
          position: isMobile ? 'fixed' : 'relative',
          inset: isMobile ? 0 : undefined,
          top: isMobile ? 48 : undefined,
          zIndex: isMobile ? 100 : undefined,
          borderLeft: isMobile ? 'none' : '1px solid var(--bdr)',
          background: 'var(--s1)',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
          animation: 'fadeIn .2s',
        }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--bdr)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)' }}>👤 Datos de persona</div>
            <button onClick={() => setPersonPanel(false)} style={{
              background: 'var(--s2)', border: '1px solid var(--bdr)',
              borderRadius: 8, padding: '4px 10px', color: 'var(--t2)', cursor: 'pointer', fontSize: 12,
            }}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              padding: '10px 14px', background: 'var(--s2)', borderRadius: 10,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: '50%', background: 'var(--acBg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800, color: 'var(--ac)',
              }}>
                {(personEdit.first_name || '?')[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--t1)' }}>
                  {[personEdit.first_name, personEdit.last_name].filter(Boolean).join(' ') || 'Sin nombre'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)' }}>ID: {personEdit.id}</div>
              </div>
            </div>

            {(chatData?.person_address || chatData?.channel) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {chatData.person_address && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--s2)', borderRadius: 8 }}>
                    <span style={{ fontSize: 14 }}>{/^\d/.test(chatData.person_address) ? '📱' : '💬'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chatData.person_address}</div>
                      <div style={{ fontSize: isMobile ? 12 : 10, color: 'var(--t2)' }}>
                        {chatData.channel?.channel_providers?.name || 'Canal'} — {chatData.channel?.name || ''}
                      </div>
                    </div>
                  </div>
                )}
                {chatData.channel?.branches?.name && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: 'var(--s3)', borderRadius: 6 }}>
                    <span style={{ fontSize: 12 }}>📍</span>
                    <span style={{ fontSize: 12, color: 'var(--t1)' }}>Sede: {chatData.channel.branches.name}</span>
                  </div>
                )}
              </div>
            )}

            {personEdit.creation_datetime && (
              <div style={{ fontSize: 11, color: 'var(--t2)', paddingLeft: 2 }}>
                Registrado: {fmtDate(personEdit.creation_datetime)}
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: .5, marginTop: 4 }}>
              Datos personales
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {personFields.map(f => (
                <div key={f.k}>
                  <label style={{ fontSize: isMobile ? 12 : 10, color: 'var(--t2)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>
                    {f.l}
                  </label>
                  <input
                    type={f.type}
                    value={personEdit[f.k] ?? ''}
                    onChange={e => setPersonEdit(prev => ({ ...prev, [f.k]: e.target.value }))}
                    placeholder={f.l}
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--bdr)',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            {personToast && (
              <span style={{ fontSize: 12, color: 'var(--grn)', fontWeight: 600, flex: 1 }}>{personToast}</span>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Btn small onClick={() => setPersonPanel(false)}>Cerrar</Btn>
              <Btn small primary onClick={savePersonData} style={{ opacity: personSaving ? .6 : 1 }}>
                {personSaving ? '...' : 'Guardar'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
