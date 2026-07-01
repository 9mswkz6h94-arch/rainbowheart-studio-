import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="nav-logo" onClick={closeMenu}>
          🌈 Rainbow Heart Studio
        </Link>
        <button
          className="nav-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
        <div className={'nav-links' + (menuOpen ? ' open' : '')} onClick={closeMenu}>
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
