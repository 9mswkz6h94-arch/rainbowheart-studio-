import { useLocation } from 'react-router-dom'

export default function Footer() {
  const { pathname } = useLocation()
  const isPublicPage = pathname === '/' || pathname === '/tools' || pathname === '/lessons'
  return (
    <footer className={'footer' + (isPublicPage ? ' public-site-footer' : '')}>
      <div className="container footer-inner">
        <span>© {new Date().getFullYear()} Rainbow Heart Studio · Copperas Cove, TX</span>
        <div className="footer-links">
          {isPublicPage && <a href="mailto:info@rainbowheart.studio">Email the Studio</a>}
          <a href="https://www.facebook.com/jowensrainbowheartstudio/" target="_blank" rel="noreferrer">
            Facebook
          </a>
        </div>
      </div>
    </footer>
  )
}
