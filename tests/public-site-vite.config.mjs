import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  envDir: false,
  optimizeDeps: { entries: ['tests/public-site-review.html'] },
  resolve: { alias: [
    { find: /.*\/context\/AuthContext$/, replacement: fileURLToPath(new URL('./public-site-auth.jsx', import.meta.url)) },
  ] },
  plugins: [react(), {
    name: 'public-site-isolation',
    enforce: 'pre',
    resolveId(id) {
      if (id.includes('supabase') || /\/lib\/(songs|setlists|memory|songHandoffs)$/.test(id)) {
        throw new Error('Production data module forbidden in public-site preview: ' + id)
      }
    },
    transform(code, id) {
      if (id.replaceAll('\\', '/').endsWith('/src/pages/Home.jsx')) {
        return code.replace(/src="https:\/\/www.facebook.com\/plugins\/page.php[^"\n]+"/, 'src="/tests/public-site-facebook.html"')
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://127.0.0.1:5189; frame-src 'self'; form-action 'none'; object-src 'none'; base-uri 'self'")
        if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.end('Preview writes blocked'); return }
        if (req.url === '/tests/public-site-module-audit.json') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify([...server.moduleGraph.idToModuleMap.keys()].filter(id => !id.includes('node_modules'))))
          return
        }
        if (!req.url?.startsWith('/@') && !req.url?.startsWith('/src/') && !req.url?.startsWith('/node_modules/') && !req.url?.startsWith('/tests/') && !req.url?.startsWith('/fonts/') && !/\.[a-z0-9]+(?:\?|$)/i.test(req.url || '')) req.url = '/tests/public-site-review.html'
        next()
      })
    },
  }],
  server: { host: '127.0.0.1', port: 5189, strictPort: true },
})
