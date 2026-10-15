import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const descriptions = 'Private piano, voice, guitar, ukulele, guitalele, and tenor guitar lessons in Copperas Cove, Texas 76522. Lessons by appointment.'
const titles = {
  '/': 'Music Lessons in Copperas Cove, TX | Rainbow Heart Studio',
  '/lessons': 'Piano, Voice & Guitar Lessons in Copperas Cove 76522 | Rainbow Heart Studio',
}

// Keep client navigation from carrying the home page's canonical into other tools.
export default function PublicSearchMetadata() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = titles[pathname] || (pathname === '/tools' ? 'Music Tools | Rainbow Heart Studio' : 'Rainbow Heart Studio')
    let canonical = document.querySelector('link[rel="canonical"]')
    if (titles[pathname]) {
      if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical) }
      canonical.href = `https://rainbowheart.studio${pathname}`
    } else canonical?.remove()
    const description = document.querySelector('meta[name="description"]')
    if (description) description.content = titles[pathname] ? descriptions : 'Rainbow Heart Studio music tools and creative community in Copperas Cove, Texas.'
    for (const property of ['og:title', 'og:description', 'og:url']) {
      const element = document.querySelector(`meta[property="${property}"]`)
      if (element) element.content = property === 'og:title' ? document.title : property === 'og:description' ? description?.content || '' : `https://rainbowheart.studio${pathname}`
    }
    const schema = document.querySelector('script[data-public-search]')
    if (schema) {
      const graph = JSON.parse(schema.textContent)
      const page = graph['@graph'].find(item => item['@type'] === 'WebPage')
      if (titles[pathname]) {
        page.url = canonical.href; page['@id'] = `${canonical.href}#page`; page.name = document.title
        schema.textContent = JSON.stringify(graph)
      } else schema.remove()
    }
  }, [pathname])
  return null
}
