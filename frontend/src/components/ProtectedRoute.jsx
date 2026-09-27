import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '16px',
        backgroundColor: 'var(--bg-page)'
      }}>
        <div className="spinner-primary" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Verifying authentication session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect unauthenticated visitors to login, preserving intended location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? children : <Outlet />;
}
