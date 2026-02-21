import { useState, useEffect, useCallback } from 'react'
import { post } from '@/lib/api'
import { fmtShort } from '@/lib/utils'
import { Card, Btn, Loading, Toast, Badge, TabBar } from '@/components/ui'
import GenericTable from '@/components/GenericTable'
import { useIsMobile } from '@/lib/useIsMobile'

const dayMap = { Monday: 'Lunes', Tuesday: 'Martes', Wednesday: 'Miércoles', Thursday: 'Jueves', Friday: 'Viernes', Saturday: 'Sábado', Sunday: 'Domingo' }
const dayOpts = Object.entries(dayMap).map(([v, l]) => ({ v, l }))
const billingOpts = [{ v: 'ONLY_REGISTRATION', l: 'Solo matrícula' }, { v: 'QUOTA', l: 'Matrícula + Cuota' }]

export default function Courses() {
  const [tab, setTab] = useState('open')
  const isMobile = useIsMobile()
  const [courses, setCourses] = useState([])
  const [editions, setEditions] = useState([])
  const [allSchedules, setAllSchedules] = useState([])
  const [branches, setBranches] = useState([])
  const [schedules, setSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')

  const [selCourse, setSelCourse] = useState(null)
  const [selEdition, setSelEdition] = useState(null)
  const [schedLoading, setSchedLoading] = useState(false)

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadAll = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [c, e, b, s] = await Promise.all([
        post({ action: 'select', table: 'courses', order: { col: 'id', asc: true } }),
        post({ action: 'select', table: 'course_editions', order: { col: 'id', asc: false } }),
        post({ endpoint: 'branches' }),
        post({ action: 'select', table: 'course_edition_schedule', order: { col: 'id', asc: true } }),
      ])
      setCourses(c || []); setEditions(e || []); setBranches(b || []); setAllSchedules(s || [])
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const loadSchedules = useCallback(async (editionId) => {
    setSchedLoading(true)
    try {
      const s = await post({
        action: 'select', table: 'course_edition_schedule',
        filters: [{ col: 'course_edition_id', op: 'eq', val: editionId }],
        order: { col: 'id', asc: true },
      })
      setSchedules(s || [])
    } catch (e) { setError(e.message) }
    setSchedLoading(false)
  }, [])

  const selectCourse = (id) => {
    setSelCourse(id === selCourse ? null : id)
    setSelEdition(null); setSchedules([])
  }
  const selectEdition = (id) => {
    if (id === selEdition) { setSelEdition(null); setSchedules([]) }
    else { setSelEdition(id); loadSchedules(id) }
  }

  const save = async (table, act, data, id) => {
    try {
      if (act === 'insert') await post({ action: 'insert', table, data })
      else if (act === 'update') await post({ action: 'update', table, data, id })
      else if (act === 'delete') {
        if (!confirm('¿Eliminar?')) return
        await post({ action: 'delete', table, id })
      }
      showToast('✓ Guardado')
      if (table === 'course_edition_schedule' && selEdition) loadSchedules(selEdition)
      else loadAll()
    } catch (e) { setError(e.message) }
  }

  if (loading) return <div style={{ padding: isMobile ? 10 : 24 }}><Loading /></div>

  const courseOpts = courses.map(c => ({ v: c.id, l: c.name }))
  const branchOpts = branches.map(b => ({ v: b.id, l: b.name }))
  const courseEditions = selCourse ? editions.filter(e => e.course_id === selCourse) : []
  const selectedCourseObj = selCourse ? courses.find(c => c.id === selCourse) : null
  const selectedEditionObj = selEdition ? editions.find(e => e.id === selEdition) : null

  const goToEditionDetail = (courseId, editionId) => {
    setTab('admin')
    setSelCourse(courseId)
    setSelEdition(editionId)
    loadSchedules(editionId)
  }

  return (
    <div style={{ padding: isMobile ? 10 : 24, animation: 'fadeIn .3s' }}>
      <Toast msg={toast} />
      <Toast msg={error} type="err" />

      <TabBar
        tabs={[
          { k: 'open', l: isMobile ? '🟢 Abiertas' : '🟢 Inscripciones abiertas' },
          { k: 'admin', l: '⚙️ Administración' },
        ]}
        active={tab}
        onChange={t => { setTab(t); if (t === 'admin') { setSelCourse(null); setSelEdition(null); setSchedules([]) } }}
      />

      {tab === 'open' && (
        <OpenEnrollments
          courses={courses}
          editions={editions}
          branches={branches}
          allSchedules={allSchedules}
          onViewDetail={goToEditionDetail}
          isMobile={isMobile}
        />
      )}

      {tab === 'admin' && (
        <AdminView
          courses={courses}
          editions={editions}
          branches={branches}
          schedules={schedules}
          schedLoading={schedLoading}
          selCourse={selCourse}
          selEdition={selEdition}
          selectedCourseObj={selectedCourseObj}
          selectedEditionObj={selectedEditionObj}
          courseEditions={courseEditions}
          courseOpts={courseOpts}
          branchOpts={branchOpts}
          selectCourse={selectCourse}
          selectEdition={selectEdition}
          save={save}
          isMobile={isMobile}
        />
      )}
    </div>
  )
}

/* ── Inscripciones abiertas ────────────────────────────── */

function OpenEnrollments({ courses, editions, branches, allSchedules, onViewDetail, isMobile }) {
  const [branchF, setBranchF] = useState('')
  const [courseF, setCourseF] = useState('')
  const [modalityF, setModalityF] = useState('')
  const [ageF, setAgeF] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(!isMobile)

  const enrolling = editions.filter(e => (e.status || '').toLowerCase() === 'enrolling')

  const filtered = enrolling.filter(e => {
    if (branchF && String(e.branch_id) !== branchF) return false
    if (courseF && String(e.course_id) !== courseF) return false
    if (modalityF && (e.modality || '').toLowerCase() !== modalityF.toLowerCase()) return false
    if (ageF) {
      const age = Number(ageF)
      if (e.min_age && age < e.min_age) return false
      if (e.max_age && age > e.max_age) return false
    }
    return true
  })

  const uniqueModalities = [...new Set(enrolling.map(e => e.modality).filter(Boolean))].sort()
  const enrollCourseIds = [...new Set(enrolling.map(e => e.course_id))]
  const enrollCourses = courses.filter(c => enrollCourseIds.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name))
  const hasFilters = branchF || courseF || modalityF || ageF

  return (
    <div>
      {/* Filters */}
      <Card style={{ marginBottom: 16, padding: isMobile ? 10 : 14 }}>
        {isMobile ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                {filtered.length} ediciones abiertas
                {hasFilters && <span style={{ color: 'var(--ac)', marginLeft: 6 }}>• filtros activos</span>}
              </div>
              <Btn small onClick={() => setFiltersOpen(!filtersOpen)} style={{
                background: filtersOpen || hasFilters ? 'var(--acBg)' : 'var(--s2)',
                color: filtersOpen || hasFilters ? 'var(--ac)' : 'var(--t3)',
              }}>⚙️ Filtros</Btn>
            </div>
            {filtersOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                <select value={courseF} onChange={e => setCourseF(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Todos los cursos</option>
                  {enrollCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={branchF} onChange={e => setBranchF(e.target.value)} style={{ width: '100%' }}>
                  <option value="">Todas las sedes</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={modalityF} onChange={e => setModalityF(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Modalidades</option>
                    {uniqueModalities.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <input type="number" placeholder="Edad" value={ageF} onChange={e => setAgeF(e.target.value)} style={{ width: 80 }} min={1} max={99} />
                </div>
                {hasFilters && (
                  <Btn small onClick={() => { setBranchF(''); setCourseF(''); setModalityF(''); setAgeF('') }}>Limpiar filtros</Btn>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="fr" style={{ gap: 8 }}>
              <select value={courseF} onChange={e => setCourseF(e.target.value)} style={{ minWidth: 180 }}>
                <option value="">Todos los cursos</option>
                {enrollCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={branchF} onChange={e => setBranchF(e.target.value)}>
                <option value="">Todas las sedes</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <select value={modalityF} onChange={e => setModalityF(e.target.value)}>
                <option value="">Todas las modalidades</option>
                {uniqueModalities.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input type="number" placeholder="Edad alumno" value={ageF} onChange={e => setAgeF(e.target.value)} style={{ width: 110 }} min={1} max={99} />
              {hasFilters && (
                <Btn small onClick={() => { setBranchF(''); setCourseF(''); setModalityF(''); setAgeF('') }}>Limpiar</Btn>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>
              {filtered.length} ediciones con inscripción abierta
              {ageF && <span> para edad {ageF}</span>}
            </div>
          </>
        )}
      </Card>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${isMobile ? '70px' : '130px'},1fr))`, gap: isMobile ? 6 : 10, marginBottom: 16 }}>
        <MiniKpi value={filtered.length} label="Abiertas" color="var(--grn)" isMobile={isMobile} />
        <MiniKpi value={[...new Set(filtered.map(e => e.course_id))].length} label="Cursos" color="var(--ac)" isMobile={isMobile} />
        <MiniKpi value={filtered.reduce((a, e) => a + (e.student_capacity || 0), 0)} label="Cupo total" color="var(--blu)" isMobile={isMobile} />
        <MiniKpi value={[...new Set(filtered.map(e => e.branch_id))].length} label="Sedes" color="var(--ylw)" isMobile={isMobile} />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div style={{ padding: isMobile ? 20 : 40, textAlign: 'center', color: 'var(--t3)' }}>No se encontraron ediciones con inscripción abierta para los filtros seleccionados</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
          {filtered.map(e => {
            const course = courses.find(c => c.id === e.course_id)
            const branch = branches.find(b => b.id === e.branch_id)
            const edSchedules = allSchedules.filter(s => s.course_edition_id === e.id)
            const isExpanded = expanded === e.id

            return (
              <Card key={e.id} style={{ padding: 0, overflow: 'hidden' }}>
                {/* Summary row */}
                <div
                  onClick={() => setExpanded(isExpanded ? null : e.id)}
                  style={{
                    padding: isMobile ? '10px 12px' : '14px 16px', cursor: 'pointer',
                    display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                    gap: isMobile ? 8 : 12, flexWrap: 'wrap',
                    background: isExpanded ? 'var(--s2)' : 'transparent',
                    transition: 'background .15s',
                    flexDirection: isMobile ? 'column' : 'row',
                  }}
                >
                  <div style={{ flex: 1, minWidth: isMobile ? '100%' : 220 }}>
                    <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: 'var(--t1)', marginBottom: 3 }}>
                      {course?.name || `Curso #${e.course_id}`}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Badge bg="var(--acBg)" color="var(--ac)">{branch?.name || '?'}</Badge>
                      {e.modality && <Badge bg="var(--bluBg)" color="var(--blu)">{e.modality}</Badge>}
                      <Badge bg="var(--grnBg)" color="var(--grn)">Inscribiendo</Badge>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: isMobile ? 10 : 14, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                    {edSchedules.length > 0 && (
                      <div style={{ fontSize: isMobile ? 11 : 12, color: 'var(--t2)' }}>
                        {edSchedules.map(s => dayMap[s.class_day]?.slice(0, 3) || s.class_day).join(', ')}
                        <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                          {edSchedules[0]?.start_time?.slice(0, 5)} - {edSchedules[0]?.end_time?.slice(0, 5)}
                        </div>
                      </div>
                    )}
                    <div style={{ textAlign: 'center', minWidth: isMobile ? 40 : 50 }}>
                      <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: 'var(--t1)' }}>{fmtShort(e.tentative_start_date)}</div>
                      <div style={{ fontSize: 9, color: 'var(--t3)' }}>Inicio</div>
                    </div>
                    {e.student_capacity && (
                      <div style={{ textAlign: 'center', minWidth: 30 }}>
                        <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: 'var(--blu)' }}>{e.student_capacity}</div>
                        <div style={{ fontSize: 9, color: 'var(--t3)' }}>Cupo</div>
                      </div>
                    )}
                    <span style={{ fontSize: 16, color: 'var(--t3)', transition: 'transform .2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ padding: isMobile ? '0 12px 12px' : '0 16px 16px', animation: 'fadeIn .2s' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit,minmax(${isMobile ? '100px' : '140px'},1fr))`, gap: isMobile ? 6 : 10, marginBottom: 14, marginTop: 4 }}>
                      <DetailField label="Curso" value={course?.name} />
                      <DetailField label="Sede" value={branch?.name} />
                      <DetailField label="Modalidad" value={e.modality} />
                      <DetailField label="Estado" value={e.status} />
                      <DetailField label="Inicio" value={fmtShort(e.tentative_start_date)} />
                      <DetailField label="Fin" value={fmtShort(e.tentative_end_date)} />
                      <DetailField label="Cupo" value={e.student_capacity} />
                      <DetailField label="Edad" value={e.min_age ? `${e.min_age} - ${e.max_age} años` : null} />
                      <DetailField label="Matrícula" value={course?.registration_price != null ? `$${Number(course.registration_price).toLocaleString()}` : null} />
                      <DetailField label="Cuota" value={course?.monthly_price ? `$${Number(course.monthly_price).toLocaleString()}` : null} />
                      <DetailField label="Duración" value={course?.duration_months ? `${course.duration_months} meses` : null} />
                      <DetailField label="Facturación" value={course?.billing_type === 'QUOTA' ? 'Matrícula + Cuota' : 'Solo matrícula'} />
                    </div>

                    {/* Schedules */}
                    {edSchedules.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Horarios</div>
                        <div style={{ display: 'flex', gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
                          {edSchedules.map(s => (
                            <div key={s.id} style={{
                              padding: isMobile ? '6px 10px' : '8px 14px', background: 'var(--s2)', borderRadius: 8, border: '1px solid var(--bdr)',
                              display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10,
                            }}>
                              <span style={{ fontWeight: 700, color: 'var(--ac)', fontSize: isMobile ? 11 : 13 }}>{dayMap[s.class_day] || s.class_day}</span>
                              <span style={{ fontSize: isMobile ? 11 : 13, color: 'var(--t1)' }}>{s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)}</span>
                              {s.disabled_date && <Badge bg="var(--redBg)" color="var(--red)">Susp. {fmtShort(s.disabled_date)}</Badge>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Detail text */}
                    {e.detail && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>Descripción</div>
                        <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 150, overflowY: 'auto', padding: isMobile ? '8px 10px' : '10px 12px', background: 'var(--s2)', borderRadius: 8 }}>
                          {e.detail}
                        </div>
                      </div>
                    )}

                    <Btn small onClick={() => onViewDetail(e.course_id, e.id)} style={{ marginTop: 4 }}>⚙️ Administrar edición</Btn>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MiniKpi({ value, label, color, isMobile }) {
  return (
    <Card style={{ padding: isMobile ? 8 : 12, textAlign: 'center' }}>
      <div style={{ fontSize: isMobile ? 16 : 22, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: isMobile ? 9 : 10, color: 'var(--t3)' }}>{label}</div>
    </Card>
  )
}

function DetailField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color: value ? 'var(--t1)' : 'var(--t3)', fontWeight: value ? 500 : 400 }}>{value || '—'}</div>
    </div>
  )
}

/* ── Administración (maestro-detalle-detalle) ──────────── */

function AdminView({
  courses, editions, branches, schedules, schedLoading,
  selCourse, selEdition, selectedCourseObj, selectedEditionObj, courseEditions,
  courseOpts, branchOpts, selectCourse, selectEdition, save, isMobile,
}) {
  return (
    <>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: isMobile ? 12 : 13, flexWrap: 'wrap' }}>
        <button
          onClick={() => { selectCourse(null) }}
          style={{
            background: !selCourse ? 'var(--ac)' : 'var(--s2)', color: !selCourse ? '#fff' : 'var(--ac)',
            border: '1px solid ' + (!selCourse ? 'var(--ac)' : 'var(--bdr)'),
            borderRadius: 8, padding: isMobile ? '5px 10px' : '6px 14px', fontWeight: 600, cursor: 'pointer', fontSize: isMobile ? 12 : 13,
          }}
        >
          📚 Cursos
        </button>
        {selCourse && (
          <>
            <span style={{ color: 'var(--t3)' }}>›</span>
            <button
              onClick={() => selectEdition(null)}
              style={{
                background: !selEdition ? 'var(--ac)' : 'var(--s2)', color: !selEdition ? '#fff' : 'var(--ac)',
                border: '1px solid ' + (!selEdition ? 'var(--ac)' : 'var(--bdr)'),
                borderRadius: 8, padding: isMobile ? '5px 10px' : '6px 14px', fontWeight: 600, cursor: 'pointer', fontSize: isMobile ? 12 : 13,
                maxWidth: isMobile ? 160 : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {selectedCourseObj?.name || `Curso #${selCourse}`}
              {!isMobile && <span style={{ marginLeft: 6, fontSize: 11, opacity: .7 }}>({courseEditions.length} ed.)</span>}
            </button>
          </>
        )}
        {selEdition && (
          <>
            <span style={{ color: 'var(--t3)' }}>›</span>
            <span style={{
              background: 'var(--ac)', color: '#fff', borderRadius: 8,
              padding: isMobile ? '5px 10px' : '6px 14px', fontWeight: 600, fontSize: isMobile ? 12 : 13,
              maxWidth: isMobile ? 140 : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              display: 'inline-block',
            }}>
              Ed. #{selEdition}
              {!isMobile && selectedEditionObj && (
                <span style={{ marginLeft: 6, fontSize: 11, opacity: .7 }}>
                  {branches.find(b => b.id === selectedEditionObj.branch_id)?.name} · {fmtShort(selectedEditionObj.tentative_start_date)}
                </span>
              )}
            </span>
          </>
        )}
      </div>

      {/* Level 1: Courses */}
      {!selCourse && (
        <div className="table-wrap">
          <GenericTable
            cols={[
              { k: 'id', l: 'ID', editable: false },
              { k: 'name', l: 'Nombre' },
              ...(!isMobile ? [
                { k: 'billing_type', l: 'Fact.', editType: 'select', opts: billingOpts },
                { k: 'registration_price', l: 'Matr.', editType: 'number', fmt: v => v != null ? `$${Number(v).toLocaleString()}` : '-' },
                { k: 'monthly_price', l: 'Cuota', editType: 'number', fmt: v => v != null ? `$${Number(v).toLocaleString()}` : '-' },
                { k: 'duration_months', l: 'Meses', editType: 'number' },
              ] : []),
              { k: 'disable', l: 'Off', fmt: v => v ? 'Sí' : 'No' },
              {
                k: 'id', l: isMobile ? 'Ed.' : 'Ediciones', editable: false,
                fmt: v => {
                  const count = editions.filter(e => e.course_id === v).length
                  return (
                    <button onClick={ev => { ev.stopPropagation(); selectCourse(v) }}
                      style={{ background: 'var(--acBg)', color: 'var(--ac)', border: 'none', borderRadius: 6, padding: isMobile ? '4px 8px' : '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {count} →
                    </button>
                  )
                },
              },
            ]}
            rows={courses}
            table="courses"
            editFields={[
              { k: 'name', l: 'Nombre' },
              { k: 'billing_type', l: 'Facturación', type: 'select', opts: billingOpts },
              { k: 'registration_price', l: 'Matrícula', type: 'number' },
              { k: 'monthly_price', l: 'Cuota', type: 'number' },
              { k: 'duration_months', l: 'Meses', type: 'number' },
              { k: 'modality', l: 'Modalidad' },
              { k: 'disable', l: 'Deshabilitado', type: 'bool' },
            ]}
            onSave={save}
          />
        </div>
      )}

      {/* Level 2: Editions */}
      {selCourse && !selEdition && (
        <>
          {selectedCourseObj && (
            <Card style={{ marginBottom: 16, padding: isMobile ? 12 : 16, display: 'flex', gap: isMobile ? 12 : 20, alignItems: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap', flexDirection: isMobile ? 'column' : 'row' }}>
              <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
                <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>{selectedCourseObj.name}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>
                  {selectedCourseObj.billing_type === 'QUOTA' ? 'Matrícula + Cuota' : 'Solo matrícula'}
                  {selectedCourseObj.duration_months ? ` · ${selectedCourseObj.duration_months} meses` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: isMobile ? 12 : 16, flexWrap: 'wrap' }}>
                {selectedCourseObj.registration_price != null && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: 'var(--ac)' }}>${Number(selectedCourseObj.registration_price).toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>Matrícula</div>
                  </div>
                )}
                {selectedCourseObj.monthly_price != null && selectedCourseObj.monthly_price > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: 'var(--grn)' }}>${Number(selectedCourseObj.monthly_price).toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: 'var(--t3)' }}>Cuota</div>
                  </div>
                )}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: 'var(--blu)' }}>{courseEditions.length}</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)' }}>Ediciones</div>
                </div>
              </div>
            </Card>
          )}
          <div className="table-wrap">
            <GenericTable
              cols={[
                { k: 'id', l: 'ID', editable: false },
                { k: 'branch_id', l: 'Sede', editType: 'select', opts: branchOpts, fmt: v => branches.find(b => b.id === v)?.name || v },
                { k: 'status', l: 'Estado', fmt: v => <Badge bg={v === 'Enrolling' ? 'var(--grnBg)' : 'var(--s3)'} color={v === 'Enrolling' ? 'var(--grn)' : 'var(--t3)'}>{v || '-'}</Badge> },
                ...(!isMobile ? [
                  { k: 'modality', l: 'Modalidad' },
                  { k: 'tentative_start_date', l: 'Inicio', editType: 'date', fmt: v => fmtShort(v) },
                  { k: 'tentative_end_date', l: 'Fin', editType: 'date', fmt: v => fmtShort(v) },
                  { k: 'student_capacity', l: 'Cupo', editType: 'number' },
                ] : [
                  { k: 'tentative_start_date', l: 'Inicio', editType: 'date', fmt: v => fmtShort(v) },
                ]),
                ...(!isMobile ? [
                  { k: 'min_age', l: 'Edad mín', editType: 'number' },
                  { k: 'max_age', l: 'Edad máx', editType: 'number' },
                ] : []),
                {
                  k: 'id', l: isMobile ? '📅' : 'Horarios', editable: false,
                  fmt: v => (
                    <button onClick={ev => { ev.stopPropagation(); selectEdition(v) }}
                      style={{ background: 'var(--acBg)', color: 'var(--ac)', border: 'none', borderRadius: 6, padding: isMobile ? '4px 8px' : '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      {isMobile ? '→' : 'Horarios →'}
                    </button>
                  ),
                },
              ]}
              rows={courseEditions}
              table="course_editions"
              editFields={[
                { k: 'course_id', l: 'Curso', type: 'select', opts: courseOpts },
                { k: 'branch_id', l: 'Sede', type: 'select', opts: branchOpts },
                { k: 'status', l: 'Estado' },
                { k: 'modality', l: 'Modalidad' },
                { k: 'tentative_start_date', l: 'Inicio tentativo', type: 'date' },
                { k: 'tentative_end_date', l: 'Fin tentativo', type: 'date' },
                { k: 'student_capacity', l: 'Cupo', type: 'number' },
                { k: 'min_age', l: 'Edad mínima', type: 'number' },
                { k: 'max_age', l: 'Edad máxima', type: 'number' },
                { k: 'detail', l: 'Detalle' },
              ]}
              onSave={save}
              extraNewData={{ course_id: selCourse }}
            />
          </div>
        </>
      )}

      {/* Level 3: Schedules */}
      {selEdition && (
        <>
          {selectedEditionObj && (
            <Card style={{ marginBottom: 16, padding: isMobile ? 12 : 16 }}>
              <div style={{ display: 'flex', gap: isMobile ? 10 : 20, alignItems: isMobile ? 'flex-start' : 'center', flexWrap: 'wrap', marginBottom: selectedEditionObj.detail ? 12 : 0, flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ flex: 1, minWidth: isMobile ? '100%' : 200 }}>
                  <div style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>
                    {selectedCourseObj?.name} — Ed. #{selectedEditionObj.id}
                  </div>
                  <div style={{ fontSize: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Badge bg="var(--acBg)" color="var(--ac)">{branches.find(b => b.id === selectedEditionObj.branch_id)?.name || '?'}</Badge>
                    {selectedEditionObj.status && <Badge bg={selectedEditionObj.status === 'Enrolling' ? 'var(--grnBg)' : 'var(--s3)'} color={selectedEditionObj.status === 'Enrolling' ? 'var(--grn)' : 'var(--t3)'}>{selectedEditionObj.status}</Badge>}
                    {selectedEditionObj.modality && <Badge bg="var(--bluBg)" color="var(--blu)">{selectedEditionObj.modality}</Badge>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: isMobile ? 10 : 16, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{fmtShort(selectedEditionObj.tentative_start_date)}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Inicio</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{fmtShort(selectedEditionObj.tentative_end_date)}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Fin</div></div>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blu)' }}>{selectedEditionObj.student_capacity || '-'}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Cupo</div></div>
                  {selectedEditionObj.min_age && <div style={{ textAlign: 'center' }}><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ylw)' }}>{selectedEditionObj.min_age}-{selectedEditionObj.max_age}</div><div style={{ fontSize: 10, color: 'var(--t3)' }}>Edad</div></div>}
                </div>
              </div>
              {selectedEditionObj.detail && (
                <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 120, overflowY: 'auto', padding: isMobile ? '8px 10px' : '10px 12px', background: 'var(--s2)', borderRadius: 8 }}>
                  {selectedEditionObj.detail}
                </div>
              )}
            </Card>
          )}
          {schedLoading ? <Loading /> : (
            <div className="table-wrap">
              <GenericTable
                cols={[
                  { k: 'id', l: 'ID', editable: false },
                  { k: 'class_day', l: 'Día', editType: 'select', opts: dayOpts, fmt: v => dayMap[v] || v },
                  { k: 'start_time', l: 'Inicio', fmt: v => v ? v.slice(0, 5) : '-' },
                  { k: 'end_time', l: 'Fin', fmt: v => v ? v.slice(0, 5) : '-' },
                  { k: 'disabled_date', l: isMobile ? 'Susp.' : 'Deshabilitado', editType: 'date', fmt: v => v ? fmtShort(v) : '' },
                ]}
                rows={schedules}
                table="course_edition_schedule"
                editFields={[
                  { k: 'class_day', l: 'Día', type: 'select', opts: dayOpts },
                  { k: 'start_time', l: 'Hora inicio' },
                  { k: 'end_time', l: 'Hora fin' },
                  { k: 'disabled_date', l: 'Fecha deshabilitado', type: 'date' },
                ]}
                onSave={save}
                extraNewData={{ course_edition_id: selEdition }}
              />
            </div>
          )}
        </>
      )}
    </>
  )
}
