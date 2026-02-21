import { useState } from 'react'
import { Card, Btn } from '@/components/ui'
import { useIsMobile } from '@/lib/useIsMobile'

// Normalize timestamps like "2026-01-23T00:00:00" to "2026-01-23" for <input type="date">
const normDate = (v, type) => {
  if (type !== 'date' || !v) return v ?? ''
  return String(v).slice(0, 10)
}

export default function GenericTable({ cols, rows, table, editFields, onSave, extraNewData = {} }) {
  const [editRow, setEditRow] = useState(null)
  const [editData, setEditData] = useState({})
  const [newRow, setNewRow] = useState(null)
  const isMobile = useIsMobile()

  const handleSave = (act, data, id) => {
    onSave(table, act, data, id)
    setEditRow(null)
    setEditData({})
    setNewRow(null)
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Btn primary small onClick={() => { setNewRow({}); setEditRow(null) }}>+ Nuevo</Btn>
      </div>

      {newRow && (
        <Card style={{ marginBottom: 16, padding: isMobile ? 10 : 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--ac)' }}>Nuevo</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
            {editFields.filter(f => f.type !== 'hidden').map(f => (
              <div key={f.k}>
                <label style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4, display: 'block' }}>{f.l}</label>
                {f.type === 'select' ? (
                  <select value={newRow[f.k] || ''} onChange={e => setNewRow({ ...newRow, [f.k]: e.target.value })} style={{ width: '100%' }}>
                    <option value="">--</option>
                    {(f.opts || []).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                ) : f.type === 'bool' ? (
                  <select value={newRow[f.k] === true ? 'true' : 'false'} onChange={e => setNewRow({ ...newRow, [f.k]: e.target.value === 'true' })} style={{ width: '100%' }}>
                    <option value="false">No</option>
                    <option value="true">Sí</option>
                  </select>
                ) : (
                  <input type={f.type || 'text'} value={normDate(newRow[f.k], f.type) || ''} onChange={e => setNewRow({ ...newRow, [f.k]: e.target.value })} style={{ width: '100%' }} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Btn primary small onClick={() => handleSave('insert', { ...newRow, ...extraNewData })}>Guardar</Btn>
            <Btn small onClick={() => setNewRow(null)}>Cancelar</Btn>
          </div>
        </Card>
      )}

      <table>
        <thead>
          <tr>
            {cols.map(c => <th key={c.k}>{c.l}</th>)}
            <th style={{ width: isMobile ? 70 : 90 }}>Acc.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              {cols.map(c => (
                <td key={c.k}>
                  {editRow === r.id && c.editable !== false ? (
                    c.editType === 'select' ? (
                      <select value={editData[c.k] ?? r[c.k] ?? ''} onChange={e => setEditData({ ...editData, [c.k]: e.target.value })} style={{ width: '100%', padding: '4px' }}>
                        <option value="">--</option>
                        {(c.opts || []).map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                    ) : (
                      <input type={c.editType || 'text'} value={normDate(editData[c.k] ?? r[c.k], c.editType) ?? ''} onChange={e => setEditData({ ...editData, [c.k]: e.target.value })} style={{ width: '100%', padding: '4px' }} />
                    )
                  ) : (
                    <span title={r[c.k]}>{c.fmt ? c.fmt(r[c.k], r) : r[c.k]}</span>
                  )}
                </td>
              ))}
              <td>
                {editRow === r.id ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn small primary onClick={() => handleSave('update', editData, r.id)}>✓</Btn>
                    <Btn small onClick={() => { setEditRow(null); setEditData({}) }}>✕</Btn>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Btn small onClick={() => { setEditRow(r.id); setEditData({ ...r }) }}>✏️</Btn>
                    <Btn small style={{ color: 'var(--red)' }} onClick={() => handleSave('delete', null, r.id)}>🗑️</Btn>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>Sin registros</div>}
    </div>
  )
}
