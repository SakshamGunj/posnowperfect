import React, { useState, useEffect } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { EmployeeService, AVAILABLE_MODULES } from '@/services/employeeService';
import { Employee, CreateEmployeeRequest, EmployeePermission } from '@/types';
import { 
  UserPlus, 
  Users, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Shield, 
  ShieldCheck,
  Mail,
  Hash,
  User,
  Search,
  CheckCircle,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EmployeeManagementProps {
  // onClose is kept for future use if needed
}

export default function EmployeeManagement({}: EmployeeManagementProps) {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'manager' | 'staff'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (restaurant) {
      fetchEmployees();
    }
  }, [restaurant]);

  const fetchEmployees = async () => {
    if (!restaurant) return;
    
    setLoading(true);
    try {
      const result = await EmployeeService.getEmployees(restaurant.id);
      if (result.success && result.data) {
        setEmployees(result.data);
      } else {
        toast.error(result.error || 'Failed to fetch employees');
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (employeeData: CreateEmployeeRequest) => {
    if (!restaurant || !user) return;

    try {
      const result = await EmployeeService.createEmployee(restaurant.id, user.id, employeeData);
      if (result.success) {
        toast.success('Employee created successfully');
        setShowCreateForm(false);
        fetchEmployees();
      } else {
        toast.error(result.error || 'Failed to create employee');
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error('Failed to create employee');
    }
  };

  const handleUpdateEmployee = async (employeeId: string, updates: any) => {
    try {
      const result = await EmployeeService.updateEmployee(employeeId, updates);
      if (result.success) {
        toast.success('Employee updated successfully');
        setEditingEmployee(null);
        fetchEmployees();
      } else {
        toast.error(result.error || 'Failed to update employee');
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Failed to update employee');
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;

    try {
      const result = await EmployeeService.deleteEmployee(employeeId);
      if (result.success) {
        toast.success('Employee deleted successfully');
        fetchEmployees();
      } else {
        toast.error(result.error || 'Failed to delete employee');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
    }
  };

  const toggleEmployeeStatus = async (employee: Employee) => {
    await handleUpdateEmployee(employee.id, { isActive: !employee.isActive });
  };

  // Filter employees based on search and filters
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || employee.role === filterRole;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && employee.isActive) ||
                         (filterStatus === 'inactive' && !employee.isActive);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getPermissionCount = (employee: Employee) => {
    return employee.permissions.filter(p => p.access).length;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Users className="w-6 h-6 mr-2" />
            Employee Management
          </h2>
          <p className="text-gray-600 mt-1">
            Manage your restaurant staff and their permissions
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn btn-theme-primary flex items-center"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="input"
          >
            <option value="all">All Roles</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="input"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Employee Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Employees</p>
              <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-gray-900">
                {employees.filter(e => e.isActive).length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center">
            <Shield className="w-8 h-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Managers</p>
              <p className="text-2xl font-bold text-gray-900">
                {employees.filter(e => e.role === 'manager').length}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center">
            <User className="w-8 h-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Staff</p>
              <p className="text-2xl font-bold text-gray-900">
                {employees.filter(e => e.role === 'staff').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Employee List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
            <p className="text-gray-600 mb-4">
              {employees.length === 0 
                ? "Get started by adding your first employee"
                : "Try adjusting your search or filters"
              }
            </p>
            {employees.length === 0 && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn btn-theme-primary"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add First Employee
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permissions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {employee.name}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Mail className="w-3 h-3 mr-1" />
                            {employee.email}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <Hash className="w-3 h-3 mr-1" />
                            PIN: {employee.pin}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        employee.role === 'manager' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {employee.role === 'manager' ? (
                          <Shield className="w-3 h-3 mr-1" />
                        ) : (
                          <User className="w-3 h-3 mr-1" />
                        )}
                        {employee.role.charAt(0).toUpperCase() + employee.role.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <ShieldCheck className="w-4 h-4 text-green-600 mr-1" />
                        <span className="text-sm text-gray-900">
                          {getPermissionCount(employee)} / {AVAILABLE_MODULES.length}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleEmployeeStatus(employee)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          employee.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        } transition-colors`}
                      >
                        {employee.isActive ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {employee.lastLoginAt 
                        ? new Date(employee.lastLoginAt).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => setEditingEmployee(employee)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="Edit Employee"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(employee.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Employee Modal */}
      {showCreateForm && (
        <CreateEmployeeModal
          onClose={() => setShowCreateForm(false)}
          onSubmit={handleCreateEmployee}
        />
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          onClose={() => setEditingEmployee(null)}
          onSubmit={(updates) => handleUpdateEmployee(editingEmployee.id, updates)}
        />
      )}
    </div>
  );
}

// Create Employee Modal Component
interface CreateEmployeeModalProps {
  onClose: () => void;
  onSubmit: (data: CreateEmployeeRequest) => void;
}

function CreateEmployeeModal({ onClose, onSubmit }: CreateEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    pin: '',
    role: 'staff' as 'manager' | 'staff'
  });
  const [permissions, setPermissions] = useState<EmployeePermission[]>(
    EmployeeService.getDefaultPermissions()
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.password || !formData.pin) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.pin.length !== 4 || !/^\d{4}$/.test(formData.pin)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        permissions
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (moduleId: string) => {
    setPermissions(prev => prev.map(p => 
      p.module === moduleId ? { ...p, access: !p.access } : p
    ));
  };

  const setAllPermissions = (access: boolean) => {
    setPermissions(prev => prev.map(p => ({ ...p, access })));
  };

  const groupedModules = AVAILABLE_MODULES.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_MODULES>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Add New Employee</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                placeholder="Enter employee name"
                required
              />
            </div>
            
            <div>
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="input"
                placeholder="Enter email address"
                required
              />
            </div>
            
            <div>
              <label className="form-label">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="input pr-10"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            
            <div>
              <label className="form-label">4-Digit PIN *</label>
              <input
                type="text"
                value={formData.pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setFormData(prev => ({ ...prev, pin: value }));
                }}
                className="input"
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="form-label">Role *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                className="input"
                required
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>

          {/* Comprehensive Permissions System */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-blue-600" />
                  Employee Permissions & Access Control
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  Configure what features and operations this employee can access
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Quick Role Presets */}
                <div className="flex items-center space-x-2 mr-4">
                  <span className="text-xs font-medium text-gray-600">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const basicModules = ['orders', 'take_order', 'billing', 'tables', 'kitchen', 'dashboard', 'customer_create', 'coupon_apply'];
                      setPermissions(prev => prev.map(p => ({
                        ...p,
                        access: basicModules.includes(p.module)
                      })));
                    }}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Waiter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const kitchenModules = ['kitchen', 'kitchen_manage', 'order_status', 'kot_print', 'dashboard'];
                      setPermissions(prev => prev.map(p => ({
                        ...p,
                        access: kitchenModules.includes(p.module)
                      })));
                    }}
                    className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                  >
                    Chef
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cashierModules = ['orders', 'billing', 'discounts', 'customer_create', 'credits', 'dashboard', 'coupon_apply'];
                      setPermissions(prev => prev.map(p => ({
                        ...p,
                        access: cashierModules.includes(p.module)
                      })));
                    }}
                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Cashier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const managerModules = ['orders', 'take_order', 'billing', 'tables', 'menu', 'inventory', 'customers', 'coupons', 'reports', 'dashboard'];
                      setPermissions(prev => prev.map(p => ({
                        ...p,
                        access: managerModules.includes(p.module)
                      })));
                    }}
                    className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                  >
                    Manager
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setAllPermissions(true)}
                  className="flex items-center px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Grant All
                </button>
                <button
                  type="button"
                  onClick={() => setAllPermissions(false)}
                  className="flex items-center px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Revoke All
                </button>
              </div>
            </div>
            
            {/* Permission Categories */}
            <div className="space-y-6">
              {Object.entries(groupedModules).map(([category, modules]) => {
                const categoryConfig = {
                  core: {
                    title: '🍽️ Core POS Operations',
                    description: 'Essential restaurant operations and order management',
                    color: 'border-blue-200 bg-blue-50'
                  },
                  management: {
                    title: '⚙️ Management & Administration',
                    description: 'Business management and configuration features',
                    color: 'border-orange-200 bg-orange-50'
                  },
                  reports: {
                    title: '📊 Analytics & Reporting',
                    description: 'Business insights, analytics, and performance reports',
                    color: 'border-green-200 bg-green-50'
                  },
                  settings: {
                    title: '🔧 System Settings & Configuration',
                    description: 'Restaurant settings and system administration',
                    color: 'border-purple-200 bg-purple-50'
                  }
                };

                const config = categoryConfig[category as keyof typeof categoryConfig] || {
                  title: category.replace('_', ' ').toUpperCase(),
                  description: 'Additional features and capabilities',
                  color: 'border-gray-200 bg-gray-50'
                };

                const categoryPermissions = permissions.filter(p => 
                  modules.some(m => m.id === p.module)
                );
                const enabledCount = categoryPermissions.filter(p => p.access).length;
                const totalCount = modules.length;

                return (
                  <div key={category} className={`border-2 rounded-xl p-5 ${config.color} transition-all hover:shadow-md`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h5 className="text-lg font-semibold text-gray-900 mb-1">
                          {config.title}
                  </h5>
                        <p className="text-sm text-gray-600 mb-2">
                          {config.description}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border">
                            {enabledCount}/{totalCount} permissions enabled
                          </span>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${(enabledCount / totalCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            modules.forEach(module => {
                              setPermissions(prev => prev.map(p => 
                                p.module === module.id ? { ...p, access: true } : p
                              ));
                            });
                          }}
                          className="text-xs px-2 py-1 bg-white border border-green-300 text-green-700 rounded hover:bg-green-50"
                        >
                          Enable All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            modules.forEach(module => {
                              setPermissions(prev => prev.map(p => 
                                p.module === module.id ? { ...p, access: false } : p
                              ));
                            });
                          }}
                          className="text-xs px-2 py-1 bg-white border border-red-300 text-red-700 rounded hover:bg-red-50"
                        >
                          Disable All
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {modules.map((module) => {
                      const permission = permissions.find(p => p.module === module.id);
                        const isEnabled = permission?.access || false;
                        
                      return (
                          <label 
                            key={module.id} 
                            className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              isEnabled 
                                ? 'border-blue-300 bg-blue-50 shadow-sm' 
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                          <input
                            type="checkbox"
                              checked={isEnabled}
                            onChange={() => togglePermission(module.id)}
                              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                          />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <div className={`text-sm font-medium ${isEnabled ? 'text-blue-900' : 'text-gray-900'}`}>
                              {module.name}
                            </div>
                                {module.defaultAccess && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs mt-1 ${isEnabled ? 'text-blue-700' : 'text-gray-500'}`}>
                              {module.description}
                            </div>
                              {/* Additional context for important permissions */}
                              {module.id === 'employees' && (
                                <div className="text-xs text-orange-600 mt-1 font-medium">
                                  ⚠️ Owner-level permission
                                </div>
                              )}
                              {module.id === 'settings' && (
                                <div className="text-xs text-orange-600 mt-1 font-medium">
                                  ⚠️ Sensitive system settings
                                </div>
                              )}
                              {module.id === 'financial_reports' && (
                                <div className="text-xs text-orange-600 mt-1 font-medium">
                                  💰 Financial data access
                                </div>
                              )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>

            {/* Permission Summary */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
              <h6 className="text-sm font-medium text-gray-900 mb-2">Permission Summary</h6>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {Object.entries(groupedModules).map(([category, modules]) => {
                  const enabledCount = permissions.filter(p => 
                    modules.some(m => m.id === p.module) && p.access
                  ).length;
                  return (
                    <div key={category} className="text-center">
                      <div className="text-lg font-bold text-blue-600">{enabledCount}</div>
                      <div className="text-xs text-gray-600 capitalize">
                        {category.replace('_', ' ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-theme-primary flex items-center disabled:opacity-50"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {loading ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface EditEmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onSubmit: (updates: any) => void;
}

function EditEmployeeModal({ employee, onClose, onSubmit }: EditEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: employee.name,
    email: employee.email,
    password: '',
    pin: employee.pin,
    role: employee.role
  });
  const [permissions, setPermissions] = useState<EmployeePermission[]>(employee.permissions);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.pin) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.pin.length !== 4 || !/^\d{4}$/.test(formData.pin)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    setLoading(true);
    try {
      const updates: any = {
        name: formData.name,
        email: formData.email,
        pin: formData.pin,
        role: formData.role,
        permissions
      };

      if (formData.password) {
        updates.password = formData.password;
      }

      await onSubmit(updates);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (moduleId: string) => {
    setPermissions(prev => prev.map(p => 
      p.module === moduleId ? { ...p, access: !p.access } : p
    ));
  };

  const setAllPermissions = (access: boolean) => {
    setPermissions(prev => prev.map(p => ({ ...p, access })));
  };

  const groupedModules = AVAILABLE_MODULES.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_MODULES>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Edit Employee: {employee.name}</h3>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="form-label">Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="input"
                required
              />
            </div>
            
            <div>
              <label className="form-label">New Password (leave blank to keep current)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="input pr-10"
                  placeholder="Enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            
            <div>
              <label className="form-label">4-Digit PIN *</label>
              <input
                type="text"
                value={formData.pin}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setFormData(prev => ({ ...prev, pin: value }));
                }}
                className="input"
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                required
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="form-label">Role *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                className="input"
                required
              >
                <option value="staff">Staff</option>
                <option value="manager">Manager</option>
              </select>
            </div>
          </div>

          {/* Comprehensive Permissions System */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-blue-600" />
                  Update Employee Permissions
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  Modify what features and operations this employee can access
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Quick Role Presets */}
                <div className="flex items-center space-x-2 mr-4">
                  <span className="text-xs font-medium text-gray-600">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const basicModules = ['orders', 'take_order', 'billing', 'tables', 'kitchen', 'dashboard', 'customer_create', 'coupon_apply'];
                      setPermissions(prev => prev.map(p => ({
                        ...p,
                        access: basicModules.includes(p.module)
                      })));
                    }}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Waiter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const kitchenModules = ['kitchen', 'kitchen_manage', 'order_status', 'kot_print', 'dashboard'];
                      setPermissions(prev => prev.map(p => ({
                        ...p,
                        access: kitchenModules.includes(p.module)
                      })));
                    }}
                    className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200"
                  >
                    Chef
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const cashierModules = ['orders', 'billing', 'discounts', 'customer_create', 'credits', 'dashboard', 'coupon_apply'];
                      setPermissions(prev => prev.map(p => ({
                        ...p,
                        access: cashierModules.includes(p.module)
                      })));
                    }}
                    className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Cashier
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const managerModules = ['orders', 'take_order', 'billing', 'tables', 'menu', 'inventory', 'customers', 'coupons', 'reports', 'dashboard'];
                      setPermissions(prev => prev.map(p => ({
                        ...p,
                        access: managerModules.includes(p.module)
                      })));
                    }}
                    className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                  >
                    Manager
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setAllPermissions(true)}
                  className="flex items-center px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Grant All
                </button>
                <button
                  type="button"
                  onClick={() => setAllPermissions(false)}
                  className="flex items-center px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Revoke All
                </button>
              </div>
            </div>
            
            {/* Permission Categories */}
            <div className="space-y-6">
              {Object.entries(groupedModules).map(([category, modules]) => {
                const categoryConfig = {
                  core: {
                    title: '🍽️ Core POS Operations',
                    description: 'Essential restaurant operations and order management',
                    color: 'border-blue-200 bg-blue-50'
                  },
                  management: {
                    title: '⚙️ Management & Administration',
                    description: 'Business management and configuration features',
                    color: 'border-orange-200 bg-orange-50'
                  },
                  reports: {
                    title: '📊 Analytics & Reporting',
                    description: 'Business insights, analytics, and performance reports',
                    color: 'border-green-200 bg-green-50'
                  },
                  settings: {
                    title: '🔧 System Settings & Configuration',
                    description: 'Restaurant settings and system administration',
                    color: 'border-purple-200 bg-purple-50'
                  }
                };

                const config = categoryConfig[category as keyof typeof categoryConfig] || {
                  title: category.replace('_', ' ').toUpperCase(),
                  description: 'Additional features and capabilities',
                  color: 'border-gray-200 bg-gray-50'
                };

                const categoryPermissions = permissions.filter(p => 
                  modules.some(m => m.id === p.module)
                );
                const enabledCount = categoryPermissions.filter(p => p.access).length;
                const totalCount = modules.length;

                return (
                  <div key={category} className={`border-2 rounded-xl p-5 ${config.color} transition-all hover:shadow-md`}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h5 className="text-lg font-semibold text-gray-900 mb-1">
                          {config.title}
                  </h5>
                        <p className="text-sm text-gray-600 mb-2">
                          {config.description}
                        </p>
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white border">
                            {enabledCount}/{totalCount} permissions enabled
                          </span>
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${(enabledCount / totalCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            modules.forEach(module => {
                              setPermissions(prev => prev.map(p => 
                                p.module === module.id ? { ...p, access: true } : p
                              ));
                            });
                          }}
                          className="text-xs px-2 py-1 bg-white border border-green-300 text-green-700 rounded hover:bg-green-50"
                        >
                          Enable All
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            modules.forEach(module => {
                              setPermissions(prev => prev.map(p => 
                                p.module === module.id ? { ...p, access: false } : p
                              ));
                            });
                          }}
                          className="text-xs px-2 py-1 bg-white border border-red-300 text-red-700 rounded hover:bg-red-50"
                        >
                          Disable All
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {modules.map((module) => {
                      const permission = permissions.find(p => p.module === module.id);
                        const isEnabled = permission?.access || false;
                        
                      return (
                          <label 
                            key={module.id} 
                            className={`flex items-start space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              isEnabled 
                                ? 'border-blue-300 bg-blue-50 shadow-sm' 
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                          <input
                            type="checkbox"
                              checked={isEnabled}
                            onChange={() => togglePermission(module.id)}
                              className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
                          />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <div className={`text-sm font-medium ${isEnabled ? 'text-blue-900' : 'text-gray-900'}`}>
                              {module.name}
                            </div>
                                {module.defaultAccess && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className={`text-xs mt-1 ${isEnabled ? 'text-blue-700' : 'text-gray-500'}`}>
                              {module.description}
                            </div>
                              {/* Additional context for important permissions */}
                              {module.id === 'employees' && (
                                <div className="text-xs text-orange-600 mt-1 font-medium">
                                  ⚠️ Owner-level permission
                                </div>
                              )}
                              {module.id === 'settings' && (
                                <div className="text-xs text-orange-600 mt-1 font-medium">
                                  ⚠️ Sensitive system settings
                                </div>
                              )}
                              {module.id === 'financial_reports' && (
                                <div className="text-xs text-orange-600 mt-1 font-medium">
                                  💰 Financial data access
                                </div>
                              )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>

            {/* Permission Summary */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
              <h6 className="text-sm font-medium text-gray-900 mb-2">Permission Summary</h6>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {Object.entries(groupedModules).map(([category, modules]) => {
                  const enabledCount = permissions.filter(p => 
                    modules.some(m => m.id === p.module) && p.access
                  ).length;
                  return (
                    <div key={category} className="text-center">
                      <div className="text-lg font-bold text-blue-600">{enabledCount}</div>
                      <div className="text-xs text-gray-600 capitalize">
                        {category.replace('_', ' ')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-theme-primary"
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Edit className="w-4 h-4 mr-2" />
              )}
              {loading ? 'Updating...' : 'Update Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 