import { format } from 'date-fns'

/**
 * LiveEventTicker – רשימת אירועים חיים מ-WebSocket.
 * כל פעם שמצלמה מזהה לוחית האירוע מופיע ראשון ברשימה.
 */
export default function LiveEventTicker({ events, connected }) {
  if (events.length === 0 && !connected) {
    return (
      <div className="text-xs text-center text-gray-400 py-4">
        ממתין לחיבור...
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="text-xs text-center text-gray-400 py-4">
        ממתין לאירועים...
      </div>
    )
  }

  return (
    <ul className="space-y-2 max-h-64 overflow-y-auto">
      {events.map((ev, i) => {
        const ts   = new Date(ev.data.timestamp)
        const isOk = ev.event === 'attendance_event'
        return (
          <li
            key={i}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm
              ${isOk
                ? ev.data.event_type === 'entry'
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-blue-50 border border-blue-200'
                : 'bg-red-50 border border-red-200'
              }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {isOk
                  ? ev.data.event_type === 'entry' ? '🚗' : '🚙'
                  : '🚫'}
              </span>
              <div>
                <p className="font-medium leading-tight">
                  {isOk
                    ? ev.data.employee_name
                    : ev.data.reason}
                </p>
                <p className="text-xs text-gray-500">
                  {ev.data.plate}
                  {ev.data.department ? ` · ${ev.data.department}` : ''}
                </p>
              </div>
            </div>
            <div className="text-left flex flex-col items-end gap-1">
              <span className={`text-xs font-medium
                ${isOk
                  ? ev.data.event_type === 'entry'
                    ? 'text-green-700'
                    : 'text-blue-700'
                  : 'text-red-700'
                }`}>
                {isOk
                  ? ev.data.event_type === 'entry' ? '⬇ כניסה' : '⬆ יציאה'
                  : '✕ נדחה'}
              </span>
              <span className="text-xs text-gray-400">
                {format(ts, 'HH:mm:ss')}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
