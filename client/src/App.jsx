import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider } from './context/I18nContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import PatientPortal from './pages/PatientPortal';
import PhysicianDashboard from './pages/PhysicianDashboard';
import TriageQueue from './pages/TriageQueue';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import NotFoundPage from './pages/NotFoundPage';
import { Skeleton } from './components/ui/Primitives';

function RequireAuth({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="max-w-apple mx-auto p-10 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallback =
      user.role === 'physician'
        ? '/app/physician'
        : user.role === 'triage'
        ? '/app/triage'
        : '/app/patient';
    return <Navigate to={fallback} replace />;
  }
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppShell>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route
                    path="/app/patient"
                    element={
                      <RequireAuth allowedRoles={['patient']}>
                        <PatientPortal />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/app/physician"
                    element={
                      <RequireAuth allowedRoles={['physician']}>
                        <PhysicianDashboard />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/app/triage"
                    element={
                      <RequireAuth allowedRoles={['triage', 'physician']}>
                        <TriageQueue />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/app/analytics"
                    element={
                      <RequireAuth>
                        <AnalyticsDashboard />
                      </RequireAuth>
                    }
                  />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppShell>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
