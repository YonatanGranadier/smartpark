import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { getAttendance, getEmployees } from '../api/api'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Attendance() {
  const [records,   setRecords]   = useState([])
  const [employees, setEmployees] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [filters,   setFilters]   = useState({
    employee_id: '',
    date_from: format(new Date(), 'yyyy-MM-dd'),
    date_to:   format(new Date(), 'yyyy-MM-dd'),
  })

  useEffect(() => {
    getEmployees().then(r => setEmployees(r.data))
    fetchRecords()
  }, [])

  const fetchRecords = async (f = filters) => {
    setLoading(true)
    try {
      const params = {}
      if (f.employee_id) params.employee_id = f.employee_id
      if (f.date_from)   params.date_from   = f.date_from
      if (f.date_to)     params.date_to     = f.date_to
      const r = await getAttendance(params)
      setRecords(r.data)
    } finally {
      setLoading(false)
    }
  }

  const handleFilter = (e) => {
    e.preventDefault()
    fetchRecords(filters)
  }

  const setF = (k, v) => setFilters(prev => ({ ...prev, [k]: v }))

  const exportCSV = () => {
    const header = 'תאריך,שעה,שם,מחלקה,אירוע,שער'
    const rows = records.map(r => [
      format(new Date(r.timestamp), 'yyyy-MM-dd'),
      format(new Date(r.timestamp), 'HH:mm:ss'),
      r.employee_name || '',
      r.employee_department || '',
      r.event_type === 'entry' ? 'כניסה' : 'יציאה',
      r.gate_id,
    ].join(','))
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = 'attendance.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">📋 נוכחות</h1>
        <button onClick={exportCSV} className="btn-secondary text-sm">📥 ייצוא CSV</button>
      </div>

      {/* פילטרים */}
      <div className="card">
        <form onSubmit={handleFilter} className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">עובד</label>
            <select className="input w-48" value={filters.employee_id}
              onChange={e => setF('employee_id', e.target.value)}>
              <option value="">כל העובדים</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">מתאריך</label>
            <input type="date" className="input" value={filters.date_from}
              onChange={e => setF('date_from', e.target.value)} />
          </div>
          <div>
            <label className="label">עד תאריך</label>
            <input type="date" className="input" value={filters.date_to}
              onChange={e => setF('date_to', e.target.value)} />
          </div>
          <button type="submit" className="btn-primary">🔍 חפש</button>
        </form>
      </div>

      {/* טבלה */}
      {loading ? <LoadingSpinner /> : (
        <div className="card overflow-x-auto">
          <p className="text-sm text-gray-500 mb-3">{records.length} רשומות נמצאו</p>
          {records.length === 0 ? (
            <p className="text-center text-gray-400 py-10">אין רשומות</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-right">
                  <th className="pb-2">תאריך</th>
                  <th className="pb-2">שעה</th>
                  <th className="pb-2">שם עובד</th>
                  <th className="pb-2">מחלקה</th>
                  <th className="pb-2">אירוע</th>
                  <th className="pb-2">שער</th>
                </tr>
              </thead>
              <tbody>
                {records.map(rec => (
                  <tr key={rec.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2">{format(new Date(rec.timestamp), 'dd/MM/yyyy')}</td>
                    <td className="py-2">{format(new Date(rec.timestamp), 'HH:mm:ss')}</td>
                    <td className="py-2 font-medium">{rec.employee_name || '-'}</td>
                    <td className="py-2 text-gray-500">{rec.employee_department || '-'}</td>
                    <td className="py-2">
                      <span className={rec.event_type === 'entry' ? 'badge-green' : 'badge-red'}>
                        {rec.event_type === 'entry' ? '⬇ כניסה' : '⬆ יציאה'}
                      </span>
                    </td>
                    <td className="py-2 text-gray-400">{rec.gate_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
