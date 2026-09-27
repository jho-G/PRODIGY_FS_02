import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { employeeApi, departmentApi } from '../api';
import './EmployeeModal.css';

export default function EmployeeModal({ isOpen, onClose, onSuccess, employee = null }) {
  const isEdit = Boolean(employee);

  const [formData, setFormData] = useState({
    employee_id: '',
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    date_of_birth: '',
    gender: 'M',
    address: '',
    department: '',
    position: '',
    employment_status: 'FT',
    salary: '',
  });

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');

  // Load departments for the dropdown
  useEffect(() => {
    if (!isOpen) return;

    const fetchDepartments = async () => {
      try {
        setLoadingDepts(true);
        const data = await departmentApi.getAll();
        const list = Array.isArray(data) ? data : data.results || [];
        setDepartments(list);
      } catch (err) {
        console.error('Failed to load departments:', err);
      } finally {
        setLoadingDepts(false);
      }
    };

    fetchDepartments();
  }, [isOpen]);

  // Pre-fill form when editing
  useEffect(() => {
    if (employee) {
      setFormData({
        employee_id: employee.employee_id || '',
        first_name: employee.first_name || '',
        last_name: employee.last_name || '',
        email: employee.email || '',
        phone_number: employee.phone_number || '',
        date_of_birth: employee.date_of_birth || '',
        gender: employee.gender || 'M',
        address: employee.address || '',
        department: employee.department || '',
        position: employee.position || '',
        employment_status: employee.employment_status || 'FT',
        salary: employee.salary || '',
      });
    } else {
      // Reset for creation
      setFormData({
        employee_id: '',
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        date_of_birth: '',
        gender: 'M',
        address: '',
        department: '',
        position: '',
        employment_status: 'FT',
        salary: '',
      });
    }
    setErrors({});
    setGeneralError('');
  }, [employee, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error as user types
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    setGeneralError('');

    const payload = {
      ...formData,
      department: formData.department ? Number(formData.department) : null,
      salary: formData.salary ? parseFloat(formData.salary) : 0,
    };

    try {
      let savedEmployee;
      if (isEdit) {
        savedEmployee = await employeeApi.update(employee.id, payload);
      } else {
        savedEmployee = await employeeApi.create(payload);
      }
      onSuccess(savedEmployee, isEdit ? 'updated' : 'created');
      onClose();
    } catch (err) {
      console.error('Save employee error:', err);
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'object' && !Array.isArray(data)) {
          setErrors(data);
          if (data.detail || data.non_field_errors) {
            setGeneralError(data.detail || data.non_field_errors?.[0]);
          }
        } else {
          setGeneralError('Please check your inputs and try again.');
        }
      } else {
        setGeneralError('Network error. Unable to reach backend service.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? `Edit Employee (${employee.employee_id})` : 'Add New Employee'}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
          <div className="modal-body">
            {generalError && (
              <div className="alert-error" style={{ marginBottom: '16px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{generalError}</span>
              </div>
            )}

            {/* Employment Identifiers */}
            <div className="modal-section-title" style={{ marginTop: 0 }}>
              Employment Identification
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="employee_id">
                  Employee ID *
                </label>
                <input
                  id="employee_id"
                  name="employee_id"
                  type="text"
                  className="form-input"
                  placeholder="e.g. EMP-101"
                  value={formData.employee_id}
                  onChange={handleChange}
                  required
                />
                {errors.employee_id && (
                  <span className="form-error">{errors.employee_id[0] || errors.employee_id}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="department">
                  Department
                </label>
                <select
                  id="department"
                  name="department"
                  className="form-select"
                  value={formData.department}
                  onChange={handleChange}
                  disabled={loadingDepts}
                >
                  <option value="">-- Select Department --</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {errors.department && (
                  <span className="form-error">{errors.department[0] || errors.department}</span>
                )}
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="position">
                  Position / Job Title *
                </label>
                <input
                  id="position"
                  name="position"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Software Engineer"
                  value={formData.position}
                  onChange={handleChange}
                  required
                />
                {errors.position && (
                  <span className="form-error">{errors.position[0] || errors.position}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="employment_status">
                  Employment Status *
                </label>
                <select
                  id="employment_status"
                  name="employment_status"
                  className="form-select"
                  value={formData.employment_status}
                  onChange={handleChange}
                  required
                >
                  <option value="FT">Full-time</option>
                  <option value="PT">Part-time</option>
                  <option value="CT">Contract</option>
                  <option value="IN">Intern</option>
                </select>
                {errors.employment_status && (
                  <span className="form-error">{errors.employment_status[0] || errors.employment_status}</span>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label" htmlFor="salary">
                Annual Salary ($) *
              </label>
              <input
                id="salary"
                name="salary"
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder="e.g. 75000.00"
                value={formData.salary}
                onChange={handleChange}
                required
              />
              {errors.salary && (
                <span className="form-error">{errors.salary[0] || errors.salary}</span>
              )}
            </div>

            {/* Personal Details */}
            <div className="modal-section-title">Personal Information</div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="first_name">
                  First Name *
                </label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  className="form-input"
                  placeholder="First name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                />
                {errors.first_name && (
                  <span className="form-error">{errors.first_name[0] || errors.first_name}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="last_name">
                  Last Name *
                </label>
                <input
                  id="last_name"
                  name="last_name"
                  type="text"
                  className="form-input"
                  placeholder="Last name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                />
                {errors.last_name && (
                  <span className="form-error">{errors.last_name[0] || errors.last_name}</span>
                )}
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Email Address *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="form-input"
                  placeholder="john.doe@company.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
                {errors.email && (
                  <span className="form-error">{errors.email[0] || errors.email}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="phone_number">
                  Phone Number
                </label>
                <input
                  id="phone_number"
                  name="phone_number"
                  type="text"
                  className="form-input"
                  placeholder="+1234567890"
                  value={formData.phone_number}
                  onChange={handleChange}
                />
                {errors.phone_number && (
                  <span className="form-error">{errors.phone_number[0] || errors.phone_number}</span>
                )}
              </div>
            </div>

            <div className="form-grid-2" style={{ marginTop: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="date_of_birth">
                  Date of Birth *
                </label>
                <input
                  id="date_of_birth"
                  name="date_of_birth"
                  type="date"
                  className="form-input"
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  required
                />
                {errors.date_of_birth && (
                  <span className="form-error">{errors.date_of_birth[0] || errors.date_of_birth}</span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="gender">
                  Gender *
                </label>
                <select
                  id="gender"
                  name="gender"
                  className="form-select"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
                {errors.gender && (
                  <span className="form-error">{errors.gender[0] || errors.gender}</span>
                )}
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '12px' }}>
              <label className="form-label" htmlFor="address">
                Residential Address *
              </label>
              <textarea
                id="address"
                name="address"
                rows="2"
                className="form-textarea"
                placeholder="Full street address, city, postal code"
                value={formData.address}
                onChange={handleChange}
                required
              />
              {errors.address && (
                <span className="form-error">{errors.address[0] || errors.address}</span>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
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
                <span>{isEdit ? 'Save Changes' : 'Create Employee'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
