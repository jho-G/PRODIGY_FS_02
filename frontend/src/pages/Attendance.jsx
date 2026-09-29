import { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  LogIn,
  LogOut,
  Search,
  X,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
} from 'lucide-react';
import { attendanceApi, employeeApi } from '../api';
import './Attendance.css';

const STATUS_OPTIONS = ['PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'REMOTE'];

const statusBadge = (status) => {
  const map = {
    PRESENT: <span className="badge badge-success">Present</span>,
    LATE: <span className="badge badge-warning">Late</span>,
    ABSENT: <span className="badge badge-danger">Absent</span>,
    LEAVE: <span className="badge badge-info">On Leave</span>,
    REMOTE: <span className="badge badge-primary">Remote</span>,
  };
  return map[status] || <span className="badge">{status}</span>;
};

export default function Attendance() {
  // View toggle: 'records' = daily log, 'summary' = per-employee month counts
  const [view, setView] = useState('records');

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState([]);
  const [summaryMeta, setSummaryMeta] = useState({ year: null, month: null });
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [summaryMonth, setSummaryMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [busyId, setBusyId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'summary') => {
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

  // Load employees once (for filter dropdown + local name search)
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
        console.error('Error fetching employees for attendance page:', err);
      }
    };
    fetchAllEmployees();
  }, []);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page };

      if (employeeFilter) params.employee = employeeFilter;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_after = dateFrom;
      if (dateTo) params.date_before = dateTo;

      const data = await attendanceApi.getAll(params);
      if (data.results) {
        setRecords(data.results);
        setTotalCount(data.count || 0);
      } else if (Array.isArray(data)) {
        setRecords(data);
        setTotalCount(data.length);
      } else {
        setRecords([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching attendance records:', err);
      showToast('Failed to load attendance records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, employeeFilter, statusFilter, dateFrom, dateTo]);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      const [year, month] = summaryMonth.split('-').map(Number);
      const data = await attendanceApi.getSummary({ year, month });
      setSummary(data.summary || []);
      setSummaryMeta({ year: data.year, month: data.month });
    } catch (err) {
      console.error('Error fetching attendance summary:', err);
      showToast('Failed to load attendance summary.', 'error');
    } finally {
      setLoading(false);
    }
  }, [summaryMonth]);

  useEffect(() => {
    if (view === 'records') {
      fetchRecords();
    } else {
      fetchSummary();
    }
  }, [view, fetchRecords, fetchSummary]);

  // Local name search over the loaded summary rows
  const filteredSummary = summary.filter((row) => {
    if (!debouncedSearch.trim()) return true;
    const term = debouncedSearch.trim().toLowerCase();
    return (
      row.employee_name?.toLowerCase().includes(term) ||
      row.employee_id_code?.toLowerCase().includes(term)
    );
  });

  // Actions
  const handleCheckIn = async (record) => {
    try {
      setBusyId(record.id);
      await attendanceApi.checkIn(record.id);
      showToast(`Check-in recorded for ${record.employee_name}.`);
      fetchRecords();
    } catch (err) {
      console.error('Check-in failed:', err);
      showToast(err.response?.data?.detail || 'Check-in failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCheckOut = async (record) => {
    try {
      setBusyId(record.id);
      await attendanceApi.checkOut(record.id);
      showToast(`Check-out recorded for ${record.employee_name}.`);
      fetchRecords();
    } catch (err) {
      console.error('Check-out failed:', err);
      showToast(err.response?.data?.detail || 'Check-out failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setEmployeeFilter('');
    setStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const pageSize = 15;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const formatTime = (timeStr) => {
    if (!timeStr) return '—';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const monthLabel = (year, month) => {
    if (!year || !month) return '';
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="attendance-page animate-fade-in">
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
          <h1>Attendance</h1>
          <p>Daily check-in/out logs and monthly attendance summaries.</p>
        </div>
        <div className="view-toggle">
          <button
            className={`btn btn-sm ${view === 'records' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('records')}
          >
            <CalendarCheck size={16} />
            <span>Daily Log</span>
          </button>
          <button
            className={`btn btn-sm ${view === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('summary')}
          >
            <Clock size={16} />
            <span>Monthly Summary</span>
          </button>
        </div>
      </div>

      {view === 'records' ? (
        <>
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

              <input
                type="date"
                className="filter-select"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                title="From date"
              />

              <input
                type="date"
                className="filter-select"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                title="To date"
              />

              {(employeeFilter || statusFilter || dateFrom || dateTo) && (
                <button onClick={resetFilters} className="btn btn-secondary btn-sm">
                  <X size={14} />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="table-card">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '36px' }}>
                        <div className="spinner-primary" style={{ margin: '0 auto 12px' }} />
                        <p>Loading attendance records...</p>
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        <div className="empty-table-state">
                          <CalendarCheck size={40} style={{ opacity: 0.4 }} />
                          <p>No attendance records match the current filters.</p>
                          <button onClick={resetFilters} className="btn btn-secondary btn-sm">
                            Reset All Filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <div className="employee-cell">
                            <div className="employee-avatar-circle">
                              {record.employee_name
                                ?.split(' ')
                                .map((p) => p[0])
                                .slice(0, 2)
                                .join('')}
                            </div>
                            <div>
                              <div className="employee-name">{record.employee_name}</div>
                              <div className="employee-sub">{record.employee_id_code}</div>
                            </div>
                          </div>
                        </td>
                        <td>{record.date}</td>
                        <td>{statusBadge(record.status)}</td>
                        <td>{formatTime(record.check_in)}</td>
                        <td>{formatTime(record.check_out)}</td>
                        <td>
                          {record.work_hours != null ? (
                            <span className="badge badge-info">{record.work_hours}h</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
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
                Showing <strong>{records.length}</strong> of <strong>{totalCount}</strong> records
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
        </>
      ) : (
        <>
          {/* Summary Controls */}
          <div className="filter-bar">
            <div className="filter-row">
              <input
                type="month"
                className="filter-select"
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(e.target.value)}
                title="Summary month"
              />
              <div className="search-input-wrapper" style={{ maxWidth: '320px' }}>
                <Search size={16} className="search-icon" />
                <input
                  className="search-input"
                  placeholder="Filter by employee name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Summary Table */}
          <div className="table-card">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Present</th>
                    <th>Late</th>
                    <th>Absent</th>
                    <th>On Leave</th>
                    <th>Remote</th>
                    <th>Total Days</th>
                    <th>Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '36px' }}>
                        <div className="spinner-primary" style={{ margin: '0 auto 12px' }} />
                        <p>Loading summary...</p>
                      </td>
                    </tr>
                  ) : filteredSummary.length === 0 ? (
                    <tr>
                      <td colSpan="8">
                        <div className="empty-table-state">
                          <Clock size={40} style={{ opacity: 0.4 }} />
                          <p>No attendance data for {monthLabel(summaryMeta.year, summaryMeta.month)}.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSummary.map((row) => {
                      const rate =
                        row.total_days > 0
                          ? Math.round(
                              ((row.present + row.remote) / row.total_days) * 100
                            )
                          : 0;
                      return (
                        <tr key={row.employee}>
                          <td>
                            <div className="employee-cell">
                              <div className="employee-avatar-circle">
                                {row.employee_name
                                  ?.split(' ')
                                  .map((p) => p[0])
                                  .slice(0, 2)
                                  .join('')}
                              </div>
                              <div>
                                <div className="employee-name">{row.employee_name}</div>
                                <div className="employee-sub">{row.employee_id_code}</div>
                              </div>
                            </div>
                          </td>
                          <td>{row.present}</td>
                          <td>{row.late}</td>
                          <td>{row.absent}</td>
                          <td>{row.on_leave}</td>
                          <td>{row.remote}</td>
                          <td>{row.total_days}</td>
                          <td>
                            <span
                              className={`badge ${
                                rate >= 90
                                  ? 'badge-success'
                                  : rate >= 75
                                    ? 'badge-warning'
                                    : 'badge-danger'
                              }`}
                            >
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
