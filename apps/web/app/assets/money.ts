const formatters = new Map<string, Intl.NumberFormat>()

function formatterFor(currency: string) {
  let formatter = formatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    })
    formatters.set(currency, formatter)
  }
  return formatter
}

function formatCents(amountCents: number, currency: string) {
  return formatterFor(currency).format(amountCents / 100)
}

function formatDay(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function today() {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export { formatCents, formatDay, today }
