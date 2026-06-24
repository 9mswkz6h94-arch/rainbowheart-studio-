import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="nav-logo">
          🌈 Rainbow Heart Studio
        </Link>
        <div className="nav-links">
          <a href="/#services">Services</a>
          <a href="/#about">About</a>
          <a href="/#team">Team</a>
          <a href="/#contact">Contact</a>
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
