import { createClient } from '@supabase/supabase-js'

const BUCKET = 'setlist-pdfs'
const SIGNED_URL_SECONDS = 60 * 60

export const config = {
  path: '/.netlify/functions/setlist-pdf-url',
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}

export default async (req) => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' })

  let payload
  try {
    payload = await req.json()
  } catch {
    return jsonResponse(400, { error: 'Invalid request' })
  }

  const showToken = typeof payload?.showToken === 'string' ? payload.showToken.trim() : ''
  const pdfPath = typeof payload?.pdfPath === 'string' ? payload.pdfPath.trim() : ''
  if (!showToken || showToken.length > 200 || !pdfPath || pdfPath.length > 300) {
    return jsonResponse(400, { error: 'Show token and PDF path are required' })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse(500, { error: 'Private PDF access is not configured' })
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: show, error: showError } = await admin
    .from('setlists')
    .select('songs')
    .eq('share_token', showToken)
    .maybeSingle()

  if (showError) return jsonResponse(500, { error: 'Could not verify this show' })
  if (!show) return jsonResponse(404, { error: 'Show not found' })

  const pdfBelongsToShow = Array.isArray(show.songs) && show.songs.some(item =>
    item?._type === 'custom-song' && item.pdf?.path === pdfPath
  )
  if (!pdfBelongsToShow) return jsonResponse(404, { error: 'PDF not found in this show' })

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_SECONDS)
  if (error || !data?.signedUrl) return jsonResponse(404, { error: 'PDF is unavailable' })

  return jsonResponse(200, { url: data.signedUrl, expiresIn: SIGNED_URL_SECONDS })
}
