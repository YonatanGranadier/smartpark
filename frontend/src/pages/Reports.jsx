import { useState } from 'react'
import { format, subDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { getWorkHoursReport, getEmployees } from '../api/api'
import LoadingSpinner from '../components/LoadingSpinner'
import { useEffect } from 'react'

export default function Reports() {
  const [employees, setEmployees] = useState([])
  const [reports,   setReports]   = useState([])
  const [loading,   setLoading]   = useState(false)
  const [searched,  setSearched]  = useState(false)
  const [filters,   setFilters]   = useState({
    employee_id: '',
    date_from: format(subDays(new Date(), 6), 'yyyy-MM-dd'),
    date_to:   format(new Date(), 'yyyy-MM-dd'),
  })

  useEffect(() => { getEmployees().then(r => setEmployees(r.data)) }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const params = { date_from: filters.date_from, date_to: filters.date_to }
      if (filters.employee_id) params.employee_id = filters.employee_id
      const r = await getWorkHoursReport(params)
      setReports(r.data)
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const setF = (k, v) => setFilters(prev => ({ ...prev, [k]: v }))

  // נתוני תרשים: שעות עבודה לפי עובד
  const chartData = reports.map(r => ({
    name: r.employee_name.split(' ')[0],  // שם פרטי
    'שעות עבודה': r.total_hours,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">📊 דוחות שעות עבודה</h1>

      {/* פילטרים */}
      <div className="card">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
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
              onChange={e => setF('date_from', e.target.value)} required />
          </div>
          <div>
            <label className="label">עד תאריך</label>
            <input type="date" className="input" value={filters.date_to}
              onChange={e => setF('date_to', e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary">📊 הפק דוח</button>
        </form>
      </div>

      {loading && <LoadingSpinner />}

      {searched && !loading && reports.length === 0 && (
        <p className="text-center text-gray-400 py-10 card">לא נמצאו נתוני נוכחות לתקופה הנבחרת</p>
      )}

      {reports.length > 0 && !loading && (
        <>
          {/* תרשים */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">סיכום שעות עבודה</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit="ש׳" />
                <Tooltip formatter={(v) => [`${v} שעות`]} />
                <Legend />
                <Bar dataKey="שעות עבודה" fill="#3b82f6" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* טבלת סיכום */}
          <div className="card overflow-x-auto">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">פירוט לפי עובד</h2>
            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="border-b text-gray-500 text-right">
                  <th className="pb-2">שם</th>
                  <th className="pb-2">מספר עובד</th>
                  <th className="pb-2">סה״כ שעות</th>
                  <th className="pb-2">מס׳ ימים</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.employee_id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 font-medium">{r.employee_name}</td>
                    <td className="py-2 text-gray-500">{r.employee_number}</td>
                    <td className="py-2 font-bold text-blue-700">{r.total_hours}h</td>
                    <td className="py-2">{r.sessions.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* פירוט סשנים */}
            {reports.map(r => (
              <details key={r.employee_id} className="mb-4 border rounded-lg">
                <summary className="cursor-pointer px-4 py-2 bg-gray-50 rounded-lg font-medium text-sm">
                  {r.employee_name} – פירוט יומי ({r.sessions.length} ימים)
                </summary>
                <table className="w-full text-xs mt-2 px-4">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="pb-1 px-4 text-right">תאריך</th>
                      <th className="pb-1 px-4 text-right">כניסה</th>
                      <th className="pb-1 px-4 text-right">יציאה</th>
                      <th className="pb-1 px-4 text-right">משך</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.sessions.map((s, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-1.5 px-4">{s.date}</td>
                        <td className="py-1.5 px-4">{format(new Date(s.entry_time), 'HH:mm')}</td>
                        <td className="py-1.5 px-4">
                          {s.exit_time ? format(new Date(s.exit_time), 'HH:mm') :
                            <span className="badge-orange text-xs">בחניון</span>}
                        </td>
                        <td className="py-1.5 px-4">
                          {s.duration_hours != null ? `${s.duration_hours}h` :
                            <span className="text-gray-400">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
