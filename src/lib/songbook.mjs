// Align spreads to 1–2, 3–4, etc., including backward entry at the last page.
export function bookSpread(page, count, pagesPerView = 1) {
  const step = pagesPerView === 2 ? 2 : 1
  const clamped = Math.min(Math.max(0, page), Math.max(0, count - 1))
  const start = Math.floor(clamped / step) * step
  const end = Math.min(count, start + step)
  return { start, end, length: Math.max(0, end - start) }
}

export function pageLabel(start, end) {
  return end > start + 1 ? `Pages ${start + 1}–${end}` : `Page ${start + 1}`
}
