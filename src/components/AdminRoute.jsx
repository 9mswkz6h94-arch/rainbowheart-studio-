import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Add Crystal's email here once confirmed
const ADMIN_EMAILS = [
  'jonathan.m.owens@gmail.com',
  // 'CRYSTAL_EMAIL_HERE',
]

export default function AdminRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!ADMIN_EMAILS.includes(user.email)) return <Navigate to="/studio" replace />
  return children
}
