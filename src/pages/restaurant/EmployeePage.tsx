import React, { useState, useEffect } from 'react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useRestaurantAuth } from '@/contexts/RestaurantAuthContext';
import { EmployeeService } from '@/services/employeeService';
import EmployeeManagement from '@/components/employee/EmployeeManagement';
import { Navigate } from 'react-router-dom';
import { 
  Users, 
  ArrowLeft, 
  User,
  Clock,
  TrendingUp,
  Activity,
  Shield,
  Calendar,
  Target,
  Award,
  CheckCircle,
  XCircle,
  PlayCircle,
  StopCircle,
  BarChart3,
  Timer,
  Star,
  LogIn,
  LogOut,
  Settings,
  FileText,
  Bell,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function EmployeePage() {
  const { restaurant } = useRestaurant();
  const { user } = useRestaurantAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'performance' | 'shifts' | 'profile'>('dashboard');
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [shiftStatus, setShiftStatus] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurant && user && user.role !== 'owner') {
      fetchEmployeeData();
      fetchShiftStatus();
      fetchPerformanceData();
      fetchActivityData();
    }
    setLoading(false);
  }, [restaurant, user]);

  const fetchEmployeeData = async () => {
    if (!restaurant || !user) return;
    
    try {
      const result = await EmployeeService.getEmployees(restaurant.id);
      if (result.success && result.data) {
        const employee = result.data.find(emp => emp.email === user.email);
        setEmployeeData(employee);
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
  };

  const fetchShiftStatus = async () => {
    if (!restaurant || !user || !employeeData) return;
    
    try {
      const result = await EmployeeService.getCurrentShiftStatus(employeeData.id, restaurant.id);
      if (result.success) {
        setShiftStatus(result.data);
      }
    } catch (error) {
      console.error('Error fetching shift status:', error);
    }
  };

  const fetchPerformanceData = async () => {
    if (!restaurant || !user || !employeeData) return;
    
    try {
      const dateRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        end: new Date()
      };
      const result = await EmployeeService.getEmployeePerformance(employeeData.id, restaurant.id, dateRange);
      if (result.success) {
        setPerformanceData(result.data);
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
    }
  };

  const fetchActivityData = async () => {
    if (!restaurant || !user || !employeeData) return;
    
    try {
      const result = await EmployeeService.getEmployeeActivity(employeeData.id, restaurant.id, 20);
      if (result.success) {
        setActivityData(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching activity data:', error);
    }
  };

  const handleClockIn = async () => {
    if (!restaurant || !employeeData) return;
    
    try {
      const result = await EmployeeService.clockIn(employeeData.id, restaurant.id);
      if (result.success) {
        toast.success('Clocked in successfully!');
        fetchShiftStatus();
      } else {
        toast.error(result.error || 'Failed to clock in');
      }
    } catch (error) {
      console.error('Error clocking in:', error);
      toast.error('Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    if (!restaurant || !employeeData) return;
    
    try {
      const result = await EmployeeService.clockOut(employeeData.id, restaurant.id);
      if (result.success) {
        toast.success(`Clocked out successfully! Total hours: ${result.data?.totalHours?.toFixed(2) || 0}`);
        fetchShiftStatus();
      } else {
        toast.error(result.error || 'Failed to clock out');
      }
    } catch (error) {
      console.error('Error clocking out:', error);
      toast.error('Failed to clock out');
    }
  };

  // Redirect non-authenticated users
  if (!user) {
    return <Navigate to={`/${restaurant?.slug}/login`} replace />;
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Restaurant Not Found</h2>
          <p className="text-gray-600">Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  // Owner view - full employee management
  if (user.role === 'owner') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
        {/* Header */}
        <div className="bg-white border-b shadow-sm">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-2 sm:space-x-4">
                <Link
                  to={`/${restaurant.slug}`}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Back to Dashboard</span>
                  <span className="sm:hidden">Back</span>
                </Link>
                <div className="h-4 sm:h-6 w-px bg-gray-300" />
                <div className="flex items-center">
                  <Users className="w-5 h-5 text-blue-600 mr-1 sm:mr-2" />
                  <h1 className="text-sm sm:text-lg font-semibold text-gray-900">Employee Management</h1>
                </div>
              </div>
              
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                  {restaurant.name}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
          <EmployeeManagement />
        </main>
      </div>
    );
  }

  // Employee view - personal dashboard
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link
                to={`/${restaurant.slug}`}
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </Link>
              <div className="h-4 sm:h-6 w-px bg-gray-300" />
              <div className="flex items-center">
                <User className="w-5 h-5 text-blue-600 mr-1 sm:mr-2" />
                <h1 className="text-sm sm:text-lg font-semibold text-gray-900">
                  <span className="hidden sm:inline">My Employee Dashboard</span>
                  <span className="sm:hidden">Dashboard</span>
                </h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="text-xs sm:text-sm text-gray-600 hidden md:block">
                Welcome, {user.name}
              </div>
              {shiftStatus?.isClocked ? (
                <button
                  onClick={handleClockOut}
                  className="bg-red-100 text-red-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium flex items-center"
                >
                  <StopCircle className="w-3 sm:w-4 h-3 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Clock Out</span>
                  <span className="sm:hidden">Out</span>
                </button>
              ) : (
                <button
                  onClick={handleClockIn}
                  className="bg-green-100 text-green-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium flex items-center"
                >
                  <PlayCircle className="w-3 sm:w-4 h-3 sm:h-4 mr-1" />
                  <span className="hidden sm:inline">Clock In</span>
                  <span className="sm:hidden">In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Quick Status Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg sm:rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Shift Status</p>
                  <p className={`text-sm sm:text-lg lg:text-xl font-bold ${shiftStatus?.isClocked ? 'text-green-600' : 'text-gray-600'}`}>
                    <span className="hidden sm:inline">
                      {shiftStatus?.isClocked ? 'Clocked In' : 'Not Clocked In'}
                    </span>
                    <span className="sm:hidden">
                      {shiftStatus?.isClocked ? 'In' : 'Out'}
                    </span>
                  </p>
                  {shiftStatus?.isClocked && (
                    <p className="text-xs text-gray-500">
                      {shiftStatus.shift?.currentHours?.toFixed(1) || 0}h today
                    </p>
                  )}
                </div>
                <div className={`p-2 sm:p-3 rounded-lg ${shiftStatus?.isClocked ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {shiftStatus?.isClocked ? (
                    <Timer className="w-4 sm:w-5 lg:w-6 h-4 sm:h-5 lg:h-6 text-green-600" />
                  ) : (
                    <Clock className="w-4 sm:w-5 lg:w-6 h-4 sm:h-5 lg:h-6 text-gray-600" />
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg sm:rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Role</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-blue-600 capitalize">{user.role}</p>
                  <p className="text-xs text-gray-500">
                    {employeeData?.permissions?.filter((p: any) => p.access).length || 0} perms
                  </p>
                </div>
                <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                  <Shield className="w-4 sm:w-5 lg:w-6 h-4 sm:h-5 lg:h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg sm:rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">This Month</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-purple-600">
                    {performanceData?.totalOrders || 0}
                    <span className="hidden sm:inline"> orders</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    ₹{performanceData?.totalRevenue?.toFixed(0) || 0}
                    <span className="hidden sm:inline"> revenue</span>
                  </p>
                </div>
                <div className="p-2 sm:p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-4 sm:w-5 lg:w-6 h-4 sm:h-5 lg:h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-3 sm:p-4 lg:p-6 rounded-lg sm:rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-600">Performance</p>
                  <p className="text-sm sm:text-lg lg:text-xl font-bold text-green-600">
                    {performanceData?.completionRate?.toFixed(0) || 0}%
                  </p>
                  <p className="text-xs text-gray-500">
                    <span className="hidden sm:inline">Completion rate</span>
                    <span className="sm:hidden">Success</span>
                  </p>
                </div>
                <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                  <Target className="w-4 sm:w-5 lg:w-6 h-4 sm:h-5 lg:h-6 text-green-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="border-b border-gray-200">
              <nav className="flex overflow-x-auto px-3 sm:px-6" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`
                  nav::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                {[
                  { id: 'dashboard', name: 'Dashboard', icon: BarChart3 },
                  { id: 'performance', name: 'Performance', icon: TrendingUp },
                  { id: 'shifts', name: 'Shifts', icon: Clock },
                  { id: 'profile', name: 'Profile', icon: Settings }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center whitespace-nowrap px-1 py-3 sm:py-4 text-xs sm:text-sm font-medium border-b-2 transition-colors mr-4 sm:mr-8 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <tab.icon className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">{tab.name}</span>
                    <span className="sm:hidden">
                      {tab.name === 'Dashboard' ? 'Home' : 
                       tab.name === 'Performance' ? 'Stats' : 
                       tab.name === 'Shifts' ? 'Time' : 'Me'}
                    </span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-3 sm:p-4 lg:p-6">
              {/* Dashboard Tab */}
              {activeTab === 'dashboard' && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Today's Performance */}
                    <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
                        <Target className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-blue-600" />
                        Today's Performance
                      </h3>
                      <div className="space-y-3 sm:space-y-4">
                        {performanceData ? (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-xs sm:text-sm text-gray-600">Orders Handled</span>
                              <span className="text-sm sm:text-lg font-semibold">{performanceData.totalOrders}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs sm:text-sm text-gray-600">Revenue Generated</span>
                              <span className="text-sm sm:text-lg font-semibold">₹{performanceData.totalRevenue?.toFixed(2) || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs sm:text-sm text-gray-600">Average Order Value</span>
                              <span className="text-sm sm:text-lg font-semibold">₹{performanceData.averageOrderValue?.toFixed(2) || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs sm:text-sm text-gray-600">Success Rate</span>
                              <span className="text-sm sm:text-lg font-semibold text-green-600">
                                {performanceData.completionRate?.toFixed(1) || 0}%
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-4">
                            <AlertCircle className="w-6 sm:w-8 h-6 sm:h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-xs sm:text-sm text-gray-500">No performance data available</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
                        <Activity className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-green-600" />
                        Recent Activity
                      </h3>
                      <div className="space-y-2 sm:space-y-3 max-h-48 sm:max-h-64 overflow-y-auto">
                        {activityData.length > 0 ? (
                          activityData.slice(0, 5).map((activity, index) => (
                            <div key={index} className="flex items-start space-x-2 sm:space-x-3 p-2 sm:p-3 bg-white rounded-lg">
                              <div className="w-5 sm:w-6 h-5 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Activity className="w-2 sm:w-3 h-2 sm:h-3 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                                  {activity.action.replace(/_/g, ' ')}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {activity.timestamp?.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4">
                            <FileText className="w-6 sm:w-8 h-6 sm:h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-xs sm:text-sm text-gray-500">No recent activity</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center">
                      <Star className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-blue-600" />
                      Quick Actions
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      {shiftStatus?.isClocked ? (
                        <button
                          onClick={handleClockOut}
                          className="flex items-center justify-center p-3 sm:p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                        >
                          <StopCircle className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-red-600" />
                          <span className="text-sm sm:text-base font-medium">Clock Out</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleClockIn}
                          className="flex items-center justify-center p-3 sm:p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                        >
                          <PlayCircle className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-green-600" />
                          <span className="text-sm sm:text-base font-medium">Clock In</span>
                        </button>
                      )}
                      <button
                        onClick={() => setActiveTab('performance')}
                        className="flex items-center justify-center p-3 sm:p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                      >
                        <TrendingUp className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-blue-600" />
                        <span className="text-sm sm:text-base font-medium">
                          <span className="hidden sm:inline">View Performance</span>
                          <span className="sm:hidden">Performance</span>
                        </span>
                      </button>
                      <button
                        onClick={() => setActiveTab('shifts')}
                        className="flex items-center justify-center p-3 sm:p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow"
                      >
                        <Calendar className="w-4 sm:w-5 h-4 sm:h-5 mr-2 text-purple-600" />
                        <span className="text-sm sm:text-base font-medium">
                          <span className="hidden sm:inline">My Shifts</span>
                          <span className="sm:hidden">Shifts</span>
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && (
                <div className="space-y-4 sm:space-y-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">My Performance Analytics</h3>
                  
                  {performanceData ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-center">
                          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600">{performanceData.totalOrders}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Total Orders</div>
                        </div>
                      </div>
                      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-center">
                          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">₹{performanceData.totalRevenue?.toFixed(0) || 0}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Revenue Generated</div>
                        </div>
                      </div>
                      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-center">
                          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600">₹{performanceData.averageOrderValue?.toFixed(0) || 0}</div>
                          <div className="text-xs sm:text-sm text-gray-600">Avg Order Value</div>
                        </div>
                      </div>
                      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                        <div className="text-center">
                          <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">{performanceData.completionRate?.toFixed(1) || 0}%</div>
                          <div className="text-xs sm:text-sm text-gray-600">Success Rate</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12">
                      <AlertCircle className="w-8 sm:w-12 h-8 sm:h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Performance Data</h3>
                      <p className="text-sm sm:text-base text-gray-600">Start taking orders to see your performance metrics.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Shifts Tab */}
              {activeTab === 'shifts' && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">My Shifts</h3>
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      {shiftStatus?.isClocked ? (
                        <span className="bg-green-100 text-green-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium flex items-center">
                          <PlayCircle className="w-3 sm:w-4 h-3 sm:h-4 mr-1" />
                          <span className="hidden sm:inline">Currently Clocked In</span>
                          <span className="sm:hidden">Active</span>
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium">
                          <span className="hidden sm:inline">Not Clocked In</span>
                          <span className="sm:hidden">Inactive</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {shiftStatus?.isClocked && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 sm:p-6">
                      <h4 className="text-base sm:text-lg font-semibold text-green-900 mb-3 sm:mb-4">Current Shift</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        <div className="text-center">
                          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
                            {shiftStatus.shift?.clockInTime?.toLocaleTimeString() || 'N/A'}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Clock In Time</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600">
                            {shiftStatus.shift?.currentHours?.toFixed(1) || 0} hrs
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Hours Worked</div>
                        </div>
                        <div className="text-center sm:col-span-2 lg:col-span-1">
                          <button
                            onClick={handleClockOut}
                            className="w-full sm:w-auto bg-red-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base"
                          >
                            Clock Out
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {!shiftStatus?.isClocked && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 sm:p-6 text-center">
                      <h4 className="text-base sm:text-lg font-semibold text-blue-900 mb-3 sm:mb-4">Ready to Start Your Shift?</h4>
                      <button
                        onClick={handleClockIn}
                        className="bg-blue-600 text-white px-6 sm:px-8 py-2 sm:py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center mx-auto text-sm sm:text-base"
                      >
                        <PlayCircle className="w-4 sm:w-5 h-4 sm:h-5 mr-2" />
                        Clock In Now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Profile Tab */}
              {activeTab === 'profile' && (
                <div className="space-y-4 sm:space-y-6">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900">My Profile</h3>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                      <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Personal Information</h4>
                      <div className="space-y-3 sm:space-y-4">
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700">Name</label>
                          <div className="mt-1 text-sm sm:text-base text-gray-900">{user.name}</div>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700">Email</label>
                          <div className="mt-1 text-sm sm:text-base text-gray-900 break-all">{user.email}</div>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700">Role</label>
                          <div className="mt-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              user.role === 'manager' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {user.role === 'manager' ? (
                                <Shield className="w-3 h-3 mr-1" />
                              ) : (
                                <User className="w-3 h-3 mr-1" />
                              )}
                              {user.role}
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-gray-700">PIN</label>
                          <div className="mt-1 text-sm sm:text-base text-gray-900">****</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200">
                      <h4 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">My Permissions</h4>
                      <div className="space-y-2 max-h-48 sm:max-h-64 overflow-y-auto">
                        {employeeData?.permissions?.filter((p: any) => p.access).map((permission: any, index: number) => (
                          <div key={index} className="flex items-center p-2 sm:p-3 bg-green-50 rounded-lg">
                            <CheckCircle className="w-3 sm:w-4 h-3 sm:h-4 text-green-600 mr-2 flex-shrink-0" />
                            <span className="text-xs sm:text-sm text-gray-900">{permission.module.replace(/_/g, ' ')}</span>
                          </div>
                        )) || (
                          <div className="text-center py-4">
                            <XCircle className="w-6 sm:w-8 h-6 sm:h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-xs sm:text-sm text-gray-500">No permissions assigned</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 