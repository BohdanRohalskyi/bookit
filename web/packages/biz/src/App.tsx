import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Account } from './pages/Account'
import { Dashboard } from './pages/Dashboard'
import { Businesses } from './pages/Businesses'
import { BusinessForm } from './pages/BusinessForm'
import { NotFound } from './pages/NotFound'
import { DashboardLayout } from './components/DashboardLayout'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Dashboard — auth + feature flag guarded inside DashboardLayout */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/businesses" element={<Businesses />} />
          <Route path="/dashboard/businesses/new" element={<BusinessForm />} />
          <Route path="/account" element={<Account />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
