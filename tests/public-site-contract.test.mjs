import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import postcss from 'postcss'

const base = '36bc2fe35857c85f0c5fc5f483c919eabd305bf6'
const normalize = s => s.replaceAll('\r\n', '\n').replace(/^\uFEFF/, '')
const read = path => normalize(readFileSync(path, 'utf8'))
const original = path => normalize(execFileSync('git', ['show', `${base}:${path}`], {encoding:'utf8'}))

test('auth, application routing, shared tool registry, and dependencies stay byte-equivalent to the reviewed base', () => {
  for (const path of ['src/App.jsx','src/context/AuthContext.jsx','src/lib/supabase.js','src/lib/tools.js','src/components/ProtectedRoute.jsx','package.json','package-lock.json']) {
    assert.equal(read(path), original(path), path)
  }
})
test('Login changes preserve all original state, return-path, sign-in and signup logic', () => {
  const path='src/pages/Login.jsx'
  assert.equal(read(path).split('  return (')[0], original(path).split('  return (')[0])
})
test('public CSS is additive and every new selector is bounded to public pages or public chrome', () => {
  const before=original('src/index.css'), after=read('src/index.css')
  assert.ok(after.startsWith(before))
  const tree=postcss.parse(after.slice(before.length))
  tree.walkRules(rule => assert.ok(rule.selector.includes('.public-site'), rule.selector))
  tree.walkAtRules(rule => assert.ok(rule.name==='media', rule.name))
  assert.ok(!after.slice(before.length).includes(':root'))
})
test('every catalog internal destination is still declared in the production router', async () => {
  const {STUDIO_TOOLS}=await import('../src/lib/tools.js')
  const routes=read('src/App.jsx')
  for(const tool of STUDIO_TOOLS.filter(t=>t.href.startsWith('/'))) assert.ok(routes.includes(`path="${tool.href}"`),tool.href)
  assert.ok(routes.includes('path="/tools"'))
})
test('review server exposes no production auth/data modules and enforces local-only network policy', async () => {
  const response=await fetch('http://127.0.0.1:5189/tests/public-site-module-audit.json')
  assert.equal(response.status,200)
  const modules=await response.json()
  assert.ok(modules.some(m=>m.endsWith('/tests/public-site-auth.jsx')))
  assert.ok(!modules.some(m=>/supabase|\/lib\/(songs|setlists|songHandoffs|memory)\./i.test(m)))
  const policy=response.headers.get('content-security-policy')
  assert.ok(policy.includes("form-action 'none'"))
  assert.ok(policy.includes("frame-src 'self'"))
  assert.ok(policy.includes("connect-src 'self' ws://127.0.0.1:5189"))
})
