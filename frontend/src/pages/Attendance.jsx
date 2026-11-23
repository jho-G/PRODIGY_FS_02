import { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Search,
  X,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogIn,
  LogOut,
  Loader2,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Plus,
  Check,
} from 'lucide-react';
import { attendanceApi, employeeApi, overtimeApi } from '../api';
import { useAuth } from '../context/useAuth';
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
  const { isManager, employeeId } = useAuth();
  // View toggle: 'records' = daily log, 'summary' = per-employee month counts
  const [view, setView] = useState('records');

  const [records, setRecords] = useState([]);
  const [todayRecord, setTodayRecord] = useState(null);
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
  const [exporting, setExporting] = useState(false);

  // Shifts & Overtime
  const [myShift, setMyShift] = useState(null);
  const [overtimes, setOvertimes] = useState([]);
  const [showOvertimeModal, setShowOvertimeModal] = useState(false);
  const [overtimeForm, setOvertimeForm] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: 2,
    rate_multiplier: 1.5,
    compensation_type: 'PAYOUT',
    reason: '',
  });

  const showToast = (message, type = 'summary') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMyShift = useCallback(async () => {
    try {
      const data = await attendanceApi.getMyShift();
      setMyShift(data.shift);
    } catch (err) {
      console.warn('Could not fetch shift details:', err);
    }
  }, []);

  const fetchOvertimes = useCallback(async () => {
    try {
      const data = await overtimeApi.getAll();
      setOvertimes(data.results || (Array.isArray(data) ? data : []));
    } catch (err) {
      console.warn('Could not fetch overtime records:', err);
    }
  }, []);

  const fetchTodayRecord = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const params = { date: todayStr };
      if (employeeId) params.employee = employeeId;
      const data = await attendanceApi.getAll(params);
      const results = data.results || (Array.isArray(data) ? data : []);
      if (results.length > 0) {
        setTodayRecord(results[0]);
      } else {
        setTodayRecord(null);
      }
    } catch (err) {
      console.warn('Could not fetch today attendance record:', err);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchTodayRecord();
    fetchMyShift();
  }, [fetchTodayRecord, fetchMyShift]);

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

  const summaryTotals = filteredSummary.reduce(
    (acc, row) => {
      acc.present += (row.present || 0) + (row.remote || 0);
      acc.late += row.late || 0;
      acc.absent += row.absent || 0;
      acc.leave += row.on_leave || 0;
      acc.total += row.total_days || 0;
      return acc;
    },
    { present: 0, late: 0, absent: 0, leave: 0, total: 0 }
  );
  const companyAttendanceRate =
    summaryTotals.total > 0
      ? Math.round((summaryTotals.present / summaryTotals.total) * 100)
      : 0;

  // Actions
  const handleCheckIn = async (record) => {
    if (!isManager && record.employee !== employeeId) return;
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
    if (!isManager && record.employee !== employeeId) return;
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

  const [punching, setPunching] = useState(false);

  const handleQuickPunch = async () => {
    try {
      setPunching(true);
      let coords = {};
      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 6000,
              enableHighAccuracy: true,
            });
          });
          coords = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
        } catch (geoErr) {
          console.warn('Geolocation capture skipped or denied:', geoErr);
        }
      }

      const res = await attendanceApi.punch(coords);
      if (res.check_out) {
        showToast(`Clock-out recorded at ${formatTime(res.check_out)}.`);
      } else {
        const flagMsg = res.is_flagged
          ? ` (⚠️ ${res.flag_reason || 'Outside geofence boundary'})`
          : ' (📍 Geofence Verified)';
        showToast(`Clock-in recorded at ${formatTime(res.check_in)}${flagMsg}`);
      }
      fetchTodayRecord();
      fetchRecords();
    } catch (err) {
      console.error('Punch failed:', err);
      showToast(err.response?.data?.detail || 'Punch failed.', 'error');
    } finally {
      setPunching(false);
    }
  };

  const handleResolveFlag = async (id) => {
    const notes = window.prompt(
      'Enter resolution note for manager authorization:',
      'Approved off-site work'
    );
    if (notes === null) return;
    try {
      await attendanceApi.resolveFlag(id, { notes });
      showToast('Geofence punch flag resolved.');
      fetchRecords();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to resolve flag.', 'error');
    }
  };

  const handleSaveOvertime = async (e) => {
    e.preventDefault();
    try {
      await overtimeApi.create({
        ...overtimeForm,
        hours: parseFloat(overtimeForm.hours),
        rate_multiplier: parseFloat(overtimeForm.rate_multiplier),
        employee: employeeId,
      });
      showToast('Overtime logged and submitted for manager approval.');
      setShowOvertimeModal(false);
      fetchOvertimes();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to submit overtime.', 'error');
    }
  };

  const handleApproveOvertime = async (id) => {
    try {
      await overtimeApi.approve(id);
      showToast('Overtime request approved.');
      fetchOvertimes();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to approve overtime.', 'error');
    }
  };

  const handleRejectOvertime = async (id) => {
    try {
      await overtimeApi.reject(id);
      showToast('Overtime request rejected.');
      fetchOvertimes();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to reject overtime.', 'error');
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

  const setQuickRange = (preset) => {
    const today = new Date();
    const toISO = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    if (preset === 'today') {
      const dStr = toISO(today);
      setDateFrom(dStr);
      setDateTo(dStr);
    } else if (preset === 'week') {
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today);
      monday.setDate(diff);
      setDateFrom(toISO(monday));
      setDateTo(toISO(today));
    } else if (preset === 'month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(toISO(firstDay));
      setDateTo(toISO(today));
    }
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

  const handleExport = async (format = 'xlsx') => {
    try {
      setExporting(true);
      const params = { format };
      if (employeeFilter) params.employee = employeeFilter;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_after = dateFrom;
      if (dateTo) params.date_before = dateTo;

      const blob = await attendanceApi.export(params);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const ext = format === 'xlsx' ? 'xlsx' : 'csv';
      link.download = `attendance_records_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Attendance report exported as ${format.toUpperCase()}.`, 'success');
    } catch (err) {
      console.error('Attendance export failed:', err);
      showToast(`Failed to export attendance report as ${format.toUpperCase()}.`, 'error');
    } finally {
      setExporting(false);
    }
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleQuickPunch}
            className="btn btn-primary"
            disabled={punching}
            title="Clock In or Clock Out for Today"
          >
            {punching ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Clock size={16} />
            )}
            <span>{punching ? 'Recording...' : 'Clock In / Out Today'}</span>
          </button>
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
            <button
              className={`btn btn-sm ${view === 'overtime' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setView('overtime');
                fetchOvertimes();
              }}
            >
              <TrendingUp size={16} />
              <span>Overtime & Comp-Off</span>
            </button>
          </div>
          {view === 'overtime' && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => {
                setOvertimeForm({
                  date: new Date().toISOString().split('T')[0],
                  hours: 2,
                  rate_multiplier: 1.5,
                  compensation_type: 'PAYOUT',
                  reason: '',
                });
                setShowOvertimeModal(true);
              }}
            >
              <Plus size={16} />
              <span>Log Overtime</span>
            </button>
          )}
          {view !== 'overtime' && (
            <>
              <button
                onClick={() => handleExport('xlsx')}
                className="btn btn-sm btn-secondary"
                disabled={exporting}
                title="Export attendance records to Excel"
              >
                {exporting ? <Loader2 size={16} className="spin" /> : <FileSpreadsheet size={16} />}
                <span>Export Excel</span>
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="btn btn-sm btn-secondary"
                disabled={exporting}
                title="Export attendance records to CSV"
              >
                <Download size={16} />
                <span>Export CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Today Attendance Punch Card */}
      <div className="attendance-today-card">
        <div className="today-card-left">
          <div className="today-icon-wrapper">
            <Clock size={24} className="today-clock-icon" />
          </div>
          <div className="today-info">
            <div className="today-title">
              Today's Attendance ({new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })})
            </div>
            <div className="today-status-row">
              {!todayRecord || !todayRecord.check_in ? (
                <>
                  <span className="today-status-badge status-not-started">Not clocked in today</span>
                  <span className="today-cutoff-note">
                    {myShift
                      ? `• Shift: ${myShift.name} (${myShift.start_time?.slice(0, 5)} - ${myShift.end_time?.slice(0, 5)}, ${myShift.grace_period_minutes}m grace)`
                      : '• Standard Shift (09:00 AM cutoff)'}
                  </span>
                </>
              ) : !todayRecord.check_out ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="today-status-badge status-active">
                    Clocked In: {formatTime(todayRecord.check_in)}
                  </span>
                  {statusBadge(todayRecord.status)}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="today-status-badge status-complete">
                    Shift Done ({formatTime(todayRecord.check_in)} - {formatTime(todayRecord.check_out)})
                  </span>
                  {statusBadge(todayRecord.status)}
                  {todayRecord.work_hours != null && (
                    <span className="badge badge-info">{todayRecord.work_hours}h</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="today-card-actions">
          {!todayRecord || !todayRecord.check_in ? (
            <button
              onClick={handleQuickPunch}
              className="btn btn-primary"
              disabled={punching}
              title="Record Clock-In for Today"
            >
              {punching ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}
              <span>{punching ? 'Recording...' : 'Clock In for Today'}</span>
            </button>
          ) : !todayRecord.check_out ? (
            <button
              onClick={handleQuickPunch}
              className="btn btn-secondary"
              disabled={punching}
              title="Record Clock-Out for Today"
            >
              {punching ? <Loader2 size={16} className="spin" /> : <LogOut size={16} />}
              <span>{punching ? 'Recording...' : 'Clock Out for Today'}</span>
            </button>
          ) : (
            <div className="today-shift-done">
              <CheckCircle size={18} style={{ color: 'var(--success)' }} />
              <span>Shift Recorded</span>
            </div>
          )}
        </div>
      </div>

      {view === 'records' ? (
        <>
          {/* Filter Bar */}
          <div className="filter-bar">
            <div className="filter-row">
              {isManager && (
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
              )}

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

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                  onClick={() => setQuickRange('today')}
                  title="Filter records for today"
                >
                  Today
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                  onClick={() => setQuickRange('week')}
                  title="Filter records for this week"
                >
                  This Week
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                  onClick={() => setQuickRange('month')}
                  title="Filter records for this month"
                >
                  This Month
                </button>
              </div>

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
                    <th>Shift</th>
                    <th>Status</th>
                    <th>Geofence</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Hours</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '36px' }}>
                        <div className="spinner-primary" style={{ margin: '0 auto 12px' }} />
                        <p>Loading attendance records...</p>
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan="9">
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
                        <td>
                          {record.shift_name ? (
                            <span className="badge badge-secondary">{record.shift_name}</span>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Default</span>
                          )}
                        </td>
                        <td>{statusBadge(record.status)}</td>
                        <td>
                          {record.is_geofence_verified ? (
                            <span className="badge badge-success" title="Verified within office geofence">📍 Verified</span>
                          ) : record.is_flagged ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span className="badge badge-warning" title={record.flag_reason || 'Outside boundary'}>⚠️ Flagged</span>
                              {isManager && (
                                <button
                                  type="button"
                                  className="btn btn-xs btn-outline"
                                  style={{ fontSize: '11px', padding: '2px 5px', cursor: 'pointer' }}
                                  onClick={() => handleResolveFlag(record.id)}
                                  title="Approve / Resolve Flag"
                                >
                                  Resolve
                                </button>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td>{formatTime(record.check_in)}</td>
                        <td>{formatTime(record.check_out)}</td>
                        <td>
                          {record.work_hours != null ? (
                            <span className="badge badge-info">{record.work_hours}h</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <div className="action-buttons">
                            {(isManager || record.employee === employeeId) ? (
                              <>
                                {!record.check_in && (
                                  <button
                                    className="action-icon-btn btn-approve"
                                    onClick={() => handleCheckIn(record)}
                                    disabled={busyId === record.id}
                                    title="Record check-in"
                                  >
                                    {busyId === record.id
                                      ? <Loader2 size={14} className="spin" />
                                      : <LogIn size={14} />}
                                  </button>
                                )}
                                {record.check_in && !record.check_out && (
                                  <button
                                    className="action-icon-btn btn-delete"
                                    onClick={() => handleCheckOut(record)}
                                    disabled={busyId === record.id}
                                    title="Record check-out"
                                  >
                                    {busyId === record.id
                                      ? <Loader2 size={14} className="spin" />
                                      : <LogOut size={14} />}
                                  </button>
                                )}
                                {record.check_in && record.check_out && (
                                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Done</span>
                                )}
                              </>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                            )}
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
      ) : view === 'summary' ? (
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

          {/* Monthly Rollup Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div className="metric-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <div className="metric-data">
                <span className="metric-number" style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--success)' }}>
                  {companyAttendanceRate}%
                </span>
                <span className="metric-title" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Overall Attendance Rate</span>
              </div>
            </div>
            <div className="metric-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <div className="metric-data">
                <span className="metric-number" style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--primary)' }}>
                  {summaryTotals.present}
                </span>
                <span className="metric-title" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Present Days</span>
              </div>
            </div>
            <div className="metric-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <div className="metric-data">
                <span className="metric-number" style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--warning)' }}>
                  {summaryTotals.late}
                </span>
                <span className="metric-title" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Late Check-ins</span>
              </div>
            </div>
            <div className="metric-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <div className="metric-data">
                <span className="metric-number" style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--danger)' }}>
                  {summaryTotals.absent}
                </span>
                <span className="metric-title" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Total Absences</span>
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
      ) : (
        <>
          {/* Overtime & Comp-Off View */}
          <div className="table-card">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Overtime Hours</th>
                    <th>Multiplier</th>
                    <th>Compensation Plan</th>
                    <th>Status</th>
                    <th>Reason</th>
                    {isManager && <th>Review Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {overtimes.length === 0 ? (
                    <tr>
                      <td colSpan={isManager ? 8 : 7} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                        No overtime requests recorded. Log extra hours worked using the "Log Overtime" button.
                      </td>
                    </tr>
                  ) : (
                    overtimes.map((ot) => (
                      <tr key={ot.id}>
                        <td>
                          <div className="employee-cell">
                            <div>
                              <div className="employee-name">{ot.employee_name}</div>
                              <div className="employee-sub">{ot.employee_id_code}</div>
                            </div>
                          </div>
                        </td>
                        <td>{ot.date}</td>
                        <td>
                          <span className="badge badge-info">{ot.hours} hrs</span>
                        </td>
                        <td>{ot.rate_multiplier}x</td>
                        <td>
                          {ot.compensation_type === 'COMP_OFF' ? (
                            <span className="badge badge-secondary">Compensatory Off (Leave)</span>
                          ) : (
                            <span className="badge badge-primary">Payroll Payout</span>
                          )}
                        </td>
                        <td>
                          {ot.status === 'APPROVED' ? (
                            <span className="badge badge-success">Approved</span>
                          ) : ot.status === 'REJECTED' ? (
                            <span className="badge badge-danger">Rejected</span>
                          ) : (
                            <span className="badge badge-warning">Pending Review</span>
                          )}
                          {ot.is_processed && <span className="badge badge-info" style={{ marginLeft: '4px' }}>Processed</span>}
                        </td>
                        <td style={{ maxWidth: '240px', fontSize: '12px', color: 'var(--muted)' }}>
                          {ot.reason || '—'}
                        </td>
                        {isManager && (
                          <td>
                            {ot.status === 'PENDING' ? (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  className="btn btn-xs btn-primary"
                                  onClick={() => handleApproveOvertime(ot.id)}
                                  title="Approve Overtime"
                                >
                                  <Check size={12} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  className="btn btn-xs btn-danger"
                                  onClick={() => handleRejectOvertime(ot.id)}
                                  title="Reject Overtime"
                                >
                                  <X size={12} />
                                  <span>Reject</span>
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                {ot.status} by {ot.approved_by_username || 'system'}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Log Overtime Modal */}
      {showOvertimeModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Log Overtime Hours</h2>
              <button className="modal-close" onClick={() => setShowOvertimeModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveOvertime} className="modal-body">
              <div className="form-group">
                <label className="form-label">Overtime Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={overtimeForm.date}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, date: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Extra Hours Worked *</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    max="16"
                    className="form-control"
                    value={overtimeForm.hours}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, hours: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Pay Multiplier</label>
                  <select
                    className="form-control"
                    value={overtimeForm.rate_multiplier}
                    onChange={(e) => setOvertimeForm({ ...overtimeForm, rate_multiplier: e.target.value })}
                  >
                    <option value="1.5">1.5x (Standard Overtime)</option>
                    <option value="2.0">2.0x (Holiday / Weekend)</option>
                    <option value="1.0">1.0x (Flat Rate)</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Compensation Choice *</label>
                <select
                  className="form-control"
                  value={overtimeForm.compensation_type}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, compensation_type: e.target.value })}
                  required
                >
                  <option value="PAYOUT">Payroll Hourly Payout (Next Paycheck)</option>
                  <option value="COMP_OFF">Compensatory Off (Credit to Leave Balance)</option>
                </select>
                <small style={{ color: 'var(--muted)', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                  Comp-off automatically credits 1 leave day per 8 overtime hours upon manager approval.
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Reason / Work Delivered *</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Production emergency hotfix, end-of-quarter client reporting"
                  value={overtimeForm.reason}
                  onChange={(e) => setOvertimeForm({ ...overtimeForm, reason: e.target.value })}
                  required
                />
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOvertimeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Overtime Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
