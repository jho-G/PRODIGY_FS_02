import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  MapPin,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  Loader2,
  LocateFixed,
  X,
  Users,
} from 'lucide-react';
import {
  shiftApi,
  shiftAssignmentApi,
  officeLocationApi,
  employeeApi,
  departmentApi,
} from '../api';
import { useAuth } from '../context/useAuth';

export default function Shifts() {
  const { isManager } = useAuth();
  const [tab, setTab] = useState('shifts'); // 'shifts' | 'assignments' | 'geofence'

  // Data states
  const [shifts, setShifts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [offices, setOffices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [shiftForm, setShiftForm] = useState({
    name: '',
    start_time: '09:00:00',
    end_time: '17:00:00',
    grace_period_minutes: 15,
    department: '',
    is_default: false,
    description: '',
  });

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employee: '',
    shift: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    notes: '',
  });

  const [showOfficeModal, setShowOfficeModal] = useState(false);
  const [editingOffice, setEditingOffice] = useState(null);
  const [officeForm, setOfficeForm] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius_meters: 200,
    allowed_ip_ranges: '',
    is_active: true,
  });

  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [sData, aData, oData, eData, dData] = await Promise.all([
        shiftApi.getAll(),
        shiftAssignmentApi.getAll(),
        officeLocationApi.getAll(),
        employeeApi.getAll({ is_active: true }),
        departmentApi.getAll(),
      ]);
      setShifts(sData.results || (Array.isArray(sData) ? sData : []));
      setAssignments(aData.results || (Array.isArray(aData) ? aData : []));
      setOffices(oData.results || (Array.isArray(oData) ? oData : []));
      setEmployees(eData.results || (Array.isArray(eData) ? eData : []));
      setDepartments(dData.results || (Array.isArray(dData) ? dData : []));
    } catch (err) {
      console.error('Failed to load shift rosters:', err);
      showToast('Failed to load shift and geofence data.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Handle Shift Submit
  const handleSaveShift = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...shiftForm,
        department: shiftForm.department || null,
        grace_period_minutes: parseInt(shiftForm.grace_period_minutes, 10) || 0,
      };
      if (editingShift) {
        await shiftApi.update(editingShift.id, payload);
        showToast(`Shift '${payload.name}' updated.`);
      } else {
        await shiftApi.create(payload);
        showToast(`Shift '${payload.name}' created.`);
      }
      setShowShiftModal(false);
      setEditingShift(null);
      loadAll();
    } catch (err) {
      console.error('Save shift failed:', err);
      showToast(err.response?.data?.detail || 'Failed to save shift.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteShift = async (id, name) => {
    if (!window.confirm(`Delete shift "${name}"?`)) return;
    try {
      await shiftApi.delete(id);
      showToast(`Shift "${name}" deleted.`);
      loadAll();
    } catch (err) {
      console.error('Delete shift error:', err);
      showToast('Cannot delete shift with active assignments.', 'error');
    }
  };

  // Handle Assign Shift Submit
  const handleSaveAssignment = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        employee: parseInt(assignForm.employee, 10),
        shift: parseInt(assignForm.shift, 10),
        start_date: assignForm.start_date,
        end_date: assignForm.end_date || null,
        notes: assignForm.notes,
        is_active: true,
      };
      await shiftAssignmentApi.create(payload);
      showToast('Shift assigned successfully.');
      setShowAssignModal(false);
      loadAll();
    } catch (err) {
      console.error('Assign shift error:', err);
      showToast(err.response?.data?.detail || 'Failed to assign shift.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (id) => {
    if (!window.confirm('Remove this shift assignment?')) return;
    try {
      await shiftAssignmentApi.delete(id);
      showToast('Shift assignment removed.');
      loadAll();
    } catch (err) {
      console.error('Delete assignment error:', err);
      showToast('Failed to remove assignment.', 'error');
    }
  };

  // Handle Office Geofence Submit
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficeForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
        showToast('Coordinates captured from your device.');
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocating(false);
        showToast('Failed to retrieve location. Please check browser permissions.', 'error');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSaveOffice = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...officeForm,
        latitude: parseFloat(officeForm.latitude),
        longitude: parseFloat(officeForm.longitude),
        radius_meters: parseInt(officeForm.radius_meters, 10) || 200,
      };
      if (editingOffice) {
        await officeLocationApi.update(editingOffice.id, payload);
        showToast(`Office '${payload.name}' updated.`);
      } else {
        await officeLocationApi.create(payload);
        showToast(`Office '${payload.name}' registered.`);
      }
      setShowOfficeModal(false);
      setEditingOffice(null);
      loadAll();
    } catch (err) {
      console.error('Save office error:', err);
      showToast(err.response?.data?.detail || 'Failed to save office geofence.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOffice = async (id, name) => {
    if (!window.confirm(`Delete office geofence "${name}"?`)) return;
    try {
      await officeLocationApi.delete(id);
      showToast(`Office "${name}" removed.`);
      loadAll();
    } catch (err) {
      console.error('Delete office error:', err);
      showToast('Failed to delete office location.', 'error');
    }
  };

  return (
    <div className="page-container" style={{ padding: '24px 32px' }}>
      {/* Toast Notification */}
      {toast && (
        <div
          className={`alert ${toast.type === 'error' ? 'alert-danger' : 'alert-success'}`}
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginLeft: '8px',
              color: 'inherit',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div className="page-header-text">
          <h1 style={{ fontSize: '26px', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>
            Shift Rostering & Geofencing
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: '4px', fontSize: '14px' }}>
            Manage rotational work schedules, team shift assignments, and on-premise geofence boundaries.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isManager && tab === 'shifts' && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingShift(null);
                setShiftForm({
                  name: '',
                  start_time: '09:00:00',
                  end_time: '17:00:00',
                  grace_period_minutes: 15,
                  department: '',
                  is_default: false,
                  description: '',
                });
                setShowShiftModal(true);
              }}
            >
              <Plus size={16} />
              <span>Create Shift</span>
            </button>
          )}
          {isManager && tab === 'assignments' && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setAssignForm({
                  employee: employees[0]?.id || '',
                  shift: shifts[0]?.id || '',
                  start_date: new Date().toISOString().split('T')[0],
                  end_date: '',
                  notes: '',
                });
                setShowAssignModal(true);
              }}
            >
              <Users size={16} />
              <span>Assign Employee to Shift</span>
            </button>
          )}
          {isManager && tab === 'geofence' && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditingOffice(null);
                setOfficeForm({
                  name: '',
                  address: '',
                  latitude: '',
                  longitude: '',
                  radius_meters: 200,
                  allowed_ip_ranges: '',
                  is_active: true,
                });
                setShowOfficeModal(true);
              }}
            >
              <MapPin size={16} />
              <span>Register Office Geofence</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
        <button
          className={`btn btn-sm ${tab === 'shifts' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('shifts')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          <Clock size={16} />
          <span>Work Shifts ({shifts.length})</span>
        </button>
        <button
          className={`btn btn-sm ${tab === 'assignments' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('assignments')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          <Calendar size={16} />
          <span>Roster Assignments ({assignments.length})</span>
        </button>
        <button
          className={`btn btn-sm ${tab === 'geofence' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('geofence')}
          style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
        >
          <MapPin size={16} />
          <span>Office Geofences & IP ({offices.length})</span>
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <Loader2 size={32} className="spin" />
        </div>
      ) : (
        <>
          {/* TAB 1: SHIFTS */}
          {tab === 'shifts' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Shift Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Hours</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Grace Window</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Scope</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Active Staff</th>
                      {isManager && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.length === 0 ? (
                      <tr>
                        <td colSpan={isManager ? 6 : 5} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                          No custom shifts defined yet. Standard 09:00 AM - 05:00 PM cutoff applies.
                        </td>
                      </tr>
                    ) : (
                      shifts.map((s) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: s.color || '#000' }} />
                              <span>{s.name}</span>
                              {s.is_default && <span className="badge badge-success">Company Default</span>}
                            </div>
                            {s.description && (
                              <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '400', marginTop: '2px' }}>
                                {s.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className="badge badge-secondary">{s.grace_period_minutes} mins grace</span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {s.department_name ? (
                              <span className="badge badge-info">{s.department_name}</span>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>Organization-wide</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <span style={{ fontWeight: '600' }}>{s.assigned_count || 0}</span> employees
                          </td>
                          {isManager && (
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => {
                                    setEditingShift(s);
                                    setShiftForm({
                                      name: s.name,
                                      start_time: s.start_time,
                                      end_time: s.end_time,
                                      grace_period_minutes: s.grace_period_minutes,
                                      department: s.department || '',
                                      is_default: s.is_default,
                                      description: s.description || '',
                                    });
                                    setShowShiftModal(true);
                                  }}
                                  title="Edit Shift"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDeleteShift(s.id, s.name)}
                                  title="Delete Shift"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: ASSIGNMENTS */}
          {tab === 'assignments' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Employee</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Assigned Shift</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Working Hours</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Effective Span</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Notes</th>
                      {isManager && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.length === 0 ? (
                      <tr>
                        <td colSpan={isManager ? 6 : 5} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                          No specific shift assignments. Employees follow their department or default shift.
                        </td>
                      </tr>
                    ) : (
                      assignments.map((a) => (
                        <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                            <div>{a.employee_name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '400' }}>{a.employee_id_code}</div>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className="badge badge-primary">{a.shift_name}</span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {a.shift_start_time?.slice(0, 5)} – {a.shift_end_time?.slice(0, 5)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {a.start_date} to {a.end_date || <span style={{ color: 'var(--muted)' }}>Ongoing</span>}
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--muted)', fontSize: '13px' }}>
                            {a.notes || '—'}
                          </td>
                          {isManager && (
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteAssignment(a.id)}
                                title="Remove Assignment"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: GEOFENCES & IP */}
          {tab === 'geofence' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="table-responsive">
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Office Premises</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>GPS Coordinates</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Geofence Radius</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Allowed IP / Subnets</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left' }}>Status</th>
                      {isManager && <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {offices.length === 0 ? (
                      <tr>
                        <td colSpan={isManager ? 6 : 5} style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>
                          No office premises configured. Geofence verification is currently relaxed for all punch-ins.
                        </td>
                      </tr>
                    ) : (
                      offices.map((o) => (
                        <tr key={o.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '600' }}>
                            <div>{o.name}</div>
                            {o.address && <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: '400' }}>{o.address}</div>}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px' }}>
                            {parseFloat(o.latitude).toFixed(4)}, {parseFloat(o.longitude).toFixed(4)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className="badge badge-secondary">{o.radius_meters} meters</span>
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                            {o.allowed_ip_ranges ? (
                              <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                                {o.allowed_ip_ranges}
                              </code>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>Any IP (GPS Only)</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            {o.is_active ? (
                              <span className="badge badge-success">Active Enforced</span>
                            ) : (
                              <span className="badge badge-danger">Disabled</span>
                            )}
                          </td>
                          {isManager && (
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => {
                                    setEditingOffice(o);
                                    setOfficeForm({
                                      name: o.name,
                                      address: o.address || '',
                                      latitude: o.latitude,
                                      longitude: o.longitude,
                                      radius_meters: o.radius_meters,
                                      allowed_ip_ranges: o.allowed_ip_ranges || '',
                                      is_active: o.is_active,
                                    });
                                    setShowOfficeModal(true);
                                  }}
                                  title="Edit Office"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => handleDeleteOffice(o.id, o.name)}
                                  title="Delete Office"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL 1: CREATE/EDIT SHIFT */}
      {showShiftModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>{editingShift ? 'Edit Work Shift' : 'Create Work Shift'}</h2>
              <button className="modal-close" onClick={() => setShowShiftModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveShift} className="modal-body">
              <div className="form-group">
                <label className="form-label">Shift Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Morning Shift, Core Hours, Night Coverage"
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Shift Start Time *</label>
                  <input
                    type="time"
                    className="form-control"
                    value={shiftForm.start_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Shift End Time *</label>
                  <input
                    type="time"
                    className="form-control"
                    value={shiftForm.end_time}
                    onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Grace Period (Minutes)</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    className="form-control"
                    value={shiftForm.grace_period_minutes}
                    onChange={(e) => setShiftForm({ ...shiftForm, grace_period_minutes: e.target.value })}
                    required
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                    Late flag triggers if check-in exceeds start time + grace.
                  </small>
                </div>
                <div className="form-group">
                  <label className="form-label">Department Scope</label>
                  <select
                    className="form-control"
                    value={shiftForm.department}
                    onChange={(e) => setShiftForm({ ...shiftForm, department: e.target.value })}
                  >
                    <option value="">All Departments (Global)</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={shiftForm.is_default}
                    onChange={(e) => setShiftForm({ ...shiftForm, is_default: e.target.checked })}
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>Mark as Default Organization Shift</span>
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">Description / Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Additional schedule details or team rules..."
                  value={shiftForm.description}
                  onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })}
                />
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowShiftModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="spin" /> : null}
                  <span>{editingShift ? 'Save Changes' : 'Create Shift'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ASSIGN SHIFT */}
      {showAssignModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Assign Employee to Shift</h2>
              <button className="modal-close" onClick={() => setShowAssignModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveAssignment} className="modal-body">
              <div className="form-group">
                <label className="form-label">Select Employee *</label>
                <select
                  className="form-control"
                  value={assignForm.employee}
                  onChange={(e) => setAssignForm({ ...assignForm, employee: e.target.value })}
                  required
                >
                  <option value="">-- Choose Employee --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_id})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Select Shift Schedule *</label>
                <select
                  className="form-control"
                  value={assignForm.shift}
                  onChange={(e) => setAssignForm({ ...assignForm, shift: e.target.value })}
                  required
                >
                  <option value="">-- Choose Shift --</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.start_time?.slice(0, 5)} - {s.end_time?.slice(0, 5)})
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Effective Start Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={assignForm.start_date}
                    onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date (Optional)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={assignForm.end_date}
                    onChange={(e) => setAssignForm({ ...assignForm, end_date: e.target.value })}
                  />
                  <small style={{ color: 'var(--muted)', fontSize: '11px' }}>Leave empty for indefinite roster.</small>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Seasonal rotation, Q1 sprint coverage"
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                />
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="spin" /> : null}
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GEOFENCE REGISTER */}
      {showOfficeModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h2>{editingOffice ? 'Edit Office Geofence' : 'Register Office Geofence'}</h2>
              <button className="modal-close" onClick={() => setShowOfficeModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveOffice} className="modal-body">
              <div className="form-group">
                <label className="form-label">Office Premises Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Corporate HQ, Tech Innovation Hub"
                  value={officeForm.name}
                  onChange={(e) => setOfficeForm({ ...officeForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Physical Address</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 100 Innovation Way, Suite 400"
                  value={officeForm.address}
                  onChange={(e) => setOfficeForm({ ...officeForm, address: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Latitude *</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-control"
                    placeholder="e.g. 9.030000"
                    value={officeForm.latitude}
                    onChange={(e) => setOfficeForm({ ...officeForm, latitude: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude *</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-control"
                    placeholder="e.g. 38.740000"
                    value={officeForm.longitude}
                    onChange={(e) => setOfficeForm({ ...officeForm, longitude: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ marginBottom: '14px' }}>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={handleDetectLocation}
                  disabled={locating}
                >
                  {locating ? <Loader2 size={14} className="spin" /> : <LocateFixed size={14} />}
                  <span>{locating ? 'Detecting GPS...' : 'Use My Current Location'}</span>
                </button>
              </div>
              <div className="form-group">
                <label className="form-label">Geofence Radius (Meters) *</label>
                <input
                  type="number"
                  min="20"
                  max="10000"
                  className="form-control"
                  value={officeForm.radius_meters}
                  onChange={(e) => setOfficeForm({ ...officeForm, radius_meters: e.target.value })}
                  required
                />
                <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                  Allowable distance radius around the coordinates (default 200m).
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Allowed Office IP Subnets (Optional)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 192.168.1.0/24, 10.0.0.1, 172.16.0.0/16"
                  value={officeForm.allowed_ip_ranges}
                  onChange={(e) => setOfficeForm({ ...officeForm, allowed_ip_ranges: e.target.value })}
                />
                <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                  Comma-separated CIDR blocks or fixed public office IP addresses.
                </small>
              </div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowOfficeModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 size={16} className="spin" /> : null}
                  <span>{editingOffice ? 'Save Office' : 'Register Office'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
