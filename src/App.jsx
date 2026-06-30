import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ChordCharts from './pages/ChordCharts'
import TabStudio from './pages/TabStudio'
import SetLists from './pages/SetLists'
import SetListView from './pages/SetListView'
import OpenMicPrivacy from './pages/OpenMicPrivacy'
import OpenMicTerms from './pages/OpenMicTerms'
import Admin from './pages/Admin'

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
          <Route path="/studio/setlists" element={
            <ProtectedRoute><SetLists /></ProtectedRoute>
          } />
          <Route path="/studio/tab-studio" element={
            <ProtectedRoute><TabStudio /></ProtectedRoute>
          } />
          <Route path="/setlist/:token" element={<SetListView />} />
          <Route path="/admin" element={
            <AdminRoute><Admin /></AdminRoute>
          } />
          <Route path="/privacy/open-mic" element={<OpenMicPrivacy />} />
          <Route path="/terms/open-mic" element={<OpenMicTerms />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}
