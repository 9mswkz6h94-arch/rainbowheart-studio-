import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

function samplePdf() {
  const stream = text => `BT /F1 28 Tf 60 700 Td (${text}) Tj ET`
  const a = stream('Sample PDF - page one'), b = stream('Sample PDF - page two'), c = stream('Sample PDF - page three')
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R 8 0 R] /Count 3 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${a.length} >>\nstream\n${a}\nendstream`, `<< /Length ${b.length} >>\nstream\n${b}\nendstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 9 0 R >>', `<< /Length ${c.length} >>\nstream\n${c}\nendstream`]
  let out = '%PDF-1.4\n'; const offsets = [0]
  objects.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(out)
}

export default defineConfig({
  optimizeDeps: { entries: ['tests/songbook-review.html'] },
  plugins: [react(), { name: 'isolated-songbook-review', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/fixture.pdf') { res.setHeader('Content-Type', 'application/pdf'); res.end(samplePdf()); return }
      if (req.url?.startsWith('/band/')) req.url = '/tests/songbook-review.html'
      next()
    })
  } }],
  resolve: { alias: [
    { find: /.*\/lib\/setlists$/, replacement: fileURLToPath(new URL('./songbook-fixture.js', import.meta.url)) },
    { find: /.*\/lib\/setlistPdfs$/, replacement: fileURLToPath(new URL('./songbook-fixture.js', import.meta.url)) },
  ] },
  server: { host: '127.0.0.1', port: 5184, strictPort: true },
})
