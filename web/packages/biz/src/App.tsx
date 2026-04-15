import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Account } from './pages/Account'
import { Dashboard } from './pages/Dashboard'
import { Businesses } from './pages/Businesses'
import { BusinessForm } from './pages/BusinessForm'
import { BranchList } from './pages/BranchList'
import { BranchWizard } from './pages/BranchWizard'
import { BranchDetail } from './pages/BranchDetail'
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

        {/* Dashboard — auth guarded inside DashboardLayout */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/businesses" element={<Businesses />} />
          <Route path="/dashboard/businesses/new" element={<BusinessForm />} />

          {/* Branch routes */}
          <Route path="/dashboard/businesses/:businessId/branches" element={<BranchList />} />
          <Route path="/dashboard/businesses/:businessId/branches/new" element={<BranchWizard />} />
          <Route path="/dashboard/businesses/:businessId/branches/:branchId" element={<BranchDetail />} />
          <Route path="/dashboard/businesses/:businessId/branches/:branchId/edit" element={<BranchWizard />} />

          <Route path="/account" element={<Account />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
