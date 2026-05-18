import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { checkin, checkout, getMyStatus, getAttendance, changePassword } from '../api/api'

export default function EmployeePortal() {
  const { employee, logout } = useAuth()
  const navigate = useNavigate()

  const [status,    setStatus]    = useState(null)    // 'in' | 'out'
  const [loading,   setLoading]   = useState(false)
  const [lastCmd,   setLastCmd]   = useState(null)    // {ok, gate_type}
  const [recentRecs, setRecentRecs] = useState([])

  // שינוי סיסמה
  const [pwForm,  setPwForm]  = useState({ password: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwOk,    setPwOk]    = useState(false)
  const [showPw,  setShowPw]  = useState(false)

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
        ? 'אתה כבר רשום כמו נמצא בחניון'
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
        ? 'אינך רשום כמו נמצא בחניון'
        : err.response?.data?.detail || 'שגיאה בתקשורת'
      setLastCmd({ ok: false, msg })
    } finally { setLoading(false) }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault(); setPwError('')
    if (pwForm.password !== pwForm.confirm) { setPwError('הסיסמאות אינן תואמות'); return }
    try {
      await changePassword({ password: pwForm.password })
      setPwOk(true); setPwForm({ password: '', confirm: '' })
      setTimeout(() => setPwOk(false), 4000)
    } catch (err) { setPwError(err.response?.data?.detail || 'שגיאה') }
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
          <button onClick={() => { logout(); navigate('/login') }}
            className="mt-4 text-xs text-blue-200 hover:text-white underline">
            התנתק
          </button>
        </div>

        {/* ─── כפתורי כניסה / יציאה ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4 text-center">🚗 דווח נוכחות</h2>

          {/* הודעת אישור */}
          {lastCmd?.ok && (
            <div className="mb-4 text-center bg-green-50 border border-green-200 text-green-800
                            rounded-xl py-3 text-sm font-medium">
              {lastCmd.gate_type === 'entry'
                ? '✅ כניסה נרשמה – השער נפתח!'
                : '✅ יציאה נרשמה – השער נפתח!'}
            </div>
          )}
          {lastCmd?.ok === false && (
            <div className="mb-4 text-center bg-red-50 border border-red-200 text-red-700
                            rounded-xl py-3 text-sm">
              ❌ {lastCmd.msg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* כניסה */}
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

            {/* יציאה */}
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

        {/* ─── נוכחות אחרונה ─── */}
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

        {/* ─── שינוי סיסמה ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <button onClick={() => setShowPw(!showPw)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 w-full">
            <span>🔐 שינוי סיסמה</span>
            <span className="mr-auto text-gray-400">{showPw ? '▲' : '▼'}</span>
          </button>
          {showPw && (
            <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
              <div>
                <label className="label">סיסמה חדשה</label>
                <input type="password" className="input" required minLength={6}
                  value={pwForm.password}
                  onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="label">אמת סיסמה</label>
                <input type="password" className="input" required
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
              </div>
              {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
              {pwOk    && <p className="text-green-600 text-sm">✓ הסיסמה עודכנה!</p>}
              <button type="submit" className="btn-primary w-full">שמור סיסמה</button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}


const STATUS_LABEL = {
  pending:  { text: '⏳ ממתין לאישור הבקרה',  cls: 'bg-yellow-50 border-yellow-300 text-yellow-800' },
  executed: { text: '✅ השער נפתח בהצלחה!',    cls: 'bg-green-50  border-green-300  text-green-800'  },
  expired:  { text: '⌛ פג תוקף הבקשה',         cls: 'bg-gray-50   border-gray-300   text-gray-600'   },
}

export default function EmployeePortal() {
  const { employee, logout } = useAuth()
  const navigate = useNavigate()

  const [gateCmd,    setGateCmd]    = useState(null)   // GateCommandResponse
  const [gateLoading, setGateLoading] = useState(false)
  const [confirm,    setConfirm]    = useState(false)
  const [gateError,  setGateError]  = useState('')
  const [recentRecs, setRecentRecs] = useState([])

  // שינוי סיסמה
  const [pwForm,  setPwForm]  = useState({ password: '', confirm: '' })
  const [pwError, setPwError] = useState('')
  const [pwOk,    setPwOk]    = useState(false)
  const [showPw,  setShowPw]  = useState(false)

  // טען רשומות נוכחות אחרונות
  useEffect(() => {
    if (!employee) return
    api.get('/attendance/', { params: { employee_id: employee.id, limit: 10 } })
      .then(r => setRecentRecs(r.data))
      .catch(() => {})
  }, [employee])

  // polling: עדכן סטטוס פקודת שער
  useEffect(() => {
    if (!gateCmd || gateCmd.status !== 'pending') return
    const id = setInterval(async () => {
      try {
        const r = await api.get('/gates/my-command')
        setGateCmd(r.data)
        if (r.data.status !== 'pending') clearInterval(id)
      } catch { clearInterval(id) }
    }, 3000)
    return () => clearInterval(id)
  }, [gateCmd?.id, gateCmd?.status])

  const requestGateOpen = async () => {
    setGateError('')
    setGateLoading(true)
    setConfirm(false)
    try {
      const r = await api.post('/gates/request-open?gate_type=entry')
      setGateCmd(r.data)
    } catch (err) {
      setGateError(err.response?.data?.detail || 'שגיאה בשליחת הבקשה')
    } finally {
      setGateLoading(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwError('')
    if (pwForm.password !== pwForm.confirm) {
      setPwError('הסיסמאות אינן תואמות')
      return
    }
    try {
      await api.put('/auth/change-password', { password: pwForm.password })
      setPwOk(true)
      setPwForm({ password: '', confirm: '' })
      setTimeout(() => setPwOk(false), 4000)
    } catch (err) {
      setPwError(err.response?.data?.detail || 'שגיאה')
    }
  }

  if (!employee) {
    navigate('/login')
    return null
  }

  const cmdStatus = gateCmd ? STATUS_LABEL[gateCmd.status] : null
  const canRequest = !gateCmd || gateCmd.status !== 'pending'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">

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
            <div className="text-4xl">👤</div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login') }}
            className="mt-4 text-xs text-blue-200 hover:text-white underline"
          >
            התנתק
          </button>
        </div>

        {/* ─── פתיחת שער ידנית ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🚧</span>
            <h2 className="font-semibold text-gray-800">פתיחת שער ידנית</h2>
            <span className="badge-red text-xs">גיבוי בלבד</span>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            השתמש/י באפשרות זו <strong>רק</strong> כאשר מערכת זיהוי הלוחית אינה פועלת.
          </p>

          {/* סטטוס */}
          {cmdStatus && (
            <div className={`rounded-lg border px-4 py-3 mb-4 text-sm font-medium ${cmdStatus.cls}`}>
              {cmdStatus.text}
              {gateCmd?.status === 'executed' && gateCmd.executed_at && (
                <span className="block text-xs font-normal mt-0.5 opacity-80">
                  {format(new Date(gateCmd.executed_at), 'HH:mm:ss')}
                </span>
              )}
            </div>
          )}

          {gateError && (
            <p className="text-red-600 text-sm mb-3">{gateError}</p>
          )}

          {/* כפתור / אישור */}
          {!confirm ? (
            <button
              onClick={() => setConfirm(true)}
              disabled={gateLoading || !canRequest}
              className="w-full py-3 rounded-xl font-medium text-white bg-orange-500 hover:bg-orange-600
                         disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {gateLoading ? '⏳ שולח בקשה...' : '🔓 בקש פתיחת שער'}
            </button>
          ) : (
            <div className="border border-orange-200 rounded-xl bg-orange-50 p-4 space-y-3">
              <p className="text-sm text-orange-800 font-medium text-center">
                האם לשלוח בקשה לפתיחת השער?<br />
                <span className="font-normal text-xs">הפעולה תירשם במערכת.</span>
              </p>
              <div className="flex gap-3">
                <button onClick={requestGateOpen}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium text-sm transition-colors">
                  ✓ כן, פתח שער
                </button>
                <button onClick={() => setConfirm(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium text-sm transition-colors">
                  ✕ ביטול
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ─── נוכחות אחרונה ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">📋 נוכחות אחרונה</h2>
          {recentRecs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">אין רשומות</p>
          ) : (
            <ul className="space-y-2">
              {recentRecs.map(rec => (
                <li key={rec.id} className="flex items-center justify-between text-sm">
                  <span className={rec.event_type === 'entry' ? 'badge-green' : 'badge-red'}>
                    {rec.event_type === 'entry' ? '⬇ כניסה' : '⬆ יציאה'}
                  </span>
                  <span className="text-gray-500">
                    {format(new Date(rec.timestamp), 'dd/MM  HH:mm')}
                  </span>
                  <span className="badge-gray">{rec.plate_number}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ─── שינוי סיסמה ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <button
            onClick={() => setShowPw(!showPw)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 w-full"
          >
            <span>🔐 שינוי סיסמה</span>
            <span className="mr-auto text-gray-400">{showPw ? '▲' : '▼'}</span>
          </button>

          {showPw && (
            <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
              <div>
                <label className="label">סיסמה חדשה</label>
                <input type="password" className="input" required minLength={6}
                  value={pwForm.password}
                  onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="label">אמת סיסמה</label>
                <input type="password" className="input" required
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
              </div>
              {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
              {pwOk    && <p className="text-green-600 text-sm">✓ הסיסמה עודכנה!</p>}
              <button type="submit" className="btn-primary w-full">שמור סיסמה</button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
