// Render only authored public pages. Never import App, auth, Supabase, or live data.
import fs from 'node:fs'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import Home from '../src/pages/Home'
import MusicLessons, { lessonInstruments } from '../src/pages/MusicLessons'
import Footer from '../src/components/Footer'

const origin = 'https://rainbowheart.studio'
const shell = fs.readFileSync('dist/index.html', 'utf8')
// Other routes keep an empty app shell: no copied home content, canonical or schema.
fs.writeFileSync('dist/app.html', shell)
const business = {
  '@type': ['LocalBusiness', 'EducationalOrganization'], '@id': `${origin}/#studio`,
  name: 'Rainbow Heart Studio', url: `${origin}/`,
  description: 'Private piano, voice, guitar, ukulele, guitalele, and tenor guitar lessons in Copperas Cove, Texas 76522. Lessons by appointment.',
  email: 'info@rainbowheart.studio', telephone: '+1-254-371-5051',
  address: { '@type': 'PostalAddress', streetAddress: '303 S. Main Street', addressLocality: 'Copperas Cove', addressRegion: 'TX', postalCode: '76522', addressCountry: 'US' },
  areaServed: { '@type': 'Place', name: 'Copperas Cove, Texas 76522' },
  sameAs: ['https://www.facebook.com/jowensrainbowheartstudio/'],
  hasOfferCatalog: { '@type': 'OfferCatalog', name: 'Private music lessons', itemListElement: lessonInstruments.map(instrument => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: `${instrument} lessons`, serviceType: 'Private music lessons', provider: { '@id': `${origin}/#studio` } } })) },
}
const pages = [
  { path: '/', file: 'dist/index.html', title: 'Music Lessons in Copperas Cove, TX | Rainbow Heart Studio', component: <Home /> },
  { path: '/lessons', file: 'dist/lessons.html', title: 'Piano, Voice & Guitar Lessons in Copperas Cove 76522 | Rainbow Heart Studio', component: <MusicLessons /> },
]
const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
for (const page of pages) {
  const url = `${origin}${page.path}`
  const description = business.description
  const schema = { '@context': 'https://schema.org', '@graph': [business, { '@type': 'WebPage', '@id': `${url}#page`, url, name: page.title, about: { '@id': business['@id'] } }] }
  const metadata = `<title>${escape(page.title)}</title>
    <meta name="description" content="${escape(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escape(page.title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary" />
    <script type="application/ld+json" data-public-search>${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>`
  const body = renderToString(<StaticRouter location={page.path}>
    <nav className="navbar public-site-nav" aria-label="Studio navigation"><div className="container navbar-inner">
      <a href="/">Rainbow Heart Studio</a><a href="/lessons">Music lessons</a><a href="/tools">Music tools</a><a href="mailto:info@rainbowheart.studio">Email the studio</a>
    </div></nav>
    <main>{page.component}</main><Footer />
  </StaticRouter>)
  const html = shell.replace(/<title>[\s\S]*?<\/title>/, '').replace(/<meta name="description"[^>]*\/>/, '').replace('</head>', `${metadata}\n  </head>`).replace('<div id="root"></div>', `<div id="root">${body}</div>`)
  fs.mkdirSync(page.file.slice(0, page.file.lastIndexOf('/')), { recursive: true })
  fs.writeFileSync(page.file, html)
}
console.log('Rendered public home and lessons HTML; preserved separate SPA shell.')
