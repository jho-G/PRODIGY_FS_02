import { useState, useEffect, useCallback } from 'react';
import {
  CalendarDays,
  Plus,
  Check,
  X,
  Ban,
  Trash2,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { leaveApi, employeeApi } from '../api';
import './Leave.css';

const LEAVE_TYPES = [
  { value: 'VL', label: 'Vacation' },
  { value: 'SL', label: 'Sick' },
  { value: 'PL', label: 'Personal' },
  { value: 'ML', label: 'Maternity/Paternity' },
  { value: 'UL', label: 'Unpaid' },
];

const STATUS_FILTERS = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

const EMPTY_FORM = {
  employee: '',
  leave_type: 'VL',
  start_date: '',
  end_date: '',
  reason: '',
};

export default function Leave() {
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  // Modal / form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load employees for filter + request form (paginate through full list)
  useEffect(() => {
    const fetchAllEmployees = async () => {
      try {
        const collected = [];
        let current = 1;
        let count = Infinity;
        while (collected.length < count && current <= 15) {
          const data = await employeeApi.getAll({ all: 'true', page: current });
          count = data.count ?? collected.length;
          const results = data.results || data || [];
          collected.push(...results);
          if (!data.results) break;
          current += 1;
        }
        setEmployees(collected);
      } catch (err) {
        console.error('Error fetching employees for leave page:', err);
      }
    };
    fetchAllEmployees();
  }, []);

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.leave_type = typeFilter;
      if (employeeFilter) params.employee = employeeFilter;

      const data = await leaveApi.getAll(params);
      if (data.results) {
        setLeaves(data.results);
        setTotalCount(data.count || 0);
      } else if (Array.isArray(data)) {
        setLeaves(data);
        setTotalCount(data.length);
      } else {
        setLeaves([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching leave requests:', err);
      showToast('Failed to load leave requests.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, employeeFilter]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const resetFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setEmployeeFilter('');
    setPage(1);
  };

  // --- Workflow actions -------------------------------------------------
  const handleAction = async (leave, action, label) => {
    try {
      setBusyId(leave.id);
      await leaveApi[action](leave.id);
      showToast(`Leave request ${label} for ${leave.employee_name}.`);
      fetchLeaves();
    } catch (err) {
      console.error(`Failed to ${action} leave:`, err);
      const detail = err.response?.data?.detail || `Failed to ${label} request.`;
      showToast(detail, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (leave) => {
    const confirmed = window.confirm(
      `Delete the ${leave.leave_type_display || leave.leave_type} request for ${leave.employee_name}?`
    );
    if (!confirmed) return;
    try {
      setBusyId(leave.id);
      await leaveApi.delete(leave.id);
      showToast('Leave request deleted.');
      fetchLeaves();
    } catch (err) {
      console.error('Failed to delete leave request:', err);
      showToast('Failed to delete request.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // --- Request form -----------------------------------------------------
  const handleOpenModal = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee || !form.start_date || !form.end_date) {
      setFormError('Employee and both dates are required.');
      return;
    }
    if (form.end_date < form.start_date) {
      setFormError('End date cannot be before the start date.');
      return;
    }
    try {
      setSubmitting(true);
      setFormError('');
      await leaveApi.create(form);
      setIsModalOpen(false);
      showToast('Leave request submitted.');
      setPage(1);
      fetchLeaves();
    } catch (err) {
      console.error('Failed to submit leave request:', err);
      const data = err.response?.data;
      const message =
        typeof data === 'object' && data !== null
          ? Object.entries(data)
              .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(' ') : msgs}`)
              .join(' | ')
          : 'Failed to submit leave request.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const pageSize = 10;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getStatusBadge = (status) => {
    const map = {
      PENDING: <span className="badge badge-warning">Pending</span>,
      APPROVED: <span className="badge badge-success">Approved</span>,
      REJECTED: <span className="badge badge-danger">Rejected</span>,
      CANCELLED: <span className="badge">Cancelled</span>,
    };
    return map[status] || <span className="badge">{status}</span>;
  };

  const getTypeLabel = (code) =>
    LEAVE_TYPES.find((t) => t.value === code)?.label || code;

  return (
    <div className="leave-page animate-fade-in">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`toast-message ${toast.type === 'error' ? 'alert-error' : 'badge-success'}`}
          style={{ padding: '12px 18px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} style={{ color: 'inherit', padding: '2px' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>Leave Management</h1>
          <p>Review, approve, and track employee time-off requests.</p>
        </div>
        <button onClick={handleOpenModal} className="btn btn-primary">
          <Plus size={18} />
          <span>New Leave Request</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-row">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Leave Types</option>
            {LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={employeeFilter}
            onChange={(e) => {
              setEmployeeFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.full_name} ({emp.employee_id})
              </option>
            ))}
          </select>

          {(statusFilter || typeFilter || employeeFilter) && (
            <button onClick={resetFilters} className="btn btn-secondary btn-sm">
              <X size={14} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Requests Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px' }}>
                    <div className="spinner-primary" style={{ margin: '0 auto 12px' }} />
                    <p>Loading leave requests...</p>
                  </td>
                </tr>
              ) : leaves.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="empty-table-state">
                      <CalendarDays size={40} style={{ opacity: 0.4 }} />
                      <p>No leave requests match the current filters.</p>
                      <button onClick={resetFilters} className="btn btn-secondary btn-sm">
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                leaves.map((leave) => (
                  <tr key={leave.id}>
                    <td>
                      <div className="employee-cell">
                        <div className="employee-avatar-circle">
                          {leave.employee_name
                            ?.split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <div className="employee-name">{leave.employee_name}</div>
                          <div className="employee-sub">{leave.employee_id_code}</div>
                        </div>
                      </div>
                    </td>
                    <td>{getTypeLabel(leave.leave_type)}</td>
                    <td>{leave.start_date}</td>
                    <td>{leave.end_date}</td>
                    <td>
                      <span className="badge badge-info">{leave.days_count}</span>
                    </td>
                    <td style={{ maxWidth: '220px' }} title={leave.reason}>
                      <span className="reason-text">{leave.reason || '—'}</span>
                    </td>
                    <td>{getStatusBadge(leave.status)}</td>
                    <td>
                      <div className="table-actions">
                        {leave.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleAction(leave, 'approve', 'approved')}
                              className="action-icon-btn btn-approve"
                              disabled={busyId === leave.id}
                              title="Approve request"
                            >
                              {busyId === leave.id ? <Loader2 size={15} /> : <Check size={15} />}
                            </button>
                            <button
                              onClick={() => handleAction(leave, 'reject', 'rejected')}
                              className="action-icon-btn btn-delete"
                              disabled={busyId === leave.id}
                              title="Reject request"
                            >
                              <X size={15} />
                            </button>
                          </>
                        )}
                        {leave.status === 'APPROVED' && (
                          <button
                            onClick={() => handleAction(leave, 'cancel', 'cancelled')}
                            className="action-icon-btn"
                            disabled={busyId === leave.id}
                            title="Cancel approved leave"
                          >
                            <Ban size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(leave)}
                          className="action-icon-btn btn-delete"
                          disabled={busyId === leave.id}
                          title="Delete request"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="pagination-bar">
          <div>
            Showing <strong>{leaves.length}</strong> of <strong>{totalCount}</strong> requests
            {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
          </div>
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages || loading}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Leave Request Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Leave Request</h2>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="form-error" style={{ marginBottom: '14px' }}>
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="leave-employee">
                    Employee *
                  </label>
                  <select
                    id="leave-employee"
                    className="form-select"
                    name="employee"
                    value={form.employee}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select an employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="leave-type">
                    Leave Type *
                  </label>
                  <select
                    id="leave-type"
                    className="form-select"
                    name="leave_type"
                    value={form.leave_type}
                    onChange={handleFormChange}
                  >
                    {LEAVE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="leave-start">
                      Start Date *
                    </label>
                    <input
                      id="leave-start"
                      className="form-input"
                      type="date"
                      name="start_date"
                      value={form.start_date}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="leave-end">
                      End Date *
                    </label>
                    <input
                      id="leave-end"
                      className="form-input"
                      type="date"
                      name="end_date"
                      value={form.end_date}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="leave-reason">
                    Reason
                  </label>
                  <textarea
                    id="leave-reason"
                    className="form-textarea"
                    name="reason"
                    rows="3"
                    placeholder="Brief reason for the request (optional)"
                    value={form.reason}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <Plus size={16} />}
                  <span>{submitting ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
