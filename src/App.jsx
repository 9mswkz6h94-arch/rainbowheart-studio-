import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ChordCharts from './pages/ChordCharts'

export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/studio" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/studio/chord-charts" element={
            <ProtectedRoute><ChordCharts /></ProtectedRoute>
          } />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
