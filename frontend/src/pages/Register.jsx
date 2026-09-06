import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, ArrowRight } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import { Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setErrors({})
    try {
      const user = await register(form)
      toast.success(`Workspace created — welcome, ${user.username}!`)
      navigate('/')
    } catch (err) {
      setError(err.message)
      setErrors(err.details || {})
    } finally {
      setLoading(false)
    }
  }

  const fields = [
    { key: 'username', label: 'Name', type: 'text', icon: User, placeholder: 'Ada Lovelace' },
    { key: 'email', label: 'Email', type: 'email', icon: Mail, placeholder: 'you@example.com' },
    {
      key: 'password',
      label: 'Password',
      type: 'password',
      icon: Lock,
      placeholder: 'At least 8 characters',
    },
  ]

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Free, local and private — your data never leaves your machine."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 ring-1 ring-rose-200">
            {error}
          </div>
        )}

        {fields.map(({ key, label, type, icon: Icon, placeholder }) => (
          <div key={key}>
            <label className="label" htmlFor={key}>
              {label}
            </label>
            <div className="relative">
              <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id={key}
                type={type}
                required
                className={`input pl-10 ${errors[key] ? 'ring-rose-300 focus:ring-rose-400' : ''}`}
                placeholder={placeholder}
                value={form[key]}
                onChange={update(key)}
              />
            </div>
            {errors[key] && <p className="mt-1.5 text-xs font-medium text-rose-600">{errors[key]}</p>}
          </div>
        ))}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Spinner className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          {loading ? 'Creating…' : 'Create workspace'}
        </button>
      </form>
    </AuthShell>
  )
}
