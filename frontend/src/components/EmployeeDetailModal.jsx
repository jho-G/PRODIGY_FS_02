import { X, Mail, Phone, MapPin, Briefcase, Wallet, CalendarDays, Award, Building2, BadgeCheck } from 'lucide-react';
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
      >
        <div className="modal-header">
          <h2 className="modal-title">Employee Profile</h2>
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
