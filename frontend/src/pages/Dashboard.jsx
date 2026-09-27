import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { employeeApi } from '../api';
import {
  Users,
  Building2,
  UserCheck,
  UserX,
  LogOut,
  ShieldCheck,
  Briefcase,
  CheckCircle,
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const { user, token, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadStats = async () => {
      try {
        setLoadingStats(true);
        const data = await employeeApi.getStats();
        if (isMounted) {
          setStats(data);
        }
      } catch (err) {
        console.error('Error fetching statistics:', err);
      } finally {
        if (isMounted) {
          setLoadingStats(false);
        }
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  return (
    <div className="dashboard-layout animate-fade-in">
      {/* Top Navigation */}
      <header className="dashboard-navbar">
        <div className="navbar-brand">
          <div className="brand-icon-wrapper">
            <Briefcase size={20} />
          </div>
          <span>EMS Dashboard</span>
        </div>

        <div className="navbar-actions">
          <div className="user-profile-badge">
            <div className="user-avatar">
              {user?.username ? user.username.charAt(0) : 'U'}
            </div>
            <div className="user-info">
              <span className="user-name">{user?.username || 'User'}</span>
              <span className="user-role">{user?.email || 'Authenticated'}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="logout-btn"
            disabled={loggingOut}
            title="Sign out of your account"
          >
            {loggingOut ? (
              <span className="spinner" style={{ width: '16px', height: '16px', borderColor: '#ef4444' }} />
            ) : (
              <LogOut size={16} />
            )}
            <span>{loggingOut ? 'Logging out...' : 'Sign Out'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="dashboard-content">
        <div className="welcome-banner">
          <div>
            <h1 className="welcome-title">Welcome back, {user?.username}!</h1>
            <p className="welcome-desc">
              Your authentication session is active. Connected securely to Django REST Framework backend with Token Authentication.
            </p>
          </div>
          <div className="status-chip">
            <CheckCircle size={15} />
            <span>Token Auth Connected</span>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Users size={24} />
            </div>
            <div>
              <div className="stat-value">{loadingStats ? '...' : stats?.total_employees ?? 0}</div>
              <div className="stat-label">Total Employees</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
              <UserCheck size={24} />
            </div>
            <div>
              <div className="stat-value">{loadingStats ? '...' : stats?.active_employees ?? 0}</div>
              <div className="stat-label">Active Workforce</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
              <UserX size={24} />
            </div>
            <div>
              <div className="stat-value">{loadingStats ? '...' : stats?.inactive_employees ?? 0}</div>
              <div className="stat-label">Deactivated</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
              <Building2 size={24} />
            </div>
            <div>
              <div className="stat-value">{loadingStats ? '...' : stats?.departments_count ?? 0}</div>
              <div className="stat-label">Departments</div>
            </div>
          </div>
        </div>

        {/* Auth Session Info */}
        <div className="info-card">
          <h2 className="info-card-header">
            <ShieldCheck size={20} color="var(--primary)" />
            Authentication Flow Verified
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.92rem' }}>
            Token-based authentication is functioning properly. The token below is securely stored in <code>localStorage</code> and automatically attached to all API requests via Axios interceptors.
          </p>
          <div style={{
            background: 'var(--bg-page)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            wordBreak: 'break-all'
          }}>
            <strong>Current Token:</strong> {token ? `${token.substring(0, 10)}****************` : 'None'}
          </div>
        </div>
      </main>
    </div>
  );
}
