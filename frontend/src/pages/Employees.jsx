import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  X,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { employeeApi, departmentApi } from '../api';
import EmployeeModal from '../components/EmployeeModal';
import './Employees.css';

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [activeFilter, setActiveFilter] = useState('true'); // 'true', 'false', 'all'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  // Toast Feedback State
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Debounce search input by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load department list for filtering
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const data = await departmentApi.getAll();
        const list = Array.isArray(data) ? data : data.results || [];
        setDepartments(list);
      } catch (err) {
        console.error('Error fetching department filter options:', err);
      }
    };
    fetchDepartments();
  }, []);

  // Fetch employees according to active filters & page
  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      if (selectedDept) {
        params.department = selectedDept;
      }
      if (selectedStatus) {
        params.employment_status = selectedStatus;
      }
      if (activeFilter === 'all') {
        params.all = 'true';
      } else {
        params.is_active = activeFilter;
      }

      const data = await employeeApi.getAll(params);
      if (data.results) {
        setEmployees(data.results);
        setTotalCount(data.count || 0);
      } else if (Array.isArray(data)) {
        setEmployees(data);
        setTotalCount(data.length);
      } else {
        setEmployees([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching employee list:', err);
      showToast('Failed to load employees. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedDept, selectedStatus, activeFilter]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Reset page when dropdown filters change
  const handleDeptChange = (e) => {
    setSelectedDept(e.target.value);
    setPage(1);
  };

  const handleStatusChange = (e) => {
    setSelectedStatus(e.target.value);
    setPage(1);
  };

  const handleActiveFilterChange = (e) => {
    setActiveFilter(e.target.value);
    setPage(1);
  };

  // Actions
  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (employee) => {
    setEditingEmployee(employee);
    setIsModalOpen(true);
  };

  const handleModalSuccess = (savedEmployee, actionType) => {
    showToast(
      `Employee ${savedEmployee.full_name || savedEmployee.first_name} successfully ${actionType}.`
    );
    fetchEmployees();
  };

  // Soft Delete (Deactivate)
  const handleSoftDelete = async (employee) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate employee "${employee.full_name || employee.first_name} ${employee.last_name}" (${employee.employee_id})?`
    );
    if (!confirmed) return;

    try {
      await employeeApi.delete(employee.id, false);
      showToast(`Employee ${employee.full_name} has been deactivated.`);
      fetchEmployees();
    } catch (err) {
      console.error('Failed to deactivate employee:', err);
      showToast('Failed to deactivate employee.', 'error');
    }
  };

  // Restore Deactivated Employee
  const handleRestore = async (employee) => {
    try {
      await employeeApi.restore(employee.id);
      showToast(`Employee ${employee.full_name} has been restored to active status.`);
      fetchEmployees();
    } catch (err) {
      console.error('Failed to restore employee:', err);
      showToast('Failed to restore employee.', 'error');
    }
  };

  // Permanent Hard Delete (optional safeguard)
  const handleHardDelete = async (employee) => {
    const confirmed = window.confirm(
      `WARNING: Permanently delete employee "${employee.full_name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await employeeApi.delete(employee.id, true);
      showToast(`Employee ${employee.full_name} permanently deleted.`);
      fetchEmployees();
    } catch (err) {
      console.error('Failed to permanently delete employee:', err);
      showToast('Failed to delete employee.', 'error');
    }
  };

  const pageSize = 10;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const getStatusBadge = (status) => {
    const map = {
      FT: <span className="badge badge-primary">Full-time</span>,
      PT: <span className="badge badge-info">Part-time</span>,
      CT: <span className="badge badge-warning">Contract</span>,
      IN: <span className="badge badge-success">Intern</span>,
    };
    return map[status] || <span className="badge">{status}</span>;
  };

  return (
    <div className="employees-page animate-fade-in">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`toast-message ${
            toast.type === 'error' ? 'alert-error' : 'badge-success'
          }`}
          style={{ padding: '12px 18px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {toast.type === 'error' ? (
              <AlertTriangle size={18} />
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
          <h1>Employee Directory</h1>
          <p>Search, filter, manage profiles, and maintain workforce records.</p>
        </div>
        <button onClick={handleOpenAddModal} className="btn btn-primary">
          <Plus size={18} />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="filter-bar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by name, ID, position, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="clear-search-btn"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
            <Filter size={16} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filters:</span>
          </div>

          <select
            className="filter-select"
            value={selectedDept}
            onChange={handleDeptChange}
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={selectedStatus}
            onChange={handleStatusChange}
          >
            <option value="">All Employment Statuses</option>
            <option value="FT">Full-time (FT)</option>
            <option value="PT">Part-time (PT)</option>
            <option value="CT">Contract (CT)</option>
            <option value="IN">Intern (IN)</option>
          </select>

          <select
            className="filter-select"
            value={activeFilter}
            onChange={handleActiveFilterChange}
          >
            <option value="true">Active Employees Only</option>
            <option value="false">Deactivated Only</option>
            <option value="all">All Records (Active & Inactive)</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Position</th>
                <th>Status</th>
                <th>Annual Salary</th>
                <th>State</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '36px' }}>
                    <div className="spinner-primary" style={{ margin: '0 auto 12px' }} />
                    <p>Loading employee records...</p>
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="empty-table-state">
                      <Users size={40} style={{ opacity: 0.4 }} />
                      <p>No employees match your search or filter criteria.</p>
                      <button
                        onClick={() => {
                          setSearch('');
                          setSelectedDept('');
                          setSelectedStatus('');
                          setActiveFilter('true');
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const initials = `${emp.first_name?.[0] || ''}${emp.last_name?.[0] || ''}`;
                  const isDeactivated = !emp.is_active;

                  return (
                    <tr key={emp.id} className={isDeactivated ? 'row-inactive' : ''}>
                      <td>
                        <div className="employee-cell">
                          <div className="employee-avatar-circle">{initials}</div>
                          <div>
                            <div className="employee-name">{emp.full_name}</div>
                            <div className="employee-sub">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.84rem' }}>{emp.employee_id}</code>
                      </td>
                      <td>{emp.department_name || <span style={{ color: 'var(--text-muted)' }}>None</span>}</td>
                      <td>{emp.position}</td>
                      <td>{getStatusBadge(emp.employment_status)}</td>
                      <td>${parseFloat(emp.salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>
                        {emp.is_active ? (
                          <span className="badge badge-success">Active</span>
                        ) : (
                          <span className="badge badge-danger">Deactivated</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            onClick={() => handleOpenEditModal(emp)}
                            className="action-icon-btn"
                            title="Edit employee"
                          >
                            <Edit2 size={15} />
                          </button>

                          {emp.is_active ? (
                            <button
                              onClick={() => handleSoftDelete(emp)}
                              className="action-icon-btn btn-delete"
                              title="Soft delete (Deactivate)"
                            >
                              <Trash2 size={15} />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleRestore(emp)}
                                className="action-icon-btn btn-restore"
                                title="Restore employee"
                              >
                                <RotateCcw size={15} />
                              </button>
                              <button
                                onClick={() => handleHardDelete(emp)}
                                className="action-icon-btn btn-delete"
                                title="Permanently delete from database"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
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
            Showing <strong>{employees.length}</strong> of <strong>{totalCount}</strong> employees
            {totalPages > 1 && ` (Page ${page} of ${totalPages})`}
          </div>

          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft size={16} />
                <span>Prev</span>
              </button>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={page >= totalPages || loading}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Employee Modal */}
      <EmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        employee={editingEmployee}
      />
    </div>
  );
}
