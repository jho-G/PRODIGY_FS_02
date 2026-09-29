import { useState, useEffect, useCallback } from 'react';
import {
  Star,
  Search,
  X,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Trash2,
  Loader2,
  Award,
} from 'lucide-react';
import { performanceApi, employeeApi } from '../api';
import './Performance.css';

const STATUS_OPTIONS = ['DRAFT', 'COMPLETED', 'ACKNOWLEDGED'];
const COMPETENCIES = ['productivity', 'quality', 'teamwork', 'communication', 'leadership'];

const EMPTY_FORM = {
  employee: '',
  review_period: '',
  productivity: '3',
  quality: '3',
  teamwork: '3',
  communication: '3',
  leadership: '3',
  strengths: '',
  areas_for_improvement: '',
  goals: '',
};

export default function Performance() {
  const [reviews, setReviews] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');

  // Detail modal
  const [detailReview, setDetailReview] = useState(null);

  // Create modal
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

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load employees once (for filter dropdown + create form)
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
        console.error('Error fetching employees for performance page:', err);
      }
    };
    fetchAllEmployees();
  }, []);

  const fetchReviews = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page };
      if (statusFilter) params.status = statusFilter;
      if (employeeFilter) params.employee = employeeFilter;
      if (periodFilter) params.review_period = periodFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

      const data = await performanceApi.getAll(params);
      if (data.results) {
        setReviews(data.results);
        setTotalCount(data.count || 0);
      } else if (Array.isArray(data)) {
        setReviews(data);
        setTotalCount(data.length);
      } else {
        setReviews([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching performance reviews:', err);
      showToast('Failed to load performance reviews.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, employeeFilter, periodFilter, debouncedSearch]);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await performanceApi.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Error fetching performance summary:', err);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // --- Workflow actions ---------------------------------------------------
  const handleComplete = async (review) => {
    try {
      setBusyId(review.id);
      await performanceApi.complete(review.id);
      showToast(`Review for ${review.employee_name} marked completed.`);
      fetchReviews();
      fetchSummary();
      if (detailReview?.id === review.id) {
        setDetailReview((prev) => ({ ...prev, status: 'COMPLETED' }));
      }
    } catch (err) {
      console.error('Failed to complete review:', err);
      showToast(err.response?.data?.detail || 'Failed to complete review.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleAcknowledge = async (review) => {
    try {
      setBusyId(review.id);
      await performanceApi.acknowledge(review.id);
      showToast(`Review for ${review.employee_name} acknowledged.`);
      fetchReviews();
      fetchSummary();
      if (detailReview?.id === review.id) {
        setDetailReview((prev) => ({ ...prev, status: 'ACKNOWLEDGED' }));
      }
    } catch (err) {
      console.error('Failed to acknowledge review:', err);
      showToast(err.response?.data?.detail || 'Failed to acknowledge review.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (review) => {
    const confirmed = window.confirm(
      `Delete the ${review.review_period} review for ${review.employee_name}?`
    );
    if (!confirmed) return;
    try {
      setBusyId(review.id);
      await performanceApi.delete(review.id);
      showToast('Performance review deleted.');
      setDetailReview(null);
      fetchReviews();
      fetchSummary();
    } catch (err) {
      console.error('Failed to delete review:', err);
      showToast('Failed to delete review.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // --- Create form ----------------------------------------------------------
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
    if (!form.employee || !form.review_period.trim()) {
      setFormError('Employee and review period are required.');
      return;
    }
    try {
      setSubmitting(true);
      setFormError('');
      await performanceApi.create({
        ...form,
        productivity: parseInt(form.productivity, 10),
        quality: parseInt(form.quality, 10),
        teamwork: parseInt(form.teamwork, 10),
        communication: parseInt(form.communication, 10),
        leadership: parseInt(form.leadership, 10),
      });
      setIsModalOpen(false);
      showToast('Performance review created as draft.');
      setPage(1);
      fetchReviews();
      fetchSummary();
    } catch (err) {
      console.error('Failed to create review:', err);
      const data = err.response?.data;
      const message =
        typeof data === 'object' && data !== null
          ? Object.entries(data)
              .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(' ') : msgs}`)
              .join(' | ')
          : 'Failed to create review.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const pageSize = 10;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getStatusBadge = (status) => {
    const map = {
      DRAFT: <span className="badge badge-warning">Draft</span>,
      COMPLETED: <span className="badge badge-info">Completed</span>,
      ACKNOWLEDGED: <span className="badge badge-success">Acknowledged</span>,
    };
    return map[status] || <span className="badge">{status}</span>;
  };

  const getRatingBadge = (rating, label) => {
    if (rating >= 4.5) return <span className="badge badge-success">{rating} · {label}</span>;
    if (rating >= 3.5) return <span className="badge badge-primary">{rating} · {label}</span>;
    if (rating >= 2.5) return <span className="badge badge-info">{rating} · {label}</span>;
    if (rating >= 1.5) return <span className="badge badge-warning">{rating} · {label}</span>;
    return <span className="badge badge-danger">{rating} · {label}</span>;
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setEmployeeFilter('');
    setPeriodFilter('');
    setPage(1);
  };

  return (
    <div className="performance-page animate-fade-in">
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
          <h1>Performance Reviews</h1>
          <p>Competency evaluations, rating analytics, and acknowledgement tracking.</p>
        </div>
        <button onClick={handleOpenModal} className="btn btn-primary">
          <Plus size={18} />
          <span>New Review</span>
        </button>
      </div>

      {/* Analytics Cards */}
      <div className="performance-summary-grid">
        <div className="summary-card">
          <div className="summary-label">Completed Reviews</div>
          <div className="summary-value">{summary?.total_reviews ?? '—'}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Average Overall Rating</div>
          <div className="summary-value">
            {summary ? `${summary.average_overall_rating} / 5` : '—'}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Top Performer</div>
          <div className="summary-value summary-value-small">
            {summary?.top_performers?.[0]
              ? `${summary.top_performers[0].employee_name} (${summary.top_performers[0].average_rating})`
              : '—'}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Outstanding Ratings</div>
          <div className="summary-value">
            {summary?.distribution?.['Outstanding'] ?? 0}
          </div>
        </div>
      </div>

      {/* Top Performers Strip */}
      {summary?.top_performers?.length > 0 && (
        <div className="top-performers-card">
          <div className="top-performers-header">
            <Award size={18} />
            <span>Top Performers</span>
          </div>
          <div className="top-performers-list">
            {summary.top_performers.map((p, idx) => (
              <div key={p.employee} className="performer-chip">
                <span className="performer-rank">#{idx + 1}</span>
                <div>
                  <div className="performer-name">{p.employee_name}</div>
                  <div className="performer-sub">{p.position}</div>
                </div>
                <span className="badge badge-success">{p.average_rating}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-row">
          <div className="search-input-wrapper" style={{ maxWidth: '320px' }}>
            <Search size={16} className="search-icon" />
            <input
              className="search-input"
              placeholder="Search name, ID, period, goals..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
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

          <input
            className="filter-select"
            style={{ minWidth: '160px' }}
            placeholder="Review period (e.g. 2026-Q2)"
            value={periodFilter}
            onChange={(e) => {
              setPeriodFilter(e.target.value);
              setPage(1);
            }}
          />

          {(statusFilter || employeeFilter || periodFilter) && (
            <button onClick={resetFilters} className="btn btn-secondary btn-sm">
              <X size={14} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Reviews Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Review Date</th>
                <th>Overall Rating</th>
                <th>Status</th>
                <th>Reviewer</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px' }}>
                    <div className="spinner-primary" style={{ margin: '0 auto 12px' }} />
                    <p>Loading performance reviews...</p>
                  </td>
                </tr>
              ) : reviews.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-table-state">
                      <Star size={40} style={{ opacity: 0.4 }} />
                      <p>No performance reviews match the current filters.</p>
                      <button onClick={resetFilters} className="btn btn-secondary btn-sm">
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                reviews.map((review) => (
                  <tr key={review.id}>
                    <td>
                      <div className="employee-cell">
                        <div className="employee-avatar-circle">
                          {review.employee_name
                            ?.split(' ')
                            .map((p) => p[0])
                            .slice(0, 2)
                            .join('')}
                        </div>
                        <div>
                          <div className="employee-name">{review.employee_name}</div>
                          <div className="employee-sub">
                            {review.position} · {review.department_name || 'No dept'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-primary">{review.review_period}</span>
                    </td>
                    <td>{review.review_date}</td>
                    <td>{getRatingBadge(review.overall_rating, review.rating_label)}</td>
                    <td>{getStatusBadge(review.status)}</td>
                    <td>{review.reviewer_username || '—'}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          onClick={() => setDetailReview(review)}
                          className="action-icon-btn"
                          title="View review details"
                        >
                          <Eye size={15} />
                        </button>
                        {review.status === 'DRAFT' && (
                          <button
                            onClick={() => handleComplete(review)}
                            className="action-icon-btn btn-approve"
                            disabled={busyId === review.id}
                            title="Mark as completed"
                          >
                            {busyId === review.id ? <Loader2 size={15} /> : <CheckCircle size={15} />}
                          </button>
                        )}
                        {review.status === 'COMPLETED' && (
                          <button
                            onClick={() => handleAcknowledge(review)}
                            className="action-icon-btn btn-approve"
                            disabled={busyId === review.id}
                            title="Mark as acknowledged"
                          >
                            {busyId === review.id ? <Loader2 size={15} /> : <Check size={15} />}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(review)}
                          className="action-icon-btn btn-delete"
                          disabled={busyId === review.id}
                          title="Delete review"
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
            Showing <strong>{reviews.length}</strong> of <strong>{totalCount}</strong> reviews
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

      {/* Review Detail Modal */}
      {detailReview && (
        <div className="modal-backdrop" onClick={() => setDetailReview(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                Review · {detailReview.employee_name} ({detailReview.review_period})
              </h2>
              <button className="modal-close-btn" onClick={() => setDetailReview(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="review-scores-grid">
                {COMPETENCIES.map((comp) => (
                  <div key={comp} className="review-score-item">
                    <span className="review-score-label">
                      {comp.charAt(0).toUpperCase() + comp.slice(1)}
                    </span>
                    <span className="review-score-stars">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={15}
                          className={star <= detailReview[comp] ? 'star-filled' : 'star-empty'}
                        />
                      ))}
                    </span>
                  </div>
                ))}
              </div>

              <div className="review-overall">
                {getRatingBadge(detailReview.overall_rating, detailReview.rating_label)}
                <span style={{ marginLeft: '8px' }}>{getStatusBadge(detailReview.status)}</span>
              </div>

              <div className="review-section">
                <h3 className="review-section-title">Strengths</h3>
                <p>{detailReview.strengths || 'Not recorded.'}</p>
              </div>
              <div className="review-section">
                <h3 className="review-section-title">Areas for Improvement</h3>
                <p>{detailReview.areas_for_improvement || 'Not recorded.'}</p>
              </div>
              <div className="review-section">
                <h3 className="review-section-title">Goals</h3>
                <p>{detailReview.goals || 'Not recorded.'}</p>
              </div>
            </div>

            <div className="modal-footer">
              {detailReview.status === 'DRAFT' && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleComplete(detailReview)}
                  disabled={busyId === detailReview.id}
                >
                  <CheckCircle size={16} />
                  <span>Mark Completed</span>
                </button>
              )}
              {detailReview.status === 'COMPLETED' && (
                <button
                  className="btn btn-primary"
                  onClick={() => handleAcknowledge(detailReview)}
                  disabled={busyId === detailReview.id}
                >
                  <Check size={16} />
                  <span>Acknowledge</span>
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setDetailReview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Review Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New Performance Review</h2>
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
                  <label className="form-label" htmlFor="review-employee">
                    Employee *
                  </label>
                  <select
                    id="review-employee"
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
                  <label className="form-label" htmlFor="review-period">
                    Review Period *
                  </label>
                  <input
                    id="review-period"
                    className="form-input"
                    type="text"
                    name="review_period"
                    placeholder="e.g. 2026-Q3 or 2026 Annual"
                    value={form.review_period}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Competency Scores (1–5)</label>
                  <div className="review-scores-grid">
                    {COMPETENCIES.map((comp) => (
                      <div key={comp} className="review-score-item">
                        <span className="review-score-label">
                          {comp.charAt(0).toUpperCase() + comp.slice(1)}
                        </span>
                        <select
                          className="form-select review-score-select"
                          name={comp}
                          value={form[comp]}
                          onChange={handleFormChange}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="review-strengths">
                    Strengths
                  </label>
                  <textarea
                    id="review-strengths"
                    className="form-textarea"
                    name="strengths"
                    rows="2"
                    value={form.strengths}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="review-improvements">
                    Areas for Improvement
                  </label>
                  <textarea
                    id="review-improvements"
                    className="form-textarea"
                    name="areas_for_improvement"
                    rows="2"
                    value={form.areas_for_improvement}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="review-goals">
                    Goals
                  </label>
                  <textarea
                    id="review-goals"
                    className="form-textarea"
                    name="goals"
                    rows="2"
                    value={form.goals}
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
                  {submitting ? (
                    <span className="spinner" style={{ width: 16, height: 16 }} />
                  ) : (
                    <Plus size={16} />
                  )}
                  <span>{submitting ? 'Creating...' : 'Create Draft Review'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
