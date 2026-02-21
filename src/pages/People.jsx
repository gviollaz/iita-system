import { useState, useEffect, useCallback, useRef } from 'react'
import { post } from '@/lib/api'
import { fmtDate, fmtShort, fmtNum } from '@/lib/utils'
import { Card, Btn, Loading, Toast, Badge, TabBar } from '@/components/ui'
import { MiniBarChart, MiniPieChart } from '@/components/Charts'
import { useIsMobile } from '@/lib/useIsMobile'

const PERSON_FIELDS = [
  { k: 'first_name', l: 'Nombre', type: 'text' },
  { k: 'last_name', l: 'Apellido', type: 'text' },
  { k: 'email', l: 'Email', type: 'email' },
  { k: 'national_id', l: 'DNI / ID', type: 'text' },
  { k: 'birth_date', l: 'Fecha de nacimiento', type: 'date' },
  { k: 'country', l: 'País', type: 'text' },
  { k: 'state_province', l: 'Provincia / Estado', type: 'text' },
  { k: 'location_address', l: 'Dirección', type: 'text' },
]

const SOFT_DATA_LABELS = {
  pais: '🌍 País',
  provincia: '📍 Provincia',
  localidad: '🏘️ Localidad',
  edad_consultada: '🎂 Edad consultada',
  consulta_para: '👤 Consulta para',
  nombre_alumno: '🎓 Nombre alumno',
  nombre_contacto: '📇 Nombre contacto',
  preferencia_modalidad: '💻 Modalidad preferida',
  tag_curso_interes: '📚 Interés en curso',
  difusion_recibida: '📢 Difusión recibida',
}

const TAG_COLORS = {
  tag_curso_interes: { bg: 'var(--acBg)', color: 'var(--ac)' },
  difusion_recibida: { bg: '#ffeaa7', color: '#d68910' },
  preferencia_modalidad: { bg: '#dfe6e9', color: '#2d3436' },
}

const PROV_COLORS = {
  whatsapp: 'var(--grn)',
  'whatsapp cloud api': '#55efc4',
  instagram: 'var(--ylw)',
  messenger: 'var(--blu)',
  email: '#e74c3c',
}

const PROVIDER_COMPAT = {
  1: [1, 4],
  4: [1, 4],
  2: [2],
  3: [3],
  5: [5],
}

const PROVIDER_ICONS = {
  whatsapp: '📱',
  'whatsapp cloud api': '🤖',
  instagram: '📸',
  messenger: '💬',
  email: '📧',
}

const PROVIDER_ID_TO_KEY = {
  1: 'whatsapp',
  2: 'instagram',
  3: 'messenger',
  4: 'whatsapp cloud api',
  5: 'email',
}

const FLAG_MAP = {
  'Argentina': '🇦🇷', 'Bolivia': '🇧🇴', 'Colombia': '🇨🇴', 'Perú': '🇵🇪',
  'Ecuador': '🇪🇨', 'Paraguay': '🇵🇾', 'Uruguay': '🇺🇾', 'México': '🇲🇽',
  'Chile': '🇨🇱', 'Brasil': '🇧🇷', 'Costa Rica': '🇨🇷', 'Venezuela': '🇻🇪',
  'Estados Unidos': '🇺🇸', 'España': '🇪🇸', 'Italia': '🇮🇹', 'Canadá': '🇨🇦',
  'Portugal': '🇵🇹', 'China': '🇨🇳', 'Noruega': '🇳🇴', 'Suiza': '🇨🇭', 'Camerún': '🇨🇲',
}

