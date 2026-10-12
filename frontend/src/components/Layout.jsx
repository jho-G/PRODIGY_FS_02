import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { notificationApi } from '../api';
import {
  LayoutDashboard,
  Users,
  Building2,
  LogOut,
  Briefcase,
  CalendarDays,
  CalendarCheck,
  Banknote,
  Star,
  Bell,
} from 'lucide-react';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);

  const fetchUnread = async () => {
    try {
      const data = await notificationApi.getUnreadCount();
      const count = typeof data === 'number' ? data : data?.count ?? data?.unread_count ?? 0;
      setUnreadCount(count);
    } catch {
      // non-critical
    }
  };

  const fetchNotifications = async () => {
    try {
      const data = await notificationApi.getAll();
      const list = Array.isArray(data) ? data : data?.results || [];
      setNotifications(list);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showNotifs) {
      fetchNotifications();
    }
  }, [showNotifs]);

  useEffect(() => {
    if (!showNotifs) return;
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifs]);

  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="app-layout">
      {/* Top Navbar */}
      <header className="app-navbar">
        <div className="nav-left">
          <NavLink to="/" className="app-brand">
            <div className="brand-icon">
              <Briefcase size={20} />
            </div>
            <span>EMS Portal</span>
          </NavLink>

          <nav>
            <ul className="nav-links">
              <li>
                <NavLink
                  to="/"
                  end
                  className={({ isActive }) =>
                    `nav-link-item ${isActive ? 'active' : ''}`
                  }
                >
                  <LayoutDashboard size={18} />
                  <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/employees"
                  className={({ isActive }) =>
                    `nav-link-item ${isActive ? 'active' : ''}`
                  }
                >
                  <Users size={18} />
                  <span>Employees</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/departments"
                  className={({ isActive }) =>
                    `nav-link-item ${isActive ? 'active' : ''}`
                  }
                >
                  <Building2 size={18} />
                  <span>Departments</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/leave"
                  className={({ isActive }) =>
                    `nav-link-item ${isActive ? 'active' : ''}`
                  }
                >
                  <CalendarDays size={18} />
                  <span>Leave</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/attendance"
                  className={({ isActive }) =>
                    `nav-link-item ${isActive ? 'active' : ''}`
                  }
                >
                  <CalendarCheck size={18} />
                  <span>Attendance</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/payroll"
                  className={({ isActive }) =>
                    `nav-link-item ${isActive ? 'active' : ''}`
                  }
                >
                  <Banknote size={18} />
                  <span>Payroll</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/performance"
                  className={({ isActive }) =>
                    `nav-link-item ${isActive ? 'active' : ''}`
                  }
                >
                  <Star size={18} />
                  <span>Performance</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>

        <div className="nav-right">
          {/* Notification Bell & Dropdown */}
          <div className="notification-wrapper" ref={notifRef}>
            <button
              type="button"
              className="notification-btn"
              onClick={() => setShowNotifs((prev) => !prev)}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {showNotifs && (
              <div className="notification-dropdown">
                <div className="notification-dropdown-header">
                  <h4>Notifications</h4>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.76rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="notification-list">
                  {notifications.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                      No notifications at this time.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`notification-item ${!n.is_read ? 'unread' : ''}`}
                        onClick={() => !n.is_read && handleMarkRead(n.id)}
                      >
                        <span className="notification-item-title">{n.title}</span>
                        <span className="notification-item-msg">{n.message}</span>
                        <span className="notification-item-time">
                          {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="user-badge">
            <div className="user-avatar-circle">
              {user?.username ? user.username.charAt(0) : 'U'}
            </div>
            <div className="user-details">
              <span className="user-username">{user?.username || 'Admin'}</span>
              <span className="user-tag">{user?.email || 'Authenticated'}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-danger-light btn-sm"
            disabled={loggingOut}
            title="Sign out of system"
          >
            {loggingOut ? (
              <span className="spinner" style={{ width: '14px', height: '14px', borderColor: '#ef4444' }} />
            ) : (
              <LogOut size={15} />
            )}
            <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="app-main-content">
        <Outlet />
      </main>
    </div>
  );
}
