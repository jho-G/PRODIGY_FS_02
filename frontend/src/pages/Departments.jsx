import { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Users,
  X,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { departmentApi } from '../api';
import './Departments.css';

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const data = await departmentApi.getAll();
      const list = Array.isArray(data) ? data : data.results || [];
      setDepartments(list);
    } catch (err) {
      console.error('Failed to load departments:', err);
      showToast('Failed to load departments.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleOpenAdd = () => {
    setEditingDept(null);
    setDeptForm({ name: '', description: '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dept) => {
    setEditingDept(dept);
    setDeptForm({ name: dept.name, description: dept.description || '' });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!deptForm.name.trim()) {
      setFormError('Department name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError('');

      if (editingDept) {
        await departmentApi.update(editingDept.id, deptForm);
        showToast(`Department "${deptForm.name}" updated successfully.`);
      } else {
        await departmentApi.create(deptForm);
        showToast(`Department "${deptForm.name}" created successfully.`);
      }

      setIsModalOpen(false);
      fetchDepartments();
    } catch (err) {
      console.error('Failed to save department:', err);
      if (err.response?.data?.name) {
        setFormError(err.response.data.name[0]);
      } else {
        setFormError('Failed to save department. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (dept) => {
    const activeCount = dept.employee_count || 0;
    const confirmMsg = activeCount > 0
      ? `Department "${dept.name}" has ${activeCount} active employee(s). Are you sure you want to delete it? Employees will have their department unassigned.`
      : `Are you sure you want to delete department "${dept.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await departmentApi.delete(dept.id);
      showToast(`Department "${dept.name}" has been deleted.`);
      fetchDepartments();
    } catch (err) {
      console.error('Failed to delete department:', err);
      showToast('Failed to delete department.', 'error');
    }
  };

  return (
    <div className="departments-page animate-fade-in">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`toast-message ${
            toast.type === 'error' ? 'alert-error' : 'badge-success'
          }`}
          style={{ padding: '12px 18px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toast.type === 'error' ? (
              <AlertCircle size={18} />
            ) : (
              <CheckCircle size={18} />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            style={{ color: 'inherit', padding: '2px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>Department Management</h1>
          <p>Organize organizational units, teams, and active workforce distribution.</p>
        </div>
        <button onClick={handleOpenAdd} className="btn btn-primary">
          <Plus size={18} />
          <span>Add Department</span>
        </button>
      </div>

      {/* Department Cards Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner-primary" style={{ margin: '0 auto 12px' }} />
          <p>Loading departments...</p>
        </div>
      ) : departments.length === 0 ? (
        <div className="table-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Building2 size={44} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>No Departments Yet</h2>
          <p style={{ marginBottom: '18px' }}>Create departments to organize your employees and workforce units.</p>
          <button onClick={handleOpenAdd} className="btn btn-primary btn-sm">
            <Plus size={16} />
            <span>Create First Department</span>
          </button>
        </div>
      ) : (
        <div className="dept-grid">
          {departments.map((dept) => (
            <div key={dept.id} className="dept-card">
              <div>
                <div className="dept-card-top">
                  <div className="dept-icon-badge">
                    <Building2 size={22} />
                  </div>
                  <div className="dept-card-actions">
                    <button
                      onClick={() => handleOpenEdit(dept)}
                      className="action-icon-btn"
                      title="Edit department"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(dept)}
                      className="action-icon-btn btn-delete"
                      title="Delete department"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '14px' }}>
                  <h3 className="dept-title">{dept.name}</h3>
                  <p className="dept-description">
                    {dept.description || <em>No description provided.</em>}
                  </p>
                </div>
              </div>

              <div className="dept-card-footer">
                <div className="dept-headcount-badge">
                  <Users size={16} color="var(--primary)" />
                  <span>
                    {dept.employee_count ?? 0} active{' '}
                    {dept.employee_count === 1 ? 'employee' : 'employees'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Department Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            className="modal-container"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {editingDept ? 'Edit Department' : 'Add Department'}
              </h2>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
              <div className="modal-body">
                {formError && (
                  <div className="alert-error" style={{ marginBottom: '16px' }}>
                    <AlertCircle size={18} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" htmlFor="dept-name">
                    Department Name *
                  </label>
                  <input
                    id="dept-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Engineering, Human Resources, Marketing"
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label" htmlFor="dept-desc">
                    Description
                  </label>
                  <textarea
                    id="dept-desc"
                    rows="3"
                    className="form-textarea"
                    placeholder="Briefly describe the functions or responsibilities of this department..."
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingDept ? 'Save Changes' : 'Create Department'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
