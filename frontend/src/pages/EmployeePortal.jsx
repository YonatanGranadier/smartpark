import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { checkin, checkout, getMyStatus, getAttendance } from '../api/api'

export default function EmployeePortal() {
  const { employee, logout } = useAuth()
  const navigate = useNavigate()

  const [status,     setStatus]     = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [lastCmd,    setLastCmd]    = useState(null)
  const [recentRecs, setRecentRecs] = useState([])

  const loadData = async () => {
    try {
      const [sRes, rRes] = await Promise.all([
        getMyStatus(),
        getAttendance({ employee_id: employee.id, limit: 8 }),
      ])
      setStatus(sRes.data.status)
      setRecentRecs(rRes.data)
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!employee) { navigate('/login'); return }
    loadData()
  }, [employee])

  const handleCheckin = async () => {
    setLoading(true); setLastCmd(null)
    try {
      await checkin()
      setLastCmd({ ok: true, gate_type: 'entry' })
      await loadData()
    } catch (err) {
      const msg = err.response?.status === 409
        ? 'אתה כבר רשום כנמצא בחניון'
        : err.response?.data?.detail || 'שגיאה בתקשורת'
      setLastCmd({ ok: false, msg })
    } finally { setLoading(false) }
  }

  const handleCheckout = async () => {
    setLoading(true); setLastCmd(null)
    try {
      await checkout()
      setLastCmd({ ok: true, gate_type: 'exit' })
      await loadData()
    } catch (err) {
      const msg = err.response?.status === 409
        ? 'אינך רשום כנמצא בחניון'
        : err.response?.data?.detail || 'שגיאה בתקשורת'
      setLastCmd({ ok: false, msg })
    } finally { setLoading(false) }
  }

  if (!employee) return null

  const isIn  = status === 'in'
  const isOut = status === 'out' || status === null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-8 space-y-5">

        {/* כרטיס עובד */}
        <div className="bg-blue-700 text-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-200 text-sm">שלום,</p>
              <h1 className="text-2xl font-bold mt-0.5">{employee.name}</h1>
              <p className="text-blue-200 text-sm mt-1">
                עובד {employee.employee_number}
                {employee.department ? ` · ${employee.department}` : ''}
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl">👤</div>
              {status && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block
                  ${isIn ? 'bg-green-400 text-green-900' : 'bg-gray-300 text-gray-700'}`}>
                  {isIn ? '● בחניה' : '○ בחוץ'}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="mt-4 text-xs text-blue-200 hover:text-white underline"
          >
            התנתק
          </button>
        </div>

        {/* כפתורי כניסה / יציאה */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4 text-center">🚗 דווח נוכחות</h2>

          {lastCmd?.ok && (
            <div className="mb-4 text-center bg-green-50 border border-green-200 text-green-800 rounded-xl py-3 text-sm font-medium">
              {lastCmd.gate_type === 'entry'
                ? '✅ כניסה נרשמה – השער נפתח!'
                : '✅ יציאה נרשמה – השער נפתח!'}
            </div>
          )}
          {lastCmd?.ok === false && (
            <div className="mb-4 text-center bg-red-50 border border-red-200 text-red-700 rounded-xl py-3 text-sm">
              ❌ {lastCmd.msg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleCheckin}
              disabled={loading || isIn}
              className="flex flex-col items-center gap-2 py-6 rounded-2xl font-bold text-lg
                         bg-green-500 hover:bg-green-600 text-white transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <span className="text-3xl">⬇️</span>
              <span>כניסה לחניה</span>
            </button>

            <button
              onClick={handleCheckout}
              disabled={loading || isOut}
              className="flex flex-col items-center gap-2 py-6 rounded-2xl font-bold text-lg
                         bg-red-500 hover:bg-red-600 text-white transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <span className="text-3xl">⬆️</span>
              <span>יציאה מהחניה</span>
            </button>
          </div>

          {loading && (
            <p className="text-center text-gray-500 text-sm mt-3">⏳ שולח פקודה לשרת...</p>
          )}

          <p className="text-center text-xs text-gray-400 mt-4">
            לחיצה על הכפתור מעדכנת את הנוכחות <strong>ופותחת את השער</strong> אוטומטית.
          </p>
        </div>

        {/* פעילות אחרונה */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">📋 פעילות אחרונה</h2>
          {recentRecs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">אין רשומות עדיין</p>
          ) : (
            <ul className="space-y-2">
              {recentRecs.map(rec => (
                <li key={rec.id} className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                    ${rec.event_type === 'entry'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'}`}>
                    {rec.event_type === 'entry' ? '⬇ כניסה' : '⬆ יציאה'}
                  </span>
                  <span className="text-gray-500">
                    {format(new Date(rec.timestamp), 'dd/MM  HH:mm')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}