import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth }       from './context/AuthContext';
import Navbar                 from './components/Navbar';
import Footer                 from './components/Footer';
import ProtectedRoute         from './components/ProtectedRoute';
import LandingPage            from './pages/LandingPage';
import OrdinancesPage         from './pages/OrdinancesPage';
import OrdinanceDetailPage    from './pages/OrdinanceDetailPage';
import HandbookPage           from './pages/HandbookPage';
import AdminPage              from './pages/AdminPage';
import LoginPage              from './pages/LoginPage';
import RegisterPage           from './pages/RegisterPage';
import AdminRoute             from './components/AdminRoute';
import ErrorBoundary          from './components/ErrorBoundary';

import { useEffect } from 'react';

function AppContent() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const hideNavbar = isAdmin;
  const hideFooter = isAdmin || pathname.startsWith('/handbook') || pathname.startsWith('/admin');

  useEffect(() => {
    if (isAdmin && !pathname.startsWith('/admin')) {
      navigate('/admin', { replace: true });
    }
  }, [isAdmin, pathname, navigate]);

  return (
    <>
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/"               element={<LandingPage />} />
        <Route path="/ordinances"     element={<OrdinancesPage />} />
        <Route path="/ordinances/:id" element={<OrdinanceDetailPage />} />
        <Route path="/login"          element={<LoginPage />} />
        <Route path="/register"       element={<RegisterPage />} />
        <Route path="/admin"          element={
          <AdminRoute><AdminPage /></AdminRoute>
        } />
        <Route path="/handbook"       element={
          <ProtectedRoute><HandbookPage /></ProtectedRoute>
        } />
      </Routes>
      {!hideFooter && <Footer />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ErrorBoundary>
    </AuthProvider>
  );
}
