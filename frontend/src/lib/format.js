export function formatNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const num = Number(value)
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}k`
  return num.toFixed(digits).replace(/\.?0+$/, '') || '0'
}

export function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(Number(value) * 100).toFixed(digits)}%`
}

export function formatMetric(label, value) {
  if (value === null || value === undefined) return '—'
  const isRatio = ['Accuracy', 'F1', 'Precision', 'Recall', 'ROC AUC'].includes(label)
  return isRatio ? formatPercent(value) : Number(value).toFixed(3)
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value.endsWith?.('Z') ? value : `${value}Z`)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(value) {
  if (!value) return '—'
  const date = new Date(value.endsWith?.('Z') ? value : `${value}Z`)
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  const steps = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.35, 'week'],
    [12, 'month'],
  ]
  let count = Math.max(seconds, 0)
  let unit = 'second'
  for (const [size, name] of steps) {
    if (count < size) {
      unit = name
      break
    }
    count = count / size
    unit = name
  }
  const rounded = Math.floor(count)
  if (unit === 'second' && rounded < 30) return 'just now'
  return `${rounded} ${unit}${rounded === 1 ? '' : 's'} ago`
}

export const CHART_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6']
