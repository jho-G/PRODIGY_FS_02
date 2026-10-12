import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { employeeApi, holidayApi } from '../api';
import {
  Users,
  Building2,
  UserCheck,
  UserX,
  PieChart,
  BarChart3,
  ArrowRight,
  PlusCircle,
  Briefcase,
  AlertTriangle,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    try {
      setLoading(true);
      setError('');
      const [statsData, holidayData] = await Promise.all([
        employeeApi.getStats(),
        holidayApi.getUpcoming(4).catch(() => []),
      ]);
      setStats(statsData);
      setHolidays(Array.isArray(holidayData) ? holidayData : []);
    } catch (err) {
      console.error('Failed to load dashboard statistics:', err);
      setError('Failed to fetch workforce statistics from API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const totalActive = stats?.active_employees || 0;
  const statusLabels = {
    FT: { label: 'Full-time', color: 'var(--primary)', bg: 'var(--primary-light)' },
    PT: { label: 'Part-time', color: 'var(--accent)', bg: 'var(--accent-light)' },
    CT: { label: 'Contract', color: 'var(--warning)', bg: 'var(--warning-light)' },
    IN: { label: 'Internship', color: 'var(--success)', bg: 'var(--success-light)' },
  };

  return (
    <div className="dashboard-page animate-fade-in">
      {/* Welcome Hero Banner */}
      <section className="dashboard-hero">
        <div className="hero-left">
          <h1>Welcome, {user?.username || 'Administrator'}!</h1>
          <p>
            Here is your live workforce snapshot. Monitor workforce distribution, manage departmental assignments, and perform operational tasks.
          </p>
        </div>
        <div className="hero-actions">
          <Link to="/employees" className="btn btn-primary" style={{ backgroundColor: '#ffffff', color: 'var(--primary)' }}>
            <Users size={16} />
            <span>Manage Employees</span>
          </Link>
          <Link to="/departments" className="btn btn-secondary" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.3)' }}>
            <Building2 size={16} />
            <span>Departments</span>
          </Link>
        </div>
      </section>

      {/* Error Alert with Retry */}
      {error && (
        <div className="alert-error" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="var(--danger)" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadStats}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Top Metric Cards */}
      <section className="metrics-row">
        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Users size={26} />
          </div>
          <div className="metric-data">
            <span className="metric-number">{loading ? '...' : stats?.total_employees ?? 0}</span>
            <span className="metric-title">Total Headcount</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
            <UserCheck size={26} />
          </div>
          <div className="metric-data">
            <span className="metric-number">{loading ? '...' : stats?.active_employees ?? 0}</span>
            <span className="metric-title">Active Employees</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
            <UserX size={26} />
          </div>
          <div className="metric-data">
            <span className="metric-number">{loading ? '...' : stats?.inactive_employees ?? 0}</span>
            <span className="metric-title">Deactivated</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-box" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}>
            <Building2 size={26} />
          </div>
          <div className="metric-data">
            <span className="metric-number">{loading ? '...' : stats?.departments_count ?? 0}</span>
            <span className="metric-title">Departments</span>
          </div>
        </div>
      </section>

      {/* Visual Breakdowns */}
      <section className="breakdown-grid">
        {/* Department Breakdown */}
        <div className="breakdown-card">
          <div className="breakdown-card-header">
            <h2 className="breakdown-title">
              <BarChart3 size={20} color="var(--primary)" />
              <span>Department Distribution</span>
            </h2>
            <Link to="/departments" className="btn btn-secondary btn-sm">
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="empty-state">Loading department distribution...</div>
          ) : stats?.department_breakdown?.length ? (
            <div className="dept-list">
              {stats.department_breakdown.map((dept) => {
                const percentage = totalActive > 0 ? Math.round((dept.active_count / totalActive) * 100) : 0;
                return (
                  <div key={dept.id} className="dept-item">
                    <div className="dept-item-header">
                      <span className="dept-name">{dept.name}</span>
                      <span className="dept-count">
                        {dept.active_count} {dept.active_count === 1 ? 'employee' : 'employees'} ({percentage}%)
                      </span>
                    </div>
                    <div className="dept-progress-track">
                      <div
                        className="dept-progress-fill"
                        style={{ width: `${Math.max(percentage, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              No departments registered yet. <Link to="/departments">Create your first department</Link>.
            </div>
          )}
        </div>

        {/* Employment Status Breakdown */}
        <div className="breakdown-card">
          <div className="breakdown-card-header">
            <h2 className="breakdown-title">
              <PieChart size={20} color="var(--accent)" />
              <span>Employment Status</span>
            </h2>
            <Link to="/employees" className="btn btn-secondary btn-sm">
              <span>Manage</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="empty-state">Loading status metrics...</div>
          ) : (
            <div className="status-cards-grid">
              {Object.entries(statusLabels).map(([code, meta]) => {
                const count = stats?.status_breakdown?.[code] ?? 0;
                const percentage = totalActive > 0 ? Math.round((count / totalActive) * 100) : 0;

                return (
                  <div key={code} className="status-stat-card">
                    <div className="status-stat-header">
                      <span
                        className="status-tag"
                        style={{ backgroundColor: meta.bg, color: meta.color }}
                      >
                        {code}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {percentage}%
                      </span>
                    </div>
                    <div className="status-count">{count}</div>
                    <div className="status-label">{meta.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Holidays Widget */}
        <div className="breakdown-card" style={{ gridColumn: 'span 2' }}>
          <div className="breakdown-card-header">
            <h2 className="breakdown-title">
              <Calendar size={20} color="var(--success)" />
              <span>Upcoming Company Holidays</span>
            </h2>
            <Link to="/leave" className="btn btn-secondary btn-sm">
              <span>Leave Calendar</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="empty-state">Loading holiday schedule...</div>
          ) : holidays.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              {holidays.map((h) => (
                <div
                  key={h.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-page)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--primary)' }}>
                    {new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    {h.name}
                  </span>
                  {h.description && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {h.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              No upcoming company holidays scheduled in the immediate future.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
