import { useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isPublicPage = pathname === '/' || pathname === '/tools'
  const menuButton = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <nav className={'navbar' + (isPublicPage ? ' public-site-nav' : '')} aria-label="Main navigation" onKeyDown={e => {
      if (isPublicPage && e.key === 'Escape' && menuOpen) {
        closeMenu()
        menuButton.current?.focus()
      }
    }}>
      {isPublicPage && <a href="#public-main" className="public-skip-link">Skip to content</a>}
      <div className="navbar-inner">
        <Link to="/" className="nav-logo" onClick={closeMenu}>
          {isPublicPage ? 'Rainbow Heart Studio' : '🌈 Rainbow Heart Studio'}
        </Link>
        <button
          className="nav-hamburger"
          ref={menuButton}
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="site-nav-links"
        >
          {isPublicPage ? (menuOpen ? 'Close menu' : 'Menu') : (menuOpen ? '✕' : '☰')}
        </button>
        <div id="site-nav-links" className={'nav-links' + (menuOpen ? ' open' : '')} onClick={closeMenu}>
          {isPublicPage && <a href="/#lessons">Lessons</a>}
          <a href="/#services">Services</a>
          <a href="/#about">About</a>
          <a href="/#team">Team</a>
          <a href="/#contact">Contact</a>
          <a href="/#open-mic">Open Mic</a>
          <NavLink to="/tools" className="nav-link-tools">Tools</NavLink>
          {user ? (
            <>
              <NavLink to="/studio" className="nav-link-studio">
                Studio ↗
              </NavLink>
              <button onClick={handleSignOut} className="btn-nav-signout">
                Sign Out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="btn-nav-login">
              Log In
            </NavLink>
          )}
        </div>
      </div>
    </nav>
  )
}
