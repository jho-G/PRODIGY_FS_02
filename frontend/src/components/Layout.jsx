import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Building2,
  LogOut,
  Briefcase,
} from 'lucide-react';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

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
            </ul>
          </nav>
        </div>

        <div className="nav-right">
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
