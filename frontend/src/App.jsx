import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar          from './components/Navbar'
import Dashboard       from './pages/Dashboard'
import Employees       from './pages/Employees'
import Attendance      from './pages/Attendance'
import Reports         from './pages/Reports'
import Login           from './pages/Login'
import EmployeePortal  from './pages/EmployeePortal'

export default function App() {
  return (
    <AuthProvider>
      <Router>
        {/* Login ו-Portal = מסך מלא ללא navbar צדדי */}
        <Routes>
          <Route path="/login"  element={<Login />} />
          <Route path="/portal" element={<EmployeePortal />} />

          {/* שאר הדפים עם Navbar */}
          <Route path="/*" element={
            <div className="min-h-screen bg-gray-50">
              <Navbar />
              <main className="container mx-auto px-4 py-8 max-w-7xl">
                <Routes>
                  <Route path="/"           element={<Dashboard />}  />
                  <Route path="/employees"  element={<Employees />}  />
                  <Route path="/attendance" element={<Attendance />} />
                  <Route path="/reports"    element={<Reports />}    />
                </Routes>
              </main>
            </div>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  )
}
