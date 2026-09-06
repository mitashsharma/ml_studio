const TOKEN_KEY = 'mlstudio.token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.status = status
    this.details = details || {}
  }
}

async function handle(response) {
  const isJson = (response.headers.get('content-type') || '').includes('application/json')
  const payload = isJson ? await response.json() : null

  if (!response.ok) {
    if (response.status === 401) setToken(null)
    throw new ApiError(
      payload?.error || `Request failed (${response.status})`,
      response.status,
      payload?.details,
    )
  }
  return payload
}

function authHeaders(extra = {}) {
  const token = getToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

export const api = {
  get: (path) => fetch(path, { headers: authHeaders() }).then(handle),

  post: (path, body) =>
    fetch(path, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body ?? {}),
    }).then(handle),

  delete: (path) => fetch(path, { method: 'DELETE', headers: authHeaders() }).then(handle),

  upload: (path, formData) =>
    fetch(path, { method: 'POST', headers: authHeaders(), body: formData }).then(handle),

  download: async (path, fallbackName) => {
    const response = await fetch(path, { headers: authHeaders() })
    if (!response.ok) throw new ApiError('Download failed', response.status)
    const blob = await response.blob()
    const disposition = response.headers.get('content-disposition') || ''
    const match = disposition.match(/filename="?([^"]+)"?/)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = match ? match[1] : fallbackName
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },
}
