import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Add Crystal's email here once confirmed
const ADMIN_EMAILS = [
  'jonathan@rainbowheart.studio',
  'crystal@rainbowheart.studio',
]

export default function AdminRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!ADMIN_EMAILS.includes(user.email)) return <Navigate to="/studio" replace />
  return children
}
