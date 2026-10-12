import { useEffect, useState } from 'react';
import {
  X,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Wallet,
  CalendarDays,
  Award,
  Building2,
  BadgeCheck,
  History,
  TrendingUp,
} from 'lucide-react';
import { historyApi } from '../api';
import './EmployeeDetailModal.css';

const STATUS_LABELS = {
  FT: 'Full-time',
  PT: 'Part-time',
  CT: 'Contract',
  IN: 'Intern',
};

const GENDER_LABELS = { M: 'Male', F: 'Female', O: 'Other' };

function InfoRow({ icon, label, value }) {
  return (
    <div className="detail-info-row">
      <div className="detail-info-icon">{icon}</div>
      <div className="detail-info-content">
        <span className="detail-info-label">{label}</span>
        <span className="detail-info-value">{value}</span>
      </div>
    </div>
  );
}

export default function EmployeeDetailModal({ employee, onClose }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [historyEvents, setHistoryEvents] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (!employee) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [employee, onClose]);

  useEffect(() => {
    if (!employee || activeTab !== 'timeline') return;
    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const data = await historyApi.getAll({ employee: employee.id });
        const list = Array.isArray(data) ? data : data.results || [];
        setHistoryEvents(list);
      } catch (err) {
        console.error('Failed to load employee history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [employee, activeTab]);

  if (!employee) return null;

  const initials = `${employee.first_name?.[0] || ''}${employee.last_name?.[0] || ''}`;
  const monthly = parseFloat(employee.monthly_salary ?? employee.salary_monthly) || 0;
  const annual = parseFloat(employee.salary) || 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-detail-title"
      >
        <div className="modal-header">
          <h2 id="employee-detail-title" className="modal-title">Employee Profile</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body detail-body">
          {/* Identity header */}
          <div className="detail-identity">
            <div className="detail-avatar">{initials}</div>
            <div>
              <h3 className="detail-name">{employee.full_name}</h3>
              <p className="detail-role">
                {employee.position} · {employee.department_name || 'No department'}
              </p>
              <div className="detail-chips">
                <span className="badge badge-primary">{STATUS_LABELS[employee.employment_status] || employee.employment_status}</span>
                {employee.is_active ? (
                  <span className="badge badge-success">Active</span>
                ) : (
                  <span className="badge badge-danger">Deactivated</span>
                )}
                <span className="badge">{employee.employee_id}</span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="detail-tabs">
            <button
              type="button"
              className={`detail-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Profile Overview
            </button>
            <button
              type="button"
              className={`detail-tab ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              Career Timeline
            </button>
          </div>

          {activeTab === 'profile' ? (
            <>
              {/* Compensation highlight */}
              <div className="detail-payroll-grid">
                <div className="detail-pay-card">
                  <Wallet size={18} color="var(--primary)" />
                  <span className="detail-pay-label">Monthly Salary</span>
                  <span className="detail-pay-value">
                    ${monthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="detail-pay-card">
                  <Wallet size={18} color="var(--accent)" />
                  <span className="detail-pay-label">Annual Salary</span>
                  <span className="detail-pay-value">
                    ${annual.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="detail-pay-card">
                  <Award size={18} color="var(--warning)" />
                  <span className="detail-pay-label">Total Experience</span>
                  <span className="detail-pay-value">{employee.effective_experience_years ?? 0} years</span>
                </div>
                <div className="detail-pay-card">
                  <CalendarDays size={18} color="var(--success)" />
                  <span className="detail-pay-label">Years at Company</span>
                  <span className="detail-pay-value">{employee.years_of_service ?? 0} years</span>
                </div>
              </div>

              {/* Contact & employment info */}
              <div className="detail-section-title">Contact Information</div>
              <div className="detail-info-grid">
                <InfoRow icon={<Mail size={16} />} label="Email" value={employee.email} />
                <InfoRow icon={<Phone size={16} />} label="Phone" value={employee.phone_number || '—'} />
                <InfoRow icon={<MapPin size={16} />} label="Address" value={employee.address || '—'} />
              </div>

              <div className="detail-section-title">Employment Details</div>
              <div className="detail-info-grid">
                <InfoRow icon={<BadgeCheck size={16} />} label="Employee ID" value={employee.employee_id} />
                <InfoRow icon={<Building2 size={16} />} label="Department" value={employee.department_name || '—'} />
                <InfoRow icon={<Briefcase size={16} />} label="Position" value={employee.position} />
                <InfoRow
                  icon={<CalendarDays size={16} />}
                  label="Hire Date"
                  value={employee.hire_date || '—'}
                />
                <InfoRow
                  icon={<Award size={16} />}
                  label="Prior Experience (at hire)"
                  value={`${employee.total_experience_years ?? 0} years`}
                />
                <InfoRow
                  icon={<CalendarDays size={16} />}
                  label="Annual Leave Entitlement"
                  value={`${employee.annual_leave_days ?? 0} days`}
                />
              </div>

              <div className="detail-section-title">Personal Details</div>
              <div className="detail-info-grid">
                <InfoRow
                  icon={<CalendarDays size={16} />}
                  label="Date of Birth"
                  value={`${employee.date_of_birth || '—'} (${employee.age ?? '—'} yrs)`}
                />
                <InfoRow
                  icon={<BadgeCheck size={16} />}
                  label="Gender"
                  value={GENDER_LABELS[employee.gender] || employee.gender}
                />
              </div>
            </>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {loadingHistory ? (
                <div style={{ textAlign: 'center', padding: '36px' }}>
                  <div className="spinner-primary" style={{ margin: '0 auto 10px' }} />
                  <p>Loading career timeline...</p>
                </div>
              ) : historyEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  <History size={36} style={{ opacity: 0.3, margin: '0 auto 10px' }} />
                  <p>No historical employment events recorded yet.</p>
                </div>
              ) : (
                <div className="timeline-list">
                  {historyEvents.map((evt) => (
                    <div key={evt.id} className="timeline-item">
                      <div className="timeline-header">
                        <span className="badge badge-primary">{evt.event_type}</span>
                        <span className="timeline-date">{evt.effective_date}</span>
                      </div>
                      <div className="timeline-title">
                        {evt.new_position || employee.position}
                        {evt.new_department_name ? ` · ${evt.new_department_name}` : ''}
                      </div>
                      {evt.notes && <div className="timeline-notes">{evt.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
