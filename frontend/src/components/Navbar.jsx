import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const adminLinks = [
  { to: '/',            label: 'לוח בקרה', icon: '🏠' },
  { to: '/employees',   label: 'עובדים',    icon: '👥' },
  { to: '/attendance',  label: 'נוכחות',    icon: '📋' },
  { to: '/reports',     label: 'דוחות',     icon: '📊' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const navigate     = useNavigate()
  const { employee, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-blue-700 text-white shadow-md">
      <div className="container mx-auto px-4 flex items-center justify-between h-16">
        <Link to="/" className="text-xl font-bold tracking-wide hover:opacity-90">🅿 SmartPark</Link>

        <div className="flex items-center gap-1">
          {/* קישורי מנהל – נסתרים בדף הפורטל */}
          {!pathname.startsWith('/portal') && !pathname.startsWith('/login') && (
            <div className="flex gap-1 ml-2">
              {adminLinks.map(({ to, label, icon }) => (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                    ${pathname === to ? 'bg-white/20' : 'hover:bg-white/10'}`}
                >
                  <span>{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              ))}
            </div>
          )}

          {/* כניסה / פרטי עובד */}
          {employee ? (
            <div className="flex items-center gap-2 border-r border-white/20 pr-3 mr-1">
              <Link to="/portal"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                  ${pathname.startsWith('/portal') ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                <span>👤</span>
                <span className="hidden sm:inline max-w-[120px] truncate">{employee.name}</span>
              </Link>
              <button onClick={handleLogout}
                className="text-xs text-white/70 hover:text-white px-2 py-1 hover:bg-white/10 rounded-lg transition-colors">
                יציאה
              </button>
            </div>
          ) : (
            <Link to="/login"
              className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/20 border border-white/20 mr-1">
              <span>🔑</span>
              <span>כניסה לעובדים</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
