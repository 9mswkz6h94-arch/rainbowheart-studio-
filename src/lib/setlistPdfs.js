import { supabase } from './supabase'

const BUCKET = 'setlist-pdfs'
const MAX_PDF_BYTES = 10 * 1024 * 1024

export async function uploadSetListPdf(file) {
  if (!file || (file.type !== 'application/pdf' && !file.name?.toLowerCase().endsWith('.pdf'))) {
    throw new Error('Choose a PDF file.')
  }
  if (file.size > MAX_PDF_BYTES) {
    throw new Error('PDF files must be 10 MB or smaller.')
  }

  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData?.user) throw new Error('Sign in before uploading a PDF.')

  const path = `${authData.user.id}/${crypto.randomUUID()}.pdf`
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'application/pdf', cacheControl: '3600', upsert: false })

  if (uploadError) throw uploadError

  return { name: file.name, path, size: file.size }
}

export async function fetchSetListPdfUrl(showToken, pdfPath) {
  const response = await fetch('/.netlify/functions/setlist-pdf-url', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ showToken, pdfPath }),
  })
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.url) {
    throw new Error(result?.error || 'PDF could not be opened.')
  }
  return result.url
}
