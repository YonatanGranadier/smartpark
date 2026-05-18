import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ─── Employees ───────────────────────────────────────────────
export const getEmployees    = ()           => api.get('/employees')
export const getEmployee     = (id)         => api.get(`/employees/${id}`)
export const createEmployee  = (data)       => api.post('/employees', data)
export const updateEmployee  = (id, data)   => api.put(`/employees/${id}`, data)
export const deleteEmployee  = (id)         => api.delete(`/employees/${id}`)

// ─── Attendance ──────────────────────────────────────────────
export const checkin            = ()         => api.post('/attendance/checkin')
export const checkout           = ()         => api.post('/attendance/checkout')
export const getMyStatus        = ()         => api.get('/attendance/status')
export const getAttendance      = (params)   => api.get('/attendance', { params })
export const getTodayAttendance = ()         => api.get('/attendance/today')
export const getCurrentParking  = ()         => api.get('/attendance/current')

// ─── Reports ─────────────────────────────────────────────────
export const getWorkHoursReport = (params)   =>
  api.get('/attendance/reports/work-hours', { params })

// ─── Auth ────────────────────────────────────────────────────
export const login           = (data)  => api.post('/auth/login', data)
export const getMe           = ()      => api.get('/auth/me')
export const changePassword  = (data)  => api.put('/auth/change-password', data)
export const adminSetPassword = (data) => api.put('/auth/admin/set-password', data)

// ─── License Plates ─────────────────────────────────────────
export const addPlate    = (empId, plate) => api.post(`/employees/${empId}/plates`, { plate_number: plate })
export const removePlate = (empId, plate) => api.delete(`/employees/${empId}/plates/${plate}`)

// ─── Gates ───────────────────────────────────────────────────
export const getMyGateCommand = () => api.get('/gates/my-command')

export default api
