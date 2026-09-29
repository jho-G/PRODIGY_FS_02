import { useState, useEffect, useCallback } from 'react';
import {
  Banknote,
  Search,
  X,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import { payrollApi, employeeApi } from '../api';
import './Payroll.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EMPTY_FORM = {
  employee: '',
  period_year: new Date().getFullYear(),
  period_month: new Date().getMonth() + 1,
  basic_salary: '',
  allowances: '0',
  bonus: '0',
  tax_deduction: '0',
  other_deductions: '0',
  notes: '',
};

export default function Payroll() {
  const [payslips, setPayslips] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [monthFilter, setMonthFilter] = useState('');

  // Summary cards
  const [summary, setSummary] = useState(null);

  // Generate payroll state
  const [generating, setGenerating] = useState(false);

  // Create payslip modal
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

  // Debounce employee-name search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load employees once (for filter dropdown + local name search + create form)
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
        console.error('Error fetching employees for payroll page:', err);
      }
    };
    fetchAllEmployees();
  }, []);

  const fetchPayslips = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page };
      if (employeeFilter) params.employee = employeeFilter;
      if (yearFilter) params.year = yearFilter;
      if (monthFilter) params.month = monthFilter;

      const data = await payrollApi.getAll(params);
      if (data.results) {
        setPayslips(data.results);
        setTotalCount(data.count || 0);
      } else if (Array.isArray(data)) {
        setPayslips(data);
        setTotalCount(data.length);
      } else {
        setPayslips([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching payslips:', err);
      showToast('Failed to load payslips.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, employeeFilter, yearFilter, monthFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      const params = {};
      if (yearFilter) params.year = yearFilter;
      if (monthFilter) params.month = monthFilter;
      const data = await payrollApi.getSummary(params);
      setSummary(data);
    } catch (err) {
      console.error('Error fetching payroll summary:', err);
    }
  }, [yearFilter, monthFilter]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Local name search over loaded payslips (server side is filtered by employee id)
  const visiblePayslips = payslips.filter((slip) => {
    if (!debouncedSearch.trim()) return true;
    const term = debouncedSearch.trim().toLowerCase();
    return (
      slip.employee_name?.toLowerCase().includes(term) ||
      slip.employee_id_code?.toLowerCase().includes(term) ||
      slip.position?.toLowerCase().includes(term)
    );
  });

  // --- Actions -----------------------------------------------------------
  const handleGenerate = async () => {
    const [year, month] = summaryMonthParts;
    const confirmed = window.confirm(
      `Generate payslips for all active employees for ${MONTHS[month - 1]} ${year}? Existing payslips for that period will be recalculated.`
    );
    if (!confirmed) return;
    try {
      setGenerating(true);
      const data = await payrollApi.generate({ year, month });
      showToast(
        `Payroll generated: ${data.created} created, ${data.updated} refreshed.`
      );
      fetchPayslips();
      fetchSummary();
    } catch (err) {
      console.error('Payroll generation failed:', err);
      showToast(err.response?.data?.detail || 'Payroll generation failed.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (slip) => {
    const confirmed = window.confirm(
      `Delete the ${slip.period_label} payslip for ${slip.employee_name}?`
    );
    if (!confirmed) return;
    try {
      setBusyId(slip.id);
      await payrollApi.delete(slip.id);
      showToast('Payslip deleted.');
      fetchPayslips();
      fetchSummary();
    } catch (err) {
      console.error('Failed to delete payslip:', err);
      showToast('Failed to delete payslip.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const summaryMonthParts = [
    parseInt(yearFilter, 10) || new Date().getFullYear(),
    parseInt(monthFilter, 10) || new Date().getMonth() + 1,
  ];

  // --- Create form -------------------------------------------------------
  const handleOpenModal = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEmployeeSelect = (e) => {
    const emp = employees.find((x) => String(x.id) === e.target.value);
    setForm((prev) => ({
      ...prev,
      employee: e.target.value,
      basic_salary: emp ? String(emp.salary_monthly ?? '') : prev.basic_salary,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.employee || !form.basic_salary) {
      setFormError('Employee and basic salary are required.');
      return;
    }
    try {
      setSubmitting(true);
      setFormError('');
      await payrollApi.create({
        ...form,
        period_year: parseInt(form.period_year, 10),
        period_month: parseInt(form.period_month, 10),
        basic_salary: parseFloat(form.basic_salary),
        allowances: parseFloat(form.allowances || 0),
        bonus: parseFloat(form.bonus || 0),
        tax_deduction: parseFloat(form.tax_deduction || 0),
        other_deductions: parseFloat(form.other_deductions || 0),
      });
      setIsModalOpen(false);
      showToast('Payslip created.');
      setPage(1);
      fetchPayslips();
      fetchSummary();
    } catch (err) {
      console.error('Failed to create payslip:', err);
      const data = err.response?.data;
      const message =
        typeof data === 'object' && data !== null
          ? Object.entries(data)
              .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(' ') : msgs}`)
              .join(' | ')
          : 'Failed to create payslip.';
      setFormError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const pageSize = 15;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const formatMoney = (value, currency = 'USD') => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return '—';
    return `${currency} ${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const availableYears = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="payroll-page animate-fade-in">
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
          <h1>Payroll</h1>
          <p>Monthly payslips, payroll totals, and bulk generation.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleGenerate} className="btn btn-secondary" disabled={generating}>
            {generating ? (
              <span className="spinner" style={{ width: 16, height: 16 }} />
            ) : (
              <Zap size={18} />
            )}
            <span>{generating ? 'Generating...' : 'Generate Monthly Payroll'}</span>
          </button>
          <button onClick={handleOpenModal} className="btn btn-primary">
            <Plus size={18} />
            <span>Add Payslip</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="payroll-summary-grid">
        <div className="summary-card">
          <div className="summary-label">Total Net Pay</div>
          <div className="summary-value">
            {summary ? formatMoney(summary.total_net, 'USD') : '—'}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Gross Pay</div>
          <div className="summary-value">
            {summary ? formatMoney(summary.total_gross, 'USD') : '—'}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Total Tax Deducted</div>
          <div className="summary-value">
            {summary ? formatMoney(summary.total_tax, 'USD') : '—'}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Payslips Issued</div>
          <div className="summary-value">{summary?.payslip_count ?? '—'}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-row">
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

          <select
            className="filter-select"
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(1);
            }}
          >
            {availableYears.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Months</option>
            {MONTHS.map((m, idx) => (
              <option key={m} value={String(idx + 1)}>
                {m}
              </option>
            ))}
          </select>

          <div className="search-input-wrapper" style={{ maxWidth: '300px' }}>
            <Search size={16} className="search-icon" />
            <input
              className="search-input"
              placeholder="Filter by name, ID, position..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="clear-search-btn" onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payslips Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Period</th>
                <th>Basic</th>
                <th>Allowances</th>
                <th>Bonus</th>
                <th>Deductions</th>
                <th>Net Pay</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px' }}>
                    <div className="spinner-primary" style={{ margin: '0 auto 12px' }} />
                    <p>Loading payslips...</p>
                  </td>
                </tr>
              ) : visiblePayslips.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="empty-table-state">
                      <Banknote size={40} style={{ opacity: 0.4 }} />
                      <p>No payslips match the current filters.</p>
                      <button
                        onClick={() => {
                          setSearch('');
                          setEmployeeFilter('');
                          setMonthFilter('');
                          setPage(1);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                visiblePayslips.map((slip) => {
                  const deductions =
                    parseFloat(slip.tax_deduction || 0) +
                    parseFloat(slip.other_deductions || 0);
                  return (
                    <tr key={slip.id}>
                      <td>
                        <div className="employee-cell">
                          <div className="employee-avatar-circle">
                            {slip.employee_name
                              ?.split(' ')
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                          <div>
                            <div className="employee-name">{slip.employee_name}</div>
                            <div className="employee-sub">
                              {slip.position} · {slip.employee_id_code}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info">{slip.period_label}</span>
                      </td>
                      <td>{formatMoney(slip.basic_salary, slip.currency)}</td>
                      <td>{formatMoney(slip.allowances, slip.currency)}</td>
                      <td>{formatMoney(slip.bonus, slip.currency)}</td>
                      <td style={{ color: 'var(--danger)' }}>
                        −{formatMoney(deductions, slip.currency)}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {formatMoney(slip.net_pay, slip.currency)}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            onClick={() => handleDelete(slip)}
                            className="action-icon-btn btn-delete"
                            disabled={busyId === slip.id}
                            title="Delete payslip"
                          >
                            {busyId === slip.id ? <Loader2 size={15} /> : <Trash2 size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="pagination-bar">
          <div>
            Showing <strong>{visiblePayslips.length}</strong> of{' '}
            <strong>{totalCount}</strong> payslips
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

      {/* Add Payslip Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Payslip</h2>
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
                  <label className="form-label" htmlFor="payslip-employee">
                    Employee *
                  </label>
                  <select
                    id="payslip-employee"
                    className="form-select"
                    name="employee"
                    value={form.employee}
                    onChange={handleEmployeeSelect}
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

                <div className="payroll-form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="payslip-year">
                      Year *
                    </label>
                    <input
                      id="payslip-year"
                      className="form-input"
                      type="number"
                      name="period_year"
                      min="2000"
                      max="2100"
                      value={form.period_year}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="payslip-month">
                      Month *
                    </label>
                    <select
                      id="payslip-month"
                      className="form-select"
                      name="period_month"
                      value={form.period_month}
                      onChange={handleFormChange}
                    >
                      {MONTHS.map((m, idx) => (
                        <option key={m} value={idx + 1}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="payslip-basic">
                    Basic Salary *
                  </label>
                  <input
                    id="payslip-basic"
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="0"
                    name="basic_salary"
                    value={form.basic_salary}
                    onChange={handleFormChange}
                    placeholder="Auto-filled from employee monthly salary"
                    required
                  />
                </div>

                <div className="payroll-form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="payslip-allowances">
                      Allowances
                    </label>
                    <input
                      id="payslip-allowances"
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      name="allowances"
                      value={form.allowances}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="payslip-bonus">
                      Bonus
                    </label>
                    <input
                      id="payslip-bonus"
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      name="bonus"
                      value={form.bonus}
                      onChange={handleFormChange}
                    />
                  </div>
                </div>

                <div className="payroll-form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="payslip-tax">
                      Tax Deduction
                    </label>
                    <input
                      id="payslip-tax"
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      name="tax_deduction"
                      value={form.tax_deduction}
                      onChange={handleFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="payslip-other">
                      Other Deductions
                    </label>
                    <input
                      id="payslip-other"
                      className="form-input"
                      type="number"
                      step="0.01"
                      min="0"
                      name="other_deductions"
                      value={form.other_deductions}
                      onChange={handleFormChange}
                    />
                  </div>
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
                  <span>{submitting ? 'Saving...' : 'Create Payslip'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
