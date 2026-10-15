import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const read = file => readFileSync(file, 'utf8')
const base = 'f5a61ce20b996f2a7ad5d477e06ed7308e2595f2'
test('existing auth, data access, dependencies and application routes are preserved', () => {
  const digest = buffer => createHash('sha256').update(buffer.toString('utf8').replaceAll('\r\n', '\n')).digest('hex')
  for (const file of ['src/context/AuthContext.jsx', 'src/lib/supabase.js', 'src/lib/songs.js', 'src/lib/setlists.js', 'src/components/ProtectedRoute.jsx', 'package-lock.json']) {
    assert.equal(digest(readFileSync(file)), digest(execFileSync('git', ['show', `${base}:${file}`])), `${file} changed unexpectedly`)
  }
  const before = execFileSync('git', ['show', `${base}:src/App.jsx`], { encoding: 'utf8' })
  const paths = source => [...source.matchAll(/<Route path="([^"]+)"/g)].map(match => match[1])
  for (const path of paths(before)) assert.ok(paths(read('src/App.jsx')).includes(path), `Missing route ${path}`)
})
test('public HTML contains useful local lesson content without JavaScript', () => {
  for (const file of ['dist/index.html', 'dist/lessons.html']) {
    const html = read(file)
    assert.match(html, /<h1/)
    for (const value of ['Piano', 'Voice', 'Guitar', 'Ukulele', 'Guitalele', 'Tenor guitar']) assert.match(html.toLowerCase(), new RegExp(value.toLowerCase()))
    assert.match(html, /76522/)
    assert.match(html, /info@rainbowheart\.studio/)
    assert.equal((html.match(/<title>/g) || []).length, 1)
    assert.equal((html.match(/name="description"/g) || []).length, 1)
    const schema = JSON.parse(html.match(/<script type="application\/ld\+json" data-public-search>(.*?)<\/script>/s)[1])
    assert.equal(schema['@graph'][0].address.postalCode, '76522')
    assert.equal(schema['@graph'][0].hasOfferCatalog.itemListElement.length, 6)
    assert.equal(schema['@graph'][0].openingHours, undefined, 'building hours must not become lesson hours')
  }
  assert.match(read('dist/lessons.html'), /rel="canonical" href="https:\/\/rainbowheart.studio\/lessons"/)
})
test('SPA fallback does not serve home content or home canonical on private routes', () => {
  const shell = read('dist/app.html')
  assert.match(shell, /<div id="root"><\/div>/)
  assert.doesNotMatch(shell, /rel="canonical"|application\/ld\+json/)
  assert.match(read('dist/_redirects'), /\/\* \/app\.html 200/)
})
test('crawler files are real documents and sitemap lists public routes only', () => {
  const sitemap = read('dist/sitemap.xml')
  assert.match(sitemap, /^<\?xml/)
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1])
  assert.deepEqual(locations, ['https://rainbowheart.studio/', 'https://rainbowheart.studio/lessons', 'https://rainbowheart.studio/tools'])
  assert.match(read('dist/robots.txt'), /Sitemap: https:\/\/rainbowheart.studio\/sitemap.xml/)
  for (const path of ['/band/*', '/present/*', '/studio/*', '/admin', '/login']) assert.ok(read('dist/_headers').includes(`${path}\n  X-Robots-Tag: noindex`))
})
