import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider }    from './context/AuthContext';
import PrivateRoute        from './components/PrivateRoute';
import Layout              from './components/Layout';

import LoginPage           from './pages/LoginPage';
import RegisterPage        from './pages/RegisterPage';
import DashboardPage       from './pages/DashboardPage';
import PatientsPage        from './pages/PatientsPage';
import PatientDetailPage   from './pages/PatientDetailPage';
import UsersPage           from './pages/UsersPage';
import ReportsPage         from './pages/ReportsPage';
import AuditPage           from './pages/AuditPage';
import NotFound            from './pages/NotFound';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontSize: '14px' },
          }}
        />
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes — all require authentication */}
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index                       element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"           element={<DashboardPage />} />
            <Route path="/patients"            element={<PatientsPage />} />
            <Route path="/patients/:patientId" element={<PatientDetailPage />} />
            <Route path="/users"               element={<UsersPage />} />
            <Route path="/reports"             element={<ReportsPage />} />

            {/* Admin + super_admin */}
            <Route
              path="/audit"
              element={
                <PrivateRoute roles={['admin', 'super_admin']}>
                  <AuditPage />
                </PrivateRoute>
              }
            />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
