import { useEffect, useState } from 'react'
import {
  getEmployees, createEmployee, updateEmployee, deleteEmployee,
  adminSetPassword, addPlate, removePlate,
} from '../api/api'
import LoadingSpinner from '../components/LoadingSpinner'

const EMPTY_FORM = {
  name: '', employee_number: '', department: '', email: '', phone: '',
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editEmp,   setEditEmp]   = useState(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [search,    setSearch]    = useState('')
  const [error,     setError]     = useState('')

  // ניהול סיסמאות
  const [pwModal, setPwModal] = useState(null)
  const [pwInput, setPwInput] = useState('')
  const [pwErr,   setPwErr]   = useState('')
  const [pwDone,  setPwDone]  = useState(false)

  // ניהול לוחיות רישוי
  const [newPlate, setNewPlate] = useState({})   // { [empId]: string }
  const [plateErr, setPlateErr] = useState({})

  const load = async () => {
    setLoading(true)
    try { const r = await getEmployees(); setEmployees(r.data) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('')
    try {
      if (editEmp) {
        await updateEmployee(editEmp.id, {
          name: form.name, department: form.department,
          email: form.email, phone: form.phone,
        })
      } else {
        await createEmployee(form)
      }
      setShowForm(false); setEditEmp(null); setForm(EMPTY_FORM); load()
    } catch (err) {
      setError(err.response?.data?.detail || 'שגיאה בשמירה')
    }
  }

  const handleEdit = (emp) => {
    setEditEmp(emp)
    setForm({
      name: emp.name, employee_number: emp.employee_number,
      department: emp.department || '', email: emp.email || '', phone: emp.phone || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('האם למחוק עובד זה?')) return
    await deleteEmployee(id); load()
  }

  const handleToggleActive = async (emp) => {
    await updateEmployee(emp.id, { is_active: !emp.is_active }); load()
  }

  const openPwModal = (emp) => {
    setPwModal(emp); setPwInput(''); setPwErr(''); setPwDone(false)
  }

  const handleAdminSetPassword = async (e) => {
    e.preventDefault(); setPwErr('')
    if (pwInput.length < 6) { setPwErr('סיסמה חייבת להיות לפחות 6 תווים'); return }
    try {
      await adminSetPassword({ employee_id: pwModal.id, password: pwInput })
      setPwDone(true); setTimeout(() => setPwModal(null), 1500)
    } catch (err) { setPwErr(err.response?.data?.detail || 'שגיאה') }
  }

  const handleAddPlate = async (empId) => {
    const plate = (newPlate[empId] || '').trim().toUpperCase()
    if (!plate) return
    setPlateErr(prev => ({ ...prev, [empId]: '' }))
    try {
      await addPlate(empId, plate)
      setNewPlate(prev => ({ ...prev, [empId]: '' }))
      load()
    } catch (err) {
      setPlateErr(prev => ({
        ...prev,
        [empId]: err.response?.data?.detail || 'שגיאה בהוספת לוחית',
      }))
    }
  }

  const handleRemovePlate = async (empId, plateNumber) => {
    if (!confirm(`למחוק לוחית ${plateNumber}?`)) return
    try {
      await removePlate(empId, plateNumber)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'שגיאה במחיקת לוחית')
    }
  }

  const filtered = employees.filter(e =>
    e.name.includes(search) ||
    e.employee_number.includes(search) ||
    (e.department || '').includes(search)
  )

  return (
    <div className="space-y-6">

      {/* כותרת */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">👥 עובדים</h1>
        <button onClick={() => { setShowForm(!showForm); setEditEmp(null); setForm(EMPTY_FORM) }}
          className="btn-primary">
          {showForm ? '✕ סגור' : '+ עובד חדש'}
        </button>
      </div>

      {/* טופס הוספה/עריכה */}
      {showForm && (
        <div className="card border border-blue-200">
          <h2 className="text-lg font-semibold mb-4">{editEmp ? 'עריכת עובד' : 'הוספת עובד'}</h2>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">שם מלא *</label>
              <input className="input" value={form.name} required
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">מספר עובד *</label>
              <input className="input" value={form.employee_number} required disabled={!!editEmp}
                onChange={e => setForm(f => ({ ...f, employee_number: e.target.value }))} />
            </div>
            <div>
              <label className="label">מחלקה</label>
              <input className="input" value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input className="input" type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">טלפון</label>
              <input className="input" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary">💾 שמור</button>
              <button type="button" className="btn-secondary"
                onClick={() => { setShowForm(false); setEditEmp(null) }}>ביטול</button>
            </div>
          </form>
        </div>
      )}

      {/* חיפוש */}
      <input className="input max-w-sm" placeholder="🔍 חיפוש עובד..."
        value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? <LoadingSpinner /> : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-10">לא נמצאו עובדים</p>
          )}
          {filtered.map(emp => (
            <div key={emp.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">{emp.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                      ${emp.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {emp.is_active ? 'פעיל' : 'לא פעיל'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    מס׳ {emp.employee_number}{emp.department ? ` · ${emp.department}` : ''}
                  </p>
                  {(emp.email || emp.phone) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {emp.email}{emp.phone ? ` · ${emp.phone}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(emp)} className="btn-secondary text-xs py-1 px-3">✏️</button>
                  <button onClick={() => openPwModal(emp)} className="btn-secondary text-xs py-1 px-3">🔑</button>
                  <button onClick={() => handleToggleActive(emp)}
                    className={`text-xs py-1 px-3 rounded-lg font-medium transition-colors
                      ${emp.is_active
                        ? 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                        : 'bg-green-100 hover:bg-green-200 text-green-700'}`}>
                    {emp.is_active ? '🔒 הפסק' : '✅ הפעל'}
                  </button>
                  <button onClick={() => handleDelete(emp.id)} className="btn-danger text-xs py-1 px-3">🗑</button>
                </div>
              </div>

              {/* מודל הגדרת סיסמה (inline) */}
              {pwModal?.id === emp.id && (
                <form onSubmit={handleAdminSetPassword}
                  className="mt-3 border-t border-gray-100 pt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-500">🔑 הגדר סיסמה:</span>
                  <input type="password" className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
                    placeholder="סיסמה חדשה" minLength={6} required
                    value={pwInput} onChange={e => setPwInput(e.target.value)} />
                  <button type="submit"
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg">
                    שמור
                  </button>
                  <button type="button" onClick={() => setPwModal(null)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-lg">
                    ביטול
                  </button>
                  {pwErr  && <span className="text-red-600 text-xs">{pwErr}</span>}
                  {pwDone && <span className="text-green-600 text-xs">✓ נשמר!</span>}
                </form>
              )}

              {/* ניהול לוחיות רישוי */}
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500 mb-1.5">🚘 לוחיות רישוי:</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(emp.plates || []).length === 0 && (
                    <span className="text-xs text-gray-400">אין לוחיות רשומות</span>
                  )}
                  {(emp.plates || []).map(p => (
                    <span key={p.id}
                      className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-mono px-2 py-0.5 rounded-full">
                      {p.plate_number}
                      <button onClick={() => handleRemovePlate(emp.id, p.plate_number)}
                        className="text-blue-400 hover:text-red-500 leading-none font-bold ml-0.5">✕</button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="border border-gray-300 rounded px-2 py-1 text-sm w-32 uppercase"
                    placeholder="לוחית חדשה"
                    maxLength={10}
                    value={newPlate[emp.id] || ''}
                    onChange={e => setNewPlate(prev => ({ ...prev, [emp.id]: e.target.value.toUpperCase() }))}
                    onKeyDown={e => e.key === 'Enter' && handleAddPlate(emp.id)}
                  />
                  <button
                    onClick={() => handleAddPlate(emp.id)}
                    className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg">
                    + הוסף
                  </button>
                  {plateErr[emp.id] && (
                    <span className="text-red-600 text-xs">{plateErr[emp.id]}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
