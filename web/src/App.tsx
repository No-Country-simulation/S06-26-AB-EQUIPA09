import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Mapa from './pages/Mapa'
import Consulta from './pages/Consulta'
import Login from './pages/Login'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Profile from './pages/Profile'
import StaffProtectedRoute from './components/auth/StaffProtectedRoute'
import StaffLogin from './pages/staff/StaffLogin'
import StaffDashboard from './pages/staff/StaffDashboard'
import StaffIngestion from './pages/staff/StaffIngestion'
import StaffIndicadores from './pages/staff/StaffIndicadores'
import StaffProgramas from './pages/staff/StaffProgramas'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/staff/login" element={<StaffLogin />} />
          <Route path="/staff/dashboard" element={
            <StaffProtectedRoute>
              <StaffDashboard />
            </StaffProtectedRoute>
          } />
          <Route path="/staff/ingestao" element={
            <StaffProtectedRoute>
              <StaffIngestion />
            </StaffProtectedRoute>
          } />
          <Route path="/staff/indicadores" element={
            <StaffProtectedRoute>
              <StaffIndicadores />
            </StaffProtectedRoute>
          } />
          <Route path="/staff/programas" element={
            <StaffProtectedRoute>
              <StaffProgramas />
            </StaffProtectedRoute>
          } />
          <Route element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="mapa" element={<Mapa />} />
            <Route path="consulta" element={<Consulta />} />
            <Route path="perfil" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
