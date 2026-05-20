import { useEffect, useState, useCallback, useRef } from 'react'
import { io } from 'socket.io-client'
import { format } from 'date-fns'
import { getCurrentParking, getTodayAttendance, getEmployees } from '../api/api'
import StatCard       from '../components/StatCard'
import LoadingSpinner from '../components/LoadingSpinner'

const SOCKET_URL = `http://${window.location.hostname}:5000`

export default function Dashboard() {
  const [parking,    setParking]    = useState([])
  const [todayRecs,  setTodayRecs]  = useState([])
  const [totalEmps,  setTotalEmps]  = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [connected,  setConnected]  = useState(false)
  const [liveEvents, setLiveEvents] = useState([])

  const socketRef = useRef(null)

  const fetchAll = useCallback(async () => {
    try {
      const [p, t, e] = await Promise.all([
        getCurrentParking(),
        getTodayAttendance(),
        getEmployees(),
      ])
      setParking(p.data)
      setTodayRecs(t.data)
      setTotalEmps(e.data.length)
      setLastUpdate(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()

    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect',    () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('attendance_event', (data) => {
      setLastUpdate(new Date())
      setLiveEvents(prev => [data, ...prev].slice(0, 20))

      if (data.event === 'entry') {
        const newEntry = {
          id: data.employee_id, name: data.employee_name,
          department: data.department, since: data.timestamp,
        }
        setParking(prev => {
          if (prev.some(e => e.id === data.employee_id)) return prev
          return [newEntry, ...prev]
        })
        setTodayRecs(prev => [{
          id: Date.now(), event_type: 'entry',
          employee_name: data.employee_name, timestamp: data.timestamp,
        }, ...prev])
      } else if (data.event === 'exit') {
        setParking(prev => prev.filter(e => e.id !== data.employee_id))
        setTodayRecs(prev => [{
          id: Date.now(), event_type: 'exit',
          employee_name: data.employee_name, timestamp: data.timestamp,
        }, ...prev])
      }
    })

    return () => { socket.disconnect() }
  }, [fetchAll])

  const todayEntries = todayRecs.filter(r => r.event_type === 'entry').length
  const todayExits   = todayRecs.filter(r => r.event_type === 'exit').length

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-8">

      {/* כותרת */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">לוח בקרה</h1>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-xs font-medium
            ${connected ? 'text-green-600' : 'text-gray-400'}`}>
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
            {connected ? 'חי' : 'מנותק'}
          </span>
          {lastUpdate && (
            <span className="text-xs text-gray-400">
              עודכן: {format(lastUpdate, 'HH:mm:ss')}
            </span>
          )}
          <button onClick={fetchAll}
            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-1 rounded-lg transition-colors">
            ↻ רענן
          </button>
        </div>
      </div>

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="עובדים בחניון"  value={parking.length}  color="green"  icon="🚗" />
        <StatCard title="כניסות היום"    value={todayEntries}     color="blue"   icon="⬇️" />
        <StatCard title="יציאות היום"    value={todayExits}       color="orange" icon="⬆️" />
        <StatCard title="סה״כ עובדים"    value={totalEmps}        color="purple" icon="👥" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* עובדים בחניון כרגע */}
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            🚗 עובדים בחניון עכשיו
            <span className="mr-2 text-sm font-normal text-gray-400">({parking.length})</span>
          </h2>
          {parking.length === 0 ? (
            <p className="text-gray-400 text-center py-10">אין עובדים בחניון כרגע</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-right">
                    <th className="pb-2">שם</th>
                    <th className="pb-2">מחלקה</th>
                    <th className="pb-2">שעת כניסה</th>
                    <th className="pb-2">משך שהייה</th>
                  </tr>
                </thead>
                <tbody>
                  {parking.map(emp => {
                    const since  = new Date(emp.since)
                    const diffMs = Date.now() - since.getTime()
                    const hours  = Math.floor(diffMs / 3_600_000)
                    const mins   = Math.floor((diffMs % 3_600_000) / 60_000)
                    return (
                      <tr key={emp.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 font-medium">{emp.name}</td>
                        <td className="py-3 text-gray-500">{emp.department || '—'}</td>
                        <td className="py-3">{format(since, 'HH:mm')}</td>
                        <td className="py-3 text-gray-500">
                          {hours > 0 ? `${hours}ש׳ ` : ''}{mins}ד׳
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* סיכום מהיר */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">📊 סיכום יום</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-600">נוכחים כרגע</span>
              <span className="font-bold text-green-600">{parking.length}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-600">כניסות היום</span>
              <span className="font-bold text-blue-600">{todayEntries}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-600">יציאות היום</span>
              <span className="font-bold text-orange-600">{todayExits}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">סה״כ עובדים</span>
              <span className="font-bold text-purple-600">{totalEmps}</span>
            </div>
          </div>
          <p className={`text-xs mt-4 text-center ${connected ? 'text-green-500' : 'text-gray-400'}`}>
            {connected ? '● עדכונים בזמן אמת' : '○ מנותק מהשרת'}
          </p>
        </div>
      </div>

      {/* Live event ticker */}
      {liveEvents.length > 0 && (
        <div className="card border border-blue-100">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">⚡ אירועים בזמן אמת</h2>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {liveEvents.map((ev, i) => (
              <div key={i}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                    ${ev.event === 'entry'
                      ? 'bg-green-100 text-green-700'
                      : ev.event === 'exit'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'}`}>
                    {ev.event === 'entry' ? '⬇ כניסה' : ev.event === 'exit' ? '⬆ יציאה' : '⚠ נדחה'}
                  </span>
                  <span className="font-medium text-sm">{ev.employee_name || ev.plate || '—'}</span>
                  {ev.reason && <span className="text-xs text-gray-400">({ev.reason})</span>}
                </div>
                <span className="text-xs text-gray-400">
                  {format(new Date(ev.timestamp), 'HH:mm:ss')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* פעילות היום */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">📋 פעילות היום</h2>
        {todayRecs.length === 0 ? (
          <p className="text-gray-400 text-center py-8">אין רשומות להיום</p>
        ) : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {todayRecs.slice(0, 40).map(rec => (
              <div key={rec.id}
                className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                    ${rec.event_type === 'entry'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'}`}>
                    {rec.event_type === 'entry' ? '⬇ כניסה' : '⬆ יציאה'}
                  </span>
                  <span className="font-medium text-sm">{rec.employee_name || '—'}</span>
                </div>
                <span className="text-sm text-gray-500">
                  {format(new Date(rec.timestamp), 'HH:mm')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
