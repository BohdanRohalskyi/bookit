import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Account } from './pages/Account'
import { Dashboard } from './pages/Dashboard'
import { Businesses } from './pages/Businesses'
import { BusinessForm } from './pages/BusinessForm'
import { LocationList } from './pages/LocationList'
import { LocationWizard } from './pages/LocationWizard'
import { LocationDetail } from './pages/LocationDetail'
import { StaffList } from './pages/StaffList'
import { MyProfile } from './pages/MyProfile'
import { SpacePicker } from './pages/SpacePicker'
import { InviteAccept } from './pages/InviteAccept'
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
        <Route path="/invites" element={<InviteAccept />} />

        {/* Space picker — requires auth, no space needed */}
        <Route path="/spaces" element={<SpacePicker />} />

        {/* Dashboard — auth + space guarded inside DashboardLayout */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/businesses" element={<Businesses />} />
          <Route path="/dashboard/businesses/new" element={<BusinessForm />} />

          {/* Location routes */}
          <Route path="/dashboard/locations" element={<LocationList />} />
          <Route path="/dashboard/locations/new" element={<LocationWizard />} />
          <Route path="/dashboard/locations/:locationId" element={<LocationDetail />} />
          <Route path="/dashboard/locations/:locationId/edit" element={<LocationWizard />} />

          {/* Staff management */}
          <Route path="/dashboard/staff" element={<StaffList />} />

          {/* Business-scoped profile */}
          <Route path="/dashboard/profile" element={<MyProfile />} />

          <Route path="/account" element={<Account />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
