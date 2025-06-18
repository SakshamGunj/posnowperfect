import { useState, useEffect } from 'react';
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
  Settings,
  Search,
  Filter,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  Building,
  DollarSign,
  AlertTriangle,
  Star,
  Award,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Zap,
  Crown,
  Key,
  Briefcase,
  Calendar,
  MapPin,
  Phone,
  UserCheck,
  UserX,
  Activity,
  TrendingUp,
  Target,
  Download
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EmployeeManagementProps {
  onClose?: () => void;
}

export default function EmployeeManagement({ onClose }: EmployeeManagementProps) {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterShift, setFilterShift] = useState<string>('all');
  
  // Permission management states
  const [showPermissionDetails, setShowPermissionDetails] = useState<string | null>(null);
  const [bulkPermissionMode, setBulkPermissionMode] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  useEffect(() => {
    if (restaurant?.id) {
      loadEmployees();
    }
  }, [restaurant?.id]);

  const loadEmployees = async () => {
    if (!restaurant?.id) return;
    
    setLoading(true);
    try {
      const result = await EmployeeService.getEmployees(restaurant.id);
      if (result.success && result.data) {
        setEmployees(result.data);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = async (employeeData: CreateEmployeeRequest) => {
    if (!restaurant?.id || !user?.id) return;

    try {
      const result = await EmployeeService.createEmployee(restaurant.id, user.id, employeeData);
      if (result.success) {
        toast.success('Employee created successfully');
        await loadEmployees();
        setShowCreateForm(false);
      } else {
        toast.error(result.error || 'Failed to create employee');
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error('Failed to create employee');
    }
  };

  const handleUpdateEmployee = async (employeeId: string, updates: any) => {
    if (!restaurant?.id) return;

    try {
      const result = await EmployeeService.updateEmployee(restaurant.id, employeeId, updates);
      if (result.success) {
        toast.success('Employee updated successfully');
        await loadEmployees();
        setShowEditForm(false);
        setSelectedEmployee(null);
      } else {
        toast.error(result.error || 'Failed to update employee');
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Failed to update employee');
    }
  };

  const handleDeleteEmployee = async (employeeId: string) => {
    if (!restaurant?.id) return;

    try {
      const result = await EmployeeService.deleteEmployee(restaurant.id, employeeId);
      if (result.success) {
        toast.success('Employee deleted successfully');
        await loadEmployees();
      } else {
        toast.error(result.error || 'Failed to delete employee');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Failed to delete employee');
    }
    
    setShowDeleteConfirm(false);
    setEmployeeToDelete(null);
  };

  const handleToggleEmployeeStatus = async (employee: Employee) => {
    await handleUpdateEmployee(employee.id, { isActive: !employee.isActive });
  };

  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || employee.role === filterRole;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && employee.isActive) ||
                         (filterStatus === 'inactive' && !employee.isActive);
    const matchesDepartment = filterDepartment === 'all' || employee.department === filterDepartment;
    const matchesShift = filterShift === 'all' || employee.shift === filterShift;
    
    return matchesSearch && matchesRole && matchesStatus && matchesDepartment && matchesShift;
  });

  const getPermissionCount = (employee: Employee) => {
    return employee.permissions.filter(p => p.access).length;
  };

  const getHighRiskPermissionCount = (employee: Employee) => {
    return employee.permissions.filter(p => {
      if (!p.access) return false;
      const module = AVAILABLE_MODULES.find(m => m.id === p.module);
      return module?.riskLevel === 'high';
    }).length;
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'manager':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'kitchen_manager':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'supervisor':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cashier':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'staff':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'manager':
        return <Crown className="w-3 h-3 mr-1" />;
      case 'kitchen_manager':
        return <Award className="w-3 h-3 mr-1" />;
      case 'supervisor':
        return <Shield className="w-3 h-3 mr-1" />;
      case 'cashier':
        return <DollarSign className="w-3 h-3 mr-1" />;
      case 'staff':
        return <User className="w-3 h-3 mr-1" />;
      default:
        return <User className="w-3 h-3 mr-1" />;
    }
  };

  const getDepartmentColor = (department?: string) => {
    switch (department) {
      case 'kitchen':
        return 'bg-red-100 text-red-700';
      case 'service':
        return 'bg-blue-100 text-blue-700';
      case 'management':
        return 'bg-purple-100 text-purple-700';
      case 'finance':
        return 'bg-green-100 text-green-700';
      case 'marketing':
        return 'bg-pink-100 text-pink-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getShiftColor = (shift?: string) => {
    switch (shift) {
      case 'morning':
        return 'bg-yellow-100 text-yellow-700';
      case 'afternoon':
        return 'bg-orange-100 text-orange-700';
      case 'evening':
        return 'bg-blue-100 text-blue-700';
      case 'night':
        return 'bg-indigo-100 text-indigo-700';
      case 'flexible':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const exportEmployeeData = () => {
    const csvData = employees.map(emp => ({
      Name: emp.name,
      Email: emp.email,
      Role: emp.role,
      Department: emp.department || 'N/A',
      Shift: emp.shift || 'N/A',
      'Hourly Rate': emp.hourlyRate || 'N/A',
      Status: emp.isActive ? 'Active' : 'Inactive',
      'Permissions Count': getPermissionCount(emp),
      'High Risk Permissions': getHighRiskPermissionCount(emp),
      'Last Login': emp.lastLoginAt ? new Date(emp.lastLoginAt).toLocaleDateString() : 'Never',
      'Created Date': new Date(emp.createdAt).toLocaleDateString()
    }));
    
    const csvContent = Object.keys(csvData[0]).join(',') + '\n' +
      csvData.map(row => Object.values(row).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
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
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center">
            <Users className="w-8 h-8 mr-3 text-blue-600" />
            Employee Management System
          </h2>
          <p className="text-gray-600 mt-2 text-lg">
            Comprehensive staff management with role-based permissions and advanced analytics
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={exportEmployeeData}
            className="btn btn-secondary flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-theme-primary flex items-center"
          >
            <UserPlus className="w-5 h-5 mr-2" />
            Add Employee
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Advanced Filters & Search
          </h3>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setBulkPermissionMode(!bulkPermissionMode)}
              className={`text-sm font-medium px-3 py-1 rounded-lg ${
                bulkPermissionMode 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Bulk Permission Mode
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="input"
          >
            <option value="all">All Roles</option>
            <option value="manager">Manager</option>
            <option value="kitchen_manager">Kitchen Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="cashier">Cashier</option>
            <option value="staff">Staff</option>
          </select>

          {/* Department Filter */}
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="input"
          >
            <option value="all">All Departments</option>
            <option value="kitchen">Kitchen</option>
            <option value="service">Service</option>
            <option value="management">Management</option>
            <option value="finance">Finance</option>
            <option value="marketing">Marketing</option>
          </select>

          {/* Shift Filter */}
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className="input"
          >
            <option value="all">All Shifts</option>
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
            <option value="night">Night</option>
            <option value="flexible">Flexible</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Enhanced Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {/* Total Employees */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-4">
          <div className="flex items-center">
            <Users className="w-8 h-8" />
            <div className="ml-3">
              <p className="text-sm font-medium opacity-90">Total Staff</p>
              <p className="text-2xl font-bold">{employees.length}</p>
            </div>
          </div>
        </div>
        
        {/* Active Employees */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-4">
          <div className="flex items-center">
            <UserCheck className="w-8 h-8" />
            <div className="ml-3">
              <p className="text-sm font-medium opacity-90">Active</p>
              <p className="text-2xl font-bold">
                {employees.filter(e => e.isActive).length}
              </p>
            </div>
          </div>
        </div>
        
        {/* Managers */}
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-4">
          <div className="flex items-center">
            <Crown className="w-8 h-8" />
            <div className="ml-3">
              <p className="text-sm font-medium opacity-90">Managers</p>
              <p className="text-2xl font-bold">
                {employees.filter(e => e.role === 'manager').length}
              </p>
            </div>
          </div>
        </div>
        
        {/* Kitchen Staff */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl p-4">
          <div className="flex items-center">
            <Award className="w-8 h-8" />
            <div className="ml-3">
              <p className="text-sm font-medium opacity-90">Kitchen</p>
              <p className="text-2xl font-bold">
                {employees.filter(e => e.department === 'kitchen').length}
              </p>
            </div>
          </div>
        </div>

        {/* High-Risk Permissions */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-8 h-8" />
            <div className="ml-3">
              <p className="text-sm font-medium opacity-90">High Risk</p>
              <p className="text-2xl font-bold">
                {employees.reduce((sum, emp) => sum + getHighRiskPermissionCount(emp), 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Average Permissions */}
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl p-4">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8" />
            <div className="ml-3">
              <p className="text-sm font-medium opacity-90">Avg Permissions</p>
              <p className="text-2xl font-bold">
                {employees.length > 0 
                  ? Math.round(employees.reduce((sum, emp) => sum + getPermissionCount(emp), 0) / employees.length)
                  : 0
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Employee List */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Employee Directory ({filteredEmployees.length})
            </h3>
            {bulkPermissionMode && selectedEmployees.length > 0 && (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-gray-600">
                  {selectedEmployees.length} selected
                </span>
                <button className="btn btn-sm btn-secondary">
                  Bulk Edit Permissions
                </button>
              </div>
            )}
          </div>
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No employees found</h3>
            <p className="text-gray-600 mb-4">
              {employees.length === 0 
                ? "Get started by adding your first employee" 
                : "Try adjusting your filters to find employees"
              }
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn btn-theme-primary"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add First Employee
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {bulkPermissionMode && (
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployees(filteredEmployees.map(emp => emp.id));
                          } else {
                            setSelectedEmployees([]);
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role & Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permissions & Access
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule & Compensation
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status & Activity
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    {bulkPermissionMode && (
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedEmployees.includes(employee.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedEmployees([...selectedEmployees, employee.id]);
                            } else {
                              setSelectedEmployees(selectedEmployees.filter(id => id !== employee.id));
                            }
                          }}
                        />
                      </td>
                    )}
                    
                    {/* Employee Details */}
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-12 w-12">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                            {employee.name.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 flex items-center">
                            {employee.name}
                            {getHighRiskPermissionCount(employee) > 0 && (
                              <AlertTriangle className="w-4 h-4 text-red-500 ml-2" title="Has high-risk permissions" />
                            )}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center mt-1">
                            <Mail className="w-3 h-3 mr-1" />
                            {employee.email}
                          </div>
                          <div className="text-xs text-gray-400 flex items-center mt-1">
                            <Hash className="w-3 h-3 mr-1" />
                            PIN: {employee.pin}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role & Department */}
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getRoleColor(employee.role)}`}>
                          {getRoleIcon(employee.role)}
                          {employee.role.replace('_', ' ').toUpperCase()}
                        </span>
                        {employee.department && (
                          <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getDepartmentColor(employee.department)}`}>
                            <Building className="w-3 h-3 mr-1" />
                            {employee.department.charAt(0).toUpperCase() + employee.department.slice(1)}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Permissions & Access */}
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <ShieldCheck className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-gray-900 font-medium">
                            {getPermissionCount(employee)} / {AVAILABLE_MODULES.length}
                          </span>
                        </div>
                        {getHighRiskPermissionCount(employee) > 0 && (
                          <div className="flex items-center space-x-2">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                            <span className="text-xs text-red-600 font-medium">
                              {getHighRiskPermissionCount(employee)} High Risk
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => setShowPermissionDetails(
                            showPermissionDetails === employee.id ? null : employee.id
                          )}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                        >
                          View Details
                          {showPermissionDetails === employee.id ? (
                            <ChevronUp className="w-3 h-3 ml-1" />
                          ) : (
                            <ChevronDown className="w-3 h-3 ml-1" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Schedule & Compensation */}
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        {employee.shift && (
                          <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${getShiftColor(employee.shift)}`}>
                            <Clock className="w-3 h-3 mr-1" />
                            {employee.shift.charAt(0).toUpperCase() + employee.shift.slice(1)}
                          </div>
                        )}
                        {employee.hourlyRate && (
                          <div className="flex items-center text-xs text-gray-600">
                            <DollarSign className="w-3 h-3 mr-1" />
                            ${employee.hourlyRate}/hr
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Status & Activity */}
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          employee.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {employee.isActive ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <XCircle className="w-3 h-3 mr-1" />
                          )}
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <div className="text-xs text-gray-500">
                          Last login: {employee.lastLoginAt 
                            ? new Date(employee.lastLoginAt).toLocaleDateString()
                            : 'Never'
                          }
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowEditForm(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit employee"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleEmployeeStatus(employee)}
                          className={`${employee.isActive ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}
                          title={employee.isActive ? 'Deactivate employee' : 'Activate employee'}
                        >
                          {employee.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => {
                            setEmployeeToDelete(employee);
                            setShowDeleteConfirm(true);
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Delete employee"
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
      {showEditForm && selectedEmployee && (
        <EditEmployeeModal
          employee={selectedEmployee}
          onClose={() => {
            setShowEditForm(false);
            setSelectedEmployee(null);
          }}
          onSubmit={(updates) => handleUpdateEmployee(selectedEmployee.id, updates)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && employeeToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">Delete Employee</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {employeeToDelete.name}? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setEmployeeToDelete(null);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteEmployee(employeeToDelete.id)}
                className="btn btn-danger"
              >
                Delete Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Create Employee Modal Component
interface CreateEmployeeModalProps {
  onClose: () => void;
  onSubmit: (data: CreateEmployeeRequest) => Promise<void>;
}

function CreateEmployeeModal({ onClose, onSubmit }: CreateEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    pin: '',
    role: 'staff' as 'manager' | 'staff' | 'kitchen_manager' | 'cashier' | 'supervisor',
    department: '' as 'kitchen' | 'service' | 'management' | 'finance' | 'marketing' | '',
    shift: '' as 'morning' | 'afternoon' | 'evening' | 'night' | 'flexible' | '',
    hourlyRate: ''
  });
  const [permissions, setPermissions] = useState<EmployeePermission[]>(
    EmployeeService.getDefaultPermissions()
  );
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'permissions' | 'schedule'>('basic');

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

    if (formData.hourlyRate && isNaN(Number(formData.hourlyRate))) {
      toast.error('Hourly rate must be a valid number');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        permissions,
        department: formData.department || undefined,
        shift: formData.shift || undefined,
        hourlyRate: formData.hourlyRate ? Number(formData.hourlyRate) : undefined
      });
      onClose();
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

  const setRoleBasedPermissions = (role: string) => {
    const rolePermissions: Record<string, string[]> = {
      manager: [
        'orders', 'take_order', 'order_modification', 'tables', 'billing', 'kitchen_display',
        'table_operations', 'menu', 'menu_categories', 'variant_management', 'customers',
        'customer_history', 'loyalty_points', 'coupons', 'promotions', 'credits',
        'payment_methods', 'discounts', 'reports', 'dashboard', 'financial_reports',
        'customer_reports', 'notifications', 'customer_communication'
      ],
      kitchen_manager: [
        'orders', 'kitchen_display', 'menu', 'menu_categories', 'variant_management',
        'inventory', 'inventory_alerts', 'supplier_management', 'dashboard',
        'inventory_reports', 'notifications'
      ],
      supervisor: [
        'orders', 'take_order', 'order_modification', 'tables', 'billing', 'kitchen_display',
        'table_operations', 'customers', 'customer_history', 'loyalty_points',
        'coupons', 'rewards_redemption', 'dashboard', 'notifications'
      ],
      cashier: [
        'orders', 'take_order', 'billing', 'customers', 'loyalty_points',
        'coupons', 'rewards_redemption', 'credits', 'payment_methods',
        'discounts', 'dashboard'
      ],
      staff: [
        'orders', 'take_order', 'tables', 'billing', 'kitchen_display', 'dashboard'
      ]
    };

    const allowedPermissions = rolePermissions[role] || [];
    setPermissions(prev => prev.map(p => ({
      ...p,
      access: allowedPermissions.includes(p.module)
    })));
  };

  const groupedModules = AVAILABLE_MODULES.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, typeof AVAILABLE_MODULES>);

  const getPermissionsByCategory = (category: string) => {
    return groupedModules[category] || [];
  };

  const getCategoryPermissionCount = (category: string) => {
    const categoryModules = getPermissionsByCategory(category);
    const enabledCount = categoryModules.filter(module => 
      permissions.find(p => p.module === module.id)?.access
    ).length;
    return `${enabledCount}/${categoryModules.length}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <UserPlus className="w-6 h-6 mr-3 text-blue-600" />
              Create New Employee
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex space-x-6 mt-4">
            {[
              { id: 'basic', label: 'Basic Info', icon: User },
              { id: 'permissions', label: 'Permissions', icon: Shield },
              { id: 'schedule', label: 'Schedule & Pay', icon: Clock }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="form-label">Full Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="input"
                      placeholder="Enter full name"
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
                      placeholder="employee@restaurant.com"
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
                        placeholder="Create a secure password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                      placeholder="1234"
                      maxLength={4}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Used for quick login and access control</p>
                  </div>

                  <div>
                    <label className="form-label">Role *</label>
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        const newRole = e.target.value as any;
                        setFormData(prev => ({ ...prev, role: newRole }));
                        setRoleBasedPermissions(newRole);
                      }}
                      className="input"
                      required
                    >
                      <option value="staff">Staff</option>
                      <option value="cashier">Cashier</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="kitchen_manager">Kitchen Manager</option>
                      <option value="manager">Manager</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Selecting a role will automatically assign appropriate permissions
                    </p>
                  </div>

                  <div>
                    <label className="form-label">Department</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value as any }))}
                      className="input"
                    >
                      <option value="">Select Department</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="service">Service</option>
                      <option value="management">Management</option>
                      <option value="finance">Finance</option>
                      <option value="marketing">Marketing</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Permissions Tab */}
            {activeTab === 'permissions' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">Access Permissions</h4>
                    <p className="text-sm text-gray-600">
                      Control what features and data this employee can access
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setAllPermissions(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Grant All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllPermissions(false)}
                      className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Revoke All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Object.entries(groupedModules).map(([category, modules]) => (
                    <div key={category} className="border rounded-xl p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-gray-900 capitalize flex items-center">
                          {category === 'core' && <Zap className="w-4 h-4 mr-2 text-blue-600" />}
                          {category === 'management' && <Briefcase className="w-4 h-4 mr-2 text-purple-600" />}
                          {category === 'reports' && <TrendingUp className="w-4 h-4 mr-2 text-green-600" />}
                          {category === 'settings' && <Settings className="w-4 h-4 mr-2 text-orange-600" />}
                          {category === 'advanced' && <Target className="w-4 h-4 mr-2 text-red-600" />}
                          {category.replace('_', ' ')} Features
                        </h5>
                        <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded">
                          {getCategoryPermissionCount(category)}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {modules.map((module) => {
                          const permission = permissions.find(p => p.module === module.id);
                          const isHighRisk = module.riskLevel === 'high';
                          return (
                            <label key={module.id} className="flex items-start space-x-3 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={permission?.access || false}
                                onChange={() => togglePermission(module.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                              />
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {module.name}
                                  </span>
                                  {isHighRisk && (
                                    <AlertTriangle className="w-3 h-3 text-red-500" title="High Risk Permission" />
                                  )}
                                  {module.requiresTraining && (
                                    <BookOpen className="w-3 h-3 text-orange-500" title="Requires Training" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {module.description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Permission Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h6 className="font-medium text-blue-900 mb-2">Permission Summary</h6>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700 font-medium">Total Granted:</span>
                      <span className="text-blue-900 ml-2">
                        {permissions.filter(p => p.access).length} / {AVAILABLE_MODULES.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-red-700 font-medium">High Risk:</span>
                      <span className="text-red-900 ml-2">
                        {permissions.filter(p => {
                          if (!p.access) return false;
                          const module = AVAILABLE_MODULES.find(m => m.id === p.module);
                          return module?.riskLevel === 'high';
                        }).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-orange-700 font-medium">Requires Training:</span>
                      <span className="text-orange-900 ml-2">
                        {permissions.filter(p => {
                          if (!p.access) return false;
                          const module = AVAILABLE_MODULES.find(m => m.id === p.module);
                          return module?.requiresTraining;
                        }).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-700 font-medium">Core Access:</span>
                      <span className="text-green-900 ml-2">
                        {permissions.filter(p => {
                          if (!p.access) return false;
                          const module = AVAILABLE_MODULES.find(m => m.id === p.module);
                          return module?.category === 'core';
                        }).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule & Pay Tab */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Work Schedule & Compensation</h4>
                  <p className="text-sm text-gray-600">
                    Configure work schedule and compensation details
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="form-label">Work Shift</label>
                    <select
                      value={formData.shift}
                      onChange={(e) => setFormData(prev => ({ ...prev, shift: e.target.value as any }))}
                      className="input"
                    >
                      <option value="">Select Shift</option>
                      <option value="morning">Morning (6 AM - 2 PM)</option>
                      <option value="afternoon">Afternoon (2 PM - 10 PM)</option>
                      <option value="evening">Evening (6 PM - 2 AM)</option>
                      <option value="night">Night (10 PM - 6 AM)</option>
                      <option value="flexible">Flexible Hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Hourly Rate ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                      className="input"
                      placeholder="15.50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                All fields marked with * are required
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-theme-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Create Employee
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Employee Modal Component
interface EditEmployeeModalProps {
  employee: Employee;
  onClose: () => void;
  onSubmit: (updates: any) => Promise<void>;
}

function EditEmployeeModal({ employee, onClose, onSubmit }: EditEmployeeModalProps) {
  const [formData, setFormData] = useState({
    name: employee.name,
    email: employee.email,
    password: '',
    pin: employee.pin,
    role: employee.role,
    department: employee.department || '',
    shift: employee.shift || '',
    hourlyRate: employee.hourlyRate?.toString() || ''
  });
  const [permissions, setPermissions] = useState<EmployeePermission[]>(employee.permissions);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'permissions' | 'schedule'>('basic');

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

    if (formData.hourlyRate && isNaN(Number(formData.hourlyRate))) {
      toast.error('Hourly rate must be a valid number');
      return;
    }

    setLoading(true);
    try {
      const updates: any = {
        name: formData.name,
        email: formData.email,
        pin: formData.pin,
        role: formData.role,
        permissions,
        department: formData.department || undefined,
        shift: formData.shift || undefined,
        hourlyRate: formData.hourlyRate ? Number(formData.hourlyRate) : undefined
      };

      if (formData.password) {
        updates.password = formData.password;
      }

      await onSubmit(updates);
      onClose();
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

  const getCategoryPermissionCount = (category: string) => {
    const categoryModules = groupedModules[category] || [];
    const enabledCount = categoryModules.filter(module => 
      permissions.find(p => p.module === module.id)?.access
    ).length;
    return `${enabledCount}/${categoryModules.length}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900 flex items-center">
              <Edit className="w-6 h-6 mr-3 text-blue-600" />
              Edit Employee: {employee.name}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex space-x-6 mt-4">
            {[
              { id: 'basic', label: 'Basic Info', icon: User },
              { id: 'permissions', label: 'Permissions', icon: Shield },
              { id: 'schedule', label: 'Schedule & Pay', icon: Clock }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <label className="form-label">New Password (Optional)</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        className="input pr-10"
                        placeholder="Leave blank to keep current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                      maxLength={4}
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">Role *</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                      className="input"
                      required
                    >
                      <option value="staff">Staff</option>
                      <option value="cashier">Cashier</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="kitchen_manager">Kitchen Manager</option>
                      <option value="manager">Manager</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Department</label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value as any }))}
                      className="input"
                    >
                      <option value="">Select Department</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="service">Service</option>
                      <option value="management">Management</option>
                      <option value="finance">Finance</option>
                      <option value="marketing">Marketing</option>
                    </select>
                  </div>
                </div>

                {/* Employee Status */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <h6 className="font-medium text-gray-900 mb-3">Employee Status</h6>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className={`ml-2 font-medium ${employee.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Login:</span>
                      <span className="text-gray-900 ml-2 font-medium">
                        {employee.lastLoginAt ? new Date(employee.lastLoginAt).toLocaleDateString() : 'Never'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Created:</span>
                      <span className="text-gray-900 ml-2 font-medium">
                        {new Date(employee.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Permissions Tab */}
            {activeTab === 'permissions' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">Access Permissions</h4>
                    <p className="text-sm text-gray-600">
                      Modify what features and data this employee can access
                    </p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setAllPermissions(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Grant All
                    </button>
                    <button
                      type="button"
                      onClick={() => setAllPermissions(false)}
                      className="text-sm text-gray-600 hover:text-gray-800 font-medium"
                    >
                      Revoke All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {Object.entries(groupedModules).map(([category, modules]) => (
                    <div key={category} className="border rounded-xl p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-semibold text-gray-900 capitalize flex items-center">
                          {category === 'core' && <Zap className="w-4 h-4 mr-2 text-blue-600" />}
                          {category === 'management' && <Briefcase className="w-4 h-4 mr-2 text-purple-600" />}
                          {category === 'reports' && <TrendingUp className="w-4 h-4 mr-2 text-green-600" />}
                          {category === 'settings' && <Settings className="w-4 h-4 mr-2 text-orange-600" />}
                          {category === 'advanced' && <Target className="w-4 h-4 mr-2 text-red-600" />}
                          {category.replace('_', ' ')} Features
                        </h5>
                        <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded">
                          {getCategoryPermissionCount(category)}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {modules.map((module) => {
                          const permission = permissions.find(p => p.module === module.id);
                          const isHighRisk = module.riskLevel === 'high';
                          return (
                            <label key={module.id} className="flex items-start space-x-3 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={permission?.access || false}
                                onChange={() => togglePermission(module.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                              />
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                                    {module.name}
                                  </span>
                                  {isHighRisk && (
                                    <AlertTriangle className="w-3 h-3 text-red-500" title="High Risk Permission" />
                                  )}
                                  {module.requiresTraining && (
                                    <BookOpen className="w-3 h-3 text-orange-500" title="Requires Training" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {module.description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule & Pay Tab */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Work Schedule & Compensation</h4>
                  <p className="text-sm text-gray-600">
                    Update work schedule and compensation details
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="form-label">Work Shift</label>
                    <select
                      value={formData.shift}
                      onChange={(e) => setFormData(prev => ({ ...prev, shift: e.target.value as any }))}
                      className="input"
                    >
                      <option value="">Select Shift</option>
                      <option value="morning">Morning (6 AM - 2 PM)</option>
                      <option value="afternoon">Afternoon (2 PM - 10 PM)</option>
                      <option value="evening">Evening (6 PM - 2 AM)</option>
                      <option value="night">Night (10 PM - 6 AM)</option>
                      <option value="flexible">Flexible Hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Hourly Rate ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.hourlyRate}
                      onChange={(e) => setFormData(prev => ({ ...prev, hourlyRate: e.target.value }))}
                      className="input"
                      placeholder="15.50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Changes will be applied immediately
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-theme-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Update Employee
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
} 