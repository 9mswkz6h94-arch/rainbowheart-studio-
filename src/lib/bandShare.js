export function bandEventDate(value) {
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function bandEventSlug(value) {
  return String(value || 'show')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'show'
}

export function bandShareUrl(origin, token, name) {
  return `${origin}/band/${encodeURIComponent(token)}/${bandEventSlug(name)}`
}

export function bandShareMessage(show) {
  return [
    show?.name || 'Band show',
    bandEventDate(show?.event_date),
    show?.event_details,
    show?.event_url ? `Event page: ${show.event_url}` : '',
  ].filter(Boolean).join('\n')
}
