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

  // ×©×™× ×•×™ ×¡×™×¡×ž×”
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
        ? '××ª×” ×›×‘×¨ ×¨×©×•× ×›×ž×• × ×ž×¦× ×‘×—× ×™×•×Ÿ'
        : err.response?.data?.detail || '×©×’×™××” ×‘×ª×§×©×•×¨×ª'
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
        ? '××™× ×š ×¨×©×•× ×›×ž×• × ×ž×¦× ×‘×—× ×™×•×Ÿ'
        : err.response?.data?.detail || '×©×’×™××” ×‘×ª×§×©×•×¨×ª'
      setLastCmd({ ok: false, msg })
    } finally { setLoading(false) }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault(); setPwError('')
    if (pwForm.password !== pwForm.confirm) { setPwError('×”×¡×™×¡×ž××•×ª ××™× ×Ÿ ×ª×•××ž×•×ª'); return }
    try {
      await changePassword({ password: pwForm.password })
      setPwOk(true); setPwForm({ password: '', confirm: '' })
      setTimeout(() => setPwOk(false), 4000)
    } catch (err) { setPwError(err.response?.data?.detail || '×©×’×™××”') }
  }

  if (!employee) return null

  const isIn  = status === 'in'
  const isOut = status === 'out' || status === null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-8 space-y-5">

        {/* ×›×¨×˜×™×¡ ×¢×•×‘×“ */}
        <div className="bg-blue-700 text-white rounded-2xl p-6 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-200 text-sm">×©×œ×•×,</p>
              <h1 className="text-2xl font-bold mt-0.5">{employee.name}</h1>
              <p className="text-blue-200 text-sm mt-1">
                ×¢×•×‘×“ {employee.employee_number}
                {employee.department ? ` Â· ${employee.department}` : ''}
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl">ðŸ‘¤</div>
              {status && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full mt-1 inline-block
                  ${isIn ? 'bg-green-400 text-green-900' : 'bg-gray-300 text-gray-700'}`}>
                  {isIn ? 'â— ×‘×—× ×™×”' : 'â—‹ ×‘×—×•×¥'}
                </span>
              )}
            </div>
          </div>
          <button onClick={() => { logout(); navigate('/login') }}
            className="mt-4 text-xs text-blue-200 hover:text-white underline">
            ×”×ª× ×ª×§
          </button>
        </div>

        {/* â”€â”€â”€ ×›×¤×ª×•×¨×™ ×›× ×™×¡×” / ×™×¦×™××” â”€â”€â”€ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4 text-center">ðŸš— ×“×•×•×— × ×•×›×—×•×ª</h2>

          {/* ×”×•×“×¢×ª ××™×©×•×¨ */}
          {lastCmd?.ok && (
            <div className="mb-4 text-center bg-green-50 border border-green-200 text-green-800
                            rounded-xl py-3 text-sm font-medium">
              {lastCmd.gate_type === 'entry'
                ? 'âœ… ×›× ×™×¡×” × ×¨×©×ž×” â€“ ×”×©×¢×¨ × ×¤×ª×—!'
                : 'âœ… ×™×¦×™××” × ×¨×©×ž×” â€“ ×”×©×¢×¨ × ×¤×ª×—!'}
            </div>
          )}
          {lastCmd?.ok === false && (
            <div className="mb-4 text-center bg-red-50 border border-red-200 text-red-700
                            rounded-xl py-3 text-sm">
              âŒ {lastCmd.msg}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* ×›× ×™×¡×” */}
            <button
              onClick={handleCheckin}
              disabled={loading || isIn}
              className="flex flex-col items-center gap-2 py-6 rounded-2xl font-bold text-lg
                         bg-green-500 hover:bg-green-600 text-white transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <span className="text-3xl">â¬‡ï¸</span>
              <span>×›× ×™×¡×” ×œ×—× ×™×”</span>
            </button>

            {/* ×™×¦×™××” */}
            <button
              onClick={handleCheckout}
              disabled={loading || isOut}
              className="flex flex-col items-center gap-2 py-6 rounded-2xl font-bold text-lg
                         bg-red-500 hover:bg-red-600 text-white transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <span className="text-3xl">â¬†ï¸</span>
              <span>×™×¦×™××” ×ž×”×—× ×™×”</span>
            </button>
          </div>

          {loading && (
            <p className="text-center text-gray-500 text-sm mt-3">â³ ×©×•×œ×— ×¤×§×•×“×” ×œ×©×¨×ª...</p>
          )}

          <p className="text-center text-xs text-gray-400 mt-4">
            ×œ×—×™×¦×” ×¢×œ ×”×›×¤×ª×•×¨ ×ž×¢×“×›× ×ª ××ª ×”× ×•×›×—×•×ª <strong>×•×¤×•×ª×—×ª ××ª ×”×©×¢×¨</strong> ××•×˜×•×ž×˜×™×ª.
          </p>
        </div>

        {/* â”€â”€â”€ × ×•×›×—×•×ª ××—×¨×•× ×” â”€â”€â”€ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">ðŸ“‹ ×¤×¢×™×œ×•×ª ××—×¨×•× ×”</h2>
          {recentRecs.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">××™×Ÿ ×¨×©×•×ž×•×ª ×¢×“×™×™×Ÿ</p>
          ) : (
            <ul className="space-y-2">
              {recentRecs.map(rec => (
                <li key={rec.id} className="flex items-center justify-between text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                    ${rec.event_type === 'entry'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'}`}>
                    {rec.event_type === 'entry' ? 'â¬‡ ×›× ×™×¡×”' : 'â¬† ×™×¦×™××”'}
                  </span>
                  <span className="text-gray-500">
                    {format(new Date(rec.timestamp), 'dd/MM  HH:mm')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* â”€â”€â”€ ×©×™× ×•×™ ×¡×™×¡×ž×” â”€â”€â”€ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <button onClick={() => setShowPw(!showPw)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-800 w-full">
            <span>ðŸ” ×©×™× ×•×™ ×¡×™×¡×ž×”</span>
            <span className="mr-auto text-gray-400">{showPw ? 'â–²' : 'â–¼'}</span>
          </button>
          {showPw && (
            <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
              <div>
                <label className="label">×¡×™×¡×ž×” ×—×“×©×”</label>
                <input type="password" className="input" required minLength={6}
                  value={pwForm.password}
                  onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="label">××ž×ª ×¡×™×¡×ž×”</label>
                <input type="password" className="input" required
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
              </div>
              {pwError && <p className="text-red-600 text-sm">{pwError}</p>}
              {pwOk    && <p className="text-green-600 text-sm">âœ“ ×”×¡×™×¡×ž×” ×¢×•×“×›× ×”!</p>}
              <button type="submit" className="btn-primary w-full">×©×ž×•×¨ ×¡×™×¡×ž×”</button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}
