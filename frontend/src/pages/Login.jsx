import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { login }       = useAuth()
  const navigate        = useNavigate()
  const [form,   setForm]   = useState({ plate_number: '' })
  const [error,  setError]  = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.plate_number)
      navigate('/portal')
    } catch (err) {
      setError(err.response?.data?.detail || 'שגיאה בהתחברות')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">

        {/* לוגו */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🅿</div>
          <h1 className="text-2xl font-bold text-gray-800">SmartPark</h1>
          <p className="text-gray-500 text-sm mt-1">פורטל עובדים</p>
        </div>

        {/* טופס */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label">לוחית רישוי</label>
            <input
              className="input text-center tracking-widest text-lg"
              placeholder="123-45-678"
              value={form.plate_number}
              required
              autoFocus
              onChange={e => setForm(f => ({ ...f, plate_number: e.target.value }))}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base disabled:opacity-60"
          >
            {loading ? 'מתחבר...' : '🔑 כניסה'}
          </button>
        </form>


      </div>
    </div>
  )
}