export default function People() {
  const [tab, setTab] = useState('list')
  const isMobile = useIsMobile()

  const [people, setPeople] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const [search, setSearch] = useState('')
  const [tagCursoF, setTagCursoF] = useState('')
  const [provinciaF, setProvinciaF] = useState('')
  const [paisF, setPaisF] = useState('')
  const [hasPhoneF, setHasPhoneF] = useState('')
  const [hasEmailF, setHasEmailF] = useState('')
  const searchTimer = useRef(null)

  const [filterOpts, setFilterOpts] = useState(null)

  const [selected, setSelected] = useState(null)
  const [personDetail, setPersonDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [personEditing, setPersonEditing] = useState(false)
  const [personEdit, setPersonEdit] = useState(null)
  const [personSaving, setPersonSaving] = useState(false)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    post({ endpoint: 'persons_filter_options' }).then(d => setFilterOpts(d)).catch(() => {})
  }, [])

  const loadPeople = useCallback(async (pg = 0) => {
    setLoading(true); setError('')
    try {
      const params = { page: pg, limit: 50 }
      if (search) params.search = search
      if (tagCursoF) params.tag_curso = tagCursoF
      if (provinciaF) params.provincia = provinciaF
      if (paisF) params.pais = paisF
      if (hasPhoneF === 'yes') params.has_phone = true
      if (hasEmailF === 'yes') params.has_email = true

      const d = await post({ endpoint: 'persons_enriched', params })
      setPeople(d?.persons || [])
      setTotal(d?.total || 0)
      setPage(pg)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [search, tagCursoF, provinciaF, paisF, hasPhoneF, hasEmailF])

  useEffect(() => { loadPeople(0) }, [loadPeople])

  const handleSearch = (val) => { setSearch(val) }

  const loadPersonDetail = useCallback(async (personId) => {
    setSelected(personId)
    setPersonEditing(false)
    setPersonDetail(null)
    setDetailLoading(true)
    try {
      const d = await post({ endpoint: 'person_full', params: { person_id: personId } })
      setPersonDetail(d)
      setPersonEdit({ ...(d?.person || {}) })
    } catch (e) { setError(e.message) }
    setDetailLoading(false)
  }, [])

  const savePersonEdit = async () => {
    if (!personEdit?.id) return
    setPersonSaving(true)
    try {
      const updates = {}
      PERSON_FIELDS.forEach(f => {
        const val = personEdit[f.k]
        updates[f.k] = val === '' ? null : val
      })
      await post({ endpoint: 'update_person', params: { person_id: personEdit.id, updates } })
      showToast('Datos guardados ✓')
      setPersonEditing(false)
      loadPersonDetail(personEdit.id)
      loadPeople(page)
    } catch (e) { alert('Error al guardar: ' + e.message) }
    setPersonSaving(false)
  }

  const totalPages = Math.ceil(total / 50)

  if (!filterOpts && !error) return <div style={{ padding: 24 }}><Loading /></div>

  // On mobile: show list OR detail, not both
  const showList = !isMobile || !selected
  const showDetail = selected

  return (
    <div style={{ padding: isMobile ? 10 : 24, animation: 'fadeIn .3s' }}>
      <Toast msg={toast} />
      <Toast msg={error} type="err" />

      <TabBar
        tabs={[
          { k: 'list', l: '👥 Lista de personas' },
          { k: 'stats', l: '📊 Estadísticas' },
        ]}
        active={tab}
        onChange={t => { setTab(t); if (t === 'list') setSelected(null) }}
      />

      {tab === 'stats' && filterOpts && <StatsTab data={filterOpts} isMobile={isMobile} />}

      {tab === 'list' && (
        <div style={{ display: 'flex', gap: 0, height: isMobile ? 'auto' : 'calc(100vh - 150px)', minHeight: isMobile ? 'calc(100vh - 150px)' : undefined }}>
          {/* Left: search + list */}
          {showList && (
            <div style={{
              width: selected && !isMobile ? 440 : '100%',
              transition: 'width .2s',
              display: 'flex',
              flexDirection: 'column',
              borderRight: selected && !isMobile ? '1px solid var(--bdr)' : 'none',
              height: isMobile ? 'calc(100vh - 150px)' : undefined,
            }}>
              {/* Filters */}
              <Card style={{ marginBottom: 12, padding: isMobile ? 8 : 12 }}>
                <div className="fr" style={{ gap: isMobile ? 4 : 8, flexWrap: 'wrap' }}>
                  <input
                    placeholder="Buscar nombre, teléfono, email, DNI..."
                    value={search}
                    onChange={e => handleSearch(e.target.value)}
                    style={{ flex: 1, minWidth: isMobile ? 140 : 200 }}
                  />
                  {!isMobile && (
                    <>
                      <select value={paisF} onChange={e => setPaisF(e.target.value)}>
                        <option value="">Todos los países</option>
                        {(filterOpts?.paises || []).map(p => (
                          <option key={p.name} value={p.name}>{FLAG_MAP[p.name] || '🌍'} {p.name} ({p.count})</option>
                        ))}
                      </select>
                      <select value={provinciaF} onChange={e => setProvinciaF(e.target.value)}>
                        <option value="">Todas las provincias</option>
                        {(filterOpts?.provincias || []).map(p => (
                          <option key={p.name} value={p.name}>{p.name} ({p.count})</option>
                        ))}
                      </select>
                    </>
                  )}
                  <select value={tagCursoF} onChange={e => setTagCursoF(e.target.value)} style={isMobile ? { flex: 1, minWidth: 120 } : {}}>
                    <option value="">Todos los cursos</option>
                    {(filterOpts?.tags_curso || []).map(t => (
                      <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
                    ))}
                  </select>
                  {!isMobile && (
                    <>
                      <select value={hasPhoneF} onChange={e => setHasPhoneF(e.target.value)}>
                        <option value="">Tel: todos</option>
                        <option value="yes">Con teléfono</option>
                      </select>
                      <select value={hasEmailF} onChange={e => setHasEmailF(e.target.value)}>
                        <option value="">Email: todos</option>
                        <option value="yes">Con email</option>
                      </select>
                    </>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>
                  {loading ? 'Cargando...' : `${total} personas encontradas`}
                  {total > 0 && (
                    <span style={{ marginLeft: 12, color: 'var(--ac)', fontWeight: 600 }}>
                      — Pág. {page + 1} de {totalPages}
                    </span>
                  )}
                </div>
              </Card>

              {/* Table */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
                {loading ? <Loading /> : (
                  <>
                    <table>
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>Teléfono</th>
                          {!isMobile && <th>País</th>}
                          {!isMobile && <th>Provincia</th>}
                          {!isMobile && <th>Intereses</th>}
                          <th style={{ textAlign: 'right' }}>Conv.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {people.map(p => (
                          <tr
                            key={p.id}
                            onClick={() => loadPersonDetail(p.id)}
                            style={{ cursor: 'pointer', background: selected === p.id ? 'var(--acBg)' : 'transparent' }}
                          >
                            <td style={{ fontWeight: 600, color: 'var(--t1)' }}>
                              {[p.first_name, p.last_name].filter(Boolean).join(' ') || <span style={{ color: 'var(--t3)', fontStyle: 'italic' }}>Sin nombre</span>}
                            </td>
                            <td style={{ fontSize: 11 }}>{p.phone || '-'}</td>
                            {!isMobile && (
                              <td style={{ fontSize: 11 }}>
                                {p.country ? <span>{FLAG_MAP[p.country] || '🌍'} {p.country}</span> : '-'}
                              </td>
                            )}
                            {!isMobile && <td style={{ fontSize: 11 }}>{p.provincia || '-'}</td>}
                            {!isMobile && (
                              <td>
                                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                  {(p.tags_curso || []).slice(0, 3).map((t, i) => (
                                    <Badge key={i} bg="var(--acBg)" color="var(--ac)">{t.length > 20 ? t.slice(0, 18) + '…' : t}</Badge>
                                  ))}
                                  {(p.tags_curso || []).length > 3 && (
                                    <Badge bg="var(--s3)" color="var(--t3)">+{p.tags_curso.length - 3}</Badge>
                                  )}
                                </div>
                              </td>
                            )}
                            <td style={{ textAlign: 'right', fontSize: 11, fontWeight: 600 }}>{p.conversation_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {totalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 12 }}>
                        <Btn small disabled={page === 0} onClick={() => loadPeople(page - 1)}>← Ant.</Btn>
                        <span style={{ fontSize: 12, color: 'var(--t3)', padding: '6px 0' }}>
                          {page + 1} / {totalPages}
                        </span>
                        <Btn small disabled={page >= totalPages - 1} onClick={() => loadPeople(page + 1)}>Sig. →</Btn>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Right: person detail */}
          {showDetail && detailLoading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Loading />
            </div>
          )}
          {showDetail && !detailLoading && personDetail && (
            <div style={{ flex: 1, overflowY: 'auto', animation: 'fadeIn .2s' }}>
              <PersonProfile
                detail={personDetail}
                editing={personEditing}
                editData={personEdit}
                saving={personSaving}
                isMobile={isMobile}
                onStartEdit={() => { setPersonEditing(true); setPersonEdit({ ...(personDetail?.person || {}) }) }}
                onCancelEdit={() => setPersonEditing(false)}
                onChangeField={(k, v) => setPersonEdit(prev => ({ ...prev, [k]: v }))}
                onSave={savePersonEdit}
                onClose={() => setSelected(null)}
                onMessageSent={() => loadPersonDetail(selected)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════
   STATS TAB
   ═══════════════════════════════════════════ */
function StatsTab({ data, isMobile }) {
  const totals = data?.totals || {}
  const tagsCurso = data?.tags_curso || []
  const provincias = data?.provincias || []
  const paises = data?.paises || []

  const tagChartData = tagsCurso.slice(0, 12).map(t => ({ label: t.name, value: t.count }))
  const provChartData = provincias.slice(0, 12).map(p => ({ label: p.name, value: p.count }))
  const paisChartData = paises.slice(0, 12).map(p => ({ label: `${FLAG_MAP[p.name] || ''} ${p.name}`, value: p.count }))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${isMobile ? '100px' : '140px'},1fr))`, gap: isMobile ? 8 : 12, marginBottom: 20 }}>
        <Card style={{ padding: isMobile ? 10 : 16, textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: 'var(--ac)' }}>{fmtNum(totals.total_persons)}</div>
          <div style={{ fontSize: isMobile ? 10 : 12, color: 'var(--t3)' }}>Total personas</div>
        </Card>
        <Card style={{ padding: isMobile ? 10 : 16, textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: 'var(--grn)' }}>{fmtNum(totals.with_phone)}</div>
          <div style={{ fontSize: isMobile ? 10 : 12, color: 'var(--t3)' }}>Con teléfono</div>
        </Card>
        <Card style={{ padding: isMobile ? 10 : 16, textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: 'var(--blu)' }}>{fmtNum(totals.with_email)}</div>
          <div style={{ fontSize: isMobile ? 10 : 12, color: 'var(--t3)' }}>Con email</div>
        </Card>
        <Card style={{ padding: isMobile ? 10 : 16, textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: '#6c5ce7' }}>{fmtNum(totals.with_tags)}</div>
          <div style={{ fontSize: isMobile ? 10 : 12, color: 'var(--t3)' }}>Con interés</div>
        </Card>
        <Card style={{ padding: isMobile ? 10 : 16, textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: '#00b894' }}>{fmtNum(totals.with_pais)}</div>
          <div style={{ fontSize: isMobile ? 10 : 12, color: 'var(--t3)' }}>Con país</div>
        </Card>
        <Card style={{ padding: isMobile ? 10 : 16, textAlign: 'center' }}>
          <div style={{ fontSize: isMobile ? 20 : 28, fontWeight: 800, color: '#e17055' }}>{fmtNum(totals.with_provincia)}</div>
          <div style={{ fontSize: isMobile ? 10 : 12, color: 'var(--t3)' }}>Con provincia</div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Interés por curso (top 12)</div>
          <MiniBarChart data={tagChartData} />
        </Card>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Personas por país</div>
          <MiniBarChart data={paisChartData} />
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Personas por provincia (top 12)</div>
          <MiniBarChart data={provChartData} />
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Todos los cursos de interés</div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Curso</th><th style={{ textAlign: 'right' }}>Personas</th></tr></thead>
              <tbody>
                {tagsCurso.map(t => (
                  <tr key={t.name}>
                    <td><Badge bg="var(--acBg)" color="var(--ac)">{t.name}</Badge></td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Todos los países</div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>País</th><th style={{ textAlign: 'right' }}>Personas</th></tr></thead>
              <tbody>
                {paises.map(p => (
                  <tr key={p.name}>
                    <td>{FLAG_MAP[p.name] || '🌍'} {p.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card style={{ padding: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Todas las provincias</div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Provincia</th><th style={{ textAlign: 'right' }}>Personas</th></tr></thead>
              <tbody>
                {provincias.map(p => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   PERSON PROFILE (detail panel)
   ═══════════════════════════════════════════ */
function PersonProfile({ detail, editing, editData, saving, isMobile, onStartEdit, onCancelEdit, onChangeField, onSave, onClose, onMessageSent }) {
  const person = detail?.person || {}
  const softData = detail?.soft_data || []
  const contacts = detail?.contacts || []
  const conversations = detail?.conversations || []
  const stats = detail?.stats || {}
  const lastChannel = detail?.last_channel || null

  const age = person.birth_date ? Math.floor((Date.now() - new Date(person.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)) : null

  const uniqueSoftData = []
  const sdSeen = new Set()
  softData.forEach(sd => {
    const key = `${sd.data_name}|${sd.data_content}`
    if (!sdSeen.has(key)) { sdSeen.add(key); uniqueSoftData.push(sd) }
  })

  const sdGrouped = {}
  uniqueSoftData.forEach(sd => {
    if (!sdGrouped[sd.data_name]) sdGrouped[sd.data_name] = []
    sdGrouped[sd.data_name].push(sd)
  })

  const uniqueContacts = []
  const cSeen = new Set()
  contacts.forEach(c => {
    const key = `${c.contact_value}|${c.channel_provider_id}`
    if (!cSeen.has(key)) { cSeen.add(key); uniqueContacts.push(c) }
  })

  // Add email from persons table as virtual contact
  const allContacts = [...uniqueContacts]
  if (person.email && person.email.trim()) {
    const emailExists = allContacts.some(c => c.channel_provider_id === 5 && c.contact_value === person.email)
    if (!emailExists) {
      allContacts.push({
        contact_value: person.email,
        channel_provider_id: 5,
        provider_name: 'email',
        external_reference: null,
        _virtual: true,
      })
    }
  }

  const tagEntries = uniqueSoftData.filter(sd => sd.data_name.startsWith('tag_') || sd.data_name === 'difusion_recibida')
  const profileEntries = uniqueSoftData.filter(sd => !sd.data_name.startsWith('tag_') && sd.data_name !== 'difusion_recibida')

  const gridCols = isMobile ? '1fr' : '1fr 1fr'

  return (
    <div style={{ padding: isMobile ? 12 : 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, minWidth: 0 }}>
          <div style={{
            width: isMobile ? 40 : 56, height: isMobile ? 40 : 56, borderRadius: '50%', background: 'var(--acBg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: isMobile ? 16 : 22, fontWeight: 800, color: 'var(--ac)', flexShrink: 0,
          }}>
            {(person.first_name || '?')[0]?.toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[person.first_name, person.last_name].filter(Boolean).join(' ') || 'Sin nombre'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)' }}>ID: {person.id} — {fmtDate(person.creation_datetime)}</div>
            <div style={{ fontSize: 11, color: 'var(--t2)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              {age !== null && <span>{age} años</span>}
              {person.country && <span>{FLAG_MAP[person.country] || '🌍'} {person.country}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {!editing && <Btn small onClick={onStartEdit}>✏️</Btn>}
          <Btn small onClick={onClose}>{isMobile ? '← Volver' : '✕'}</Btn>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(80px,1fr))', gap: 6, marginBottom: 16 }}>
        <StatBox label="Conversaciones" value={stats.total_conversations || 0} color="var(--ac)" />
        <StatBox label="Mensajes" value={stats.total_messages || 0} color="var(--blu)" />
        <StatBox label="Primer contacto" value={fmtShort(stats.first_contact)} color="var(--t2)" small />
        <StatBox label="Último contacto" value={fmtShort(stats.last_contact)} color="var(--grn)" small />
      </div>

      {/* Canales de contacto */}
      <SectionTitle title="Canales de contacto" />
      <Card style={{ marginBottom: 16, padding: isMobile ? 10 : 14 }}>
        {allContacts.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: 12 }}>Sin canales registrados</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {allContacts.map((c, i) => {
              const isEmail = c.channel_provider_id === 5
              const isPhone = !isEmail && /^\d/.test(c.contact_value)
              const provColor = PROV_COLORS[c.provider_name?.toLowerCase()] || 'var(--ac)'
              const icon = isEmail ? '📧' : (isPhone ? '📱' : '💬')
              const badgeLabel = isEmail ? 'Email' : (c.provider_name || '').replace('whatsapp cloud api', 'WA Cloud').replace('whatsapp', 'WhatsApp')
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', background: 'var(--s2)', borderRadius: 8 }}>
                  <span style={{ fontSize: 14 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.contact_value}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                      {c.provider_name || 'desconocido'}
                      {c._virtual && ' (desde perfil)'}
                    </div>
                  </div>
                  <Badge bg={provColor + '22'} color={provColor}>{badgeLabel}</Badge>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Enviar mensaje */}
      <SendMessagePanel
        personId={person.id}
        contacts={allContacts}
        lastChannel={lastChannel}
        conversations={conversations}
        personEmail={person.email}
        isMobile={isMobile}
        onMessageSent={onMessageSent}
      />

      {/* Tags */}
      <SectionTitle title="Etiquetas e intereses" />
      <Card style={{ marginBottom: 16, padding: isMobile ? 10 : 14 }}>
        {tagEntries.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: 12 }}>Sin etiquetas</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {tagEntries.map((sd, i) => {
              const tc = TAG_COLORS[sd.data_name] || { bg: 'var(--s3)', color: 'var(--t2)' }
              return (
                <Badge key={i} bg={tc.bg} color={tc.color}>
                  {sd.data_name === 'difusion_recibida' ? `📢 ${sd.data_content}` : `📚 ${sd.data_content}`}
                </Badge>
              )
            })}
          </div>
        )}
      </Card>

      {/* Datos adicionales */}
      <SectionTitle title="Datos adicionales (perfil)" />
      <Card style={{ marginBottom: 16, padding: isMobile ? 10 : 14 }}>
        {profileEntries.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: 12 }}>Sin datos adicionales</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8 }}>
            {Object.entries(sdGrouped)
              .filter(([name]) => !name.startsWith('tag_') && name !== 'difusion_recibida')
              .map(([name, items]) => (
                <div key={name} style={{ padding: '6px 0' }}>
                  <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>
                    {SOFT_DATA_LABELS[name] || name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 500 }}>
                    {items.map(i => i.data_content).join(', ')}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </Card>

      {/* Datos personales (editable) */}
      <SectionTitle title="Datos personales" />
      <Card style={{ marginBottom: 16, padding: isMobile ? 10 : 14 }}>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PERSON_FIELDS.map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>
                  {f.l}
                </label>
                <input
                  type={f.type}
                  value={editData?.[f.k] ?? ''}
                  onChange={e => onChangeField(f.k, e.target.value)}
                  placeholder={f.l}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Btn small primary onClick={onSave} style={{ opacity: saving ? .6 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Btn>
              <Btn small onClick={onCancelEdit}>Cancelar</Btn>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 8 }}>
            {PERSON_FIELDS.map(f => (
              <div key={f.k} style={{ padding: '6px 0' }}>
                <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>{f.l}</div>
                <div style={{ fontSize: 13, color: person[f.k] ? 'var(--t1)' : 'var(--t3)', fontWeight: person[f.k] ? 500 : 400 }}>
                  {f.k === 'birth_date' && person[f.k] ? fmtShort(person[f.k]) : (
                    f.k === 'country' && person[f.k] ? `${FLAG_MAP[person[f.k]] || '🌍'} ${person[f.k]}` : (person[f.k] || '—')
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Conversaciones */}
      <SectionTitle title={`Conversaciones (${conversations.length})`} />
      <Card style={{ padding: isMobile ? 10 : 14 }}>
        {conversations.length === 0 ? (
          <div style={{ color: 'var(--t3)', fontSize: 12 }}>Sin conversaciones</div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Canal</th>
                  {!isMobile && <th>Proveedor</th>}
                  {!isMobile && <th>Sede</th>}
                  <th style={{ textAlign: 'right' }}>Msgs</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map(c => {
                  const pColor = PROV_COLORS[(c.provider || '').toLowerCase()] || 'var(--t2)'
                  return (
                    <tr key={c.conversation_id}>
                      <td style={{ fontWeight: 500 }}>{c.channel_name}</td>
                      {!isMobile && <td><Badge bg={pColor + '22'} color={pColor}>{c.provider}</Badge></td>}
                      {!isMobile && <td style={{ fontSize: 11 }}>{c.branch || '-'}</td>}
                      <td style={{ textAlign: 'right', fontSize: 11 }}>
                        <span style={{ color: 'var(--blu)' }}>{c.msgs_in || 0}↓</span>{' '}
                        <span style={{ color: 'var(--grn)' }}>{c.msgs_out || 0}↑</span>
                      </td>
                      <td style={{ fontSize: 11 }}>{fmtShort(c.start_date)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════
   SEND MESSAGE PANEL
   ═══════════════════════════════════════════ */
function SendMessagePanel({ personId, contacts, lastChannel, conversations, personEmail, isMobile, onMessageSent }) {
  const [open, setOpen] = useState(false)
  const [channels, setChannels] = useState([])
  const [loadingChannels, setLoadingChannels] = useState(false)

  const [selectedContact, setSelectedContact] = useState('')
  const [selectedChannel, setSelectedChannel] = useState('')
  const [msgText, setMsgText] = useState('')
  const [msgSubject, setMsgSubject] = useState('')
  const [attachUrl, setAttachUrl] = useState('')
  const [attachName, setAttachName] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!open || channels.length > 0) return
    setLoadingChannels(true)
    post({ endpoint: 'channels' })
      .then(d => setChannels(d || []))
      .catch(() => {})
      .finally(() => setLoadingChannels(false))
  }, [open])

  useEffect(() => {
    if (!open || !lastChannel || !contacts?.length) return
    const matchContact = contacts.find(c => c.contact_value === lastChannel.person_address)
    if (matchContact) {
      setSelectedContact(`${matchContact.channel_provider_id}|${matchContact.contact_value}`)
    }
    if (lastChannel.channel_id) {
      setSelectedChannel(String(lastChannel.channel_id))
    }
  }, [open, lastChannel, contacts])

  const parsedContact = selectedContact ? {
    provId: parseInt(selectedContact.split('|')[0]),
    address: selectedContact.split('|').slice(1).join('|'),
  } : null

  const isEmailMode = parsedContact?.provId === 5

  const compatibleChannels = parsedContact
    ? channels.filter(ch => (PROVIDER_COMPAT[parsedContact.provId] || []).includes(ch.id_channel_provider))
    : []

  useEffect(() => {
    if (!parsedContact) return
    const currentStillOk = compatibleChannels.find(ch => String(ch.id) === selectedChannel)
    if (!currentStillOk && compatibleChannels.length > 0) {
      setSelectedChannel(String(compatibleChannels[0].id))
    }
  }, [selectedContact, channels])

  const handleSend = async () => {
    if (!parsedContact || !selectedChannel) return
    if (!msgText.trim() && !attachUrl.trim()) return
    setSending(true)
    setResult(null)
    try {
      const params = {
        person_id: personId,
        person_address: parsedContact.address,
        channel_id: parseInt(selectedChannel),
        text: msgText.trim() || null,
        attachment_url: attachUrl.trim() || null,
        attachment_name: attachName.trim() || null,
      }
      if (isEmailMode && msgSubject.trim()) {
        params.subject = msgSubject.trim()
      }
      const res = await post({ endpoint: 'send_to_person', params })
      setResult({ ok: true, msg: `✓ ${isEmailMode ? 'Email' : 'Mensaje'} registrado (conv: ${res?.conversation_id})` })
      setMsgText('')
      setMsgSubject('')
      setAttachUrl('')
      setAttachName('')
      if (onMessageSent) onMessageSent()
    } catch (e) {
      setResult({ ok: false, msg: `Error: ${e.message}` })
    }
    setSending(false)
  }

  const selectedChannelObj = channels.find(ch => String(ch.id) === selectedChannel)

  const hasAnyContact = (contacts?.length > 0) || (personEmail && personEmail.trim())
  if (!hasAnyContact && !conversations?.length) return null

  const contactOptions = []
  const seenAddr = new Set()
  ;(contacts || []).forEach(c => {
    const key = `${c.channel_provider_id}|${c.contact_value}`
    if (!seenAddr.has(key)) {
      seenAddr.add(key)
      contactOptions.push({ key, provId: c.channel_provider_id, provName: c.provider_name || 'desconocido', address: c.contact_value })
    }
  })
  ;(conversations || []).forEach(cv => {
    if (!cv.address) return
    const provMap = { whatsapp: 1, 'whatsapp cloud api': 4, instagram: 2, messenger: 3, email: 5 }
    const provId = provMap[(cv.provider || '').toLowerCase()] || 1
    const key = `${provId}|${cv.address}`
    if (!seenAddr.has(key)) {
      seenAddr.add(key)
      contactOptions.push({ key, provId, provName: cv.provider || 'whatsapp', address: cv.address })
    }
  })

  return (
    <>
      <SectionTitle title="Enviar mensaje" />
      <Card style={{ marginBottom: 16, padding: 0, overflow: 'hidden' }}>
        <div
          onClick={() => setOpen(!open)}
          style={{
            padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', background: open ? 'var(--acBg)' : 'transparent',
            transition: 'background .15s',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: open ? 'var(--ac)' : 'var(--t1)' }}>
            ✉️ {open ? 'Enviar mensaje' : 'Enviar mensaje a esta persona'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--t3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>▼</span>
        </div>

        {open && (
          <div style={{ padding: isMobile ? 10 : 14, display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--bdr)' }}>
            {loadingChannels ? <Loading /> : (
              <>
                {/* Dropdowns - stack on mobile */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>
                      Canal de la persona
                    </label>
                    <select value={selectedContact} onChange={e => setSelectedContact(e.target.value)} style={{ width: '100%', fontSize: 12 }}>
                      <option value="">— Seleccionar —</option>
                      {contactOptions.map(co => {
                        const icon = PROVIDER_ICONS[co.provName.toLowerCase()] || '📱'
                        return <option key={co.key} value={co.key}>{icon} {co.provName} — {co.address}</option>
                      })}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 4 }}>
                      Canal IITA (enviar desde)
                    </label>
                    <select value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} style={{ width: '100%', fontSize: 12 }} disabled={!parsedContact}>
                      {!parsedContact && <option value="">Seleccione canal persona primero</option>}
                      {compatibleChannels.map(ch => {
                        const icon = PROVIDER_ICONS[ch.channel_providers?.name?.toLowerCase()] || '📱'
                        const branch = ch.branches?.name || ''
                        return <option key={ch.id} value={ch.id}>{icon} {ch.name} — {ch.address} {branch ? `(${branch})` : ''}</option>
                      })}
                      {parsedContact && compatibleChannels.length === 0 && <option value="">Sin canales compatibles</option>}
                    </select>
                  </div>
                </div>

                {parsedContact && selectedChannelObj && (
                  <div style={{ fontSize: 11, color: 'var(--t2)', background: 'var(--s2)', borderRadius: 6, padding: '6px 10px', wordBreak: 'break-word' }}>
                    📤 Desde <strong>{selectedChannelObj.name}</strong> → {PROVIDER_ICONS[PROVIDER_ID_TO_KEY[parsedContact.provId]] || '📱'} <strong>{parsedContact.address}</strong>
                    {isEmailMode && (
                      <span style={{ display: 'block', marginTop: 4, color: '#e74c3c', fontWeight: 600 }}>
                        ⚠️ Backend de email pendiente
                      </span>
                    )}
                  </div>
                )}

                {isEmailMode && (
                  <input placeholder="Asunto del email..." value={msgSubject} onChange={e => setMsgSubject(e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                )}

                <textarea
                  placeholder={isEmailMode ? 'Cuerpo del email...' : 'Escribir mensaje...'}
                  value={msgText} onChange={e => setMsgText(e.target.value)}
                  rows={isEmailMode ? 6 : 3}
                  style={{ width: '100%', resize: 'vertical', fontSize: 13 }}
                />

                <details style={{ fontSize: 12, color: 'var(--t3)' }}>
                  <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>📎 Adjuntar archivo (URL)</summary>
                  <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 8, marginTop: 6 }}>
                    <input placeholder="URL del archivo" value={attachUrl} onChange={e => setAttachUrl(e.target.value)} style={{ flex: 2, fontSize: 12 }} />
                    <input placeholder="Nombre (opcional)" value={attachName} onChange={e => setAttachName(e.target.value)} style={{ flex: 1, fontSize: 12 }} />
                  </div>
                </details>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <Btn small primary disabled={sending || (!msgText.trim() && !attachUrl.trim()) || !parsedContact || !selectedChannel} onClick={handleSend} style={{ opacity: sending ? .6 : 1 }}>
                    {sending ? '⏳ Enviando...' : (isEmailMode ? '📧 Enviar email' : '📨 Enviar')}
                  </Btn>
                  {result && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: result.ok ? 'var(--grn)' : '#e74c3c' }}>
                      {result.msg}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Card>
    </>
  )
}

/* ═══════ Small reusable components ═══════ */
function SectionTitle({ title }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8, marginTop: 4 }}>
      {title}
    </div>
  )
}

function StatBox({ label, value, color, small }) {
  return (
    <div style={{ background: 'var(--s2)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
      <div style={{ fontSize: small ? 12 : 16, fontWeight: 800, color }}>{value || '—'}</div>
      <div style={{ fontSize: 9, color: 'var(--t3)' }}>{label}</div>
    </div>
  )
}
