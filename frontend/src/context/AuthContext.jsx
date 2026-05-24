import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [employee, setEmployee] = useState(null)
  const [loading,  setLoading]  = useState(true)

  // שחזר session מ-localStorage
  useEffect(() => {
    const token = localStorage.getItem('sp_token')
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      api.get('/auth/me')
        .then(r => setEmployee(r.data))
        .catch(() => {
          localStorage.removeItem('sp_token')
          delete api.defaults.headers.common['Authorization']
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (plate_number) => {
    const r = await api.post('/auth/login', { plate_number })
    localStorage.setItem('sp_token', r.data.access_token)
    api.defaults.headers.common['Authorization'] = `Bearer ${r.data.access_token}`
    setEmployee(r.data.employee)
    return r.data.employee
  }

  const logout = () => {
    localStorage.removeItem('sp_token')
    delete api.defaults.headers.common['Authorization']
    setEmployee(null)
  }

  return (
    <AuthContext.Provider value={{ employee, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
